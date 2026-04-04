/**
 * Booking flow & payment — pure function tests.
 *
 * Covers all pricing paths, payment model derivation, deposit calculation,
 * and email date formatting. No DB, no Stripe API, no network calls.
 *
 * Run: pnpm test
 */

import { describe, it, expect, vi } from 'vitest'

// ─── Env mock — hoisted before any module that imports @/lib/env ──────────────
// Must be declared before imports so vitest's automatic mock-hoisting picks it up.
vi.mock('@/lib/env', () => ({
  env: {
    PLATFORM_COMMISSION_RATE:          0.1,
    RESEND_API_KEY:                    're_test_key',
    NEXT_PUBLIC_SUPABASE_URL:          'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:     'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:         'test-service-role-key',
    STRIPE_SECRET_KEY:                 'sk_test_key',
    STRIPE_WEBHOOK_SECRET:             'whsec_test_key',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_key',
    NEXT_PUBLIC_APP_URL:               'http://localhost:3000',
  },
}))

// ─── Stub React Email renderer so we never actually render JSX in tests ───────
vi.mock('@react-email/components', () => ({
  render: vi.fn().mockResolvedValue('<html></html>'),
  Html: ({ children }: { children?: unknown }) => children,
  Head: ({ children }: { children?: unknown }) => children,
  Body: ({ children }: { children?: unknown }) => children,
  Container: ({ children }: { children?: unknown }) => children,
  Section: ({ children }: { children?: unknown }) => children,
  Row: ({ children }: { children?: unknown }) => children,
  Column: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
  Heading: ({ children }: { children?: unknown }) => children,
  Button: ({ children }: { children?: unknown }) => children,
  Link: ({ children }: { children?: unknown }) => children,
  Hr:      () => null,
  Img:     () => null,
  Preview: ({ children }: { children?: unknown }) => children,
  Font:    () => null,
}))

import {
  computeBookingPricing,
  calcSubtotalFromOption,
  type DurationOption,
} from '@/lib/booking-pricing'

import {
  getPaymentModel,
  calcDepositEur,
  getCommissionRate,
} from '@/lib/payment-model'

import {
  fmtEmailDate,
  fmtEmailDateRange,
  fmtEmailDays,
} from '@/lib/email'

// ─────────────────────────────────────────────────────────────────────────────
// 1. computeBookingPricing
// ─────────────────────────────────────────────────────────────────────────────
//
// New two-step payment model (2026-04-05):
//   depositEur = booking fee = commission + service_fee (same for ALL models)
//   guidePayoutEur = subtotal - commission (guide receives this directly)

describe('computeBookingPricing', () => {
  // ── Standard commission 10% ─────────────────────────────────────────────────

  it('computes booking: standard commission 10%, subtotal €400', () => {
    const p = computeBookingPricing(400, 0.10)
    expect(p.subtotalEur).toBe(400)
    expect(p.serviceFeeEur).toBe(20)          // 400 × 5% = 20 (below cap)
    expect(p.totalEur).toBe(420)              // 400 + 20
    expect(p.commissionEur).toBe(40)          // 400 × 10%
    expect(p.guidePayoutEur).toBe(360)        // 400 − 40
    expect(p.applicationFeeEur).toBe(60)      // 40 + 20
    // NEW: depositEur = booking fee = commission + service fee (NOT 40% of total)
    expect(p.depositEur).toBe(60)             // = applicationFeeEur
  })

  it('computes booking: founding commission 8%, subtotal €500', () => {
    const p = computeBookingPricing(500, 0.08)
    expect(p.serviceFeeEur).toBe(25)          // 500 × 5%
    expect(p.totalEur).toBe(525)
    expect(p.commissionEur).toBe(40)          // 500 × 8%
    expect(p.guidePayoutEur).toBe(460)
    expect(p.applicationFeeEur).toBe(65)      // 40 + 25
    expect(p.depositEur).toBe(65)             // = applicationFeeEur
  })

  it('computes booking: zero commission (flat-fee guide)', () => {
    const p = computeBookingPricing(300, 0)
    expect(p.commissionEur).toBe(0)
    expect(p.guidePayoutEur).toBe(300)        // guide gets 100% of subtotal
    expect(p.applicationFeeEur).toBe(15)      // only service fee
    expect(p.depositEur).toBe(15)             // booking fee = service fee only
  })

  // ── Service fee cap ─────────────────────────────────────────────────────────

  it('caps service fee at €50 for subtotal €1200', () => {
    const p = computeBookingPricing(1200, 0.10)
    expect(p.serviceFeeEur).toBe(50)          // 1200 × 5% = 60 → CAPPED at 50
    expect(p.totalEur).toBe(1250)
    expect(p.commissionEur).toBe(120)
    expect(p.guidePayoutEur).toBe(1080)
    expect(p.applicationFeeEur).toBe(170)     // 120 + 50
    expect(p.depositEur).toBe(170)            // booking fee = applicationFeeEur
  })

  it('hits the service fee cap exactly at subtotal €1000', () => {
    const p = computeBookingPricing(1000, 0.10)
    expect(p.serviceFeeEur).toBe(50)          // 1000 × 5% = 50 — exactly at cap
    expect(p.totalEur).toBe(1050)
    expect(p.depositEur).toBe(150)            // 100 commission + 50 service fee
  })

  it('does NOT cap service fee below €1000 subtotal (€900)', () => {
    const p = computeBookingPricing(900, 0.10)
    expect(p.serviceFeeEur).toBe(45)          // 900 × 5% = 45 (below cap)
  })

  // ── depositEur always = applicationFeeEur (both models unified) ─────────────

  it('depositEur always equals applicationFeeEur (booking fee, both models)', () => {
    const cases: [number, number][] = [
      [100, 0.08],
      [400, 0.10],
      [500, 0.08],
      [1200, 0.10],
      [1500, 0.10],
    ]
    for (const [subtotal, rate] of cases) {
      const p = computeBookingPricing(subtotal, rate)
      expect(p.depositEur).toBe(p.applicationFeeEur)
      expect(p.depositEur).toBeCloseTo(p.commissionEur + p.serviceFeeEur, 2)
    }
  })

  // ── applicationFeeEur composition ──────────────────────────────────────────

  it('applicationFeeEur always equals commissionEur + serviceFeeEur', () => {
    const cases: [number, number][] = [
      [100, 0.08],
      [500, 0.10],
      [1500, 0.10],
      [50, 0.08],
    ]
    for (const [subtotal, rate] of cases) {
      const p = computeBookingPricing(subtotal, rate)
      expect(p.applicationFeeEur).toBeCloseTo(p.commissionEur + p.serviceFeeEur, 2)
    }
  })

  it('guidePayoutEur + commissionEur always equals subtotalEur', () => {
    const cases: [number, number][] = [[400, 0.10], [700, 0.08], [1500, 0.10]]
    for (const [subtotal, rate] of cases) {
      const p = computeBookingPricing(subtotal, rate)
      expect(p.guidePayoutEur + p.commissionEur).toBeCloseTo(p.subtotalEur, 2)
    }
  })

  it('totalEur always equals subtotalEur + serviceFeeEur', () => {
    const p = computeBookingPricing(800, 0.10)
    expect(p.totalEur).toBeCloseTo(p.subtotalEur + p.serviceFeeEur, 2)
  })

  it('angler grand total = booking fee + guide amount (same for all models)', () => {
    // bookingFee (depositEur) + guideAmount (guidePayoutEur) = totalEur
    const cases: [number, number][] = [[400, 0.10], [500, 0.08], [1200, 0.10]]
    for (const [subtotal, rate] of cases) {
      const p = computeBookingPricing(subtotal, rate)
      expect(p.depositEur + p.guidePayoutEur).toBeCloseTo(p.totalEur, 2)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. calcSubtotalFromOption
// ─────────────────────────────────────────────────────────────────────────────

describe('calcSubtotalFromOption', () => {
  // ── per_person ──────────────────────────────────────────────────────────────

  it('per_person: price × guests × days (single day, days:null)', () => {
    const opt: DurationOption = { label: 'Half day', days: null, pricing_type: 'per_person', price_eur: 150 }
    expect(calcSubtotalFromOption(opt, 2, 1)).toBe(300)   // 150 × 2 × 1
    expect(calcSubtotalFromOption(opt, 3, 1)).toBe(450)   // 150 × 3 × 1
  })

  it('per_person: multiplies by tripDays for single-day options', () => {
    const opt: DurationOption = { label: 'Full day', days: 1, pricing_type: 'per_person', price_eur: 200 }
    expect(calcSubtotalFromOption(opt, 2, 3)).toBe(1200)  // 200 × 2 × 3
  })

  it('per_person: multi-day PACKAGE (days>1) uses tripCount=1 — does NOT re-multiply by tripDays', () => {
    const opt: DurationOption = { label: '3-day package', days: 3, pricing_type: 'per_person', price_eur: 450 }
    expect(calcSubtotalFromOption(opt, 2, 3)).toBe(900)   // 450 × 2 × 1 (not × 3)
    expect(calcSubtotalFromOption(opt, 2, 1)).toBe(900)   // tripDays is ignored for packages
  })

  // ── per_boat ─────────────────────────────────────────────────────────────────

  it('per_boat: flat rate regardless of guest count', () => {
    const opt: DurationOption = { label: 'Boat', days: null, pricing_type: 'per_boat', price_eur: 400 }
    expect(calcSubtotalFromOption(opt, 1, 1)).toBe(400)
    expect(calcSubtotalFromOption(opt, 6, 1)).toBe(400)   // guests don't matter
  })

  it('per_boat: multiplies by tripDays for single-day options', () => {
    const opt: DurationOption = { label: 'Boat', days: null, pricing_type: 'per_boat', price_eur: 400 }
    expect(calcSubtotalFromOption(opt, 4, 3)).toBe(1200)  // 400 × 3 days
  })

  it('per_boat: multi-day package uses tripCount=1', () => {
    const opt: DurationOption = { label: '3-day boat', days: 3, pricing_type: 'per_boat', price_eur: 1200 }
    expect(calcSubtotalFromOption(opt, 4, 3)).toBe(1200)  // not × 3
  })

  // ── per_group ────────────────────────────────────────────────────────────────

  it('per_group: uses matched group_price when available', () => {
    const opt: DurationOption = {
      label: 'Group',
      days: null,
      pricing_type: 'per_group',
      price_eur: 500,
      group_prices: { '1': 300, '2': 600, '4': 1000 },
    }
    expect(calcSubtotalFromOption(opt, 2, 1)).toBe(600)   // matched: group_prices['2']
    expect(calcSubtotalFromOption(opt, 4, 1)).toBe(1000)  // matched: group_prices['4']
  })

  it('per_group: falls back to price_eur when group size not in group_prices', () => {
    const opt: DurationOption = {
      label: 'Group',
      days: null,
      pricing_type: 'per_group',
      price_eur: 500,
      group_prices: { '1': 300, '4': 1000 },
    }
    expect(calcSubtotalFromOption(opt, 3, 1)).toBe(500)   // no match for '3' → fallback
  })

  it('per_group: falls back to price_eur when group_prices is null', () => {
    const opt: DurationOption = {
      label: 'Group',
      days: null,
      pricing_type: 'per_group',
      price_eur: 500,
      group_prices: null,
    }
    expect(calcSubtotalFromOption(opt, 2, 1)).toBe(500)
  })

  it('per_group: multiplies matched price by tripDays for single-day options', () => {
    const opt: DurationOption = {
      label: 'Group',
      days: null,
      pricing_type: 'per_group',
      price_eur: 500,
      group_prices: { '2': 600 },
    }
    expect(calcSubtotalFromOption(opt, 2, 3)).toBe(1800)  // 600 × 3 days
  })

  it('per_group: multi-day package uses tripCount=1', () => {
    const opt: DurationOption = {
      label: '3-day group',
      days: 3,
      pricing_type: 'per_group',
      price_eur: 500,
      group_prices: { '2': 900 },
    }
    expect(calcSubtotalFromOption(opt, 2, 3)).toBe(900)   // not × 3
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. getPaymentModel
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentModel', () => {
  it('returns stripe_connect when account_id is set and payouts_enabled is true', () => {
    expect(getPaymentModel({
      stripe_account_id:     'acct_abc123',
      stripe_payouts_enabled: true,
    })).toBe('stripe_connect')
  })

  it('ignores stripe_charges_enabled — only payouts_enabled determines model', () => {
    // Accounts v2 destination charges: charges_enabled is always false on connected account
    expect(getPaymentModel({
      stripe_account_id:       'acct_abc123',
      stripe_charges_enabled:  false,   // intentionally NOT checked
      stripe_payouts_enabled:  true,
    })).toBe('stripe_connect')
  })

  it('returns manual when no stripe_account_id', () => {
    expect(getPaymentModel({ stripe_account_id: null })).toBe('manual')
    expect(getPaymentModel({ stripe_account_id: undefined })).toBe('manual')
    expect(getPaymentModel({})).toBe('manual')
  })

  it('returns manual when payouts_enabled is false (onboarding not complete)', () => {
    expect(getPaymentModel({
      stripe_account_id:     'acct_abc123',
      stripe_payouts_enabled: false,
    })).toBe('manual')
  })

  it('returns manual when payouts_enabled is null', () => {
    expect(getPaymentModel({
      stripe_account_id:     'acct_abc123',
      stripe_payouts_enabled: null,
    })).toBe('manual')
  })

  it('returns manual when payouts_enabled is undefined', () => {
    expect(getPaymentModel({
      stripe_account_id:     'acct_abc123',
      stripe_payouts_enabled: undefined,
    })).toBe('manual')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. calcDepositEur
// ─────────────────────────────────────────────────────────────────────────────
//
// New model: always returns commission + service_fee regardless of paymentModel.
// The paymentModel parameter is kept for backward compatibility but ignored.

describe('calcDepositEur', () => {
  it('returns commission + service fee (booking fee) — same for both models', () => {
    // commission: 500 × 8% = 40; service fee: 25 → 65
    expect(calcDepositEur(500, 0.08, 'stripe_connect')).toBe(65)
    expect(calcDepositEur(500, 0.08, 'manual')).toBe(65)
    expect(calcDepositEur(500, 0.08)).toBe(65)
  })

  it('applies service fee cap', () => {
    // commission: 2000 × 10% = 200; service fee: 50 (capped from 100) → 250
    expect(calcDepositEur(2000, 0.10)).toBe(250)
    expect(calcDepositEur(2000, 0.10, 'stripe_connect')).toBe(250)
    expect(calcDepositEur(2000, 0.10, 'manual')).toBe(250)
  })

  it('service fee exactly at cap (€1000 subtotal)', () => {
    // commission: 100; service fee: 50 (exactly at cap) → 150
    expect(calcDepositEur(1000, 0.10)).toBe(150)
  })

  it('zero commission — only service fee charged', () => {
    // commission: 0; service fee: 300 × 5% = 15
    expect(calcDepositEur(300, 0)).toBe(15)
  })

  it('consistent with computeBookingPricing for same inputs', () => {
    // Both functions should produce the same depositEur for matching inputs
    const cases: [number, number][] = [[500, 0.08], [750, 0.10], [1200, 0.10]]
    for (const [subtotal, rate] of cases) {
      const fromCalcDeposit    = calcDepositEur(subtotal, rate)
      const fromComputePricing = computeBookingPricing(subtotal, rate).depositEur
      expect(fromCalcDeposit).toBe(fromComputePricing)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. getCommissionRate
// ─────────────────────────────────────────────────────────────────────────────

describe('getCommissionRate', () => {
  // Dates relative to now so they never become stale
  const monthsAgo = (n: number) =>
    new Date(Date.now() - n * 30.44 * 24 * 60 * 60 * 1000).toISOString()

  it('returns 0 when pricing_model is not commission', () => {
    expect(getCommissionRate({ created_at: monthsAgo(12), pricing_model: 'flat_fee' })).toBe(0)
    expect(getCommissionRate({ created_at: monthsAgo(12), pricing_model: null })).toBe(0)
    expect(getCommissionRate({ created_at: monthsAgo(12), pricing_model: undefined })).toBe(0)
  })

  it('returns 8% (founding rate) for commission guides within 24 months', () => {
    expect(getCommissionRate({ created_at: monthsAgo(6),  pricing_model: 'commission' })).toBe(0.08)
    expect(getCommissionRate({ created_at: monthsAgo(12), pricing_model: 'commission' })).toBe(0.08)
    expect(getCommissionRate({ created_at: monthsAgo(23), pricing_model: 'commission' })).toBe(0.08)
  })

  it('returns 10% (standard rate from env) for commission guides over 24 months', () => {
    expect(getCommissionRate({ created_at: monthsAgo(25), pricing_model: 'commission' })).toBe(0.10)
    expect(getCommissionRate({ created_at: monthsAgo(36), pricing_model: 'commission' })).toBe(0.10)
    expect(getCommissionRate({ created_at: monthsAgo(60), pricing_model: 'commission' })).toBe(0.10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Email date formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('fmtEmailDate', () => {
  it('formats ISO date to human-readable label', () => {
    expect(fmtEmailDate('2026-04-04')).toBe('4 Apr 2026')
    expect(fmtEmailDate('2026-12-25')).toBe('25 Dec 2026')
    expect(fmtEmailDate('2026-01-01')).toBe('1 Jan 2026')
    expect(fmtEmailDate('2025-07-15')).toBe('15 Jul 2025')
  })
})

describe('fmtEmailDateRange', () => {
  it('returns empty string when from is empty', () => {
    expect(fmtEmailDateRange('', '2026-04-08')).toBe('')
    expect(fmtEmailDateRange('', '')).toBe('')
  })

  it('returns single date when from === to', () => {
    expect(fmtEmailDateRange('2026-04-04', '2026-04-04')).toBe('4 Apr 2026')
  })

  it('returns single date when to is empty', () => {
    expect(fmtEmailDateRange('2026-04-04', '')).toBe('4 Apr 2026')
  })

  it('formats range in same month: "D–D Mon YYYY"', () => {
    expect(fmtEmailDateRange('2026-04-04', '2026-04-08')).toBe('4–8 Apr 2026')
    expect(fmtEmailDateRange('2026-06-10', '2026-06-15')).toBe('10–15 Jun 2026')
  })

  it('formats range across months in same year: "D Mon – D Mon YYYY"', () => {
    expect(fmtEmailDateRange('2026-04-28', '2026-05-02')).toBe('28 Apr – 2 May 2026')
    expect(fmtEmailDateRange('2026-11-29', '2026-12-03')).toBe('29 Nov – 3 Dec 2026')
  })

  it('formats range across years: "D Mon YYYY – D Mon YYYY"', () => {
    expect(fmtEmailDateRange('2025-12-30', '2026-01-03')).toBe('30 Dec 2025 – 3 Jan 2026')
    expect(fmtEmailDateRange('2025-12-01', '2026-02-28')).toBe('1 Dec 2025 – 28 Feb 2026')
  })
})

describe('fmtEmailDays', () => {
  it('returns empty string for empty array', () => {
    expect(fmtEmailDays([])).toBe('')
  })

  it('returns single date for one-element array', () => {
    expect(fmtEmailDays(['2026-04-04'])).toBe('4 Apr 2026')
  })

  it('formats first–last range for multi-element array', () => {
    // 3 days in same month → same-month range
    expect(fmtEmailDays(['2026-04-04', '2026-04-06', '2026-04-08'])).toBe('4–8 Apr 2026')
    // 2 days across months
    expect(fmtEmailDays(['2026-04-30', '2026-05-02'])).toBe('30 Apr – 2 May 2026')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Booking state machine — confirmable status guard
//    (mirrors the webhook handler logic for idempotency)
// ─────────────────────────────────────────────────────────────────────────────

describe('Booking status guard (webhook confirmable states)', () => {
  const CONFIRMABLE_STATUSES = ['accepted', 'offer_accepted']

  const canConfirm = (status: string) => CONFIRMABLE_STATUSES.includes(status)

  it('allows confirmation from "accepted" (direct booking — guide accepted)', () => {
    expect(canConfirm('accepted')).toBe(true)
  })

  it('allows confirmation from "offer_accepted" (inquiry booking — angler accepted offer)', () => {
    expect(canConfirm('offer_accepted')).toBe(true)
  })

  it('blocks confirmation from "pending" — guide has not accepted yet', () => {
    expect(canConfirm('pending')).toBe(false)
  })

  it('blocks confirmation from "confirmed" — idempotency guard (already confirmed)', () => {
    expect(canConfirm('confirmed')).toBe(false)
  })

  it('blocks confirmation from terminal statuses', () => {
    expect(canConfirm('cancelled')).toBe(false)
    expect(canConfirm('refunded')).toBe(false)
    expect(canConfirm('declined')).toBe(false)
    expect(canConfirm('completed')).toBe(false)
  })

  it('blocks confirmation from inquiry-only statuses', () => {
    expect(canConfirm('reviewing')).toBe(false)
    expect(canConfirm('offer_sent')).toBe(false)
  })
})
