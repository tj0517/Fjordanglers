/**
 * Email-inbound webhook — unmatched path. FA-1.12
 *
 * An inbound email from an address that does not match any inquiry
 * must be inserted into unmatched_messages (never into messages).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    RESEND_INBOUND_SECRET:  undefined, // skip signature check
    RESEND_API_KEY:         'test-resend',
    AI_AUTO_REPLY_ENABLED:  false,
  },
}))

vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail: vi.fn().mockResolvedValue(null), // no match
}))

vi.mock('@/lib/ai/inquiry-agent', () => ({
  classifyInquiry: vi.fn(),
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue('evt-1'),
  EventError: class EventError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('email-inbound webhook — unmatched path', () => {
  it('inserts into unmatched_messages when no inquiry matches', async () => {
    const inserts: { table: string }[] = []

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => ({
        insert: (_row: unknown) => {
          inserts.push({ table })
          return { select: () => ({ single: async () => ({ data: { id: 'um-1' }, error: null }) }), error: null }
        },
        update:  () => ({ eq: () => ({ error: null }) }),
        select:  () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    // Stub fetch to return a body for the email
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ text: 'Hello, I want to book a trip.' }),
    }))

    const payload = {
      type: 'email.received',
      data: {
        email_id: 'email-xyz-123',
        from:     'stranger@unknown.com',
        to:       ['leads@fjordanglers.com'],
        subject:  'Trip inquiry',
      },
    }

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(new NextRequest('http://localhost/api/webhooks/email-inbound', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)
    // Must insert to unmatched_messages, NOT to messages
    const unmatchedInserts = inserts.filter(i => i.table === 'unmatched_messages')
    const messagesInserts  = inserts.filter(i => i.table === 'messages')
    expect(unmatchedInserts).toHaveLength(1)
    expect(messagesInserts).toHaveLength(0)

    vi.unstubAllGlobals()
  })
})
