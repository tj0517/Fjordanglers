/**
 * Shared pricing helpers for the Icelandic (inquiry) booking flow.
 *
 * Used by:
 *  - src/actions/inquiries.ts        (server-side)
 *  - src/components/dashboard/guide-offer-form.tsx  (client-side preview)
 *  - src/app/account/trips/[id]/page.tsx            (angler display)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One step in an offer price ladder.
 * The last tier (highest `anglers`) implicitly covers all larger group sizes.
 */
export type PriceTier = {
  anglers:  number   // minimum anglers for this tier
  priceEur: number   // total offer price in EUR
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a sorted-or-unsorted list of price tiers and an actual group size,
 * returns the applicable total price.
 *
 * Logic:
 *  - Sort tiers ascending by `anglers`.
 *  - Walk the list and take the last tier whose `anglers` ≤ groupSize.
 *  - If groupSize is smaller than every tier's `anglers`, fall back to the
 *    first (cheapest) tier so the offer is never rejected.
 */
export function findApplicableTierPrice(tiers: PriceTier[], groupSize: number): number {
  if (tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => a.anglers - b.anglers)
  let match = sorted[0]
  for (const tier of sorted) {
    if (tier.anglers <= groupSize) match = tier
  }
  return match.priceEur
}

/**
 * Validates a tier array.  Returns an error string or null if valid.
 */
export function validatePriceTiers(tiers: PriceTier[]): string | null {
  if (tiers.length === 0) return 'Add at least one price tier.'

  for (const t of tiers) {
    if (!Number.isInteger(t.anglers) || t.anglers < 1) {
      return 'Angler count must be a positive whole number in each tier.'
    }
    if (t.priceEur <= 0 || !isFinite(t.priceEur)) {
      return 'All tier prices must be greater than 0.'
    }
  }

  const anglerValues = tiers.map(t => t.anglers)
  if (new Set(anglerValues).size !== anglerValues.length) {
    return 'Each angler count can only appear once in the price tiers.'
  }

  return null
}
