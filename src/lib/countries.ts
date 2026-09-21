// ─── SINGLE SOURCE OF TRUTH FOR COUNTRIES ──────────────────────────────────
// All country-related constants should be imported from this file.

export const COUNTRIES = [
  'Norway',
  'Sweden',
  'Finland',
  'Iceland',
  'Denmark',
  'Argentina',
  'Chile',
  'New Zealand',
] as const

export type Country = (typeof COUNTRIES)[number]

/** Region group used for footer tagline context and same-region cross-sell fallback. */
export type RegionGroup = 'Nordic' | 'Patagonia' | 'New Zealand'

export const COUNTRY_REGION: Record<Country, RegionGroup> = {
  Norway:      'Nordic',
  Sweden:      'Nordic',
  Finland:     'Nordic',
  Iceland:     'Nordic',
  Denmark:     'Nordic',
  Argentina:   'Patagonia',
  Chile:       'Patagonia',
  'New Zealand': 'New Zealand',
}

/** Returns the region group for a country string, or null if it isn't a known `Country`. */
export function getRegionGroup(country: string): RegionGroup | null {
  const match = COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim())
  return match != null ? COUNTRY_REGION[match] : null
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
  'new zealand': 'nz', australia: 'au', argentina: 'ar', chile: 'cl',
}

/** Converts an ISO 3166-1 alpha-2 code to a Twemoji SVG path segment.
 *  e.g. "no" → "1f1f3-1f1f4" */
function isoToTwemojiPath(code: string): string {
  return code.toUpperCase().split('').map(c =>
    (0x1F1E6 + c.charCodeAt(0) - 65).toString(16)
  ).join('-')
}

/** Returns a Twemoji SVG URL for the given country name.
 *  Looks identical to macOS/iOS emoji flags and works on all platforms. */
export function getFlagUrl(country: string): string | null {
  const key = country.toLowerCase().trim()
  const code = EXTENDED_CODES[key]
  if (code == null) return null
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${isoToTwemojiPath(code)}.svg`
}


