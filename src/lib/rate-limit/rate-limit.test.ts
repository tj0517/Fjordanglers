/**
 * FA-1.41 — inquiry rate limit: key hashing, thresholds, missing-header and
 * fail-open behaviour, in-memory adapter. No network, no Upstash.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  RATE_LIMIT_SALT: 'salt-one' as string | undefined,
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

const getRateLimiterMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rate-limit/factory', () => ({ getRateLimiter: getRateLimiterMock }))

import { createMemoryLimiter } from '@/lib/rate-limit/memory'
import type { RateLimiter } from '@/lib/rate-limit/types'
import {
  INQUIRY_LIMITS,
  clientIpFromHeaders,
  checkIpLimit,
  checkEmailLimit,
} from '@/lib/rate-limit/inquiries'

const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/
const IPV6_PATTERN = /(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}|::/i

const NOW = 1_800_000_000_000

function spyLimiter(now: () => number = () => NOW) {
  const inner = createMemoryLimiter(now)
  const limit = vi.fn(inner.limit)
  const limiter: RateLimiter = { limit }
  return { limiter, limit }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.RATE_LIMIT_SALT = 'salt-one'
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('INQUIRY_LIMITS', () => {
  it('starts at 5 requests / 10 min per IP and 3 requests / hour per e-mail', () => {
    expect(INQUIRY_LIMITS.ip).toEqual({ max: 5, windowSec: 600 })
    expect(INQUIRY_LIMITS.email).toEqual({ max: 3, windowSec: 3600 })
  })
})

describe('createMemoryLimiter', () => {
  it('allows `max` requests per window, then blocks with a positive retry-after', async () => {
    const limiter = createMemoryLimiter(() => NOW)
    const rule = { max: 2, windowSec: 60 }
    expect((await limiter.limit('k', rule)).allowed).toBe(true)
    expect((await limiter.limit('k', rule)).allowed).toBe(true)
    const third = await limiter.limit('k', rule)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(third.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('counts keys independently and starts over in the next window', async () => {
    let now = NOW
    const limiter = createMemoryLimiter(() => now)
    const rule = { max: 1, windowSec: 60 }
    expect((await limiter.limit('a', rule)).allowed).toBe(true)
    expect((await limiter.limit('a', rule)).allowed).toBe(false)
    expect((await limiter.limit('b', rule)).allowed).toBe(true)
    now += 60_000
    expect((await limiter.limit('a', rule)).allowed).toBe(true)
  })
})

describe('clientIpFromHeaders', () => {
  it('reads cf-connecting-ip and trims it', () => {
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': ' 203.0.113.9 ' }))).toBe('203.0.113.9')
  })

  it('lowercases IPv6', () => {
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': '2001:DB8::1' }))).toBe('2001:db8::1')
  })

  it('ignores x-forwarded-for and x-real-ip (they carry the Cloudflare edge IP)', () => {
    const h = new Headers({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' })
    expect(clientIpFromHeaders(h)).toBeNull()
  })

  it('returns null when the header is missing or not an IP address', () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull()
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': 'not-an-ip' }))).toBeNull()
    expect(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': '1.2.3.4, 5.6.7.8' }))).toBeNull()
  })
})

describe('checkIpLimit / checkEmailLimit — thresholds', () => {
  it('blocks the 6th request from one IP and reports retry-after', async () => {
    getRateLimiterMock.mockReturnValue(spyLimiter().limiter)
    for (let i = 0; i < 5; i++) {
      expect(await checkIpLimit('203.0.113.9')).toEqual({ blocked: false })
    }
    const sixth = await checkIpLimit('203.0.113.9')
    expect(sixth.blocked).toBe(true)
    if (sixth.blocked) {
      expect(sixth.retryAfterSec).toBeGreaterThanOrEqual(1)
      expect(sixth.retryAfterSec).toBeLessThanOrEqual(600)
    }
  })

  it('blocks the 4th request for one e-mail, whatever its case', async () => {
    getRateLimiterMock.mockReturnValue(spyLimiter().limiter)
    expect((await checkEmailLimit('Anna@Example.com')).blocked).toBe(false)
    expect((await checkEmailLimit('anna@example.com')).blocked).toBe(false)
    expect((await checkEmailLimit('ANNA@EXAMPLE.COM')).blocked).toBe(false)
    expect((await checkEmailLimit('anna@Example.com')).blocked).toBe(true)
  })

  it('passes the configured rule to the adapter (the adapter sets TTL = windowSec)', async () => {
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)
    await checkIpLimit('203.0.113.9')
    await checkEmailLimit('anna@example.com')
    expect(limit.mock.calls[0][1]).toEqual(INQUIRY_LIMITS.ip)
    expect(limit.mock.calls[1][1]).toEqual(INQUIRY_LIMITS.email)
  })
})

describe('checkIpLimit / checkEmailLimit — privacy of counter keys', () => {
  const IP = '203.0.113.42'
  const IPV6 = '2001:db8:85a3::8a2e:370:7334'
  const EMAIL = 'Anna.Test@Example.com'

  it('keys contain no @, no IPv4/IPv6 pattern and nothing from the raw values', async () => {
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)

    await checkIpLimit(IP)
    await checkIpLimit(IPV6)
    await checkEmailLimit(EMAIL)

    expect(limit).toHaveBeenCalledTimes(3)
    for (const [key] of limit.mock.calls) {
      expect(key).not.toContain('@')
      expect(key).not.toMatch(IPV4_PATTERN)
      expect(key).not.toMatch(IPV6_PATTERN)
      expect(key).not.toContain('203.0.113')
      expect(key.toLowerCase()).not.toContain('anna')
      expect(key.toLowerCase()).not.toContain('example')
    }
  })

  it('is deterministic per value, differs per salt and per kind', async () => {
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)

    await checkIpLimit(IP)
    await checkIpLimit(IP)
    mockEnv.RATE_LIMIT_SALT = 'salt-two'
    await checkIpLimit(IP)

    const [a, b, c] = limit.mock.calls.map(call => call[0])
    expect(a).toBe(b)
    expect(c).not.toBe(a)

    // same text as IP and as e-mail must not share a counter
    mockEnv.RATE_LIMIT_SALT = 'salt-one'
    limit.mockClear()
    await checkIpLimit('203.0.113.1')
    await checkEmailLimit('203.0.113.1')
    expect(limit.mock.calls[0][0]).not.toBe(limit.mock.calls[1][0])
  })
})

describe('checkIpLimit — missing client IP (decision 2, fail-open for the IP dimension)', () => {
  it('skips the IP check without calling the adapter; no warning outside production', async () => {
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkIpLimit(null)).toEqual({ blocked: false })
    expect(limit).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('in production logs a warning that carries no personal data', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkIpLimit(null)).toEqual({ blocked: false })
    expect(limit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/cf-connecting-ip/i)
  })

  it('with the header present there is no warning even in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    getRateLimiterMock.mockReturnValue(spyLimiter().limiter)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await checkIpLimit('203.0.113.9')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('checkIpLimit / checkEmailLimit — limiter off or failing (O-29 a, fail-open)', () => {
  it('limiter not configured → not blocked, silent outside production', async () => {
    getRateLimiterMock.mockReturnValue(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await checkIpLimit('203.0.113.9')).toEqual({ blocked: false })
    expect(await checkEmailLimit('anna@example.com')).toEqual({ blocked: false })
    expect(warn).not.toHaveBeenCalled()
  })

  it('limiter not configured in production → a warning, no personal data', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    getRateLimiterMock.mockReturnValue(null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await checkEmailLimit('anna@example.com')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('anna')
  })

  it('missing RATE_LIMIT_SALT disables the limiter: never hash without a salt', async () => {
    mockEnv.RATE_LIMIT_SALT = undefined
    const { limiter, limit } = spyLimiter()
    getRateLimiterMock.mockReturnValue(limiter)

    expect(await checkIpLimit('203.0.113.9')).toEqual({ blocked: false })
    expect(await checkEmailLimit('anna@example.com')).toEqual({ blocked: false })
    expect(limit).not.toHaveBeenCalled()
  })

  it('adapter throws → not blocked; the logged error carries no IP and no e-mail', async () => {
    getRateLimiterMock.mockReturnValue({
      limit: vi.fn().mockRejectedValue(new Error('upstash unreachable')),
    } satisfies RateLimiter)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await checkIpLimit('203.0.113.9')).toEqual({ blocked: false })
    expect(await checkEmailLimit('anna@example.com')).toEqual({ blocked: false })

    expect(error).toHaveBeenCalledTimes(2)
    const logged = JSON.stringify(error.mock.calls)
    expect(logged).toContain('upstash unreachable')
    expect(logged).not.toContain('203.0.113.9')
    expect(logged).not.toContain('anna')
    expect(logged).not.toContain('example.com')
  })
})
