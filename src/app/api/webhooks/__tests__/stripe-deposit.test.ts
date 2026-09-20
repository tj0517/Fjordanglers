/**
 * Stripe deposit webhook unit tests — FA-1.12
 *
 * Tests the guard: a checkout.session.completed event that has
 * payment_type='inquiry_deposit' but NO inquiry_id in metadata must
 * log a warning and return 200 without touching the database.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET:         'whsec_test_fa112',
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

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getInquiryExperience } from '@/lib/inquiries/experience-lookup'
import { sendDepositConfirmedAnglerEmail, sendDepositConfirmedFaEmail } from '@/lib/email'
import { emitEvent } from '@/lib/events/emit'
import { transition } from '@/lib/inquiries/state'

// Mock next/headers (no real request context in tests)
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'test-sig' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stripe-deposit webhook — no inquiry_id in metadata', () => {
  it('returns 200 and does not update any inquiry when inquiry_id is missing', async () => {
    const dbWrites: unknown[] = []

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => ({
        select:  () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update:  (data: unknown) => { dbWrites.push({ table, data }); return { eq: () => ({ error: null }) } },
        insert:  (data: unknown) => { dbWrites.push({ table, data }); return { error: null } },
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_no_inquiry_id',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit' /* no inquiry_id */ },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id:   'evt_test',
      type: 'checkout.session.completed',
      data: { object: session },
    } as unknown as Stripe.Event)

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: session } })
    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'test-sig' },
      body:    rawBody,
    }))

    expect(response.status).toBe(200)
    // No DB writes: no update to inquiries, no insert to anything
    expect(dbWrites).toHaveLength(0)
  })
})

describe('stripe-deposit webhook — idempotency', () => {
  it('returns 200 and emits no events when deposit_paid_at is already set', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id:                        'inq-idempotent',
                deposit_paid_at:           '2026-09-17T13:00:00.000Z',
                angler_email:              'test@fjordanglers.com',
                angler_name:               'Test Angler',
                angler_country:            'NO',
                requested_dates:           [],
                party_size:                1,
                deposit_amount:            360,
                trip_id:                   null,
                guide_id:                  null,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: () => ({ error: null }) }),
        insert: vi.fn().mockReturnValue({ error: null }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_duplicate_session',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-idempotent' },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id:   'evt_test_dup',
      type: 'checkout.session.completed',
      data: { object: session },
    } as unknown as Stripe.Event)

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: session } })
    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    const response = await POST(new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'test-sig' },
      body:    rawBody,
    }))

    expect(response.status).toBe(200)
    // deposit_paid_at was already set → early return before any event emission
    expect(emitEvent).not.toHaveBeenCalled()
  })
})

describe('stripe-deposit webhook — double call same session', () => {
  it('emits exactly one payment.received and calls transition once for two calls with the same session', async () => {
    // Stateful DB: deposit_paid_at starts null; set by the first webhook update
    let depositPaidAt: string | null = null

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id:                        'inq-double',
                deposit_paid_at:           depositPaidAt,
                angler_email:              'test@fjordanglers.com',
                angler_name:               'Test',
                angler_country:            'NO',
                requested_dates:           [],
                party_size:                1,
                deposit_amount:            360,
                trip_id:                   null,
                guide_id:                  null,
              },
              error: null,
            }),
          }),
        }),
        update: (data: Record<string, unknown>) => {
          // First call sets deposit_paid_at; second call sees it and returns early
          if (data['deposit_paid_at'] != null) depositPaidAt = data['deposit_paid_at'] as string
          return { eq: () => ({ error: null }) }
        },
        insert: () => ({ error: null }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             'cs_test_double',
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-double' },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id:   'evt_double',
      type: 'checkout.session.completed',
      data: { object: session },
    } as unknown as Stripe.Event)

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: session } })
    const makeReq = () => new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'test-sig' },
      body:    rawBody,
    })

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')

    const r1 = await POST(makeReq())
    expect(r1.status).toBe(200)

    // After first call deposit_paid_at is set; second call hits the idempotency guard
    const r2 = await POST(makeReq())
    expect(r2.status).toBe(200)

    const paymentReceivedCalls = vi.mocked(emitEvent).mock.calls.filter(
      ([, params]) => params.type === 'payment.received'
    )
    expect(paymentReceivedCalls).toHaveLength(1)
    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
  })
})

describe('stripe-deposit webhook — trip title in the confirmation emails (FA-1.09)', () => {
  async function runWebhook(sessionId: string) {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id:                 'inq-title',
                deposit_paid_at:    null,
                angler_email:       'test@fjordanglers.com',
                angler_name:        'Test',
                angler_country:     'NO',
                requested_dates:    [],
                party_size:         1,
                deposit_amount:     360,
                trip_id:            null,
                experience_page_id: 'page-1',
                guide_id:           null,
              },
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: () => ({ error: null }) }),
        insert: () => ({ error: null }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>)

    const session: Partial<Stripe.Checkout.Session> = {
      id:             sessionId,
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: 'inq-title' },
    }
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id:   `evt_${sessionId}`,
      type: 'checkout.session.completed',
      data: { object: session },
    } as unknown as Stripe.Event)

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route')
    return POST(new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'test-sig' },
      body:    JSON.stringify({ type: 'checkout.session.completed', data: { object: session } }),
    }))
  }

  it('puts the resolved experience name into the angler and FA emails', async () => {
    vi.mocked(getInquiryExperience).mockResolvedValue({
      id: 'page-1', name: 'Salmon on the Laxá', slug: 's', country: 'Iceland',
      guideId: null, priceFrom: 200, priceType: 'per_person', currency: 'EUR',
    })

    const res = await runWebhook('cs_test_title')

    expect(res.status).toBe(200)
    expect(getInquiryExperience).toHaveBeenCalledWith({ experience_page_id: 'page-1', trip_id: null })
    expect(sendDepositConfirmedAnglerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Salmon on the Laxá' }),
    )
    expect(sendDepositConfirmedFaEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Salmon on the Laxá' }),
    )
  })

  it('still returns 200 and sends the emails with the generic title when nothing resolves', async () => {
    vi.mocked(getInquiryExperience).mockResolvedValue(null)

    const res = await runWebhook('cs_test_title_null')

    expect(res.status).toBe(200)
    expect(sendDepositConfirmedAnglerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tripTitle: 'Your trip' }),
    )
  })
})
