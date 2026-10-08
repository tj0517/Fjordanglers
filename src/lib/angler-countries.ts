/**
 * Where the angler lives — ISO 3166-1 alpha-2, stored in `inquiries.angler_country`.
 *
 * Not to be confused with `src/lib/countries.ts`, which lists the **destinations** FA sells
 * by name. This one is about the customer, and the code is what the guide dashboard and the
 * admin card already read (`COUNTRY_FLAG` keys there are alpha-2).
 *
 * The list is the markets FA actually sells into — the same fourteen the v1 widget's phone
 * picker offers, plus "somewhere else" so nobody is forced into a wrong answer. It is a
 * short list on purpose: a 200-entry select on the last step before the e-mail field costs
 * conversions, and the country is a routing hint, not a legal record.
 */

export const ANGLER_COUNTRIES: readonly { code: string; name: string }[] = [
  { code: 'PL', name: 'Poland' },
  { code: 'DE', name: 'Germany' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZZ', name: 'Somewhere else' },
]

const NAMES: Record<string, string> = Object.fromEntries(
  ANGLER_COUNTRIES.map(c => [c.code, c.name]),
)

/**
 * The country's English name for a stored code. Falls back to `Intl` for a code the list
 * does not carry (an inquiry imported from elsewhere), and to the code itself when even
 * that fails — printing "XK" is better than printing nothing.
 */
export function anglerCountryName(code: string | null | undefined): string | null {
  if (code == null) return null
  const key = code.trim().toUpperCase()
  if (key === '') return null
  if (NAMES[key] != null) return NAMES[key]
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(key) ?? key
  } catch {
    return key
  }
}
