/**
 * Stripe deposit webhook unit tests
 *
 * Covers:
 *   - Payment Link path (D1 — FA-1.16): session.metadata empty, payment_link set →
 *     fetch link metadata, proceed normally
 *   - Payment Link with wrong payment_type → zero DB writes
 *   - retrieve failure (D4 — FA-1.16): throws → 500; retry with working retrieve → 200
 *   - Atomic idempotency (D2 — FA-1.16): parallel delivery → exactly one payment.received
 *     (shared-state mock simulating Postgres IS NULL — proves the .is() guard in the code)
 *   - Checkout Session path (existing): metadata on session, unchanged
 *   - Sequential double call (existing): sequential idempotency still works
 *   - Trip title in confirmation emails (FA-1.09)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET:         'whsec_test_fa116',
    STRIPE_WEBHOOK_SECRET_DEPOSIT: undefined,
    FA_EMAIL:                      'test@fjordanglers.com',
    NEXT_PUBLIC_APP_URL:           'https://test.example.com',
  },
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    paymentLinks: {
      retrieve: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendDepositConfirmedAnglerEmail: vi.fn(),
  sendDepositConfirmedFaEmail:     vi.fn(),
  sendBookingConfirmedGuideEmail:  vi.fn(),
}))

vi.mock('@/lib/inquiries/state', () => ({
  transition:      vi.fn(),
  TransitionError: class TransitionError extends Error {},
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent:  vi.fn(),
  EventError: class EventError extends Error {},
}))

vi.mock('@/lib/inquiries/experience-lookup', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/inquiries/experience-lookup')>()),
  getInquiryExperience: vi.fn(),
}))

// next/headers — no real request context in tests
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'test-sig' }),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { sendDepositConfirmedAnglerEmail, sendDepositConfirmedFaEmail } from '@/lib/email'
import { emitEvent } from '@/lib/events/emit'
import { transition } from '@/lib/inquiries/state'

type PaymentLinkResponse = Awaited<ReturnType<typeof stripe.paymentLinks.retrieve>>

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Happy-path inquiry row returned from UPDATE … RETURNING */
const INQUIRY_ROW = {
  id:                 'inq-test',
  angler_email:       'angler@test.com',
  angler_name:        'Test Angler',
  angler_country:     'NO',
  requested_dates:    [] as string[],
  party_size:         1,
  deposit_amount:     360,
  trip_id:            null,
  experience_page_id: null,
  guide_id:           null,
}

/** Build a mock supabase client for the happy path (D2 atomic UPDATE returns row). */
function buildHappyMock(row = INQUIRY_ROW) {
  return {
    from: (table: string) => {
      if (table === 'inquiries') {
        return {
          update: (_data: unknown) => ({
            eq: (_col: string, _val: string) => ({
              is: (_col2: string, _val2: null) => ({
                select: async () => ({ data: [row], error: null }),
              }),
            }),
          }),
        }
      }
      // guides table — no guide assigned
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>
}

/**
 * Build a mock that simulates Postgres-level IS NULL atomicity.
 * dbState is shared across both concurrent POST calls.
 * The async select() body has no internal await, so it runs synchronously
 * when called — the first writer mutates dbState before the second sees it.
 */
function buildSharedStateMock(dbState: { deposit_paid_at: string | null }) {
  return {
    from: (table: string) => {
      if (table === 'inquiries') {
        return {
          update: (data: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => ({
              is: (col: string, val: null) => ({
                select: async () => {
                  if (col === 'deposit_paid_at' && val === null && dbState.deposit_paid_at === null) {
                    dbState.deposit_paid_at = data['deposit_paid_at'] as string
                    return { data: [{ ...INQUIRY_ROW, id: 'inq-parallel' }], error: null }
                  }
                  return { data: [], error: null }
                },
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>
}

function makeReq(body: string) {
  return new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 'test-sig' },
    body,
  })
}

function mockEvent(session: Partial<Stripe.Checkout.Session>) {
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
    id:   'evt_test',
    type: 'checkout.session.completed',
    data: { object: session },
  } as unknown as Stripe.Event)
  return JSON.stringify({ type: 'checkout.session.completed', data: { object: session } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── D1: Payment Link path ─────────────────────────────────────────────────────

describe('stripe-deposit webhook — Payment Link session (D1)', () => {
  it('processes deposit when metadata comes from the payment link', async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildHappyMock())

    vi.mocked(stripe.paymentLinks.retrieve).mockResolvedValue({
      metadata: { payment_type: 'inquiry_deposit', inquiry_id: 'inq-test' },
    } as unknown as PaymentLinkResponse)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_plink',
      object:         'checkout.session',
      payment_status: 'paid',
      payment_link:   'plink_test_123',
      metadata:       null,
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(stripe.paymentLinks.retrieve).toHaveBeenCalledWith('plink_test_123')

    const paymentReceivedCalls = vi.mocked(emitEvent).mock.calls.filter(
      ([, params]) => params.type === 'payment.received'
    )
    expect(paymentReceivedCalls).toHaveLength(1)
    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
  })

  it('returns 200 and writes nothing when payment link metadata has wrong payment_type', async () => {
    const dbUpdates: unknown[] = []
    vi.mocked(createServiceClient).mockReturnValue({
      from: (_table: string) => ({
        update: (data: unknown) => {
          dbUpdates.push(data)
          return { eq: () => ({ is: () => ({ select: async () => ({ data: [], error: null }) }) }) }
        },
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    vi.mocked(stripe.paymentLinks.retrieve).mockResolvedValue({
      metadata: { payment_type: 'not_a_deposit', inquiry_id: 'inq-test' },
    } as unknown as PaymentLinkResponse)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_wrong_type',
      object:         'checkout.session',
      payment_status: 'paid',
      payment_link:   'plink_test_wrong',
      metadata:       null,
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(dbUpdates).toHaveLength(0)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })

  it('returns 200 and writes nothing when session has no metadata and no payment_link', async () => {
    const dbUpdates: unknown[] = []
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        update: (data: unknown) => {
          dbUpdates.push(data)
          return { eq: () => ({ is: () => ({ select: async () => ({ data: [], error: null }) }) }) }
        },
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_no_meta_no_link',
      object:         'checkout.session',
      payment_status: 'paid',
      payment_link:   null,
      metadata:       null,
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(dbUpdates).toHaveLength(0)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })
})

// ─── D4: payment link retrieve failure ────────────────────────────────────────

describe('stripe-deposit webhook — payment link retrieve failure (D4)', () => {
  it('returns 500 and writes nothing when stripe.paymentLinks.retrieve throws', async () => {
    const dbUpdates: unknown[] = []
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        update: (data: unknown) => {
          dbUpdates.push(data)
          return { eq: () => ({ is: () => ({ select: async () => ({ data: [], error: null }) }) }) }
        },
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    vi.mocked(stripe.paymentLinks.retrieve).mockRejectedValue(
      new Error('Stripe API error: service unavailable'),
    )

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_retrieve_fail',
      object:         'checkout.session',
      payment_status: 'paid',
      payment_link:   'plink_test_fail',
      metadata:       null,
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(500)
    expect(dbUpdates).toHaveLength(0)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
  })

  it('retries successfully: retrieve recovers → 200 and exactly one payment.received', async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildHappyMock())

    vi.mocked(stripe.paymentLinks.retrieve)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        metadata: { payment_type: 'inquiry_deposit', inquiry_id: 'inq-test' },
      } as unknown as PaymentLinkResponse)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_retrieve_retry',
      object:         'checkout.session',
      payment_status: 'paid',
      payment_link:   'plink_test_retry',
      metadata:       null,
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')

    // First delivery: retrieve throws → 500
    const r1 = await POST(makeReq(body))
    expect(r1.status).toBe(500)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()

    // Second delivery (Stripe retry): retrieve succeeds → 200, 1× payment.received
    const r2 = await POST(makeReq(body))
    expect(r2.status).toBe(200)

    const paymentReceivedCalls = vi.mocked(emitEvent).mock.calls.filter(
      ([, params]) => params.type === 'payment.received'
    )
    expect(paymentReceivedCalls).toHaveLength(1)
    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
  })
})

// ─── D2: Atomic idempotency — parallel double delivery ────────────────────────

describe('stripe-deposit webhook — parallel double delivery (D2)', () => {
  it('emits exactly one payment.received when two deliveries run in parallel', async () => {
    // Shared state simulates Postgres IS NULL atomicity.
    // select() has no internal await so its body runs synchronously —
    // the first caller mutates dbState before the second one sees it.
    const dbState: { deposit_paid_at: string | null } = { deposit_paid_at: null }
    vi.mocked(createServiceClient).mockReturnValue(buildSharedStateMock(dbState))

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_parallel',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-parallel' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')

    const [r1, r2] = await Promise.all([POST(makeReq(body)), POST(makeReq(body))])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)

    const paymentReceivedCalls = vi.mocked(emitEvent).mock.calls.filter(
      ([, params]) => params.type === 'payment.received'
    )
    expect(paymentReceivedCalls).toHaveLength(1)
    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
  })
})

// ─── No inquiry_id ────────────────────────────────────────────────────────────

describe('stripe-deposit webhook — no inquiry_id in metadata', () => {
  it('returns 200 and does not update any inquiry when inquiry_id is missing', async () => {
    const dbUpdates: unknown[] = []

    vi.mocked(createServiceClient).mockReturnValue({
      from: (_table: string) => ({
        update: (data: unknown) => {
          dbUpdates.push(data)
          return { eq: () => ({ is: () => ({ select: async () => ({ data: [], error: null }) }) }) }
        },
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_no_inquiry_id',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit' /* no inquiry_id */ },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(dbUpdates).toHaveLength(0)
  })
})

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe('stripe-deposit webhook — idempotency (atomic UPDATE returns empty)', () => {
  it('returns 200 and emits no events when UPDATE returns empty (already processed)', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        update: () => ({
          eq: () => ({
            is: () => ({
              select: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_duplicate_session',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-idempotent' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(vi.mocked(emitEvent)).not.toHaveBeenCalled()
    expect(vi.mocked(transition)).not.toHaveBeenCalled()
  })
})

// ─── Sequential double call ───────────────────────────────────────────────────

describe('stripe-deposit webhook — sequential double call', () => {
  it('emits exactly one payment.received for two sequential calls with the same session', async () => {
    let updateCallCount = 0

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'inquiries') {
          return {
            update: (_data: unknown) => ({
              eq: () => ({
                is: () => ({
                  select: async () => {
                    if (updateCallCount === 0) {
                      updateCallCount++
                      return { data: [{ ...INQUIRY_ROW, id: 'inq-double' }], error: null }
                    }
                    updateCallCount++
                    return { data: [], error: null }
                  },
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_double',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-double' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')

    const r1 = await POST(makeReq(body))
    expect(r1.status).toBe(200)

    const r2 = await POST(makeReq(body))
    expect(r2.status).toBe(200)

    const paymentReceivedCalls = vi.mocked(emitEvent).mock.calls.filter(
      ([, params]) => params.type === 'payment.received'
    )
    expect(paymentReceivedCalls).toHaveLength(1)
    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
  })
})

// ─── Happy path emails (Checkout Session) ─────────────────────────────────────

describe('stripe-deposit webhook — happy path emails (Checkout Session)', () => {
  it('calls all three email functions when guide is assigned', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'inquiries') {
          return {
            update: () => ({
              eq: () => ({
                is: () => ({
                  select: async () => ({
                    data: [{ ...INQUIRY_ROW, guide_id: 'guide-1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        // guides table
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { full_name: 'Test Guide', invite_email: 'guide@test.com' },
                error: null,
              }),
            }),
          }),
        }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const {
      sendDepositConfirmedAnglerEmail: anglerEmail,
      sendDepositConfirmedFaEmail: faEmail,
      sendBookingConfirmedGuideEmail: guideEmail,
    } = await import('@/lib/email')

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_emails',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-test' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)

    // Give fire-and-forget a tick to complete
    await new Promise(r => setTimeout(r, 0))

    expect(anglerEmail).toHaveBeenCalledOnce()
    expect(faEmail).toHaveBeenCalledOnce()
    expect(guideEmail).toHaveBeenCalledOnce()
  })
})

// ─── Trip title in confirmation emails (FA-1.09) ──────────────────────────────

describe('stripe-deposit webhook — trip title in the confirmation emails (FA-1.09)', () => {
  it('puts the resolved experience name into the angler and FA emails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildHappyMock({ ...INQUIRY_ROW, experience_page_id: 'page-1' }),
    )

    vi.mocked(getInquiryExperience).mockResolvedValue({
      id: 'page-1', name: 'Salmon on the Laxá', slug: 's', country: 'Iceland',
      guideId: null, priceFrom: 200, priceType: 'per_person', currency: 'EUR',
    })

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_title',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-test' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(getInquiryExperience).toHaveBeenCalledWith({ experience_page_id: 'page-1', trip_id: null })
    expect(sendDepositConfirmedAnglerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Salmon on the Laxá' }),
    )
    expect(sendDepositConfirmedFaEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Salmon on the Laxá' }),
    )
  })

  it('still returns 200 and sends the emails with the generic title when nothing resolves', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildHappyMock({ ...INQUIRY_ROW, experience_page_id: null }),
    )

    vi.mocked(getInquiryExperience).mockResolvedValue(null)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_title_null',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-test' },
    }
    const body = mockEvent(session)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(makeReq(body))

    expect(response.status).toBe(200)
    expect(sendDepositConfirmedAnglerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Your trip' }),
    )
  })
})
