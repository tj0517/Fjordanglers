export const DEPOSIT_PERCENT = 20

/** Format a deposit amount (integer cents ×100) with currency for display and draft text.
 *  Matches the card formatting in ThreadActionsPanel. */
export function formatDepositAmount(cents: number, currency: string): string {
  return (
    (cents / 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' ' +
    currency.toUpperCase()
  )
}

/** Deposit hint in minor units ×100 (same convention as offer_options.price_cents). */
export function depositHintCents(optionPriceCents: number): number {
  return Math.round(optionPriceCents * DEPOSIT_PERCENT / 100)
}

/** Also the currencies an offer option may use (FA-1.74, tj D-C). */
export const ALLOWED_DEPOSIT_CURRENCIES = ['EUR', 'USD', 'ISK', 'NZD'] as const
export type DepositCurrency = (typeof ALLOWED_DEPOSIT_CURRENCIES)[number]

export function isDepositCurrency(value: string): value is DepositCurrency {
  return (ALLOWED_DEPOSIT_CURRENCIES as readonly string[]).includes(value)
}

interface PriceEvent {
  type:    string
  payload: Record<string, unknown>
}

function optionPrice(list: unknown, optionId: string): { price_cents: unknown; currency: unknown } | null {
  if (!Array.isArray(list)) return null
  for (const item of list) {
    if (typeof item === 'object' && item != null && 'id' in item && item.id === optionId) {
      return {
        price_cents: 'price_cents' in item ? item.price_cents : null,
        currency:    'currency' in item ? item.currency : null,
      }
    }
  }
  return null
}

/**
 * FA-1.74: true when the accepted option's price (or currency) is no longer what it was
 * when the deposit amount was last saved. `events` in chronological order. The price at
 * that moment is the "before" of the first `offer.updated` after the last
 * `deposit.amount_set`; no edit since then → the deposit is current.
 */
export function depositSetFromOldPrice(
  events: readonly PriceEvent[],
  accepted: { id: string; price_cents: number; currency: string },
): boolean {
  let lastDeposit = -1
  events.forEach((e, i) => { if (e.type === 'deposit.amount_set') lastDeposit = i })
  if (lastDeposit === -1) return false
  for (const e of events.slice(lastDeposit + 1)) {
    if (e.type !== 'offer.updated') continue
    const atDeposit = optionPrice(e.payload.before, accepted.id)
    if (atDeposit == null) continue
    return atDeposit.price_cents !== accepted.price_cents
      || String(atDeposit.currency).toLowerCase() !== accepted.currency.toLowerCase()
  }
  return false
}
