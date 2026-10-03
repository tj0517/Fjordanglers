/**
 * FA-1.41 supplement — the limiter cannot be created (O-29 a, fail-open).
 *
 * Runs against the real @upstash/redis constructor (no network: it only validates
 * the URL). 1.39.0 throws UrlError for `rediss://…`, a stray space or a missing
 * scheme, and the error message embeds the received URL — credentials included.
 * Creation failure must mean "no limiter": null, no throw, one fixed log line
 * with no error text, and the outcome cached so it does not repeat per request.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  UPSTASH_REDIS_REST_URL:   undefined as string | undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined as string | undefined,
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

const FIXED_MESSAGE = '[rate-limit] could not create limiter, running without a limit'
const TOKEN         = 'fake-token-value'

async function freshFactory() {
  vi.resetModules()
  return import('@/lib/rate-limit/factory')
}

beforeEach(() => {
  mockEnv.UPSTASH_REDIS_REST_URL   = undefined
  mockEnv.UPSTASH_REDIS_REST_TOKEN = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getRateLimiter', () => {
  it('returns null and logs nothing when the variables are not set', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getRateLimiter } = await freshFactory()

    expect(getRateLimiter()).toBeNull()
    expect(error).not.toHaveBeenCalled()
  })

  it('returns null when only the URL is set', async () => {
    mockEnv.UPSTASH_REDIS_REST_URL = 'https://fake-host.upstash.io'
    const { getRateLimiter } = await freshFactory()

    expect(getRateLimiter()).toBeNull()
  })

  it('creates a limiter for a valid https URL (no network call at creation)', async () => {
    mockEnv.UPSTASH_REDIS_REST_URL   = 'https://fake-host.upstash.io'
    mockEnv.UPSTASH_REDIS_REST_TOKEN = TOKEN
    const { getRateLimiter } = await freshFactory()

    expect(getRateLimiter()).not.toBeNull()
  })

  it.each([
    ['a rediss:// connection string', 'rediss://default:fake-secret-pw@fake-host.upstash.io:6379'],
    ['a leading space',               ' https://fake-host.upstash.io'],
    ['a trailing space',              'https://fake-host.upstash.io '],
    ['a missing scheme',              'fake-host.upstash.io'],
  ])('creation fails on %s → no limiter, no throw, one fixed log line without the URL or token', async (_name, url) => {
    mockEnv.UPSTASH_REDIS_REST_URL   = url
    mockEnv.UPSTASH_REDIS_REST_TOKEN = TOKEN
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getRateLimiter } = await freshFactory()

    expect(() => getRateLimiter()).not.toThrow()
    expect(getRateLimiter()).toBeNull()

    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]).toEqual([FIXED_MESSAGE])
    const logged = JSON.stringify(error.mock.calls)
    expect(logged).not.toContain(url)
    expect(logged).not.toContain('fake-host')
    expect(logged).not.toContain('fake-secret-pw')
    expect(logged).not.toContain(TOKEN)
    expect(logged).not.toContain('UrlError')
  })

  it('caches the failed outcome: later calls neither retry creation nor log again', async () => {
    mockEnv.UPSTASH_REDIS_REST_URL   = 'rediss://default:fake-secret-pw@fake-host.upstash.io:6379'
    mockEnv.UPSTASH_REDIS_REST_TOKEN = TOKEN
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getRateLimiter } = await freshFactory()

    for (let i = 0; i < 5; i++) expect(getRateLimiter()).toBeNull()
    expect(error).toHaveBeenCalledTimes(1)
  })
})
