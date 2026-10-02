/**
 * FA-1.41 supplement — a malformed Upstash URL must not turn POST /api/inquiries
 * into a 500 (O-29 a, fail-open; the comment in src/lib/env.ts promises the same).
 *
 * The real factory and the real @upstash/redis constructor run here (no network:
 * the constructor only validates the URL and throws UrlError for `rediss://…`,
 * stray spaces or a missing scheme; its message embeds the URL).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  createInquiry:       vi.fn(),
  classifyInquiry:     vi.fn(),
  autoSendReply:       vi.fn(),
  sendFaEmail:         vi.fn(),
  sendAnglerEmail:     vi.fn(),
}))

const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:        'test-key',
  NEXT_PUBLIC_APP_URL:      'https://test.example.com',
  FA_EMAIL:                 'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED:    true as boolean,
  RESEND_API_KEY:           'test-resend',
  RATE_LIMIT_SALT:          'test-salt' as string | undefined,
  UPSTASH_REDIS_REST_URL:   undefined as string | undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined as string | undefined,
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/inquiries/create', () => ({ createInquiry: mocks.createInquiry }))
vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: mocks.classifyInquiry }))
vi.mock('@/lib/ai/auto-send', () => ({
  autoSendReply:     mocks.autoSendReply,
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     mocks.sendFaEmail,
  sendInquiryReceivedAnglerEmail: mocks.sendAnglerEmail,
}))
vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-01',
}))

const TOKEN = 'fake-token-value'

async function post(email: string): Promise<Response> {
  const { POST } = await import('@/app/api/inquiries/route')
  return POST(new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
    body:    JSON.stringify({
      experience_page_id: '550e8400-e29b-41d4-a716-446655440000',
      angler_name:        'Test Angler',
      angler_email:       email,
      requested_dates:    ['2026-08-01'],
      party_size:         2,
      message:            'I want to fish New Zealand rivers.',
    }),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // fresh factory cache per test
  mockEnv.UPSTASH_REDIS_REST_TOKEN = TOKEN

  mocks.createInquiry.mockResolvedValue({ id: 'inq-cfg', status: 'new' })
  mocks.sendFaEmail.mockResolvedValue(undefined)
  mocks.sendAnglerEmail.mockResolvedValue(undefined)
  mocks.classifyInquiry.mockResolvedValue(undefined)
  mocks.autoSendReply.mockResolvedValue(undefined)

  const page = {
    id:              '11111111-1111-1111-1111-111111111111',
    guide_id:        'guide-1',
    experience_name: 'NZ Trout Fly Fishing',
    country:         'New Zealand',
  }
  mocks.createServiceClient.mockReturnValue({
    from: () => {
      const b = { select: () => b, eq: () => b, single: async () => ({ data: page, error: null }) }
      return b
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/inquiries — limiter cannot be created (O-29 a, fail-open)', () => {
  it.each([
    ['a rediss:// connection string', 'rediss://default:fake-secret-pw@fake-host.upstash.io:6379'],
    ['a URL with a stray space',      ' https://fake-host.upstash.io'],
  ])('%s → 201, nothing thrown, the log holds nothing from the URL or token', async (_name, url) => {
    mockEnv.UPSTASH_REDIS_REST_URL = url
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const first = await post('first@example.com')
    expect(first.status).toBe(201)
    expect(mocks.createInquiry).toHaveBeenCalledTimes(1)
    expect(mocks.autoSendReply).toHaveBeenCalledTimes(1)

    // later requests keep passing and do not log the failure again
    expect((await post('second@example.com')).status).toBe(201)
    expect((await post('third@example.com')).status).toBe(201)
    expect(mocks.createInquiry).toHaveBeenCalledTimes(3)
    expect(error).toHaveBeenCalledTimes(1)

    const logged = JSON.stringify(error.mock.calls)
    expect(logged).not.toContain(url)
    expect(logged).not.toContain('fake-host')
    expect(logged).not.toContain('fake-secret-pw')
    expect(logged).not.toContain(TOKEN)
  })
})
