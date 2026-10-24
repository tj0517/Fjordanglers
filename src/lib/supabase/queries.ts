/**
 * Public Supabase query helpers — server-side, ISR-friendly.
 *
 * Uses the plain @supabase/supabase-js client (no cookies) so that
 * Next.js can cache these fetches and serve them via ISR / static rendering.
 * All queries read only publicly-visible data (active pages, verified guides).
 *
 * Import only in Server Components or Server Actions — never in Client Components.
 */

import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { COUNTRIES, getRegionGroup } from '@/lib/countries'
import { availabilityWindow } from '@/lib/availability-window'
import { effectivePrices, fromPrice, customRange, anglersPerGuideLabel, type PriceRow } from '@/lib/pricing/experience-price'
import { formatCents, formatPrice } from '@/lib/format-price'
import { env } from '@/lib/env'
import { DESTINATION_HUBS, getHubCountries, getHubForSlug, type DestinationHub } from '@/lib/destinations'
import { hubSpecies } from '@/lib/hub-species'
import { getTestimonial, type Testimonial } from './testimonials'
import {
  speciesNames,
  parseLicenseInfo,
  parseHeroFacts,
  parseDaySchedule,
  parseSeasonPeriods,
  parseItinerary,
  parseSuggestedLodging,
  parseFaq,
  parseContentBlocks,
  parseSpeciesDetails,
  safeHttpUrl,
  type LicenseInfo,
  type HeroFacts,
  type DayStep,
  type SeasonPeriod,
  type ItineraryDay,
  type LodgingSuggestion,
  type FaqEntry,
  type StoryBlock,
  type SpeciesDetail,
} from '@/lib/experience-v2-content'

// Cache tag constants — used here and revalidated from Server Actions.
export const CACHE_TAG_EXPERIENCES = 'experiences'
export const CACHE_TAG_GUIDES      = 'guides'

// ─── Client factory ───────────────────────────────────────────────────────────

/**
 * Lightweight anon client — no cookie handling, enables static / ISR rendering.
 * RLS policies on all public tables allow SELECT for the anon role.
 */
function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Sort images by `sort_order` ascending (cover first). */
function sortImages<T extends { sort_order: number }>(images: T[]): T[] {
  return [...images].sort((a, b) => a.sort_order - b.sort_order)
}

// ─── Featured guides ──────────────────────────────────────────────────────────

/**
 * Random verified guides — used in the home page "Meet the guides" section.
 */
export async function getFeaturedGuides(limit = 4): Promise<FeaturedGuide[]> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data, error } = await db
        .from('guides')
        .select('id, slug, full_name, avatar_url, cover_url, country, city, average_rating, years_experience, fish_expertise, languages, tagline')
        .eq('status', 'active')
        .eq('is_hidden', false)
        .not('verified_at', 'is', null)
        .limit(20)

      if (error) {
        console.error('[getFeaturedGuides]', error.message)
        return []
      }

      const all = (data ?? []) as FeaturedGuide[]
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]]
      }

      return all.slice(0, limit)
    },
    ['featured-guides', String(limit)],
    { revalidate: 300, tags: [CACHE_TAG_GUIDES] },
  )()
}

// ─── Platform stats ───────────────────────────────────────────────────────────

export type PlatformStats = {
  guideCount: number
  experienceCount: number
  countryCount: number
  languageCount: number
}

/**
 * Live counts for the stat strip shown on home + listing pages.
 * Three parallel requests — fast and cheap.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const [guideCountRes, expCountRes, guidesRes] = await Promise.all([
        db
          .from('guides')
          .select('id', { count: 'exact', head: true })
          .or('status.eq.active,verified_at.not.is.null')
          .eq('is_hidden', false),

        db
          .from('experience_pages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        db
          .from('guides')
          .select('country, languages')
          .or('status.eq.active,verified_at.not.is.null')
          .eq('is_hidden', false),
      ])

      const activeGuides = guidesRes.data ?? []

      const uniqueCountries = new Set(
        activeGuides
          .map(g => g.country)
          .filter((c): c is string => c != null && c !== ''),
      )

      const uniqueLanguages = new Set(
        activeGuides
          .flatMap(g => (g.languages as string[] | null) ?? []),
      )

      return {
        guideCount:      guideCountRes.count ?? 0,
        experienceCount: expCountRes.count ?? 0,
        countryCount:    uniqueCountries.size,
        languageCount:   uniqueLanguages.size,
      }
    },
    ['platform-stats'],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES, CACHE_TAG_GUIDES] },
  )()
}

// ─── Species counts ───────────────────────────────────────────────────────────

/**
 * Returns a map of { [speciesName]: pageCount } across all active experience pages.
 * Used to display live counts on the home page species picker.
 */
export async function getSpeciesCounts(): Promise<Record<string, number>> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data, error } = await db
        .from('experience_pages')
        .select('target_species')
        .eq('status', 'active')

      if (error) return {}

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        for (const species of row.target_species ?? []) {
          counts[species] = (counts[species] ?? 0) + 1
        }
      }
      return counts
    },
    ['species-counts'],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES] },
  )()
}

// ─── Guides ───────────────────────────────────────────────────────────────────

export type GuideRow = Database['public']['Tables']['guides']['Row']

export type FeaturedGuide = Pick<
  GuideRow,
  'id' | 'slug' | 'full_name' | 'avatar_url' | 'cover_url' | 'country' | 'city' |
  'average_rating' | 'years_experience' | 'fish_expertise' | 'languages' | 'tagline'
>

type GuideImageRow = Database['public']['Tables']['guide_images']['Row']

/** GuideRow extended with embedded gallery images (from guide_images table). */
export type GuideWithImages = GuideRow & { images: GuideImageRow[] }

export type GuideSearchParams = {
  country?: string
  language?: string
  page?: number
}

const GUIDES_PAGE_SIZE = 12

/**
 * Active (verified) guides with optional country + language filtering + pagination.
 * Used by the /guides listing page.
 */
export async function getGuides(
  params: GuideSearchParams = {},
): Promise<{ guides: GuideRow[]; total: number }> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()
      const page = Math.max(1, params.page ?? 1)
      const from = (page - 1) * GUIDES_PAGE_SIZE
      const to   = from + GUIDES_PAGE_SIZE - 1

      let query = db
        .from('guides')
        .select('*', { count: 'exact' })
        .or('status.eq.active,verified_at.not.is.null')
        .eq('is_hidden', false)
        .order('average_rating', { ascending: false, nullsFirst: false })
        .range(from, to)

      if (params.country)  query = query.eq('country', params.country)
      if (params.language) query = query.contains('languages', [params.language])

      const { data, error, count } = await query

      if (error) {
        console.error('[getGuides]', error.message)
        return { guides: [], total: 0 }
      }

      return { guides: data ?? [], total: count ?? 0 }
    },
    ['guides', JSON.stringify(params)],
    { revalidate: 300, tags: [CACHE_TAG_GUIDES] },
  )()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Fetch a guide by slug or UUID, with embedded gallery images.
 * UUID lookups first try by id; slug lookups try by slug column.
 * Returns null if not found / inactive / hidden.
 */
export async function getGuide(slugOrId: string): Promise<GuideWithImages | null> {
  const isUuid = UUID_RE.test(slugOrId)
  return unstable_cache(
    async () => {
      const db = createPublicClient()
      const SELECT = '*, images:guide_images ( id, guide_id, url, is_cover, sort_order, created_at )'

      // Primary lookup
      const primary = isUuid
        ? db.from('guides').select(SELECT).eq('id', slugOrId).eq('status', 'active').eq('is_hidden', false).maybeSingle()
        : db.from('guides').select(SELECT).eq('slug', slugOrId).eq('status', 'active').eq('is_hidden', false).maybeSingle()

      const { data, error } = await primary

      if (!error && data != null) {
        const guide = data as unknown as GuideWithImages
        return { ...guide, images: sortImages(guide.images ?? []) }
      }

      // Fallback: UUID might also be stored as slug (edge case)
      if (isUuid) {
        const { data: bySlug } = await db
          .from('guides').select(SELECT).eq('slug', slugOrId).eq('status', 'active').eq('is_hidden', false).maybeSingle()
        if (bySlug != null) {
          const guide = bySlug as unknown as GuideWithImages
          return { ...guide, images: sortImages(guide.images ?? []) }
        }
      }

      return null
    },
    ['guide', slugOrId],
    { revalidate: 300, tags: [CACHE_TAG_GUIDES] },
  )()
}

// ─── Guide experience pages (guide profile) ───────────────────────────────────

export type GuideExperiencePage = {
  id: string
  slug: string
  experience_name: string
  country: string
  hero_image_url: string | null
  gallery_image_urls: string[] | null
  price_from: number
  price_type: string
  currency: string
  target_species: string[] | null
  difficulty: string | null
}

/**
 * Active experience pages belonging to a specific guide.
 * Used on the public guide profile page — returns /experiences/[slug] cards.
 */
export async function getGuideExperiencePages(guideId: string): Promise<GuideExperiencePage[]> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data, error } = await db
        .from('experience_pages')
        .select('id, slug, experience_name, country, hero_image_url, gallery_image_urls, price_from, price_type, currency, target_species, difficulty')
        .eq('guide_id', guideId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) return []

      return (data ?? []) as GuideExperiencePage[]
    },
    ['guide-experience-pages', guideId],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES, CACHE_TAG_GUIDES] },
  )()
}

// ─── Featured experience pages (home slider) ──────────────────────────────────

export type FeaturedExperiencePage = {
  id: string
  slug: string
  experience_name: string
  country: string
  region: string
  price_from: number
  price_type: string
  currency: string
  hero_image_url: string | null
  guide: { id: string; full_name: string } | null
}

/**
 * Random active experience pages — used in the home page "Trips you can book" slider.
 */
export async function getFeaturedExperiencePages(limit = 8): Promise<FeaturedExperiencePage[]> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data, error } = await db
        .from('experience_pages')
        .select('id, slug, experience_name, country, region, price_from, price_type, currency, hero_image_url, guide:guides!guide_id ( id, full_name )')
        .eq('status', 'active')
        .limit(40)

      if (error) {
        console.error('[getFeaturedExperiencePages]', error.message)
        return []
      }

      const all = (data ?? []) as unknown as FeaturedExperiencePage[]

      // Fisher-Yates shuffle
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]]
      }

      return all.slice(0, limit)
    },
    ['featured-experience-pages', String(limit)],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES] },
  )()
}

// ─── Related experience pages (offer page, "More trips") ─────────────────────

export type RelatedExperiencePages = {
  /** How close the picks are to the page they sit under — the heading is worded from it. */
  tier:  'region' | 'country' | 'group' | 'anywhere'
  pages: FeaturedExperiencePage[]
}

const RELATED_SELECT =
  'id, slug, experience_name, country, region, price_from, price_type, currency, hero_image_url, guide:guides!guide_id ( id, full_name )'

/**
 * Up to `limit` other active pages, as close as the catalogue allows: same region, else
 * same country, else the same part of the world (`getRegionGroup`), else any. Each tier is
 * tried only when the previous one is empty, so the result is never a mix the heading
 * cannot describe. Cached like the featured list; a page edit revalidates the tag.
 */
export async function getRelatedExperiencePages({
  pageId, country, region, limit = 3,
}: {
  pageId: string; country: string; region: string; limit?: number
}): Promise<RelatedExperiencePages> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const groupCountries = (() => {
        const group = getRegionGroup(country)
        return group == null ? [] : COUNTRIES.filter(c => getRegionGroup(c) === group && c !== country)
      })()

      const tiers: { tier: RelatedExperiencePages['tier']; apply: (q: ReturnType<typeof base>) => ReturnType<typeof base> }[] = [
        { tier: 'region',   apply: q => q.eq('country', country).eq('region', region) },
        { tier: 'country',  apply: q => q.eq('country', country) },
        { tier: 'group',    apply: q => q.in('country', groupCountries) },
        { tier: 'anywhere', apply: q => q },
      ]

      function base() {
        return db
          .from('experience_pages')
          .select(RELATED_SELECT)
          .eq('status', 'active')
          .neq('id', pageId)
          .limit(limit)
      }

      for (const { tier, apply } of tiers) {
        if (tier === 'region' && region === '') continue
        if (tier === 'group' && groupCountries.length === 0) continue

        const { data, error } = await apply(base())
        if (error) {
          console.error('[getRelatedExperiencePages]', tier, error.message)
          continue
        }
        if (data != null && data.length > 0) {
          return { tier, pages: data as unknown as FeaturedExperiencePage[] }
        }
      }

      return { tier: 'anywhere' as const, pages: [] }
    },
    ['related-experience-pages', pageId, String(limit)],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES] },
  )()
}

// ─── Active destination countries (footer) ────────────────────────────────────

/**
 * Distinct countries with at least one active experience page, ordered to match
 * COUNTRIES (Nordic first, then Patagonia, then New Zealand) rather than alphabetically.
 * Used by the footer's "Destinations" list — a country with 0 active pages disappears
 * on its own, no hardcoded array to maintain.
 */
export async function getActiveDestinationCountries(): Promise<string[]> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data, error } = await db
        .from('experience_pages')
        .select('country')
        .eq('status', 'active')

      if (error) {
        console.error('[getActiveDestinationCountries]', error.message)
        return []
      }

      const active = new Set((data ?? []).map(row => row.country))
      return COUNTRIES.filter(c => active.has(c))
    },
    ['active-destination-countries'],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES] },
  )()
}

// ─── Experience page routing (FA-1.52) ───────────────────────────────────────

export type ExperienceRouting = {
  /** experience_pages.page_version — 1 = editorial template, 2 = offer-centric. */
  pageVersion:   1 | 2
  /** The slug the page lives at today. Differs from the asked slug for aliases. */
  canonicalSlug: string
}

/**
 * Which template a slug should render, and where the slug really lives.
 *
 * Returns null when the slug matches neither an active page nor an alias of
 * one — the caller renders v1, which 404s. A retired slug (experience_slug_aliases)
 * resolves to its current page, so the router can 308 to canonicalSlug; the
 * redirect target therefore always comes from the database, never the request.
 */
export async function getExperienceRouting(slug: string): Promise<ExperienceRouting | null> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data: page, error } = await db
        .from('experience_pages')
        .select('slug, page_version')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (error != null) {
        console.error('[getExperienceRouting]', error.message)
        return null
      }

      if (page != null) {
        return { pageVersion: page.page_version === 2 ? 2 : 1, canonicalSlug: page.slug } as const
      }

      const { data: alias, error: aliasError } = await db
        .from('experience_slug_aliases')
        .select('experience_id')
        .eq('slug', slug)
        .maybeSingle()

      if (aliasError != null) {
        console.error('[getExperienceRouting] alias', aliasError.message)
        return null
      }
      if (alias == null) return null

      const { data: target } = await db
        .from('experience_pages')
        .select('slug, page_version')
        .eq('id', alias.experience_id)
        .eq('status', 'active')
        .maybeSingle()

      if (target == null) return null

      return { pageVersion: target.page_version === 2 ? 2 : 1, canonicalSlug: target.slug } as const
    },
    ['experience-routing', slug],
    { revalidate: 3600, tags: [CACHE_TAG_EXPERIENCES] },
  )()
}

/**
 * Service-role reader for the one piece of a v2 page that RLS cannot serve: the reviewer's
 * first name and country live on `inquiries`, which `anon` may not read at all (and must
 * not — the row also holds the e-mail, the phone and FA's internal notes).
 *
 * Built here rather than imported from `@/lib/supabase/server` so this module keeps its
 * "no cookies, ISR-friendly" property. Only the three fields the review card prints ever
 * leave `getExperienceV2`.
 */
function createServiceReadClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Experience page v2 — the offer-centric template (FA-1.53) ───────────────

/** One guide shown on the page, from `experience_guides` + `guides`. */
type ExperienceV2Guide = {
  id:                string
  slug:              string | null
  fullName:          string
  avatarUrl:         string | null
  yearsExperience:   number | null
  association:       string | null
  responseTimeHours: number | null
  googleRating:      number | null
  googleReviewCount: number | null
  /** Already checked `http(s)` — the value is admin-typed, and a page must not link to `javascript:`. */
  googleProfileUrl:  string | null
  languages:         string[]
  bio:               string | null
  /** How this guide collects the balance — the last step of "How booking works" (S8). */
  balancePaymentMethod: 'cash' | 'stripe'
  isPrimary:         boolean
}

type ExperienceV2Option = {
  id:              string
  kind:            string
  label:           string
  priceFromCents:  number | null
  priceToCents:    number | null
  currency:        string | null
  durationDaysMin: number | null
  durationDaysMax: number | null
  description:     string | null
  /** `archetype` options only; empty for the others. */
  sampleItinerary: ItineraryDay[]
}

/**
 * One review card of S10 (FA-1.55).
 *
 * `firstName` is the first word of the angler's name and nothing else (tj 2026-10-07,
 * option C): the review form records no consent to publish a name, so the page shows the
 * least that still reads as a person.
 */
export type ExperienceV2Review = {
  id:          string
  rating:      number | null
  comment:     string | null
  firstName:   string | null
  /** ISO 3166-1 alpha-2, when the inquiry carries one. */
  country:     string | null
  submittedAt: string
  /** First `http(s)` entry of `media_urls`, when there is one. */
  photoUrl:    string | null
}

export type ExperienceV2 = {
  id:                 string
  slug:               string
  experienceName:     string
  introText:          string | null
  /** The written story and its photo blocks — the v1 editorial fields, kept on v2. */
  storyText:          string | null
  contentBlocks:      StoryBlock[]
  speciesDetails:     SpeciesDetail[]
  catchesText:        string | null
  environment:        string[]
  country:            string
  region:             string
  heroImageUrl:       string | null
  galleryImageUrls:   string[]
  includes:           string[]
  excludes:           string[]
  speciesNames:       string[]
  technique:          string[]
  meetingPointName:        string | null
  meetingPointDescription: string | null
  walkingKmMin:       number | null
  walkingKmMax:       number | null
  license:            LicenseInfo | null
  /** Chips and cards typed in the admin; null or a null field = computed (FA-1.63). */
  heroFacts:          HeroFacts | null
  tipGuidanceText:    string | null
  suitedFor:          string[]
  notSuitedFor:       string[]
  expectationsText:   string | null
  /** `fixed` pages: the day as a timeline. Empty = no S6. */
  daySchedule:        DayStep[]
  weatherPolicyText:  string | null
  offerEtaText:       string | null
  seasonMonths:       number[]
  /** The best months of `seasonMonths`; a subset of it, drawn darker on the season bar. */
  peakMonths:         number[]
  /** S11: what each part of the season is like, shown under the bar for its months. */
  seasonPeriods:      SeasonPeriod[]
  minDays:            number
  maxDays:            number | null
  maxAnglersPerGuide: number
  responseSlaHours:   number
  offerMode:          'fixed' | 'custom'
  /** `experience_pages.fee_pct` — the FA fee, which is also the deposit (ADR-0001). */
  feePct:             number
  currency:           string
  /** `custom` pages only: the indicative range, shown exactly as stored (no FA fee added). */
  priceFromCents:     number | null
  priceToCents:       number | null
  /** S11: the pin of the map. Both or neither — a lone coordinate draws nothing. */
  locationLat:        number | null
  locationLng:        number | null
  nearestAirport:     string | null
  suggestedLodging:   LodgingSuggestion[]
  /** S12 — `experience_pages.what_to_bring`. */
  whatToBring:        string[]
  /** S13 — the page's own questions. Empty = no S13. */
  faq:                FaqEntry[]
  metaTitle:          string | null
  metaDescription:    string | null
  /** S10 — newest first, at most 6. Empty means the page shows no reviews section. */
  reviews:            ExperienceV2Review[]
  guides:             ExperienceV2Guide[]
  /** Current rows, already carrying the primary guide's override if there is one. */
  prices:             PriceRow[]
  options:            ExperienceV2Option[]
}

type RawGuideRow = {
  role:         string
  status:       string
  show_on_page: boolean
  sort_order:   number
  guide_price_override_cents: number | null
  guide: {
    id:                  string
    slug:                string | null
    full_name:           string
    avatar_url:          string | null
    years_experience:    number | null
    association:         string | null
    response_time_hours: number | null
    google_rating:       number | null
    google_review_count: number | null
    google_profile_url:  string | null
    languages:           string[]
    bio:                 string | null
    default_balance_payment_method: string
  } | null
}

/**
 * Keeps the newest row per (days, anglers), matching how the override trigger picks a base
 * price: latest `valid_from`, with an undated row last (`ORDER BY valid_from DESC NULLS LAST`).
 * A dated row therefore wins over the page's standing price while its season is on.
 */
function newestPerSlot(
  rows: { days: number; anglers: number; guide_price_cents: number; currency: string; valid_from: string | null }[],
): PriceRow[] {
  const best = new Map<string, (typeof rows)[number]>()

  for (const row of rows) {
    const key     = `${row.days}×${row.anglers}`
    const current = best.get(key)
    const newer   = current == null
      || (row.valid_from != null && (current.valid_from == null || row.valid_from > current.valid_from))
    if (newer) best.set(key, row)
  }

  return [...best.values()]
    .map(r => ({ days: r.days, anglers: r.anglers, guidePriceCents: r.guide_price_cents, currency: r.currency }))
    .sort((a, b) => a.days - b.days || a.anglers - b.anglers)
}

type RawPriceRow = {
  days: number; anglers: number; guide_price_cents: number; currency: string
  valid_from: string | null; valid_to: string | null
}

/**
 * The price rows a v2 page quotes from: current on `today`, the newest per slot, the shown
 * primary guide's override folded into the base row. Shared by the offer page and the hub
 * cards (FA-1.65) so a card can never print a different "from" than the page it links to.
 */
function pagePrices(
  rows: RawPriceRow[],
  { today, maxAnglersPerGuide, overrideCents }: { today: string; maxAnglersPerGuide: number; overrideCents: number | null },
): PriceRow[] {
  const current = rows.filter(
    r => (r.valid_from == null || r.valid_from <= today) && (r.valid_to == null || r.valid_to >= today),
  )
  return effectivePrices(newestPerSlot(current), { maxAnglersPerGuide, overrideCents })
}

type RawReviewRow = {
  id:             string
  overall_rating: number | null
  comment:        string | null
  submitted_at:   string | null
  media_urls:     unknown
  inquiry: { angler_name: string | null; angler_country: string | null } | null
}

/** First `http(s)` entry of `media_urls`; anything else in the array is ignored. */
function firstPhotoUrl(mediaUrls: unknown): string | null {
  if (!Array.isArray(mediaUrls)) return null
  for (const entry of mediaUrls) {
    const url = safeHttpUrl(typeof entry === 'string' ? entry : null)
    if (url != null) return url
  }
  return null
}

/**
 * What the page is allowed to say about a reviewer: the first word of their name, their
 * country, the month they submitted, the rating, the text and one photo. The e-mail, the
 * phone, the full name and the inquiry id stay on the server (tj 2026-10-07, option C).
 *
 * A row with neither a rating nor a comment is dropped — an empty card is not social proof.
 */
function reviewCards(rows: unknown[]): ExperienceV2Review[] {
  return (rows as RawReviewRow[]).flatMap(row => {
    if (row.submitted_at == null) return []
    const comment = row.comment?.trim() ?? ''
    if (comment === '' && row.overall_rating == null) return []

    const firstName = row.inquiry?.angler_name?.trim().split(/\s+/)[0] ?? null

    return [{
      id:          row.id,
      rating:      row.overall_rating,
      comment:     comment === '' ? null : comment,
      firstName:   firstName === '' ? null : firstName,
      country:     row.inquiry?.angler_country ?? null,
      submittedAt: row.submitted_at,
      photoUrl:    firstPhotoUrl(row.media_urls),
    }]
  })
}

/**
 * The guide a v2 page's inquiry belongs to: the active `primary` row of
 * `experience_guides` (proposal §7 step 3). Null when the page has no primary guide — the
 * caller then keeps whatever `experience_pages.guide_id` says rather than losing the guide.
 *
 * Takes the caller's client so the public API route does not open a second connection.
 */
export async function getPrimaryGuideId(
  client: ServiceClient,
  experiencePageId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('experience_guides')
    .select('guide_id')
    .eq('experience_id', experiencePageId)
    .eq('role', 'primary')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (error != null) throw new Error(`getPrimaryGuideId: ${error.message}`)
  return data?.guide_id ?? null
}

/**
 * Everything the v2 offer page renders, in one call — the only read path for that template
 * (CLAUDE.md rule 3: no `.from(` in components).
 *
 * Two filters are deliberately applied here in code rather than left to the database:
 *
 *  • **Which guides the page may show.** The policy "Public reads guides of active pages"
 *    returns every row of an active page — `paused`, `backup` and `show_on_page = false`
 *    included (docs/deferred-tasks.md, FA-1.50). The page may show only active rows with
 *    `show_on_page`, so that is enforced here. Narrowing the policy itself is that deferred row.
 *
 *  • **Which prices are current.** `valid_from`/`valid_to` are compared against one clock
 *    read, in the data layer, so the whole page prices off a single date.
 *
 * `guide_price_override_cents` never leaves this function: it is folded into the price rows
 * (the base row only — days 1 × `max_anglers_per_guide`, tj 2026-10-07) so the number the
 * client receives is already the price this guide charges, and the column itself — like guide
 * contact data, which is not selected at all — stays out of the client bundle.
 */
export async function getExperienceV2(slug: string): Promise<ExperienceV2 | null> {
  return unstable_cache(
    async () => {
      const db = createPublicClient()

      const { data: page, error } = await db
        .from('experience_pages')
        .select(`
          id, slug, experience_name, intro_text, country, region,
          story_text, content_blocks, catches_text, environment,
          hero_image_url, gallery_image_urls, includes, excludes, season_months, season_periods,
          species_details, technique, meeting_point_name, meeting_point_description,
          walking_km_min, walking_km_max, license_info, hero_facts, tip_guidance_text,
          suited_for, not_suited_for, expectations_text, day_schedule,
          weather_policy_text, offer_eta_text,
          min_days, max_days, max_anglers_per_guide, response_sla_hours,
          offer_mode, fee_pct, currency, price_from_cents, price_to_cents,
          peak_months, location_lat, location_lng, nearest_airport, suggested_lodging,
          what_to_bring, faq,
          meta_title, meta_description
        `)
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (error != null) {
        console.error('[getExperienceV2]', error.message)
        return null
      }
      if (page == null) return null

      const [guidesResult, pricesResult, optionsResult, reviewsResult] = await Promise.all([
        db
          .from('experience_guides')
          .select(`
            role, status, show_on_page, sort_order, guide_price_override_cents,
            guide:guides!guide_id (
              id, slug, full_name, avatar_url, years_experience, association,
              response_time_hours, google_rating, google_review_count, google_profile_url,
              languages, bio, default_balance_payment_method
            )
          `)
          .eq('experience_id', page.id),
        db
          .from('experience_prices')
          .select('days, anglers, guide_price_cents, currency, valid_from, valid_to')
          .eq('experience_id', page.id),
        db
          .from('experience_page_options')
          .select('id, kind, label, price_from_cents, price_to_cents, currency, duration_days_min, duration_days_max, description, sample_itinerary, sort_order')
          .eq('experience_page_id', page.id)
          .order('sort_order', { ascending: true }),
        // Only reviews stamped with this page (tj 2026-10-07, option A: `experience_id`
        // only — no fallback through the inquiry). Submitted ones only: an unanswered
        // review link is a row with nothing in it. Consented ones only (FA-1.59, O-37 a):
        // the name, country and photos are shown only when the author ticked the box.
        createServiceReadClient()
          .from('reviews')
          .select('id, overall_rating, comment, submitted_at, media_urls, inquiry:inquiries!inquiry_id (angler_name, angler_country)')
          .eq('experience_id', page.id)
          .eq('publish_consent', true)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(6),
      ])

      if (guidesResult.error != null) console.error('[getExperienceV2] guides', guidesResult.error.message)
      if (pricesResult.error != null) console.error('[getExperienceV2] prices', pricesResult.error.message)
      if (optionsResult.error != null) console.error('[getExperienceV2] options', optionsResult.error.message)
      if (reviewsResult.error != null) console.error('[getExperienceV2] reviews', reviewsResult.error.message)

      // Only rows the page is allowed to show — see the note above.
      const shown = ((guidesResult.data ?? []) as unknown as RawGuideRow[])
        .filter(row => row.status === 'active' && row.show_on_page && row.guide != null)
        .sort((a, b) => a.sort_order - b.sort_order)

      const guides: ExperienceV2Guide[] = shown.map(row => ({
        id:                row.guide!.id,
        slug:              row.guide!.slug,
        fullName:          row.guide!.full_name,
        avatarUrl:         row.guide!.avatar_url,
        yearsExperience:   row.guide!.years_experience,
        association:       row.guide!.association,
        responseTimeHours: row.guide!.response_time_hours,
        googleRating:      row.guide!.google_rating,
        googleReviewCount: row.guide!.google_review_count,
        googleProfileUrl:  safeHttpUrl(row.guide!.google_profile_url),
        languages:         row.guide!.languages ?? [],
        bio:               row.guide!.bio,
        balancePaymentMethod: row.guide!.default_balance_payment_method === 'stripe' ? 'stripe' : 'cash',
        isPrimary:         row.role === 'primary',
      }))

      // One clock read for the whole page, in the data layer (src/lib/availability-window.ts).
      const prices = pagePrices(pricesResult.data ?? [], {
        today:              availabilityWindow(0).from,
        maxAnglersPerGuide: page.max_anglers_per_guide,
        // The override belongs to the primary guide — the one whose price the widget quotes.
        overrideCents:      shown.find(row => row.role === 'primary')?.guide_price_override_cents ?? null,
      })

      // Narrowed to the union here: in a plain object literal the ternary widens to `string`.
      const offerMode: 'fixed' | 'custom' = page.offer_mode === 'custom' ? 'custom' : 'fixed'

      return {
        id:                 page.id,
        slug:               page.slug,
        experienceName:     page.experience_name,
        introText:          page.intro_text,
        storyText:          page.story_text,
        contentBlocks:      parseContentBlocks(page.content_blocks),
        speciesDetails:     parseSpeciesDetails(page.species_details),
        catchesText:        page.catches_text,
        environment:        page.environment ?? [],
        country:            page.country,
        region:             page.region,
        heroImageUrl:       page.hero_image_url,
        galleryImageUrls:   page.gallery_image_urls ?? [],
        includes:           page.includes ?? [],
        excludes:           page.excludes ?? [],
        speciesNames:       speciesNames(page.species_details),
        technique:          page.technique ?? [],
        meetingPointName:        page.meeting_point_name,
        meetingPointDescription: page.meeting_point_description,
        walkingKmMin:       page.walking_km_min,
        walkingKmMax:       page.walking_km_max,
        license:            parseLicenseInfo(page.license_info),
        heroFacts:          parseHeroFacts(page.hero_facts),
        tipGuidanceText:    page.tip_guidance_text,
        suitedFor:          page.suited_for ?? [],
        notSuitedFor:       page.not_suited_for ?? [],
        expectationsText:   page.expectations_text,
        daySchedule:        parseDaySchedule(page.day_schedule),
        weatherPolicyText:  page.weather_policy_text,
        offerEtaText:       page.offer_eta_text,
        seasonMonths:       page.season_months ?? [],
        peakMonths:         page.peak_months ?? [],
        seasonPeriods:      parseSeasonPeriods(page.season_periods),
        minDays:            page.min_days,
        maxDays:            page.max_days,
        maxAnglersPerGuide: page.max_anglers_per_guide,
        responseSlaHours:   page.response_sla_hours,
        offerMode,
        feePct:             page.fee_pct,
        currency:           page.currency,
        priceFromCents:     page.price_from_cents,
        priceToCents:       page.price_to_cents,
        locationLat:        page.location_lat,
        locationLng:        page.location_lng,
        nearestAirport:     page.nearest_airport,
        suggestedLodging:   parseSuggestedLodging(page.suggested_lodging),
        whatToBring:        page.what_to_bring ?? [],
        faq:                parseFaq(page.faq),
        metaTitle:          page.meta_title,
        metaDescription:    page.meta_description,
        reviews:            reviewCards(reviewsResult.data ?? []),
        guides,
        prices,
        options: (optionsResult.data ?? []).map(o => ({
          id:              o.id,
          kind:            o.kind,
          label:           o.label,
          priceFromCents:  o.price_from_cents,
          priceToCents:    o.price_to_cents,
          currency:        o.currency,
          durationDaysMin: o.duration_days_min,
          durationDaysMax: o.duration_days_max,
          description:     o.description,
          sampleItinerary: o.kind === 'archetype' ? parseItinerary(o.sample_itinerary) : [],
        })),
      }
    },
    ['experience-v2', slug],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES, CACHE_TAG_GUIDES] },
  )()
}

/**
 * Whether a page renders with the v2 template — the one condition the experience router uses
 * (`src/app/experiences/[slug]/page.tsx`), shared so the hub cards price an offer exactly as
 * the page they link to does.
 */
export function rendersAsV2(pageVersion: number | null | undefined): boolean {
  return env.EXPERIENCE_V2_ENABLED && pageVersion === 2
}

// ─── Country hub v2 (FA-1.65) ─────────────────────────────────────────────────

/** One card of the hub. `page` carries the fields `ExpCard` prints. */
export type HubOffer = {
  id: string
  page: {
    slug:                string
    experience_name:     string
    country:             string
    region:              string
    price_from:          number
    price_type:          string
    currency:            string
    hero_image_url:      string | null
    gallery_image_urls:  string[]
    difficulty:          string | null
    non_angler_friendly: boolean | null
  }
  /** The price exactly as the offer page prints it (tj 3b, 2026-10-23) — a `custom` page's indicative range included. */
  priceText:     string
  targetSpecies: string[]
  locationLat:   number | null
  locationLng:   number | null
  /** Guides the offer page shows (active + `show_on_page`), in its order. */
  guides:        { name: string; avatarUrl: string | null }[]
}

export type DestinationHubData = {
  hub:        DestinationHub
  offers:     HubOffer[]
  /** Distinct guides shown on the hub's active offers. */
  guideCount: number
  /** The hero's "from" — null when the hub has no priced offer in its dominant currency. */
  priceFrom:  { cents: number; currency: string; text: string } | null
  /** Species chips: the hub's own list, or the union of its offers' (tj D2). */
  species:    string[]
  /** Newest first, at most six, consented and submitted only — the review-card fields only. */
  reviews:    ExperienceV2Review[]
  /** Stands in for the reviews section when there are none (FA-1.69); null when there are. */
  testimonial: Testimonial | null
  /** Hero image of the newest active offer. */
  ogImage:    string | null
  otherHubs:  { slug: string; h1: string }[]
}

type RawHubGuideRow = {
  experience_id: string
  role:          string
  status:        string
  show_on_page:  boolean
  sort_order:    number
  guide_price_override_cents: number | null
  guide: { id: string; full_name: string; avatar_url: string | null } | null
}

/**
 * The hub's proof-line price (tj D3 + decisions 1 and 3b, 2026-10-23): the lowest priced offer
 * in the hub's dominant currency — the currency most of its active offers are in. Offers on
 * request carry no amount and do not count towards the minimum; a v2 `custom` offer counts with
 * the lower bound of its indicative range (tj, 2026-10-23). Two currencies with the same
 * number of offers have no dominant one, so no price is shown rather than a guessed one.
 */
function hubPriceFrom(
  offers: { currency: string; cents: number | null; text: string }[],
): DestinationHubData['priceFrom'] {
  const counts = new Map<string, number>()
  for (const o of offers) counts.set(o.currency, (counts.get(o.currency) ?? 0) + 1)

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  if (top == null || (ranked[1] != null && ranked[1][1] === top[1])) return null

  let best: DestinationHubData['priceFrom'] = null
  for (const o of offers) {
    if (o.currency !== top[0] || o.cents == null) continue
    if (best == null || o.cents < best.cents) best = { cents: o.cents, currency: o.currency, text: o.text }
  }
  return best
}

/**
 * Everything a country hub (`/[destination]`) shows, in one call — the page itself queries
 * nothing (CLAUDE.md rule 3). Null for a slug that is not in `DESTINATION_HUBS`.
 *
 * The same filters as `getExperienceV2`, for the same reasons: guides only when active and
 * `show_on_page` (the read policy returns every row of an active page), reviews only when
 * consented and submitted, read with the service role and cut down to the card fields — the
 * reviewer's e-mail, phone, full name and inquiry id never leave this function, and neither
 * does `guide_price_override_cents` (it is folded into the card's price).
 */
export async function getDestinationHub(slug: string): Promise<DestinationHubData | null> {
  const hub = getHubForSlug(slug)
  if (hub == null) return null

  // Only what the database says is cached; the hub's own config (copy, species override,
  // the other hubs) is applied after, so a deploy that edits `destinations.ts` shows at once.
  const fromDb = await unstable_cache(
    async (): Promise<Omit<DestinationHubData, 'hub' | 'species' | 'otherHubs' | 'testimonial'>> => {
      const db = createPublicClient()

      const { data: pages, error } = await db
        .from('experience_pages')
        .select(`
          id, slug, experience_name, country, region, price_from, price_type, currency,
          hero_image_url, gallery_image_urls, difficulty, non_angler_friendly, target_species,
          location_lat, location_lng, page_version, offer_mode, fee_pct, max_anglers_per_guide,
          price_from_cents, price_to_cents
        `)
        .eq('status', 'active')
        .in('country', getHubCountries(hub))
        .order('created_at', { ascending: false })

      if (error != null) console.error('[getDestinationHub]', error.message)

      const rows  = pages ?? []
      const ids   = rows.map(p => p.id)
      const v2Ids = rows.filter(p => rendersAsV2(p.page_version)).map(p => p.id)

      const [guidesResult, pricesResult, reviewsResult] = await Promise.all([
        ids.length === 0 ? null : db
          .from('experience_guides')
          .select(`
            experience_id, role, status, show_on_page, sort_order, guide_price_override_cents,
            guide:guides!guide_id ( id, full_name, avatar_url )
          `)
          .in('experience_id', ids),
        v2Ids.length === 0 ? null : db
          .from('experience_prices')
          .select('experience_id, days, anglers, guide_price_cents, currency, valid_from, valid_to')
          .in('experience_id', v2Ids),
        ids.length === 0 ? null : createServiceReadClient()
          .from('reviews')
          .select('id, overall_rating, comment, submitted_at, media_urls, inquiry:inquiries!inquiry_id (angler_name, angler_country)')
          .in('experience_id', ids)
          .eq('publish_consent', true)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(6),
      ])

      if (guidesResult?.error != null)  console.error('[getDestinationHub] guides', guidesResult.error.message)
      if (pricesResult?.error != null)  console.error('[getDestinationHub] prices', pricesResult.error.message)
      if (reviewsResult?.error != null) console.error('[getDestinationHub] reviews', reviewsResult.error.message)

      const shown = ((guidesResult?.data ?? []) as unknown as RawHubGuideRow[])
        .filter(row => row.status === 'active' && row.show_on_page && row.guide != null)
        .sort((a, b) => a.sort_order - b.sort_order)

      const today  = availabilityWindow(0).from
      const priced: { currency: string; cents: number | null; text: string }[] = []

      const offers: HubOffer[] = rows.map(p => {
        const pageGuides = shown.filter(row => row.experience_id === p.id)

        let cents: number | null
        let currency = p.currency
        let priceText: string
        if (rendersAsV2(p.page_version) && p.offer_mode === 'custom') {
          // A `custom` page prints its stored range, labelled indicative (offer-price-lead);
          // the card says the same (tj 2026-10-23), and its lower bound counts in the hero minimum.
          const range = customRange(p.price_from_cents, p.price_to_cents, p.currency)
          cents     = range?.fromCents ?? null
          priceText = range == null
            ? 'Price on request'
            : `${range.toCents != null
                ? `${formatCents(range.fromCents, range.currency)}–${formatCents(range.toCents, range.currency)}`
                : `from ${formatCents(range.fromCents, range.currency)}`} · indicative`
        } else if (rendersAsV2(p.page_version)) {
          // The offer page's own "from": its current price rows, the primary guide's override.
          const prices = pagePrices(
            (pricesResult?.data ?? []).filter(r => r.experience_id === p.id),
            {
              today,
              maxAnglersPerGuide: p.max_anglers_per_guide,
              overrideCents:      pageGuides.find(row => row.role === 'primary')?.guide_price_override_cents ?? null,
            },
          )
          const from = fromPrice({ prices, feePct: p.fee_pct, maxAnglersPerGuide: p.max_anglers_per_guide })
          cents     = from?.totalCents ?? null
          currency  = from?.currency ?? p.currency
          priceText = from != null
            ? `from ${formatCents(from.totalCents, from.currency)} · ${anglersPerGuideLabel(p.max_anglers_per_guide)}`
            : 'Price on request'
        } else {
          cents     = p.price_type === 'request' ? null : Math.round(p.price_from * 100)
          priceText = formatPrice({ priceFrom: p.price_from, priceType: p.price_type, currency: p.currency })
        }
        priced.push({ currency, cents, text: priceText })

        return {
          id: p.id,
          page: {
            slug:                p.slug,
            experience_name:     p.experience_name,
            country:             p.country,
            region:              p.region,
            price_from:          p.price_from,
            price_type:          p.price_type,
            currency:            p.currency,
            hero_image_url:      p.hero_image_url,
            gallery_image_urls:  p.gallery_image_urls ?? [],
            difficulty:          p.difficulty,
            non_angler_friendly: p.non_angler_friendly,
          },
          priceText,
          targetSpecies: p.target_species ?? [],
          locationLat:   p.location_lat,
          locationLng:   p.location_lng,
          guides: pageGuides.map(row => ({ name: row.guide!.full_name, avatarUrl: row.guide!.avatar_url })),
        }
      })

      return {
        offers,
        guideCount: new Set(shown.map(row => row.guide!.id)).size,
        priceFrom:  hubPriceFrom(priced),
        reviews:    reviewCards(reviewsResult?.data ?? []),
        ogImage:    rows[0]?.hero_image_url ?? null,
      }
    },
    // The countries are part of the query; the flag decides how every card is priced.
    ['destination-hub', slug, getHubCountries(hub).join(','), rendersAsV2(2) ? 'v2' : 'v1'],
    { revalidate: 300, tags: [CACHE_TAG_EXPERIENCES, CACHE_TAG_GUIDES] },
  )()

  return {
    ...fromDb,
    hub,
    species:   hubSpecies(hub.species, fromDb.offers.map(o => o.targetSpecies)),
    otherHubs: DESTINATION_HUBS.filter(h => h.slug !== hub.slug).map(h => ({ slug: h.slug, h1: h.h1 })),
    // Outside the cache, like the config above. Every country the hub covers (tj FA-1.69 2B).
    testimonial: fromDb.reviews.length === 0 ? await getTestimonial(getHubCountries(hub)) : null,
  }
}

// ─── Service-client helpers (no ISR caching) ─────────────────────────────────
// Accept a caller-supplied service-role client so the caller controls connection
// lifetime. Do not cache — these read mutable operational data.
// Used by the AI pipeline (auto-send.ts) and webhooks.

type ServiceClient = SupabaseClient<Database>

export type InquiryForAutoSend = {
  id:           string
  status:       string
  trip_country: string | null
  angler_email: string | null
  /** Form text. On a form inquiry this is the client's first message; the thread stays empty. */
  message:      string | null
  /** FA-1.46: trip reference and form data — a form without text is answered from these. */
  trip_id:            string | null
  experience_page_id: string | null
  angler_name:        string
  requested_dates:    string[] | null
  party_size:         number | null
  source:             string | null
  /** FA-1.55 — the v2 form's answers, so the judge reads the same block as the draft. */
  brief:              unknown
}

export async function getInquiryForAutoSend(
  client: ServiceClient,
  inquiryId: string,
): Promise<InquiryForAutoSend | null> {
  const { data } = await client
    .from('inquiries')
    .select('id, status, trip_country, angler_email, message, trip_id, experience_page_id, angler_name, requested_dates, party_size, source, brief')
    .eq('id', inquiryId)
    .maybeSingle()
  return (data ?? null) as InquiryForAutoSend | null
}

export async function hasAgentSentReplyToAngler(
  client: ServiceClient,
  inquiryId: string,
): Promise<boolean> {
  const { count } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .eq('direction', 'outbound')
    .eq('counterpart', 'angler')
    .eq('drafted_by', 'agent')
    .in('status', ['sent', 'queued'])
  return (count ?? 0) > 0
}

/**
 * FA-1.48 — has a human taken over this inquiry's thread with the angler?
 *
 * True when the thread holds a SENT outbound message to the angler (any channel) written
 * by a human:
 *   - `drafted_by` is not 'agent' (panel messages and the FA-1.49 Zoho import are 'admin'), or
 *   - `drafted_by='agent'` but its `message.sent` event has an actor other than 'agent'
 *     (an agent draft a human sent — the panel keeps `drafted_by='agent'` on promotion).
 * A message the agent auto-sent (actor 'agent') and any message to a guide do not count.
 *
 * Throws on a database error — the caller chooses what an unknown answer means.
 */
export async function hasHumanTakenOverThread(
  client: ServiceClient,
  inquiryId: string,
): Promise<boolean> {
  const { data: sent, error } = await client
    .from('messages')
    .select('id, drafted_by')
    .eq('inquiry_id', inquiryId)
    .eq('direction', 'outbound')
    .eq('counterpart', 'angler')
    .in('status', ['sent', 'delivered', 'read'])
  if (error != null) throw new Error(error.message)

  const rows = sent ?? []
  if (rows.some(m => m.drafted_by !== 'agent')) return true

  const agentMessageIds = rows.map(m => m.id)
  if (agentMessageIds.length === 0) return false

  const { count, error: eventError } = await client
    .from('inquiry_events')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .eq('type', 'message.sent')
    .in('message_id', agentMessageIds)
    .neq('actor_kind', 'agent')
  if (eventError != null) throw new Error(eventError.message)
  return (count ?? 0) > 0
}

export async function getConversationForJudge(
  client: ServiceClient,
  inquiryId: string,
): Promise<{ direction: string; body: string }[]> {
  const { data } = await client
    .from('messages')
    .select('direction, body, occurred_at')
    .eq('inquiry_id', inquiryId)
    .neq('status', 'draft')
    .order('occurred_at', { ascending: true })
  return (data ?? []) as { direction: string; body: string }[]
}

/** Trim + lower-case: how an e-mail is compared. `angler_email` is stored as typed. */
function normaliseEmailForMatch(email: string): string {
  return email.trim().toLowerCase()
}

/** Makes `\`, `%` and `_` literal in an ILIKE pattern. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`)
}

/**
 * FA-1.42 — does this e-mail (trimmed, case-insensitive) already have an inquiry created
 * at or after `since`, other than `excludeInquiryId`? Any source counts.
 *
 * The address is untrusted: wildcards are escaped, and the rows the database returns are
 * compared again in code, so `a_b@x.com` can never suppress a reply to `axb@x.com`.
 * (PostgREST also reads `*` as a wildcard in ILIKE; the second comparison covers that too.)
 *
 * Throws on a database error — the caller chooses whether to fail open.
 */
export async function hasRecentInquiryFromEmail(
  client: ServiceClient,
  params: { email: string; excludeInquiryId: string; since: Date },
): Promise<boolean> {
  const wanted = normaliseEmailForMatch(params.email)
  const { data, error } = await client
    .from('inquiries')
    .select('angler_email')
    .ilike('angler_email', escapeLikePattern(wanted))
    .neq('id', params.excludeInquiryId)
    .gte('created_at', params.since.toISOString())
    .limit(50)
  if (error != null) throw new Error(error.message)
  return (data ?? []).some(
    row => row.angler_email != null && normaliseEmailForMatch(row.angler_email) === wanted,
  )
}

/**
 * FA-1.42 — how many auto-sends went out since `since`: `agent.auto_send_decided`
 * events with `sent=true`. Throws on a database error — the caller must not read a
 * failed count as "zero sent".
 */
export async function countAutoSendsSince(
  client: ServiceClient,
  since: Date,
): Promise<number> {
  const { count, error } = await client
    .from('inquiry_events')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'agent.auto_send_decided')
    .eq('payload->>sent', 'true')
    .gte('occurred_at', since.toISOString())
  if (error != null) throw new Error(error.message)
  return count ?? 0
}

export async function getInquiryStatusForD2(
  client: ServiceClient,
  inquiryId: string,
): Promise<{ status: string } | null> {
  const { data } = await client
    .from('inquiries')
    .select('status')
    .eq('id', inquiryId)
    .maybeSingle()
  return data ? { status: (data as { status: string }).status } : null
}

// ─── Request-scoped role read (FA-1.52) ──────────────────────────────────────

/**
 * profiles.role === 'admin' for the given user, read through a caller-supplied
 * request-scoped client (so RLS applies). Used by src/proxy.ts to decide whether
 * ?preview=v2 may be rewritten to the preview route — the preview route itself
 * re-checks with requireAdmin()-grade auth, this only avoids a pointless 404 for
 * ordinary logged-in users. Never cached: a role change must take effect at once.
 */
export async function isAdminUser(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return data?.role === 'admin'
}
