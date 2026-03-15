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
  flag:  COUNTRY_FLAG[c],
  label: `${COUNTRY_FLAG[c]} ${c}`,
}))

/** Case-insensitive flag lookup — safe for DB values */
export function getCountryFlag(country: string): string {
  const key = country.trim() as Country
  return COUNTRY_FLAG[key] ?? (COUNTRY_FLAG[
    (COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim()) ?? '') as Country
  ] ?? '🌍')
}
