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
