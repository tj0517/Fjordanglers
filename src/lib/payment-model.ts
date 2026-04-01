/**
 * Payment model utilities.
 *
 * A guide's payment model is DERIVED — never stored as a separate column.
 * It is determined solely by whether their Stripe account is active.
 *
 * stripe_connect — Stripe Connect (existing flow):
 *   • Angler pays full amount + 5% service fee via Stripe
 *   • Platform takes application_fee (commission) from each charge
 *   • Guide receives net payout via Stripe Connect transfer
 *
 * manual — Direct payment model (no Stripe Connect):
 *   • Angler pays platform fee only (commission % + service fee %) via
 *     Stripe Direct Charge to FjordAnglers main account
 *   • Angler pays guide's net amount directly: cash on-site or IBAN transfer
 *   • Same economics as stripe_connect — only the transfer mechanism differs
 *
 * This is the default for:
 *   • Guides who haven't connected Stripe yet
 *   • Guides in unsupported countries (IS, HR — see STRIPE_UNSUPPORTED)
 */

import { env } from '@/lib/env'

export type PaymentModel = 'stripe_connect' | 'manual'

// ─── Fee constants ─────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE    = 0.05
const SERVICE_FEE_CAP_EUR = 50          // max €50 service fee
const DEPOSIT_RATE_SC     = 0.40        // Stripe Connect deposit rate

// ─── Derivation ───────────────────────────────────────────────────────────────

/**
 * Derives the payment model from the guide's Stripe account status.
 * Single source of truth — call this instead of comparing stripe fields directly.
 */
export function getPaymentModel(guide: {
  stripe_account_id?:    string | null
  stripe_charges_enabled?: boolean | null
  stripe_payouts_enabled?: boolean | null
}): PaymentModel {
  if (
    guide.stripe_account_id      != null &&
    guide.stripe_charges_enabled === true &&
    guide.stripe_payouts_enabled === true
  ) {
    return 'stripe_connect'
  }
  return 'manual'
}

// ─── Deposit calculation ───────────────────────────────────────────────────────

export type DepositBreakdown = {
  /** Total trip price (price_per_person × guests × days) */
  tripTotalEur:      number
  /** 5% service fee charged to angler on top of trip price */
  serviceFeeEur:     number
  /** Platform commission (e.g. 10%) taken from trip total */
  commissionEur:     number
  /** Amount angler pays NOW — via Stripe */
  payNowEur:         number
  /** Amount angler pays guide DIRECTLY (cash or IBAN) — manual model only */
  payGuideEur:       number
  /** Grand total angler pays (payNow + payGuide). Same in both models. */
  grandTotalEur:     number
  paymentModel:      PaymentModel
}

/**
 * Calculates how the trip total is split across payment channels.
 *
 * stripe_connect:
 *   payNow = 40% deposit of (tripTotal + serviceFee)
 *   (balance = remaining 60%, charged later before trip)
 *
 * manual:
 *   payNow  = commissionEur + serviceFeeEur  (goes to FjordAnglers via Direct Charge)
 *   payGuide = tripTotal - commissionEur      (angler pays guide directly)
 */
export function calcDepositBreakdown(
  tripTotalEur:   number,
  commissionRate: number,
  paymentModel:   PaymentModel,
): DepositBreakdown {
  const serviceFeeEur  = Math.min(Math.round(tripTotalEur * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
  const commissionEur  = Math.round(tripTotalEur * commissionRate  * 100) / 100
  const grandTotalEur  = Math.round((tripTotalEur + serviceFeeEur) * 100) / 100

  if (paymentModel === 'stripe_connect') {
    const depositEur = Math.round(grandTotalEur * DEPOSIT_RATE_SC * 100) / 100
    return {
      tripTotalEur,
      serviceFeeEur,
      commissionEur,
      payNowEur:    depositEur,
      payGuideEur:  0,
      grandTotalEur,
      paymentModel,
    }
  }

  // manual — angler pays platform fee now, guide net directly
  const payNowEur   = Math.round((commissionEur + serviceFeeEur) * 100) / 100
  const payGuideEur = Math.round((tripTotalEur - commissionEur)  * 100) / 100

  return {
    tripTotalEur,
    serviceFeeEur,
    commissionEur,
    payNowEur,
    payGuideEur,
    grandTotalEur,
    paymentModel,
  }
}

/**
 * Returns the deposit amount the angler pays now (EUR).
 *
 * stripe_connect: (subtotal + capped service fee) × 40%
 * manual:         subtotal × commissionRate + capped service fee
 *
 * @param subtotalEur  Trip price before service fee (price_per_person × guests × days)
 */
export function calcDepositEur(
  subtotalEur:    number,
  commissionRate: number,
  paymentModel:   PaymentModel,
): number {
  const serviceFeeEur = Math.min(Math.round(subtotalEur * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
  if (paymentModel === 'stripe_connect') {
    const grandTotal = Math.round((subtotalEur + serviceFeeEur) * 100) / 100
    return Math.round(grandTotal * DEPOSIT_RATE_SC * 100) / 100
  }
  // manual: commission + service fee = platform's take
  const commissionEur = Math.round(subtotalEur * commissionRate * 100) / 100
  return Math.round((commissionEur + serviceFeeEur) * 100) / 100
}

/**
 * Returns the effective commission rate for a guide.
 * Founding Guides (joined ≤ 24 months ago) get a reduced rate.
 */
export function getCommissionRate(guide: {
  created_at: string
  pricing_model?: string | null
}): number {
  if (guide.pricing_model !== 'commission') return 0
  const FOUNDING_RATE   = 0.08
  const STANDARD_RATE   = Number(env.PLATFORM_COMMISSION_RATE)
  const monthsSinceJoin = (Date.now() - new Date(guide.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  return monthsSinceJoin <= 24 ? FOUNDING_RATE : STANDARD_RATE
}
