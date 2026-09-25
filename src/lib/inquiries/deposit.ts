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

const ALLOWED_DEPOSIT_CURRENCIES = ['EUR', 'USD', 'ISK', 'NZD'] as const
export type DepositCurrency = (typeof ALLOWED_DEPOSIT_CURRENCIES)[number]

export function isDepositCurrency(value: string): value is DepositCurrency {
  return (ALLOWED_DEPOSIT_CURRENCIES as readonly string[]).includes(value)
}
