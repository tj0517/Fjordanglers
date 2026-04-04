/**
 * Centralized booking price computation — single source of truth.
 *
 * ALL pricing paths (createBookingCheckout, acceptBooking, display) must use this
 * function instead of inline calculations. This prevents drift between:
 *   - service fee cap (5%, €50 max) being applied inconsistently
 *   - commission and payout being computed with slightly different rounding
 *   - application_fee_amount missing the service fee (critical Stripe bug)
 *
 * Semantic note on `customTotalEur` / `subtotalEur`:
 *   This function always receives the GUIDE'S PRICE (subtotal, before service fee).
 *   The service fee is added ON TOP for the angler. Guides never see or pay it.
 */

import type { PaymentModel } from './payment-model'

// ─── Duration option pricing ───────────────────────────────────────────────────

/**
 * Minimal shape of a duration option needed for subtotal calculation.
 * Intentionally kept separate from DurationOptionPayload (actions/experiences.ts)
 * to avoid importing server-action types into lib.
 */
export type DurationOption = {
  label: string
  days: number | null
  pricing_type: 'per_person' | 'per_boat' | 'per_group'
  price_eur: number
  /** Only set when pricing_type = 'per_group'. Key = group size as string ("1", "2", …) */
  group_prices?: Record<string, number> | null
}

/**
 * Calculate booking subtotal from a selected duration option.
 *
 * Mirrors the widget's `calcPrice(opt, groupSize) × tripCount` logic:
 *   - Multi-day packages (opt.days > 1): price_eur covers the ENTIRE package.
 *     tripDays is ignored (tripCount = 1 — range mode).
 *   - Single-day options (opt.days <= 1 or null): price_eur is the per-unit rate.
 *     tripDays = number of individual days selected (tripCount = tripDays).
 *
 * @param opt      The matched duration option
 * @param guests   Number of anglers
 * @param tripDays Number of single-day units; ignored for multi-day packages
 */
export function calcSubtotalFromOption(
  opt: DurationOption,
  guests: number,
  tripDays: number,
): number {
  const r = (n: number) => Math.round(n * 100) / 100

  // Multi-day package: price_eur already covers all N days — do NOT multiply again
  const isPackage = (opt.days ?? 1) > 1
  const unitCount = isPackage ? 1 : tripDays

  switch (opt.pricing_type) {
    case 'per_boat':
      // Flat rate per boat regardless of group size, multiplied by unit count
      return r(opt.price_eur * unitCount)

    case 'per_group': {
      // Look up exact price for this group size; fall back to base price_eur
      const matched = (opt.group_prices ?? {})[String(guests)]
      const unitPrice = matched != null ? matched : opt.price_eur
      return r(unitPrice * unitCount)
    }

    case 'per_person':
    default:
      return r(opt.price_eur * guests * unitCount)
  }
}

const SERVICE_FEE_RATE    = 0.05
const SERVICE_FEE_CAP_EUR = 50
const DEPOSIT_RATE_SC     = 0.40

export type BookingPricing = {
  /** Guide's trip price before any fees (price_per_person × guests × days) */
  subtotalEur: number
  /** 5% service fee, capped at €50 — charged to angler on top of subtotal */
  serviceFeeEur: number
  /** Total the angler pays (subtotal + serviceFee) — stored as total_eur */
  totalEur: number
  /** Platform commission (subtotal × commissionRate) — stored as platform_fee_eur */
  commissionEur: number
  /** Guide's net earnings (subtotal − commission) — stored as guide_payout_eur */
  guidePayoutEur: number
  /** Amount the angler pays NOW via Stripe — stored as deposit_eur */
  depositEur: number
  /**
   * Stripe application_fee_amount = commission + serviceFee.
   * This is what the platform actually keeps on each Stripe charge.
   * NEVER use platform_fee_eur (commission only) for application_fee_amount!
   */
  applicationFeeEur: number
}

/**
 * Compute all booking price fields from a single subtotal + commission rate.
 *
 * @param subtotalEur     Guide's trip price (excl. service fee) e.g. €330 × 2 guests × 1 day = €660
 * @param commissionRate  Platform commission e.g. 0.10 (10%)
 * @param paymentModel    'stripe_connect' → 40% deposit; 'manual' → platform fee only
 */
export function computeBookingPricing(
  subtotalEur:    number,
  commissionRate: number,
  paymentModel:   PaymentModel,
): BookingPricing {
  const r = (n: number) => Math.round(n * 100) / 100

  const serviceFeeEur     = Math.min(r(subtotalEur * SERVICE_FEE_RATE), SERVICE_FEE_CAP_EUR)
  const totalEur          = r(subtotalEur + serviceFeeEur)
  const commissionEur     = r(subtotalEur * commissionRate)
  const guidePayoutEur    = r(subtotalEur - commissionEur)
  const applicationFeeEur = r(commissionEur + serviceFeeEur)

  let depositEur: number
  if (paymentModel === 'stripe_connect') {
    // 40% of the full angler total (subtotal + service fee)
    depositEur = r(totalEur * DEPOSIT_RATE_SC)
  } else {
    // manual: angler pays platform's full take now (commission + service fee),
    // pays guide's net directly (cash / IBAN)
    depositEur = applicationFeeEur
  }

  return {
    subtotalEur,
    serviceFeeEur,
    totalEur,
    commissionEur,
    guidePayoutEur,
    depositEur,
    applicationFeeEur,
  }
}
