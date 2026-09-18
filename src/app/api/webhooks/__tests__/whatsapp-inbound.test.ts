/**
 * FA-1.13 — WhatsApp webhook HMAC Option B tests.
 *
 * RED tests (must stay failing until WHATSAPP_APP_SECRET is set in prod):
 *   - No WHATSAPP_APP_SECRET → 401
 *   - Secret present + bad signature → 401
 *
 * GREEN:
 *   - Secret present + correct signature → 200
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Mutable env stub — individual tests mutate WHATSAPP_APP_SECRET
const mockEnv: Record<string, string | undefined> = {
  WHATSAPP_VERIFY_TOKEN:    'verify-token',
  WHATSAPP_APP_SECRET:      undefined,
  WHATSAPP_TEMPLATE_GUIDE:  'fa_guide_new_inquiry',
  WHATSAPP_TEMPLATE_ANGLER: 'fa_angler_update',
}

vi.mock('@/lib/env', () => ({ env: mockEnv }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
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

const BODY = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [],
})

function makeRequest(body: string, opts: {
  signature?: string
  omitSignatureHeader?: boolean
} = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!opts.omitSignatureHeader && opts.signature != null) {
    headers['x-hub-signature-256'] = opts.signature
  }
  return new Request('https://fjordanglers.com/api/webhooks/whatsapp', {
    method: 'POST',
    headers,
    body,
  })
}

function hmac(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.WHATSAPP_APP_SECRET = undefined  // reset to absent
})

// ─── RED: no secret → 401 ────────────────────────────────────────────────────

describe('HMAC Option B — no secret configured', () => {
  it('returns 401 when WHATSAPP_APP_SECRET is absent', async () => {
    mockEnv.WHATSAPP_APP_SECRET = undefined

    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const req = makeRequest(BODY, { omitSignatureHeader: true })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toContain('not configured')
  })
})

// ─── RED: bad signature → 401 ────────────────────────────────────────────────

describe('HMAC Option B — bad signature', () => {
  it('returns 401 when signature is wrong', async () => {
    mockEnv.WHATSAPP_APP_SECRET = 'correct-secret'

    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const req = makeRequest(BODY, { signature: 'sha256=bad-signature-here' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).toContain('Invalid signature')
  })
})

// ─── GREEN: correct signature → 200 ──────────────────────────────────────────

describe('HMAC Option B — correct signature', () => {
  it('returns 200 when secret present and signature matches', async () => {
    const secret = 'correct-secret'
    mockEnv.WHATSAPP_APP_SECRET = secret

    const { POST } = await import('@/app/api/webhooks/whatsapp/route')
    const req = makeRequest(BODY, { signature: hmac(secret, BODY) })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
