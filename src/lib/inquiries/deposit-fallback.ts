/**
 * Fallback deposit amount for `sendDepositLink`.
 *
 * `inquiries.offer_deposit_eur` always wins and is handled by the caller; this function
 * is only used when no offer deposit was saved. It derives the deposit from the
 * experience's list price (`experience_pages.price_from` × party size × deposit %).
 *
 * Pure, no I/O. The Stripe line item is hard-coded to EUR, so a price in any other
 * currency is refused — never converted. A price on request has no number to derive from.
 * The price type and currency are checked BEFORE any amount is computed.
 */

import type { InquiryExperience } from './experience-lookup'

export type FallbackDeposit = { ok: true; cents: number } | { ok: false; error: string }

export function computeFallbackDepositCents(
  exp: Pick<InquiryExperience, 'priceFrom' | 'priceType' | 'currency'> | null,
  partySize: number,
  depositPercent: number,
): FallbackDeposit {
  if (!exp) {
    return { ok: false, error: 'No offer deposit set — save an offer first' }
  }

  if (exp.priceType === 'request') {
    return { ok: false, error: 'No offer deposit set — trip price is on request; save an offer first' }
  }

  if (exp.currency !== 'EUR') {
    return {
      ok: false,
      error: `No offer deposit set — trip price is in ${exp.currency}; save an offer first`,
    }
  }

  if (exp.priceType !== 'per_person' && exp.priceType !== 'flat') {
    return { ok: false, error: 'No offer deposit set — trip price type is not supported; save an offer first' }
  }

  if (!Number.isFinite(exp.priceFrom) || exp.priceFrom <= 0) {
    return { ok: false, error: 'No offer deposit set — trip has no list price; save an offer first' }
  }

  if (!Number.isFinite(depositPercent) || depositPercent <= 0) {
    return { ok: false, error: 'No offer deposit set — deposit percentage is not valid; save an offer first' }
  }

  let multiplier = 1
  if (exp.priceType === 'per_person') {
    if (!Number.isFinite(partySize) || partySize < 1) {
      return { ok: false, error: 'No offer deposit set — party size is not valid; save an offer first' }
    }
    multiplier = partySize
  }

  const cents = Math.round((exp.priceFrom * 100 * multiplier * depositPercent) / 100)
  return { ok: true, cents }
}
