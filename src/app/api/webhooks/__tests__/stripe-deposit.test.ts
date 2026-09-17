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

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

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
