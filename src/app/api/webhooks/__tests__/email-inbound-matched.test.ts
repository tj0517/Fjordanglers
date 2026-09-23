/**
 * Email-inbound webhook — matched path. FA-1.25
 *
 * When an inbound email matches an existing inquiry (even one that previously
 * had agent_status='waiting'), the webhook must NOT call the AI agent.
 * The agent round logic was removed in FA-1.25; the matched path now only
 * inserts a message, updates last_contact_at, and emits message.received.
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

vi.mock('@/lib/env', () => ({
  env: {
    RESEND_INBOUND_SECRET:  undefined,
    RESEND_API_KEY:         'test-resend',
    AI_AUTO_REPLY_ENABLED:  true, // enabled — must still be silent on inbound
  },
}))

vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail: vi.fn().mockResolvedValue('inq-matched'), // match
}))

vi.mock('@/lib/ai/inquiry-agent', () => ({
  classifyInquiry: vi.fn(),
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue('evt-1'),
  EventError: class EventError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'
import { classifyInquiry } from '@/lib/ai/inquiry-agent'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('email-inbound webhook — matched path, FA-1.25', () => {
  it('does not call the AI agent when an email matches an existing inquiry', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'msg-1' }, error: null }),
          }),
          error: null,
        }),
        update: () => ({ eq: () => ({ error: null }) }),
        select: () => ({
          eq: () => ({ single: async () => ({ data: { agent_status: 'waiting' }, error: null }) }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ text: 'I would like to confirm my trip dates.' }),
    }))

    const payload = {
      type: 'email.received',
      data: {
        email_id: 'email-matched-1',
        from:     'angler@example.com',
        to:       ['leads@fjordanglers.com'],
        subject:  'Re: trip booking',
      },
    }

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(new NextRequest('http://localhost/api/webhooks/email-inbound', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)

    // The AI agent must not be called — neither via the module export
    expect(vi.mocked(classifyInquiry)).toHaveBeenCalledTimes(0)
    // ...nor via the Anthropic SDK directly
    expect(anthropicCreateMock).toHaveBeenCalledTimes(0)

    vi.unstubAllGlobals()
  })
})
