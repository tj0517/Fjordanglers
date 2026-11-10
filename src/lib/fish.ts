// ─── SINGLE SOURCE OF TRUTH FOR FISH SPECIES ──────────────────────────────
// All fish-related constants should be imported from this file.

/** Full list used in forms (experience creation, guide profiles, etc.) */
export const FISH_ALL = [
  // ── Salmonids ──────────────────────────────────────────────────────────
  'Salmon',
  'Sea Trout',
  'Brown Trout',
  'Rainbow Trout',
  'Lake Trout',
  'Arctic Char',
  'Grayling',
  'Whitefish',
  'Brook Trout',
  'Coho Salmon',
  'Chinook Salmon',
  // ── Freshwater predators ───────────────────────────────────────────────
  'Pike',
  'Perch',
  'Zander',
  'Burbot',
  // ── Saltwater — demersal ───────────────────────────────────────────────
  'Cod',
  'Pollock',
  'Haddock',
  'Ling',
  'Brosme',
  'Halibut',
  'Flounder',
  'Wolffish',
  'Spiny Dogfish',
  // ── Saltwater — other ─────────────────────────────────────────────────
  'Sea Bass',
  'Mackerel',
  'Garfish',
  'Norway Redfish',
  // ── Saltwater — NZ ────────────────────────────────────────────────────
  'Saltwater Species: Kingfish & Coastal Predators',
] as const

/** Species shown on the homepage slider */
export const FISH_CATALOG: {
  name: string
  slug: string
  pageSlug: string
  img: string
}[] = [
  { name: 'Atlantic Salmon',  slug: 'Salmon',         pageSlug: 'salmon',         img: '/fish_catalog/salmon.png' },
  { name: 'Sea Trout',        slug: 'Sea Trout',       pageSlug: 'sea_trout',      img: '/fish_catalog/sea_trout.png' },
  { name: 'Brown Trout',      slug: 'Brown Trout',     pageSlug: 'brown_trout',    img: '/fish_catalog/brown_trout.png' },
  { name: 'Rainbow Trout',    slug: 'Rainbow Trout',   pageSlug: 'rainbow_trout',  img: '/fish_catalog/rainbow_trout.png' },
  { name: 'Lake Trout',       slug: 'Lake Trout',      pageSlug: 'lake_trout',     img: '/fish_catalog/lake-trout.png' },
  { name: 'Arctic Char',      slug: 'Arctic Char',     pageSlug: 'arctic_char',    img: '/fish_catalog/char.png' },
  { name: 'Grayling',         slug: 'Grayling',        pageSlug: 'grayling',       img: '/fish_catalog/grayling.png' },
  { name: 'Pike',             slug: 'Pike',            pageSlug: 'pike',           img: '/fish_catalog/pike.png' },
  { name: 'Perch',            slug: 'Perch',           pageSlug: 'perch',          img: '/fish_catalog/perch.png' },
  { name: 'Zander',           slug: 'Zander',          pageSlug: 'zander',         img: '/fish_catalog/zander.png' },
  { name: 'Cod',              slug: 'Cod',             pageSlug: 'cod',            img: '/fish_catalog/cod.png' },
  { name: 'Pollock',          slug: 'Pollock',         pageSlug: 'pollock',        img: '/fish_catalog/pollock.png' },
  { name: 'Ling',             slug: 'Ling',            pageSlug: 'ling',           img: '/fish_catalog/ling.png' },
  { name: 'Halibut',          slug: 'Halibut',         pageSlug: 'halibut',        img: '/fish_catalog/halibut.png' },
  { name: 'Brosme',           slug: 'Brosme',          pageSlug: 'brosme',         img: '/fish_catalog/brossma.png' },
  { name: 'Norway Redfish',   slug: 'Norway Redfish',  pageSlug: 'norway_redfish', img: '/fish_catalog/karmazyn.png' },
  { name: 'Wolffish',         slug: 'Wolffish',        pageSlug: 'wolffish',       img: '/fish_catalog/wolffish.png' },
  { name: 'Sea Bass',         slug: 'Sea Bass',        pageSlug: 'sea_bass',       img: '/fish_catalog/sea-bass.png' },
  { name: 'Mackerel',         slug: 'Mackerel',        pageSlug: 'mackerel',       img: '/fish_catalog/mackrel.png' },
  { name: 'Spiny Dogfish',    slug: 'Spiny Dogfish',   pageSlug: 'spiny_dogfish',  img: '/fish_catalog/spine-dogfish.png' },
]
