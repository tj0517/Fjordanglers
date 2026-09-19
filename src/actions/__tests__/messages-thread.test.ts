/**
 * FA-1.12 unit tests for messages thread server actions and sendMessage utility.
 *
 * All tests are pure — no network, no external services.
 * Supabase and channel adapters are mocked; fake DB clients track inserts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient:        vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    prices:      { create: vi.fn() },
    paymentLinks: { create: vi.fn() },
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL:    'https://test.example.com',
    ANTHROPIC_API_KEY:      'sk-test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    NEXT_PUBLIC_SUPABASE_URL:  'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    STRIPE_SECRET_KEY:      'sk_test_1234',
    STRIPE_WEBHOOK_SECRET:  'whsec_test',
    RESEND_API_KEY:         'test-resend',
    RESEND_INBOUND_SECRET:  'test-secret',
  },
}))

vi.mock('@/lib/email', () => ({
  sendDepositLinkAnglerEmail:   vi.fn(),
  sendInquiryMessageAnglerEmail: vi.fn(),
  sendRichOfferAnglerEmail:     vi.fn(),
  sendGuideAssignedEmail:       vi.fn(),
  sendDepositConfirmedAnglerEmail: vi.fn(),
  sendDepositConfirmedFaEmail:  vi.fn(),
  sendBookingConfirmedGuideEmail: vi.fn(),
}))

vi.mock('@/lib/channels/email', () => ({
  emailAdapter: {
    canSendFreeform: (_lastInboundAt: Date | null) => true,
    send: vi.fn().mockResolvedValue({ externalId: 'ext-test-123', threadKey: '<test@mail.fjordanglers.com>' }),
    parseInbound: vi.fn().mockReturnValue(null),
  },
}))

vi.mock('@/lib/channels/whatsapp', () => ({
  whatsappAdapter: {
    canSendFreeform: vi.fn().mockReturnValue(true),
    send: vi.fn().mockResolvedValue({ externalId: 'wa-ext-test', threadKey: '+48123456789' }),
    parseInbound: vi.fn().mockReturnValue(null),
  },
}))

vi.mock('@/lib/channels/instagram', () => ({
  instagramAdapter: {
    enabled: false,
    canSendFreeform: vi.fn().mockReturnValue(false),
    send: vi.fn().mockRejectedValue(new Error('[instagram-adapter] Instagram channel is not configured.')),
    parseInbound: vi.fn().mockReturnValue(null),
  },
}))

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/guards'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockNoSession() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function mockAdmin(userId = 'user-admin-1') {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'admin' }, error: null }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── messages.ts — markAsGuideOffer ───────────────────────────────────────────

describe('markAsGuideOffer', () => {
  it('rejects empty options without touching the DB', async () => {
    mockAdmin()
    vi.mocked(createServiceClient).mockReturnValue({} as ReturnType<typeof createServiceClient>)

    const { markAsGuideOffer } = await import('@/actions/messages')
    const result = await markAsGuideOffer('msg-1', { options: [] })

    expect(result).toEqual({ success: false, error: 'At least one option is required' })
  })

  it('throws UnauthorizedError when there is no session', async () => {
    mockNoSession()
    const { markAsGuideOffer } = await import('@/actions/messages')
    await expect(markAsGuideOffer('msg-1', { options: [{ label: 'A', priceCents: 100, currency: 'eur' }] }))
      .rejects.toBeInstanceOf(UnauthorizedError)
  })
})

// ─── messages.ts — markClientAccepted ────────────────────────────────────────

describe('markClientAccepted — option from wrong offer', () => {
  it('returns error when optionId does not belong to offerId', async () => {
    mockAdmin()
    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'offer_options') {
          return {
            select: () => ({
              eq: () => ({
                // Second .eq() — returns null (option not in this offer)
                eq: () => ({
                  single: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { markClientAccepted } = await import('@/actions/messages')
    const result = await markClientAccepted('offer-A', 'option-from-offer-B')
    expect(result).toEqual({ success: false, error: 'Option not found or does not belong to this offer' })
  })
})

// ─── messages.ts — markOfferPresented ────────────────────────────────────────

describe('markOfferPresented', () => {
  it('rejects a call without messageId', async () => {
    mockAdmin()
    vi.mocked(createServiceClient).mockReturnValue({} as ReturnType<typeof createServiceClient>)

    const { markOfferPresented } = await import('@/actions/messages')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await markOfferPresented('offer-1', '' as any)
    expect(result).toEqual({ success: false, error: 'messageId is required to present an offer' })
  })
})

// ─── sendMessage — 1 row + exactly 1 event (to angler) ───────────────────────

describe('sendMessage', () => {
  it('inserts exactly 1 messages row and emits exactly 1 event for an angler message', async () => {
    const inserts: { table: string; row: Record<string, unknown> }[] = []
    let updateCalled = 0

    const fakeClient = {
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            inserts.push({ table, row })
            return {
              select: () => ({
                single: async () => ({ data: { id: `${table}-row-1` }, error: null }),
              }),
            }
          },
          update(_data: Record<string, unknown>) {
            updateCalled++
            return { eq: () => ({ error: null }) }
          },
          select(_cols: string, _opts?: unknown) {
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    neq: () => ({ count: 0, error: null }),
                  }),
                }),
              }),
            }
          },
        }
      },
    }

    const { sendMessage } = await import('@/lib/messages/send')
    const result = await sendMessage(fakeClient as unknown as Parameters<typeof sendMessage>[0], {
      inquiryId:   'inq-1',
      channel:     'email',
      counterpart: 'angler',
      to:          'angler@example.com',
      body:        'Hello angler',
      draftedBy:   'admin',
      actor:       { kind: 'admin', id: 'user-1' },
    })

    // 1 messages insert
    const messageInserts = inserts.filter(i => i.table === 'messages')
    expect(messageInserts).toHaveLength(1)
    expect(messageInserts[0].row).toMatchObject({
      inquiry_id: 'inq-1', direction: 'outbound', counterpart: 'angler', status: 'queued',
    })

    // exactly 1 inquiry_events insert (message.sent only — no guide.contacted for angler)
    const eventInserts = inserts.filter(i => i.table === 'inquiry_events')
    expect(eventInserts).toHaveLength(1)
    expect(eventInserts[0].row).toMatchObject({ inquiry_id: 'inq-1', type: 'message.sent' })

    // update called (status queued → sent)
    expect(updateCalled).toBeGreaterThanOrEqual(1)

    expect(result.messageId).toBe('messages-row-1')
  })

  it('emits guide.contacted on first outbound message to a guide', async () => {
    const inserts: { table: string; row: Record<string, unknown> }[] = []

    const fakeClient = {
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            inserts.push({ table, row })
            return {
              select: () => ({
                single: async () => ({ data: { id: `${table}-row-1` }, error: null }),
              }),
            }
          },
          update(_data: Record<string, unknown>) {
            return { eq: () => ({ error: null }) }
          },
          select(_cols: string, opts?: { count?: string; head?: boolean }) {
            if (opts?.count === 'exact') {
              // count of prior outbound guide messages = 0 (first one)
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      neq: () => ({ count: 0, error: null }),
                    }),
                  }),
                }),
              }
            }
            return { eq: () => ({ single: async () => ({ data: null, error: null }) }) }
          },
        }
      },
    }

    const { sendMessage } = await import('@/lib/messages/send')
    await sendMessage(fakeClient as unknown as Parameters<typeof sendMessage>[0], {
      inquiryId:    'inq-1',
      channel:      'email',
      counterpart:  'guide',
      to:           'guide@example.com',
      body:         'Hello guide',
      draftedBy:    'admin',
      actor:        { kind: 'admin', id: 'user-1' },
      counterpartId: 'guide-1',
    })

    const eventTypes = inserts.filter(i => i.table === 'inquiry_events').map(i => i.row.type)
    expect(eventTypes).toContain('message.sent')
    expect(eventTypes).toContain('guide.contacted')
    expect(eventTypes).toHaveLength(2)
  })
})

