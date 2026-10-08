import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Unit tests: Resend is never reached — fetch is stubbed. The API key is a dummy.
vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: 'test-dummy-key',
    FA_FROM_EMAIL: 'FjordAnglers <contact@fjordanglers.com>',
  },
}))

import { emailAdapter } from './email'

const TO = 'jan.kowalski@example.com'

let fetchMock: ReturnType<typeof vi.fn>
let infoSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  delete process.env.RESEND_DEV_FAKE
  process.env.RESEND_API_KEY = 'test-dummy-key'
  fetchMock = vi.fn(async () => new Response('{"id":"re_test_123"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.RESEND_DEV_FAKE
})

describe('channels/email adapter with RESEND_DEV_FAKE=1', () => {
  it('returns a fake result and never calls Resend', async () => {
    process.env.RESEND_DEV_FAKE = '1'

    const result = await emailAdapter.send({ to: TO, subject: 'Hi', body: 'Hello' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.externalId).toMatch(/^fake-/)
    expect(result.threadKey).toMatch(/@dev\.fjordanglers\.com>$/)
    const line = String(infoSpy.mock.calls[0]?.[0])
    expect(line).toContain('type=channel message')
    expect(line).not.toContain(TO)
  })
})

describe('channels/email adapter without RESEND_DEV_FAKE', () => {
  it('calls Resend once with the expected body and returns the Resend id', async () => {
    const result = await emailAdapter.send({ to: TO, subject: 'Hi', body: 'Hello' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.to).toBe(TO)
    expect(body.subject).toBe('Hi')
    expect(body.text).toBe('Hello')
    expect(result.externalId).toBe('re_test_123')
  })
})
