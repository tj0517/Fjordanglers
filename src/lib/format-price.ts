const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  NZD: 'NZ$',
  GBP: '£',
  SEK: 'SEK ',
  NOK: 'NOK ',
  ISK: 'ISK ',
}

/** Never falls back to '€' — an unknown ISO code is shown as-is, with a trailing space. */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `
}

export interface FormatPriceInput {
  priceFrom: number
  priceType: string
  currency: string
}

export function formatPrice({ priceFrom, priceType, currency }: FormatPriceInput): string {
  if (priceType === 'request') return 'Price on request'
  const unit = priceType === 'flat' ? 'per trip' : '/ person'
  return `from ${currencySymbol(currency)}${priceFrom} ${unit}`
}

/**
 * An exact amount in integer minor units, for the v2 offer page (FA-1.53).
 *
 * Separate from `formatPrice` above, which renders the v1 "from €650 / person" line out of
 * major units and a `price_type`. This one prints one exact amount — the widget's Total,
 * Deposit and Balance lines — and keeps the whole cents of it: trailing cents are shown
 * only when there are any, so a round price reads "NZ$1,500", not "NZ$1,500.00".
 */
export function formatCents(cents: number, currency: string): string {
  const units    = cents / 100
  const decimals = cents % 100 === 0 ? 0 : 2
  const amount   = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(units)
  return `${currencySymbol(currency)}${amount}`
}
