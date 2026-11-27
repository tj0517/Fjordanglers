/**
 * FA-M.15 — which emails a paid deposit sends, seen through the real email module and the
 * RESEND_DEV_FAKE switch (FA-1.58): every send that runs logs one `not sent: type=…` line and
 * never reaches Resend. Only the FA email may log; the angler and guide emails are off
 * (POST_DEPOSIT_PARTY_EMAILS_ENABLED, tj 2026-11-27) even with a guide assigned.
 *
 * Everything around the emails is mocked as in stripe-deposit.test.ts; @/lib/email is NOT.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET:         'whsec_test_fam15',
    STRIPE_WEBHOOK_SECRET_DEPOSIT: undefined,
    FA_EMAIL:                      'fa@test.example',
    FA_FROM_EMAIL:                 'FjordAnglers <contact@test.example>',
    RESEND_API_KEY:                'test-dummy-key',
    NEXT_PUBLIC_APP_URL:           'https://test.example.com',
  },
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: { webhooks: { constructEvent: vi.fn() }, paymentLinks: { retrieve: vi.fn() } },
}))
vi.mock('@/lib/inquiries/state', () => ({ transition: vi.fn() }))
vi.mock('@/lib/events/emit', () => ({ emitEvent: vi.fn() }))
vi.mock('@/lib/inquiries/experience-lookup', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/inquiries/experience-lookup')>()),
  getInquiryExperience: vi.fn(async () => null),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'test-sig' }),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { POST } from '@/app/api/webhooks/stripe-deposit/route'

const ROW = {
  id:                   'inq-fam15',
  angler_email:         'angler@test.example',
  angler_name:          'Test Angler',
  angler_country:       'NO',
  requested_dates:      ['2027-07-01'],
  party_size:           2,
  deposit_amount:       null,
  deposit_amount_cents: 20000,
  deposit_currency:     'EUR',
  deposit_eur_rate:     1,
  trip_id:              null,
  experience_page_id:   null,
  guide_id:             'guide-fam15',
}

function serviceWithGuide() {
  return {
    from: (table: string) =>
      table === 'inquiries'
        ? { update: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: [ROW], error: null }) }) }) }) }
        : {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { full_name: 'Test Guide', invite_email: 'guide@test.example' }, error: null }),
              }),
            }),
          },
  } as unknown as ReturnType<typeof createServiceClient>
}

let fetchMock: ReturnType<typeof vi.fn>
let infoLines: string[]

beforeEach(() => {
  process.env.RESEND_DEV_FAKE = '1'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  infoLines = []
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => { infoLines.push(args.map(String).join(' ')) })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.RESEND_DEV_FAKE
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('stripe-deposit webhook through the email fake (FA-M.15)', () => {
  it('paid deposit with a guide assigned → exactly one email, to FA; none to the angler or the guide', async () => {
    vi.mocked(createServiceClient).mockReturnValue(serviceWithGuide())
    const session: Partial<Stripe.Checkout.Session> = {
      id: 'cs_fam15', object: 'checkout.session', payment_status: 'paid',
      metadata: { payment_type: 'inquiry_deposit', inquiry_id: ROW.id },
    }
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: 'evt_fam15', type: 'checkout.session.completed', data: { object: session },
    } as unknown as Stripe.Event)

    const res = await POST(new NextRequest('http://localhost/api/webhooks/stripe-deposit', {
      method: 'POST', headers: { 'stripe-signature': 'test-sig' }, body: '{}',
    }))

    expect(res.status).toBe(200)
    const sent = infoLines.filter(l => l.includes('RESEND_DEV_FAKE=1 — not sent'))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('type=DepositConfirmedFaEmail')
    expect(sent[0]).toContain('f***@test.example')
    expect(infoLines.join('\n')).not.toMatch(/DepositConfirmedAnglerEmail|BookingConfirmedGuideEmail/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
