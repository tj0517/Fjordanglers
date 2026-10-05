/**
 * Email-inbound webhook — outbound path. FA-1.49
 *
 * A mail from an FA address (Zoho BCC copy) is recognised as outbound,
 * matched by recipient, written to messages, and emits message.sent.
 * autoSendReply and D2 are not called. Duplicate delivery is idempotent.
 * Outbound with no matching inquiry is silently dropped (no unmatched_messages row).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted env ──────────────────────────────────────────────────────────────

const mockEnv = vi.hoisted(() => ({
  RESEND_INBOUND_SECRET:  undefined as string | undefined,
  RESEND_API_KEY:         'test-resend' as string,
  AI_AUTO_REPLY_ENABLED:  true,
  FA_EMAIL:               'contact@fjordanglers.com',
  FA_OUTBOUND_ADDRESSES:  undefined as string | undefined,
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail:     vi.fn().mockResolvedValue(null),
  matchInquiryByRecipient: vi.fn().mockResolvedValue('inq-outbound'),
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent:  vi.fn().mockResolvedValue('evt-1'),
  EventError: class EventError extends Error {},
}))

vi.mock('@/lib/ai/auto-send', () => ({
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
  autoSendReply:     vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/inquiries/state', () => ({
  transition:      vi.fn().mockResolvedValue({ from: 'new', to: 'qualifying' }),
  TransitionError: class TransitionError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByEmail, matchInquiryByRecipient } from '@/lib/inquiry-matcher'
import { emitEvent } from '@/lib/events/emit'
import { autoSendReply } from '@/lib/ai/auto-send'
import { transition } from '@/lib/inquiries/state'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildOutboundPayload(emailId = 'outbound-email-1') {
  return {
    type: 'email.received',
    data: {
      email_id: emailId,
      from:     'hello@fjordanglers.com',
      to:       ['client@example.test'],
      subject:  'Your trip details',
      text:     'Hi, here are the details for your trip.',
    },
  }
}

function makeRequest(payload = buildOutboundPayload()) {
  return new NextRequest('http://localhost/api/webhooks/email-inbound', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(payload),
  })
}

function setupDb(insertError: { code?: string; message?: string } | null = null) {
  const inserts: { table: string; row: unknown }[] = []

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'messages') {
        return {
          insert: (row: unknown) => {
            inserts.push({ table, row })
            if (insertError) {
              return { select: () => ({ single: async () => ({ data: null, error: insertError }) }) }
            }
            return { select: () => ({ single: async () => ({ data: { id: 'msg-out-1' }, error: null }) }) }
          },
        }
      }
      return {
        insert: (row: unknown) => {
          inserts.push({ table, row })
          return { error: null }
        },
        update: () => ({ eq: () => ({ error: null }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)

  return inserts
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_DEV_FAKE = '1'
  mockEnv.FA_OUTBOUND_ADDRESSES = undefined
})

afterEach(() => {
  delete process.env.RESEND_DEV_FAKE
})

// ─── FA-1.49: outbound matched ────────────────────────────────────────────────

describe('email-inbound webhook — outbound path, FA-1.49', () => {
  it('inserts an outbound/sent messages row and emits message.sent', async () => {
    const inserts = setupDb()
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(makeRequest())

    expect(response.status).toBe(200)

    // matchInquiryByEmail NOT called (outbound branches before it)
    expect(vi.mocked(matchInquiryByEmail)).not.toHaveBeenCalled()
    // matchInquiryByRecipient called with the to address
    expect(vi.mocked(matchInquiryByRecipient)).toHaveBeenCalledWith(['client@example.test'])

    const msgInserts = inserts.filter(i => i.table === 'messages')
    expect(msgInserts).toHaveLength(1)
    const row = msgInserts[0].row as Record<string, unknown>
    expect(row.direction).toBe('outbound')
    expect(row.status).toBe('sent')
    expect(row.drafted_by).toBe('admin')
    expect(row.channel).toBe('email')
    expect(row.external_id).toBe('outbound-email-1')

    expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type:   'message.sent',
        actor:  expect.objectContaining({ kind: 'admin' }),
        source: 'webhook',
      }),
    )
  })

  it('does NOT call autoSendReply or D2 transition on outbound', async () => {
    setupDb()
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(autoSendReply)).not.toHaveBeenCalled()
    expect(vi.mocked(transition)).not.toHaveBeenCalled()
  })

  it('is idempotent — duplicate delivery (23505) creates no second row and no second event', async () => {
    const inserts = setupDb({ code: '23505', message: 'unique_violation' })
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    // insert was attempted once (dedupe happens on conflict code)
    expect(inserts.filter(i => i.table === 'messages')).toHaveLength(1)
    // no event emitted on duplicate
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })

  it('does NOT write to unmatched_messages when no inquiry matches the recipient', async () => {
    vi.mocked(matchInquiryByRecipient).mockResolvedValueOnce(null)
    const inserts = setupDb()
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(inserts.filter(i => i.table === 'messages')).toHaveLength(0)
    expect(inserts.filter(i => i.table === 'unmatched_messages')).toHaveLength(0)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })

  it('also detects outbound when from matches FA_EMAIL (contact@fjordanglers.com)', async () => {
    const inserts = setupDb()
    const payload = {
      ...buildOutboundPayload('outbound-email-2'),
      data: {
        ...buildOutboundPayload().data,
        from:     'contact@fjordanglers.com',
        email_id: 'outbound-email-2',
      },
    }
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest(payload))

    const msgInserts = inserts.filter(i => i.table === 'messages')
    expect(msgInserts).toHaveLength(1)
    expect((msgInserts[0].row as Record<string, unknown>).direction).toBe('outbound')
  })

  it('uses FA_OUTBOUND_ADDRESSES env when set', async () => {
    mockEnv.FA_OUTBOUND_ADDRESSES = 'tj@custom.test,other@custom.test'
    const inserts = setupDb()
    const payload = {
      ...buildOutboundPayload('outbound-custom-1'),
      data: {
        ...buildOutboundPayload().data,
        from:     'tj@custom.test',
        email_id: 'outbound-custom-1',
      },
    }
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest(payload))

    expect(inserts.filter(i => i.table === 'messages')).toHaveLength(1)
  })
})
