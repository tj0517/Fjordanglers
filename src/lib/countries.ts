// ─── SINGLE SOURCE OF TRUTH FOR COUNTRIES ──────────────────────────────────
// All country-related constants should be imported from this file.

export const COUNTRIES = [
  'Norway',
  'Sweden',
  'Finland',
  'Iceland',
  'Denmark',
] as const

export type Country = (typeof COUNTRIES)[number]

/** ISO 3166-1 alpha-2 codes — used for flag image URLs */
export const COUNTRY_CODE: Record<Country, string> = {
  Norway:  'no',
  Sweden:  'se',
  Finland: 'fi',
  Iceland: 'is',
  Denmark: 'dk',
}

/** Returns a flagcdn.com image URL for the given country. */
export function getFlagUrl(country: string): string | null {
  const canonical = COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim())
  if (canonical == null) return null
  return `https://flagcdn.com/w20/${COUNTRY_CODE[canonical]}.png`
}

/** @deprecated Emoji flags don't render on Windows — use <CountryFlag> component instead */
export const COUNTRY_FLAG: Record<Country, string> = {
  Norway:  '🇳🇴',
  Sweden:  '🇸🇪',
  Finland: '🇫🇮',
  Iceland: '🇮🇸',
  Denmark: '🇩🇰',
}

/** Ordered list used in dropdowns and filters */
export const COUNTRY_OPTIONS = COUNTRIES.map(c => ({
  value: c,
  code:  COUNTRY_CODE[c],
  label: c,
}))

/** @deprecated Use getFlagUrl() + <img> or <CountryFlag> component instead */
export function getCountryFlag(country: string): string {
  const key = country.trim() as Country
  return COUNTRY_FLAG[key] ?? (COUNTRY_FLAG[
    (COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim()) ?? '') as Country
  ] ?? '')
}
