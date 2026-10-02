/**
 * FA-1.41 — Upstash adapter wiring, on mocked libraries (never a real Upstash).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const m = vi.hoisted(() => ({
  limit:       vi.fn(),
  fixedWindow: vi.fn(),
  ctor:        vi.fn(),
  redisCtor:   vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor(opts: unknown) { m.ctor(opts) }
    limit(key: string) { return m.limit(key) }
    static fixedWindow(max: number, window: string) {
      m.fixedWindow(max, window)
      return { kind: 'fixed', max, window }
    }
  }
  return { Ratelimit }
})

vi.mock('@upstash/redis', () => {
  class Redis {
    constructor(opts: unknown) { m.redisCtor(opts) }
  }
  return { Redis }
})

import { createUpstashLimiter } from '@/lib/rate-limit/upstash'

const NOW = 1_800_000_000_000

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createUpstashLimiter', () => {
  it('uses a fixed window of exactly the rule window, so the counter TTL equals the window', async () => {
    m.limit.mockResolvedValue({ success: true, reset: NOW + 600_000 })
    const limiter = createUpstashLimiter('https://example.upstash.io', 'token')

    await limiter.limit('k1', { max: 5, windowSec: 600 })

    expect(m.redisCtor).toHaveBeenCalledWith({ url: 'https://example.upstash.io', token: 'token' })
    expect(m.fixedWindow).toHaveBeenCalledWith(5, '600 s')
    expect(m.limit).toHaveBeenCalledWith('k1')
  })

  it('builds one Ratelimit per rule and reuses it', async () => {
    m.limit.mockResolvedValue({ success: true, reset: NOW + 1000 })
    const limiter = createUpstashLimiter('https://example.upstash.io', 'token')

    await limiter.limit('a', { max: 5, windowSec: 600 })
    await limiter.limit('b', { max: 5, windowSec: 600 })
    await limiter.limit('c', { max: 3, windowSec: 3600 })

    expect(m.ctor).toHaveBeenCalledTimes(2)
  })

  it('maps success and reset to allowed and whole-second retry-after (min 1)', async () => {
    const limiter = createUpstashLimiter('https://example.upstash.io', 'token')

    m.limit.mockResolvedValueOnce({ success: false, reset: NOW + 90_500 })
    expect(await limiter.limit('k', { max: 1, windowSec: 600 })).toEqual({ allowed: false, retryAfterSec: 91 })

    m.limit.mockResolvedValueOnce({ success: false, reset: NOW + 10 })
    expect((await limiter.limit('k', { max: 1, windowSec: 600 })).retryAfterSec).toBe(1)

    m.limit.mockResolvedValueOnce({ success: true, reset: NOW + 60_000 })
    expect((await limiter.limit('k', { max: 1, windowSec: 600 })).allowed).toBe(true)
  })

  it('a Redis timeout lets the request through and is logged without the key', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    m.limit.mockResolvedValue({ success: true, reset: NOW + 1000, reason: 'timeout' })
    const limiter = createUpstashLimiter('https://example.upstash.io', 'token')

    expect((await limiter.limit('secret-key', { max: 1, windowSec: 60 })).allowed).toBe(true)
    expect(error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret-key')
  })

  it('lets a Redis error propagate so the caller can fail open and log it', async () => {
    m.limit.mockRejectedValue(new Error('network down'))
    const limiter = createUpstashLimiter('https://example.upstash.io', 'token')

    await expect(limiter.limit('k', { max: 1, windowSec: 60 })).rejects.toThrow('network down')
  })
})
