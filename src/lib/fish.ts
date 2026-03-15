// ─── SINGLE SOURCE OF TRUTH FOR FISH SPECIES ──────────────────────────────
// All fish-related constants should be imported from this file.

/** Full list used in forms (experience creation, guide profiles, etc.) */
export const FISH_ALL = [
  // ── Salmonids ──────────────────────────────────────────────────────────
  'Salmon',
  'Sea Trout',
  'Brown Trout',
  'Rainbow Trout',
  'Arctic Char',
  'Grayling',
  'Whitefish',
  // ── Freshwater predators ───────────────────────────────────────────────
  'Pike',
  'Perch',
  'Zander',
  // ── Saltwater — demersal ───────────────────────────────────────────────
  'Cod',
  'Pollock',
  'Haddock',
  'Ling',
  'Halibut',
  'Flounder',
  'Wolffish',
  // ── Saltwater — other ─────────────────────────────────────────────────
  'Mackerel',
  'Garfish',
  'Norway Redfish',
] as const

export type FishSpecies = (typeof FISH_ALL)[number]

/** Subset shown in search filters and filter bars */
export const FISH_FILTER = [
  'Salmon',
  'Sea Trout',
  'Brown Trout',
  'Arctic Char',
  'Grayling',
  'Whitefish',
  'Pike',
  'Perch',
  'Zander',
  'Cod',
  'Pollock',
  'Haddock',
  'Halibut',
  'Wolffish',
  'Mackerel',
  'Garfish',
  'Norway Redfish',
  'Flounder',
] as const satisfies string[]

/**
 * Maps any fish name (as stored in DB or used in UI) to its catalog image.
 * Fallback to closest visual match when a dedicated image doesn't exist yet.
 */
export const FISH_IMG: Record<string, string> = {
  // Salmonids
  'Salmon':           '/fish_catalog/salmon.png',
  'Atlantic Salmon':  '/fish_catalog/salmon.png',
  'Sea Trout':        '/fish_catalog/sea_trout.png',
  'Brown Trout':      '/fish_catalog/brown_trout.png',
  'Rainbow Trout':    '/fish_catalog/rainbow_trout.png',
  'Trout':            '/fish_catalog/trout.png',
  'Arctic Char':      '/fish_catalog/char.png',
  'Grayling':         '/fish_catalog/grayling.png',
  'Whitefish':        '/fish_catalog/char.png',          // closest visual — TODO: dedicated image
  // Freshwater predators
  'Pike':             '/fish_catalog/pike.png',
  'Perch':            '/fish_catalog/perch.png',
  'Zander':           '/fish_catalog/zander.png',
  // Saltwater — demersal
  'Cod':              '/fish_catalog/cod.png',
  'Pollock':          '/fish_catalog/cod.png',           // TODO: dedicated image
  'Saithe':           '/fish_catalog/cod.png',
  'Haddock':          '/fish_catalog/cod.png',           // TODO: dedicated image
  'Ling':             '/fish_catalog/cod.png',           // TODO: dedicated image
  'Halibut':          '/fish_catalog/halibut.png',
  'Flounder':         '/fish_catalog/halibut.png',       // TODO: dedicated image
  'Wolffish':         '/fish_catalog/wolffish.png',
  'Norway Redfish':   '/fish_catalog/karmazyn.png',
  'Redfish':          '/fish_catalog/karmazyn.png',
  // Saltwater — other
  'Mackerel':         '/fish_catalog/mackrel.png',
  'Garfish':          '/fish_catalog/mackrel.png',       // TODO: dedicated image
}

/** Lookup image by page slug (used in /species/[slug]) */
export const FISH_IMG_BY_PAGE_SLUG: Record<string, string> = {
  salmon:         '/fish_catalog/salmon.png',
  sea_trout:      '/fish_catalog/sea_trout.png',
  brown_trout:    '/fish_catalog/brown_trout.png',
  rainbow_trout:  '/fish_catalog/rainbow_trout.png',
  trout:          '/fish_catalog/trout.png',
  arctic_char:    '/fish_catalog/char.png',
  grayling:       '/fish_catalog/grayling.png',
  whitefish:      '/fish_catalog/char.png',
  pike:           '/fish_catalog/pike.png',
  perch:          '/fish_catalog/perch.png',
  zander:         '/fish_catalog/zander.png',
  cod:            '/fish_catalog/cod.png',
  pollock:        '/fish_catalog/cod.png',
  haddock:        '/fish_catalog/cod.png',
  ling:           '/fish_catalog/cod.png',
  halibut:        '/fish_catalog/halibut.png',
  flounder:       '/fish_catalog/halibut.png',
  wolffish:       '/fish_catalog/wolffish.png',
  norway_redfish: '/fish_catalog/karmazyn.png',
  mackerel:       '/fish_catalog/mackrel.png',
  garfish:        '/fish_catalog/mackrel.png',
}

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
  { name: 'Arctic Char',      slug: 'Arctic Char',     pageSlug: 'arctic_char',    img: '/fish_catalog/char.png' },
  { name: 'Grayling',         slug: 'Grayling',        pageSlug: 'grayling',       img: '/fish_catalog/grayling.png' },
  { name: 'Pike',             slug: 'Pike',            pageSlug: 'pike',           img: '/fish_catalog/pike.png' },
  { name: 'Perch',            slug: 'Perch',           pageSlug: 'perch',          img: '/fish_catalog/perch.png' },
  { name: 'Zander',           slug: 'Zander',          pageSlug: 'zander',         img: '/fish_catalog/zander.png' },
  { name: 'Cod',              slug: 'Cod',             pageSlug: 'cod',            img: '/fish_catalog/cod.png' },
  { name: 'Halibut',          slug: 'Halibut',         pageSlug: 'halibut',        img: '/fish_catalog/halibut.png' },
  { name: 'Norway Redfish',   slug: 'Norway Redfish',  pageSlug: 'norway_redfish', img: '/fish_catalog/karmazyn.png' },
  { name: 'Wolffish',         slug: 'Wolffish',        pageSlug: 'wolffish',       img: '/fish_catalog/wolffish.png' },
  { name: 'Mackerel',         slug: 'Mackerel',        pageSlug: 'mackerel',       img: '/fish_catalog/mackrel.png' },
]
