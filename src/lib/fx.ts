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

/**
 * Fetches the EUR → toCurrency exchange rate for a specific past date (ECB reference
 * rate, 'YYYY-MM-DD'). Used to freeze a rate at the moment a historical payment was
 * actually made (CLAUDE.md rule 6), never "today's" rate. Not cached — each date is
 * looked up once and the result is frozen into the row. Returns null on any error.
 */
export async function fetchEurRateOn(date: string, toCurrency: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=EUR&to=${toCurrency}`)
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

// ─── Indicative conversion for the v2 offer page (FA-1.53) ───────────────────

/**
 * Currencies the offer page offers in its top bar. Short on purpose: each one is one
 * more rate request per page render, and the line it feeds is a courtesy ("≈ USD"),
 * not a price the angler is charged — Stripe always takes the deposit in EUR.
 */
const INDICATIVE_CURRENCIES = ['EUR', 'USD', 'GBP', 'PLN'] as const

/**
 * Rates that convert an amount in `baseCurrency` into each offered currency.
 *
 * frankfurter only quotes EUR → X, so anything that is not EUR-based needs a cross
 * rate: NZD → USD is (EUR → USD) ÷ (EUR → NZD), derived from two of the calls that
 * already exist rather than from a second provider. The arithmetic is deliberately
 * not frozen anywhere — this is display only, never stored, never charged
 * (CLAUDE.md rule 6 freezes the rates that *are* stored, at the event).
 *
 * Returns only the currencies whose rate could actually be fetched; the base currency
 * maps to 1. An empty-ish result is normal and the page simply omits the "≈" line —
 * a wrong number here is worse than no number.
 */
export async function fetchIndicativeRates(baseCurrency: string): Promise<Record<string, number>> {
  const base = baseCurrency.toUpperCase()

  const eurToBase = base === 'EUR' ? 1 : await fetchEurRate(base)
  if (eurToBase == null || eurToBase === 0) return { [base]: 1 }

  const pairs = await Promise.all(
    INDICATIVE_CURRENCIES.map(async target => {
      if (target === base) return [target, 1] as const
      const eurToTarget = target === 'EUR' ? 1 : await fetchEurRate(target)
      if (eurToTarget == null) return null
      return [target, eurToTarget / eurToBase] as const
    }),
  )

  const rates: Record<string, number> = { [base]: 1 }
  for (const pair of pairs) {
    if (pair != null) rates[pair[0]] = pair[1]
  }
  return rates
}

/**
 * An amount in minor units, converted and formatted for the "≈" line. Rounded to whole
 * units: showing cents on a rate that moves daily would be a precision we do not have.
 */
export function fmtIndicative(cents: number, rate: number, currency: string): string {
  const units = Math.round((cents / 100) * rate)
  return `≈ ${new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(units)}`
}
