/**
 * fx.ts — Currency conversion helpers for the offer page.
 *
 * Exchange rates are fetched from frankfurter.app (free, ECB data, no API key).
 * Results are cached for 1 hour via Next.js fetch cache.
 *
 * Only used for display-only hints. Stripe always charges in EUR.
 */

// ─── Country → ISO 4217 currency ──────────────────────────────────────────────

const COUNTRY_CURRENCY: Record<string, string> = {
  // Non-EUR Nordics
  norway:          'NOK',
  sweden:          'SEK',
  iceland:         'ISK',
  denmark:         'DKK',
  // Central Europe (FA primary target markets)
  poland:          'PLN',
  'czech republic':'CZK',
  czechia:         'CZK',
  hungary:         'HUF',
  // Western Europe (non-EUR)
  switzerland:     'CHF',
  'united kingdom':'GBP',
  'great britain': 'GBP',
  uk:              'GBP',
  // Other
  'united states': 'USD',
  usa:             'USD',
  // EUR-zone countries — return null (no conversion shown)
  // finland, germany, austria, netherlands, belgium, france, italy,
  // spain, portugal, ireland, slovakia, slovenia, croatia, estonia,
  // latvia, lithuania → all EUR, omitted
}

/**
 * Returns the ISO 4217 currency code for a given country name,
 * or null if the country uses EUR (no conversion needed) or is unknown.
 */
export function currencyForCountry(country: string): string | null {
  const key = country.toLowerCase().trim()
  return COUNTRY_CURRENCY[key] ?? null
}

// ─── Rate fetch ───────────────────────────────────────────────────────────────

interface FrankfurterResponse {
  rates: Record<string, number>
}

/**
 * Fetches the EUR → toCurrency exchange rate from frankfurter.app.
 * Cached for 1 hour. Returns null on any error.
 */
export async function fetchEurRate(toCurrency: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=EUR&to=${toCurrency}`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as FrankfurterResponse
    return data.rates[toCurrency] ?? null
  } catch {
    return null
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Converts a EUR amount to the local currency and formats it.
 * e.g. fmtConverted(850, 4.18, 'PLN') → '≈ PLN 3,553'
 */
export function fmtConverted(amountEur: number, rate: number, currency: string): string {
  const local = Math.round(amountEur * rate)
  const formatted = new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(local)
  return `≈ ${formatted}`
}
