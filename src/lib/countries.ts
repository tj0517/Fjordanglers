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

/** Extended ISO codes for angler-origin countries (Central/Western Europe + Scandinavia) */
const EXTENDED_CODES: Record<string, string> = {
  norway: 'no', sweden: 'se', finland: 'fi', iceland: 'is', denmark: 'dk',
  poland: 'pl', germany: 'de', austria: 'at', switzerland: 'ch',
  'czech republic': 'cz', czechia: 'cz', hungary: 'hu', slovakia: 'sk',
  netherlands: 'nl', belgium: 'be', france: 'fr', italy: 'it', spain: 'es',
  uk: 'gb', 'united kingdom': 'gb', 'great britain': 'gb',
  ireland: 'ie', portugal: 'pt', 'united states': 'us', usa: 'us',
  estonia: 'ee', latvia: 'lv', lithuania: 'lt',
}

/** Returns a flagcdn.com image URL for the given country name. */
export function getFlagUrl(country: string): string | null {
  const key = country.toLowerCase().trim()
  const code = EXTENDED_CODES[key]
  if (code == null) return null
  return `https://flagcdn.com/w20/${code}.png`
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
