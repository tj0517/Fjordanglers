/**
 * Email-inbound webhook — schema/payload robustness. FA-1.49.
 *
 * Supplements added after review:
 *  1. Missing email_id in payload → 200 OK (not 400), preserving original inbound behaviour.
 *  2. unmatched_messages.raw_payload stores the original JSON-parsed object,
 *     not a schema-stripped copy.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/env', () => ({
  env: {
    RESEND_INBOUND_SECRET:  undefined,
    RESEND_API_KEY:         'test-resend',
    AI_AUTO_REPLY_ENABLED:  false,
  },
}))
vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail:     vi.fn().mockResolvedValue(null),
  matchInquiryByRecipient: vi.fn().mockResolvedValue(null),
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
  transition:      vi.fn().mockResolvedValue({}),
  TransitionError: class TransitionError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_DEV_FAKE = '1'
})
afterEach(() => {
  delete process.env.RESEND_DEV_FAKE
})

// ─── missing email_id ─────────────────────────────────────────────────────────

describe('email-inbound webhook — missing email_id, FA-1.49', () => {
  it('returns 200 OK when email_id is absent (not 400)', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        insert: () => ({ error: null }),
        update: () => ({ eq: () => ({ error: null }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const payload = {
      type: 'email.received',
      data: {
        // email_id intentionally omitted
        from:    'client@example.test',
        to:      ['leads@fjordanglers.com'],
        subject: 'No ID here',
        text:    'Some body text.',
      },
    }

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response = await POST(new NextRequest('http://localhost/api/webhooks/email-inbound', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)
  })
})

// ─── raw_payload stores original object ──────────────────────────────────────

describe('email-inbound webhook — raw_payload stores original, FA-1.49', () => {
  it('stores the full original JSON object in unmatched_messages.raw_payload', async () => {
    const insertedRows: { table: string; row: unknown }[] = []

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => ({
        insert: (row: unknown) => {
          insertedRows.push({ table, row })
          return { error: null }
        },
        update: () => ({ eq: () => ({ error: null }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    // Stub fetch so the body is read from the payload text field (RESEND_DEV_FAKE=1)
    const payload = {
      type: 'email.received',
      data: {
        email_id: 'email-raw-1',
        from:     'stranger@example.test',
        to:       ['leads@fjordanglers.com'],
        subject:  'Hello',
        text:     'Test body.',
        extra_field: 'this should be in raw_payload',
      },
    }

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(new NextRequest('http://localhost/api/webhooks/email-inbound', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    }))

    const unmatchedRow = insertedRows.find(r => r.table === 'unmatched_messages')
    expect(unmatchedRow).toBeDefined()

    const row = unmatchedRow!.row as Record<string, unknown>
    const stored = row.raw_payload as Record<string, unknown>
    // The full original payload is stored — schema-stripping would remove extra_field
    // and the nested data.extra_field
    const storedData = (stored.data ?? {}) as Record<string, unknown>
    expect(storedData.extra_field).toBe('this should be in raw_payload')
  })
})
