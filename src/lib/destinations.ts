import { type Country, type RegionGroup, COUNTRIES, COUNTRY_REGION } from './countries'

export type DestinationHub = {
  slug: string
  group: RegionGroup
  /** Narrows the region group to specific countries. Absent means all countries in the group. */
  countries?: Country[]
  h1: string
  intro: string
  metaTitle: string
  metaDescription: string
}

export const DESTINATION_HUBS: DestinationHub[] = [
  {
    slug: 'patagonia',
    group: 'Patagonia',
    h1: 'Patagonia Fly Fishing Trips',
    intro: 'Two owner-guides, one in Bariloche and one in Coyhaique. Juan Leobono rows the Upper Limay and Manso. Alex Prior has guided the Aysén spring creeks since 1989. Guided days from $550 for two anglers, two and three day floats, hotel packages in Bariloche. Season runs November to April.',
    metaTitle: 'Patagonia Fly Fishing Trips',
    metaDescription: 'Two owner-guides in Bariloche and Coyhaique. Juan Leobono rows the Upper Limay. Alex Prior guides the Aysén spring creeks. From $550 for two anglers.',
  },
  {
    slug: 'iceland',
    group: 'Nordic',
    countries: ['Iceland'],
    h1: 'Iceland Fly Fishing Trips',
    intro: 'Andri Fannberg has guided out of Reykjavík for ten years. Brynjar Arnarsson runs river expeditions from the same base. Brown trout, arctic char and Atlantic salmon, depending on the river and the month. You talk to the guide who takes you out.',
    metaTitle: 'Iceland Fly Fishing Trips',
    metaDescription: 'Andri Fannberg and Brynjar Arnarsson guide from Reykjavík. Brown trout, arctic char and Atlantic salmon. You talk to the guide who takes you out.',
  },
  {
    slug: 'new-zealand',
    group: 'New Zealand',
    h1: 'New Zealand Fly Fishing Trips',
    intro: 'Josh Hart guides the Tongariro and the Taupō rivers on the North Island. Kristina Placko walks the Southland spring creeks around Lumsden and Mossburn. Full days from 1 100 NZD for two anglers, gear included. Sight fishing to visible trout in clear water.',
    metaTitle: 'New Zealand Fly Fishing Trips',
    metaDescription: 'Josh Hart on the Tongariro and Taupō. Kristina Placko on Southland spring creeks. Full days from 1100 NZD for two anglers, gear included.',
  },
]

/** Returns the full list of countries for a hub (resolves from region group if no override). */
export function getHubCountries(hub: DestinationHub): Country[] {
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
export function getHubForSlug(slug: string): DestinationHub | undefined {
  return DESTINATION_HUBS.find(h => h.slug === slug)
}
