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
