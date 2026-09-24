/**
 * FA-1.27 — /api/inquiries POST, flag-off and auto-send-throws checks.
 *
 * When AI_AUTO_REPLY_ENABLED is false, neither classifyInquiry nor autoSendReply
 * should be called — no AI model invocations on the new-inquiry path.
 *
 * When AI_AUTO_REPLY_ENABLED is true and autoSendReply throws, the route must
 * still return 201 (auto-send errors must never block inquiry creation).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const anthropicCreateMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreateMock }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mutable env so tests can flip AI_AUTO_REPLY_ENABLED
const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:     'test-key',
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: false as boolean,
  RESEND_API_KEY:        'test-resend',
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

const classifyInquiryMock = vi.fn()
vi.mock('@/lib/ai/inquiry-agent', () => ({
  classifyInquiry: classifyInquiryMock,
}))

const autoSendReplyMock = vi.fn()
vi.mock('@/lib/ai/auto-send', () => ({
  autoSendReply:     autoSendReplyMock,
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     vi.fn().mockResolvedValue(undefined),
  sendInquiryReceivedAnglerEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/inquiries/create', () => ({
  createInquiry: vi.fn().mockResolvedValue({ id: 'inq-flag-off', status: 'new' }),
}))

vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-01',
}))

import { createServiceClient } from '@/lib/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = false

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'experience_pages') {
        const b = {
          select: () => b,
          eq:     () => b,
          single: async () => ({
            data: {
              id:              '11111111-1111-1111-1111-111111111111',
              guide_id:        'guide-1',
              experience_name: 'NZ Trout Fly Fishing',
              country:         'New Zealand',
            },
            error: null,
          }),
        }
        return b
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
})

const TEST_BODY = {
  experience_page_id: '550e8400-e29b-41d4-a716-446655440000',
  angler_name:        'Test Angler',
  angler_email:       'test@angler.com',
  requested_dates:    ['2026-08-01'],
  party_size:         2,
  message:            'I want to fish New Zealand rivers.',
}

describe('/api/inquiries POST — flag off, FA-1.27', () => {
  it('calls 0 AI model invocations when AI_AUTO_REPLY_ENABLED=false', async () => {
    const { POST } = await import('@/app/api/inquiries/route')

    const response = await POST(new NextRequest('http://localhost/api/inquiries', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(TEST_BODY),
    }))

    expect(response.status).toBe(201)

    expect(classifyInquiryMock).toHaveBeenCalledTimes(0)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(0)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(0)
  })
})

describe('/api/inquiries POST — autoSendReply throws, FA-1.27', () => {
  it('returns 201 even when autoSendReply throws', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    classifyInquiryMock.mockResolvedValueOnce({ qualified: 'yes', reason: 'valid inquiry' })
    autoSendReplyMock.mockRejectedValueOnce(new Error('auto-send pipeline crashed'))

    const { POST } = await import('@/app/api/inquiries/route')

    const response = await POST(new NextRequest('http://localhost/api/inquiries', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(TEST_BODY),
    }))

    expect(response.status).toBe(201)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
  })
})
