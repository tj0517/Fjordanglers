/**
 * Payment model utilities.
 *
 * A guide's payment model is DERIVED — never stored as a separate column.
 * It is determined solely by whether their Stripe account is active.
 *
 * ## Two-step payment model (2026-04-05)
 *
 * stripe_connect — Guide has verified Stripe Connect account:
 *   Step 1: Angler pays booking fee (commission + service fee) via Stripe to platform
 *   Step 2: Angler pays guide amount via a SECOND Stripe Checkout session
 *           → transfer_data to guide's connected account (guide receives 100%)
 *
 * manual — Direct payment model (no Stripe Connect):
 *   Step 1: Angler pays booking fee (commission + service fee) via Stripe to platform
 *   Step 2: Angler pays guide amount directly:
 *           • IBAN guide: bank transfer (guide shares SEPA QR code)
 *           • No payment info: "arrange directly with your guide"
 *
 * Both models have identical economics — only the payment mechanism differs.
 * The booking fee (step 1) is always = commission + service_fee.
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

// ─── Derivation ───────────────────────────────────────────────────────────────

/**
 * Derives the payment model from the guide's Stripe account status.
 * Single source of truth — call this instead of comparing stripe fields directly.
 */
export function getPaymentModel(guide: {
  stripe_account_id?:      string | null
  stripe_charges_enabled?: boolean | null   // accepted but intentionally unused — see below
  stripe_payouts_enabled?: boolean | null
}): PaymentModel {
  // NOTE: stripe_charges_enabled is intentionally NOT checked here.
  // FjordAnglers uses Accounts v2 destination charges — the platform account
  // is the one that charges anglers, so Stripe always sets charges_enabled=false
  // on the connected account. payouts_enabled is the correct "fully onboarded"
  // signal for destination-charge connected accounts.
  if (
    guide.stripe_account_id    != null &&
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
  /**
   * Booking fee — what angler pays NOW via Stripe to platform.
   * Always = commission + service_fee (independent of payment model).
   */
  payNowEur:         number
  /**
   * Guide amount — what angler pays directly to guide (step 2).
   * = tripTotal − commission.
   * Delivered via Stripe Connect (stripe_connect model) or cash/IBAN (manual model).
   */
  payGuideEur:       number
  /** Grand total angler pays (payNow + payGuide). Same in both models. */
  grandTotalEur:     number
  paymentModel:      PaymentModel
}

/**
 * Calculates how the trip total is split across payment channels.
 *
 * Both models:
 *   payNow  = commissionEur + serviceFeeEur  (booking fee → platform via Stripe)
 *   payGuide = tripTotal - commissionEur      (guide amount → guide directly)
 *
 * The 40% deposit model has been replaced — both models use the same booking fee.
 */
export function calcDepositBreakdown(
  tripTotalEur:   number,
  commissionRate: number,
  paymentModel:   PaymentModel,
): DepositBreakdown {
  const serviceFeeEur  = Math.min(Math.round(tripTotalEur * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
  const commissionEur  = Math.round(tripTotalEur * commissionRate  * 100) / 100
  const grandTotalEur  = Math.round((tripTotalEur + serviceFeeEur) * 100) / 100

  // Booking fee: platform's full cut (commission + service fee)
  const payNowEur   = Math.round((commissionEur + serviceFeeEur) * 100) / 100
  // Guide amount: what angler pays directly to guide (via Stripe Connect or IBAN/cash)
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
 * Returns the booking fee (what the angler pays to the platform now).
 * Always = commission + capped service fee, regardless of payment model.
 *
 * @param subtotalEur  Trip price before service fee (price_per_person × guests × days)
 */
export function calcDepositEur(
  subtotalEur:    number,
  commissionRate: number,
  // paymentModel param kept for backward compatibility — no longer affects result
  _paymentModel?: PaymentModel,
): number {
  const serviceFeeEur = Math.min(Math.round(subtotalEur * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
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
