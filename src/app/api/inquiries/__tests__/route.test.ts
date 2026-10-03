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

const sendFaEmailMock     = vi.fn()
const sendAnglerEmailMock = vi.fn()
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     sendFaEmailMock,
  sendInquiryReceivedAnglerEmail: sendAnglerEmailMock,
}))

// FA-1.42 — data-layer lookup for "same e-mail within 24 h"
const hasRecentInquiryMock = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  hasRecentInquiryFromEmail: hasRecentInquiryMock,
}))

const createInquiryMock = vi.fn()
vi.mock('@/lib/inquiries/create', () => ({
  createInquiry: createInquiryMock,
}))

vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-01',
}))

import { createServiceClient } from '@/lib/supabase/server'

/** Rows the route itself writes to inquiry_events (createInquiry is mocked, so only FA-1.42 skips land here). */
let emittedEvents: Record<string, unknown>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = false
  emittedEvents = []
  createInquiryMock.mockResolvedValue({ id: 'inq-flag-off', status: 'new' })
  sendFaEmailMock.mockResolvedValue(undefined)
  sendAnglerEmailMock.mockResolvedValue(undefined)
  hasRecentInquiryMock.mockResolvedValue(false)

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
        insert: (row: Record<string, unknown>) => {
          if (table === 'inquiry_events') emittedEvents.push(row)
          return { select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }
        },
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

// ─── FA-1.42 — repeat submissions from the same e-mail ───────────────────────

const REPEAT_REASON = 'repeat submission from same e-mail within 24 h'

function post(body: Record<string, unknown> = TEST_BODY) {
  return import('@/app/api/inquiries/route').then(({ POST }) => POST(new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })))
}

describe('/api/inquiries POST — repeat from the same e-mail, FA-1.42', () => {
  it('saves the inquiry, skips AI, auto-reply and the customer e-mail, still mails FA, and leaves an event with the reason — RED on main: everything is called', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(true)

    const response = await post()

    expect(response.status).toBe(201)
    expect(createInquiryMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      inquiry_id: 'inq-flag-off',
      type:       'agent.auto_send_decided',
      payload:    { sent: false, score: null, reasons: [REPEAT_REASON], draft_message_id: null },
    })
  })

  it('does not write the angler e-mail address into the event', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(true)

    await post()

    expect(JSON.stringify(emittedEvents)).not.toMatch(/angler\.com/i)
  })

  it('treats a repeat the same way when the auto-reply flag is off (D2): no customer e-mail, event still saved', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = false
    hasRecentInquiryMock.mockResolvedValue(true)

    const response = await post()

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(1)
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([REPEAT_REASON])
  })

  it('leaves behaviour unchanged for a first inquiry from an e-mail: classify, auto-send, customer e-mail, no skip event', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(false)

    const response = await post()

    expect(response.status).toBe(201)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('asks the data layer about this e-mail, excluding the new inquiry, over the last 24 h', async () => {
    const before = Date.now()
    await post({ ...TEST_BODY, angler_email: 'Test@Angler.COM' })
    const after = Date.now()

    expect(hasRecentInquiryMock).toHaveBeenCalledTimes(1)
    const params = hasRecentInquiryMock.mock.calls[0][1] as { email: string; excludeInquiryId: string; since: Date }
    expect(params.email).toBe('Test@Angler.COM')
    expect(params.excludeInquiryId).toBe('inq-flag-off')
    const DAY = 24 * 60 * 60 * 1000
    expect(params.since.getTime()).toBeGreaterThanOrEqual(before - DAY)
    expect(params.since.getTime()).toBeLessThanOrEqual(after - DAY)
  })

  it('fails open when the lookup throws: the inquiry is treated as new and gets the usual flow', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockRejectedValue(new Error('connection reset'))

    const response = await post()

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })
})
