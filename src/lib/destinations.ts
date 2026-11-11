import { type Country, type RegionGroup, COUNTRIES, COUNTRY_REGION } from './countries'
import type { HubContent } from './hubs/content'

/**
 * What stays in code about a hub (FA-1.85, O-42 → (b)): which hubs exist, which countries each one
 * covers, and — until FA-1.90 — the articles it links to. The editorial copy (h1, intro, meta,
 * season, species, FAQ, quote, proof note, contact) lives in the `destination_hubs` table and is
 * edited in /admin/hubs; `getDestinationHub()` joins the two into a `DestinationHub`.
 */
export type DestinationHubSkeleton = {
  slug: string
  group: RegionGroup
  /** Narrows the region group to specific countries. Absent means all countries in the group. */
  countries?: Country[]
  /** Articles the hub links to, in order. Empty = no "Read before you go" block (FA-1.83 fills it). */
  articles?: { slug: string; title: string }[]
}

/** A hub as the page renders it: the skeleton plus its content row. */
export type DestinationHub = DestinationHubSkeleton & HubContent

export const DESTINATION_HUBS: DestinationHubSkeleton[] = [
  { slug: 'patagonia', group: 'Patagonia' },
  { slug: 'iceland', group: 'Nordic', countries: ['Iceland'] },
  {
    slug: 'norway',
    group: 'Nordic',
    countries: ['Norway'],
    articles: [
      { slug: 'fishing-regulations-norway-2026', title: 'Fishing in Norway 2026: Regulations, Licenses, and Limits – A Complete Guide' },
    ],
  },
  { slug: 'sweden', group: 'Nordic', countries: ['Sweden'] },
  { slug: 'finland', group: 'Nordic', countries: ['Finland'] },
  { slug: 'new-zealand', group: 'New Zealand' },
]

/** Returns the full list of countries for a hub (resolves from region group if no override). */
export function getHubCountries(hub: DestinationHubSkeleton): Country[] {
  if (hub.countries != null) return hub.countries
  return COUNTRIES.filter(c => COUNTRY_REGION[c] === hub.group)
}

/** Map from country name -> hub slug, built once at module load. */
const COUNTRY_TO_HUB_SLUG: Partial<Record<string, string>> = {}
for (const hub of DESTINATION_HUBS) {
  for (const country of getHubCountries(hub)) {
    COUNTRY_TO_HUB_SLUG[country] = hub.slug
  }
}

/** Returns the hub slug for a country, or null if no hub covers that country. */
export function getHubSlugForCountry(country: string): string | null {
  return COUNTRY_TO_HUB_SLUG[country] ?? null
}

/** Finds a hub by slug. Returns undefined for unknown slugs. */
export function getHubForSlug(slug: string): DestinationHubSkeleton | undefined {
  return DESTINATION_HUBS.find(h => h.slug === slug)
}
