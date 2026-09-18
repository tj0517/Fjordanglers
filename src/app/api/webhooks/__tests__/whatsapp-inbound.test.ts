/**
 * FA-1.13 — WhatsApp webhook tests.
 *
 * Part A — HMAC Option B:
 *   RED: no WHATSAPP_APP_SECRET → 401
 *   RED: secret present + bad signature → 401
 *   GREEN: secret present + correct signature → 200
 *
 * Part B — Inbound routing:
 *   - Guide phone match → messages row (counterpart='guide') + emitEvent
 *   - Angler phone match → messages row (counterpart='angler') + emitEvent
 *   - Unknown number → unmatched_messages, NO messages row
 *   - Multi-match (2 candidates) → unmatched_messages, NO messages row
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { emitEvent } from '@/lib/events/emit'
import { matchInboundPhone } from '@/lib/inquiry-matcher'
import { whatsappAdapter } from '@/lib/channels/whatsapp'
import type { InboundMessage } from '@/lib/channels/types'

// ─── Mutable env stub ─────────────────────────────────────────────────────────

const mockEnv: Record<string, string | undefined> = {
  WHATSAPP_VERIFY_TOKEN:    'verify-token',
  WHATSAPP_APP_SECRET:      undefined,
  WHATSAPP_TEMPLATE_GUIDE:  'fa_guide_new_inquiry',
  WHATSAPP_TEMPLATE_ANGLER: 'fa_angler_update',
}
vi.mock('@/lib/env', () => ({ env: mockEnv }))

// ─── DB insert tracker ────────────────────────────────────────────────────────

const dbInserts: { table: string; row: Record<string, unknown> }[] = []

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        dbInserts.push({ table, row })
        return { select: () => ({ single: async () => ({ data: { id: 'msg-inserted' }, error: null }) }) }
      },
      update: () => ({ eq: () => ({ error: null }) }),
    }),
  })),
}))

vi.mock('@/lib/inquiry-matcher', () => ({
  matchInboundPhone: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/channels/whatsapp', () => ({
  whatsappAdapter: {
    parseInbound: vi.fn().mockReturnValue(null),
    canSendFreeform: vi.fn().mockReturnValue(false),
    send: vi.fn(),
  },
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = 'correct-secret'

function hmac(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

const EMPTY_PAYLOAD = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })

const PAYLOAD_WITH_MESSAGE = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'entry-1',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '48987654321', phone_number_id: 'ph-1' },
        contacts: [{ wa_id: '48123456789', profile: { name: 'Test User' } }],
        messages: [{
          from:      '48123456789',
          id:        'wamid-test-1',
          timestamp: '1726660000',
          type:      'text',
          text:      { body: 'Hello FA' },
        }],
      },
      field: 'messages',
    }],
  }],
})

const MOCK_INBOUND: InboundMessage = {
  from:        '+48123456789',
  body:        'Hello FA',
  externalId:  'wamid-test-1',
  occurredAt:  new Date('2024-09-18T10:00:00Z'),
  media:       null,
  threadKey:   '+48123456789',
}

function makeRequest(body: string, opts: { signature?: string; omitSig?: boolean } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!opts.omitSig && opts.signature != null) {
    headers['x-hub-signature-256'] = opts.signature
  }
  return new Request('https://fjordanglers.com/api/webhooks/whatsapp', {
    method: 'POST', headers, body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  dbInserts.length = 0
  mockEnv.WHATSAPP_APP_SECRET = undefined
})

// ═══════════════════════════════════════════════════════════════════════════════
// Part A — HMAC Option B
// ═══════════════════════════════════════════════════════════════════════════════

describe('HMAC Option B — no secret configured', () => {
  it('returns 401 when WHATSAPP_APP_SECRET is absent', async () => {
    mockEnv.WHATSAPP_APP_SECRET = undefined
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(makeRequest(EMPTY_PAYLOAD, { omitSig: true }))
    expect(res.status).toBe(401)
    expect(await res.text()).toContain('not configured')
  })
})

describe('HMAC Option B — bad signature', () => {
  it('returns 401 when signature is wrong', async () => {
    mockEnv.WHATSAPP_APP_SECRET = SECRET
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(makeRequest(EMPTY_PAYLOAD, { signature: 'sha256=bad-sig' }))
    expect(res.status).toBe(401)
    expect(await res.text()).toContain('Invalid signature')
  })
})

describe('HMAC Option B — correct signature', () => {
  it('returns 200 when secret present and signature matches', async () => {
    mockEnv.WHATSAPP_APP_SECRET = SECRET
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(makeRequest(EMPTY_PAYLOAD, { signature: hmac(SECRET, EMPTY_PAYLOAD) }))
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Part B — Inbound routing
// ═══════════════════════════════════════════════════════════════════════════════

function setupSignedRequest() {
  mockEnv.WHATSAPP_APP_SECRET = SECRET
  vi.mocked(whatsappAdapter.parseInbound).mockReturnValueOnce(MOCK_INBOUND)
  return makeRequest(PAYLOAD_WITH_MESSAGE, { signature: hmac(SECRET, PAYLOAD_WITH_MESSAGE) })
}

describe('Inbound routing — guide phone match', () => {
  it('inserts messages row with counterpart=guide and emits message.received', async () => {
    vi.mocked(matchInboundPhone).mockResolvedValueOnce([
      { inquiryId: 'inq-1', counterpart: 'guide', counterpartId: 'guide-1' },
    ])
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(setupSignedRequest())
    expect(res.status).toBe(200)

    const msgInsert = dbInserts.find(i => i.table === 'messages')
    expect(msgInsert).toBeDefined()
    expect(msgInsert?.row).toMatchObject({
      channel:        'whatsapp',
      direction:      'inbound',
      counterpart:    'guide',
      counterpart_id: 'guide-1',
    })

    expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type:      'message.received',
        source:    'webhook',
        channel:   'whatsapp',
        inquiryId: 'inq-1',
      }),
    )
  })
})

describe('Inbound routing — angler phone match', () => {
  it('inserts messages row with counterpart=angler and emits message.received', async () => {
    vi.mocked(matchInboundPhone).mockResolvedValueOnce([
      { inquiryId: 'inq-2', counterpart: 'angler', counterpartId: null },
    ])
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(setupSignedRequest())
    expect(res.status).toBe(200)

    const msgInsert = dbInserts.find(i => i.table === 'messages')
    expect(msgInsert).toBeDefined()
    expect(msgInsert?.row).toMatchObject({
      channel:        'whatsapp',
      direction:      'inbound',
      counterpart:    'angler',
      counterpart_id: null,
    })

    expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'message.received', inquiryId: 'inq-2' }),
    )
  })
})

describe('Inbound routing — unknown number', () => {
  it('inserts into unmatched_messages and does NOT insert into messages', async () => {
    vi.mocked(matchInboundPhone).mockResolvedValueOnce([])
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(setupSignedRequest())
    expect(res.status).toBe(200)

    expect(dbInserts.find(i => i.table === 'unmatched_messages')).toBeDefined()
    expect(dbInserts.find(i => i.table === 'messages')).toBeUndefined()
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })
})

describe('Inbound routing — multi-match (2 open inquiries)', () => {
  it('inserts into unmatched_messages with candidates list, NO messages insert', async () => {
    vi.mocked(matchInboundPhone).mockResolvedValueOnce([
      { inquiryId: 'inq-A', counterpart: 'angler', counterpartId: null },
      { inquiryId: 'inq-B', counterpart: 'angler', counterpartId: null },
    ])
    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const res = await POST(setupSignedRequest())
    expect(res.status).toBe(200)

    const unmatchedInsert = dbInserts.find(i => i.table === 'unmatched_messages')
    expect(unmatchedInsert).toBeDefined()
    const payload = unmatchedInsert?.row?.raw_payload as { candidates?: string[] } | undefined
    expect(payload?.candidates).toEqual(expect.arrayContaining(['inq-A', 'inq-B']))
    expect(dbInserts.find(i => i.table === 'messages')).toBeUndefined()
  })
})
