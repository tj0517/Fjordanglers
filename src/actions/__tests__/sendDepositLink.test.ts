/**
 * sendDepositLink wiring — FA-1.09
 *
 * The saved offer deposit always wins. Without it the deposit is derived from the
 * experience's list price, and a price on request or in a non-EUR currency must never
 * reach Stripe. Pure unit test: Supabase, Stripe, email and the lookup are mocked.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type Stripe from 'stripe'

vi.mock('@/lib/supabase/server', () => ({
  createClient:        vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}))

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'https://test.example.com' },
}))

vi.mock('@/lib/email', () => ({
  sendDepositLinkAnglerEmail:    vi.fn(),
  sendInquiryMessageAnglerEmail: vi.fn(),
  sendGuideAssignedEmail:        vi.fn(),
}))

vi.mock('@/lib/app-url', () => ({ getAppUrl: vi.fn().mockResolvedValue('https://test.example.com') }))
vi.mock('@/lib/inquiries/create', () => ({ createInquiry: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'admin-1' }),
}))

vi.mock('@/lib/inquiries/state', () => ({
  transition:       vi.fn(),
  TransitionError:  class TransitionError extends Error {},
  isInquiryStatus:  vi.fn(),
}))

vi.mock('@/lib/inquiries/experience-lookup', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/inquiries/experience-lookup')>()),
  getInquiryExperience: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { sendDepositLinkAnglerEmail } from '@/lib/email'
import { getInquiryExperience, type InquiryExperience } from '@/lib/inquiries/experience-lookup'
import { sendDepositLink } from '@/actions/inquiries'

function inquiryRow(over: Record<string, unknown> = {}) {
  return {
    id:                 'inq-1',
    status:             'qualifying',
    angler_email:       'angler@example.invalid',
    angler_name:        'Test Angler',
    angler_country:     'NO',
    requested_dates:    ['2027-01-10'],
    party_size:         3,
    trip_id:            null,
    experience_page_id: 'page-1',
    message:            null,
    offer_deposit_eur:  null,
    ...over,
  }
}

function experience(over: Partial<InquiryExperience> = {}): InquiryExperience {
  return {
    id: 'page-1', name: 'Salmon on the Laxá', slug: 's', country: 'Iceland',
    guideId: null, priceFrom: 200, priceType: 'per_person', currency: 'EUR',
    ...over,
  }
}

function mockDb(row: Record<string, unknown>) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      update: () => ({ eq: () => ({ error: null }) }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

function stripeCall() {
  const create = vi.mocked(stripe.checkout.sessions.create)
  // The mock is typed with the last overload; the action calls the (params, options) one.
  const arg = create.mock.calls[0]?.[0] as unknown as Stripe.Checkout.SessionCreateParams | undefined
  const item = arg?.line_items?.[0]
  return {
    calls:  create.mock.calls.length,
    amount: item?.price_data?.unit_amount,
    name:   item?.price_data?.product_data?.name,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stripe.checkout.sessions.create).mockResolvedValue(
    { id: 'cs_1', url: 'https://checkout.example/cs_1' } as never,
  )
  vi.mocked(sendDepositLinkAnglerEmail).mockResolvedValue(undefined)
})

describe('sendDepositLink — deposit amount', () => {
  it('offer_deposit_eur wins, even when the experience price is on request', async () => {
    mockDb(inquiryRow({ offer_deposit_eur: 450 }))
    vi.mocked(getInquiryExperience).mockResolvedValue(experience({ priceType: 'request' }))

    const res = await sendDepositLink('inq-1', 30)

    expect(res.success).toBe(true)
    expect(stripeCall()).toMatchObject({ calls: 1, amount: 45000 })
  })

  it('without an offer deposit, falls back to price x party size x percent (per person)', async () => {
    mockDb(inquiryRow({ party_size: 3 }))
    vi.mocked(getInquiryExperience).mockResolvedValue(experience({ priceFrom: 200, priceType: 'per_person' }))

    const res = await sendDepositLink('inq-1', 30)

    expect(res.success).toBe(true)
    expect(stripeCall()).toMatchObject({
      calls:  1,
      amount: 18000,
      name:   'Booking & Curation Fee — Salmon on the Laxá',
    })
  })

  it('flat price is not multiplied by party size', async () => {
    mockDb(inquiryRow({ party_size: 4 }))
    vi.mocked(getInquiryExperience).mockResolvedValue(experience({ priceFrom: 1500, priceType: 'flat' }))

    await sendDepositLink('inq-1', 30)

    expect(stripeCall()).toMatchObject({ calls: 1, amount: 45000 })
  })
})

describe('sendDepositLink — red proof: nothing reaches Stripe on a bad price', () => {
  it('price on request and no offer deposit: refused, Stripe not called', async () => {
    mockDb(inquiryRow())
    vi.mocked(getInquiryExperience).mockResolvedValue(experience({ priceType: 'request' }))

    const res = await sendDepositLink('inq-1', 30)

    expect(res.success).toBe(false)
    expect(stripeCall().calls).toBe(0)
  })

  it('NZD price and no offer deposit: refused, Stripe not called', async () => {
    mockDb(inquiryRow())
    vi.mocked(getInquiryExperience).mockResolvedValue(experience({ priceType: 'flat', currency: 'NZD' }))

    const res = await sendDepositLink('inq-1', 30)

    expect(res).toMatchObject({ success: false })
    if (!res.success) expect(res.error).toContain('NZD')
    expect(stripeCall().calls).toBe(0)
  })

  it('experience unresolved and no offer deposit: refused, Stripe not called', async () => {
    mockDb(inquiryRow({ trip_id: null, experience_page_id: null }))
    vi.mocked(getInquiryExperience).mockResolvedValue(null)

    const res = await sendDepositLink('inq-1', 30)

    expect(res).toEqual({ success: false, error: 'No offer deposit set — save an offer first' })
    expect(stripeCall().calls).toBe(0)
  })
})
