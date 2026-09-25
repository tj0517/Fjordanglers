/**
 * FA-1.12 unit tests for messages thread server actions and sendMessage utility.
 *
 * All tests are pure — no network, no external services.
 * Supabase and channel adapters are mocked; fake DB clients track inserts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/inquiries/state', () => ({
  transition:  vi.fn().mockResolvedValue(undefined),
  TransitionError: class TransitionError extends Error {},
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient:        vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    prices:       { create: vi.fn() },
    paymentLinks: { create: vi.fn(), update: vi.fn() },
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

// ─── FA-1.29: markClientAccepted does NOT transition to awaiting_payment ──────

describe('markClientAccepted — FA-1.29 D1: no awaiting_payment transition', () => {
  it('succeeds without ever calling transition()', async () => {
    mockAdmin()
    vi.mocked(createServiceClient).mockReturnValue({
      from(table: string) {
        if (table === 'offer_options') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ single: async () => ({ data: { id: 'opt-1', offer_id: 'off-1' }, error: null }) }),
              }),
            }),
            update: () => ({ eq: () => ({ error: null }) }),
          }
        }
        if (table === 'offers') {
          return {
            select: () => ({
              eq: () => ({ single: async () => ({ data: { id: 'off-1', inquiry_id: 'inq-1' }, error: null }) }),
            }),
            update: () => ({ eq: () => ({ error: null }) }),
          }
        }
        // inquiry_events
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'evt-1' }, error: null }) }) }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { transition } = await import('@/lib/inquiries/state')
    const { markClientAccepted } = await import('@/actions/messages')
    const result = await markClientAccepted('off-1', 'opt-1')

    expect(result.success).toBe(true)
    expect(vi.mocked(transition)).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'awaiting_payment',
      expect.anything(),
    )
  })
})

// ─── FA-1.29: createPaymentLink ───────────────────────────────────────────────

import { stripe } from '@/lib/stripe/client'

describe('createPaymentLink — FA-1.29', () => {
  it('returns error when deposit_amount_cents is null, no Stripe call', async () => {
    mockAdmin()
    vi.mocked(createServiceClient).mockReturnValue({
      from() {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { id: 'inq-1', deposit_amount_cents: null, deposit_currency: null, deposit_payment_link_id: null, deposit_payment_link_url: null }, error: null }) }),
          }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { createPaymentLink } = await import('@/actions/messages')
    const result = await createPaymentLink('inq-1')

    expect(result).toEqual({ success: false, error: expect.stringContaining('Deposit amount not set') })
    expect(vi.mocked(stripe.paymentLinks.create)).not.toHaveBeenCalled()
  })

  it('idempotency: same amount/currency returns existing link without creating a new one', async () => {
    mockAdmin()
    const existingLinkId  = 'plink_existing'
    const existingLinkUrl = 'https://buy.stripe.com/existing'
    vi.mocked(createServiceClient).mockReturnValue({
      from(table: string) {
        if (table === 'inquiries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'inq-1', angler_name: 'Alice', angler_email: 'a@x.com', party_size: 2,
                    deposit_amount_cents: 20000, deposit_currency: 'EUR',
                    deposit_payment_link_id: existingLinkId,
                    deposit_payment_link_url: existingLinkUrl,
                  }, error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'inquiry_events') {
          // Return event with matching link_id, amount_cents, currency
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { payload: { link_id: existingLinkId, amount_cents: 20000, currency: 'EUR' } },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { createPaymentLink } = await import('@/actions/messages')
    const result = await createPaymentLink('inq-1')

    expect(result).toEqual({ success: true, url: existingLinkUrl })
    expect(vi.mocked(stripe.paymentLinks.create)).not.toHaveBeenCalled()
  })

  it('amount changed: deactivates old link and creates a new one', async () => {
    mockAdmin()
    const oldLinkId = 'plink_old'
    vi.mocked(stripe.prices.create).mockResolvedValue({ id: 'price_new' } as never)
    vi.mocked(stripe.paymentLinks.create).mockResolvedValue({ id: 'plink_new', url: 'https://buy.stripe.com/new' } as never)
    vi.mocked(stripe.paymentLinks.update).mockResolvedValue({} as never)

    vi.mocked(createServiceClient).mockReturnValue({
      from(table: string) {
        if (table === 'inquiries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'inq-1', angler_name: 'Bob', angler_email: 'b@x.com', party_size: 1,
                    deposit_amount_cents: 25000, deposit_currency: 'EUR',
                    deposit_payment_link_id: oldLinkId,
                    deposit_payment_link_url: 'https://buy.stripe.com/old',
                  }, error: null,
                }),
              }),
            }),
            update: () => ({ eq: () => ({ error: null }) }),
          }
        }
        if (table === 'inquiry_events') {
          // Event has different amount (old 20000 vs new 25000)
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { payload: { link_id: oldLinkId, amount_cents: 20000, currency: 'EUR' } },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'evt-2' }, error: null }) }) }),
          }
        }
        // messages insert + inquiry_events insert
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-x' }, error: null }) }) }),
          update: () => ({ eq: () => ({ error: null }) }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { createPaymentLink } = await import('@/actions/messages')
    const result = await createPaymentLink('inq-1')

    expect(result).toEqual({ success: true, url: 'https://buy.stripe.com/new' })
    expect(vi.mocked(stripe.paymentLinks.update)).toHaveBeenCalledWith(oldLinkId, { active: false })
    expect(vi.mocked(stripe.paymentLinks.create)).toHaveBeenCalledTimes(1)
  })

  it('ISK: passes deposit_amount_cents directly to Stripe unit_amount (no ÷100)', async () => {
    mockAdmin()
    vi.mocked(stripe.prices.create).mockResolvedValue({ id: 'price_isk' } as never)
    vi.mocked(stripe.paymentLinks.create).mockResolvedValue({ id: 'plink_isk', url: 'https://buy.stripe.com/isk' } as never)

    vi.mocked(createServiceClient).mockReturnValue({
      from(table: string) {
        if (table === 'inquiries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'inq-isk', angler_name: 'Gunnar', angler_email: 'g@is.is', party_size: 2,
                    deposit_amount_cents: 50000,  // 500 ISK stored as 50000 (×100)
                    deposit_currency: 'ISK',
                    deposit_payment_link_id: null,
                    deposit_payment_link_url: null,
                  }, error: null,
                }),
              }),
            }),
            update: () => ({ eq: () => ({ error: null }) }),
          }
        }
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-x' }, error: null }) }) }),
          update: () => ({ eq: () => ({ error: null }) }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { createPaymentLink } = await import('@/actions/messages')
    await createPaymentLink('inq-isk')

    expect(vi.mocked(stripe.prices.create)).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'isk', unit_amount: 50000 }),
    )
  })

  it('deactivation fails: returns error, no prices.create or paymentLinks.create called', async () => {
    mockAdmin()
    const oldLinkId = 'plink_old'
    vi.mocked(stripe.paymentLinks.update).mockRejectedValue(new Error('Stripe network error'))

    vi.mocked(createServiceClient).mockReturnValue({
      from(table: string) {
        if (table === 'inquiries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'inq-1', angler_name: 'Bob', angler_email: 'b@x.com', party_size: 1,
                    deposit_amount_cents: 25000, deposit_currency: 'EUR',
                    deposit_payment_link_id: oldLinkId,
                    deposit_payment_link_url: 'https://buy.stripe.com/old',
                  }, error: null,
                }),
              }),
            }),
            update: () => ({ eq: () => ({ error: null }) }),
          }
        }
        if (table === 'inquiry_events') {
          // Old event has different amount → triggers deactivation path
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { payload: { link_id: oldLinkId, amount_cents: 20000, currency: 'EUR' } },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-x' }, error: null }) }) }),
          update: () => ({ eq: () => ({ error: null }) }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const { createPaymentLink } = await import('@/actions/messages')
    const result = await createPaymentLink('inq-1')

    expect(result).toEqual({ success: false, error: expect.stringContaining('deactivate') })
    expect(vi.mocked(stripe.prices.create)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.paymentLinks.create)).not.toHaveBeenCalled()
  })
})

