import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Unit tests: Resend is never reached — fetch is stubbed. The API key is a dummy.
vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: 'test-dummy-key',
    FA_FROM_EMAIL: 'FjordAnglers <contact@fjordanglers.com>',
  },
}))

import { sendPasswordResetEmail, sendInquiryReceivedAnglerEmail } from './email'

const RESEND_URL = 'https://api.resend.com/emails'
const ANGLER = 'Jan Kowalski'
const TO = 'jan.kowalski@example.com'

let fetchMock: ReturnType<typeof vi.fn>
let infoSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  delete process.env.RESEND_DEV_FAKE
  fetchMock = vi.fn(async () => new Response('{"id":"re_test"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.RESEND_DEV_FAKE
})

describe('sendEmail with RESEND_DEV_FAKE=1', () => {
  beforeEach(() => {
    process.env.RESEND_DEV_FAKE = '1'
  })

  it('password reset: does not call Resend, logs type and masked recipient only', async () => {
    await sendPasswordResetEmail({ to: TO, resetUrl: 'https://example.test/reset?token=secret' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const line = String(infoSpy.mock.calls[0]?.[0])
    expect(line).toContain('type=PasswordResetEmail')
    expect(line).toContain('j***@example.com')
    expect(line).not.toContain(TO)
    expect(line).not.toContain('secret')
  })

  it('inquiry confirmation to angler: does not call Resend, no angler name in the log', async () => {
    await sendInquiryReceivedAnglerEmail({
      to: TO,
      anglerName: ANGLER,
      tripTitle: 'Lofoten Salmon',
      requestedDates: ['2026-07-01'],
      partySize: 2,
      inquiryId: 'inq-1',
      replyByDate: 'Tuesday, 15 September',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    const line = String(infoSpy.mock.calls[0]?.[0])
    expect(line).toContain('type=InquiryReceivedAnglerEmail')
    expect(line).not.toContain(ANGLER)
    expect(line).not.toContain('Lofoten')
  })
})

describe('sendEmail without RESEND_DEV_FAKE (production path)', () => {
  it('password reset: calls Resend once with the expected body', async () => {
    await sendPasswordResetEmail({ to: TO, resetUrl: 'https://example.test/reset' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(RESEND_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-dummy-key')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.from).toBe('FjordAnglers <contact@fjordanglers.com>')
    expect(body.to).toBe(TO)
    expect(body.subject).toBe('Reset your FjordAnglers password')
    expect(typeof body.html).toBe('string')
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('inquiry confirmation to angler: calls Resend once with the expected subject', async () => {
    await sendInquiryReceivedAnglerEmail({
      to: TO,
      anglerName: ANGLER,
      tripTitle: 'Lofoten Salmon',
      requestedDates: ['2026-07-01'],
      partySize: 2,
      inquiryId: 'inq-1',
      replyByDate: 'Tuesday, 15 September',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(RESEND_URL)
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.to).toBe(TO)
    expect(body.subject).toBe('Inquiry received — Lofoten Salmon')
  })
})

// ─── FA-M.15: retry with one Idempotency-Key per logical send ─────────────────

describe('sendEmail retry (FA-M.15)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** The prod failure of 2026-11-27: undici's TypeError with the socket error as cause. */
  function econnreset(): TypeError {
    const cause = Object.assign(
      new Error('Client network socket disconnected before secure TLS connection was established'),
      { code: 'ECONNRESET' },
    )
    return new TypeError('fetch failed', { cause })
  }

  function keyOf(call: unknown[]): string | undefined {
    const init = call[1] as RequestInit
    return (init.headers as Record<string, string>)['Idempotency-Key']
  }

  /** Runs the send while letting the backoff timers fire; resolves to the error, or null. */
  async function run(): Promise<Error | null> {
    const done = (async (): Promise<Error | null> => {
      try {
        await sendPasswordResetEmail({ to: TO, resetUrl: 'https://example.test/reset' })
        return null
      } catch (err) {
        return err as Error
      }
    })()
    await vi.runAllTimersAsync()
    return done
  }

  it('ECONNRESET once, then 200 → one successful send, two fetch calls, same Idempotency-Key', async () => {
    fetchMock
      .mockRejectedValueOnce(econnreset())
      .mockResolvedValueOnce(new Response('{"id":"re_ok"}', { status: 200 }))

    expect(await run()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = fetchMock.mock.calls
    expect(keyOf(first!)).toMatch(/^[0-9a-f-]{36}$/)
    expect(keyOf(second!)).toBe(keyOf(first!))
  })

  it('two logical sends get two different keys', async () => {
    await run()
    await run()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(keyOf(fetchMock.mock.calls[0]!)).not.toBe(keyOf(fetchMock.mock.calls[1]!))
  })

  it('HTTP 400 → no retry, throws after one call', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"bad"}', { status: 400 }))

    const err = await run()
    expect(err?.message).toContain('Resend HTTP 400')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('HTTP 503 three times → throws after 3 calls, same key on all three', async () => {
    fetchMock.mockImplementation(async () => new Response('unavailable', { status: 503 }))

    const err = await run()
    expect(err?.message).toContain('Resend HTTP 503')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const keys = fetchMock.mock.calls.map(keyOf)
    expect(new Set(keys).size).toBe(1)
  })

  it('HTTP 429 then 200 → retried once', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"id":"re_ok"}', { status: 200 }))

    expect(await run()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('network error three times → rethrows the network error after 3 calls', async () => {
    fetchMock.mockImplementation(async () => { throw econnreset() })

    const err = await run()
    expect(err).toBeInstanceOf(TypeError)
    expect(err?.message).toBe('fetch failed')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('a non-network error from fetch → not retried', async () => {
    fetchMock.mockRejectedValueOnce(new RangeError('something else'))

    const err = await run()
    expect(err).toBeInstanceOf(RangeError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('RESEND_DEV_FAKE=1 → still no fetch at all', async () => {
    process.env.RESEND_DEV_FAKE = '1'
    expect(await run()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
