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
import { COUNTRIES } from '@/lib/countries'
import { availabilityWindow } from '@/lib/availability-window'
import { effectivePrices, type PriceRow } from '@/lib/pricing/experience-price'
import {
  speciesNames,
  parseLicenseInfo,
  parseDaySchedule,
  parseItinerary,
  type LicenseInfo,
  type DayStep,
  type ItineraryDay,
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

export type ExperienceV2 = {
  id:                 string
  slug:               string
  experienceName:     string
  introText:          string | null
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
  tipGuidanceText:    string | null
  suitedFor:          string[]
  notSuitedFor:       string[]
  expectationsText:   string | null
  /** `fixed` pages: the day as a timeline. Empty = no S6. */
  daySchedule:        DayStep[]
  weatherPolicyText:  string | null
  offerEtaText:       string | null
  seasonMonths:       number[]
  skillLevel:         number | null
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
  metaTitle:          string | null
  metaDescription:    string | null
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
          hero_image_url, gallery_image_urls, includes, excludes, season_months, skill_level,
          species_details, technique, meeting_point_name, meeting_point_description,
          walking_km_min, walking_km_max, license_info, tip_guidance_text,
          suited_for, not_suited_for, expectations_text, day_schedule,
          weather_policy_text, offer_eta_text,
          min_days, max_days, max_anglers_per_guide, response_sla_hours,
          offer_mode, fee_pct, currency, price_from_cents, price_to_cents,
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

      const [guidesResult, pricesResult, optionsResult] = await Promise.all([
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
      ])

      if (guidesResult.error != null) console.error('[getExperienceV2] guides', guidesResult.error.message)
      if (pricesResult.error != null) console.error('[getExperienceV2] prices', pricesResult.error.message)
      if (optionsResult.error != null) console.error('[getExperienceV2] options', optionsResult.error.message)

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
        googleProfileUrl:  row.guide!.google_profile_url,
        languages:         row.guide!.languages ?? [],
        bio:               row.guide!.bio,
        balancePaymentMethod: row.guide!.default_balance_payment_method === 'stripe' ? 'stripe' : 'cash',
        isPrimary:         row.role === 'primary',
      }))

      // One clock read for the whole page, in the data layer (src/lib/availability-window.ts).
      const today   = availabilityWindow(0).from
      const current = (pricesResult.data ?? []).filter(
        r => (r.valid_from == null || r.valid_from <= today) && (r.valid_to == null || r.valid_to >= today),
      )

      // The override belongs to the primary guide — the one whose price the widget quotes.
      const override = shown.find(row => row.role === 'primary')?.guide_price_override_cents ?? null

      const prices = effectivePrices(newestPerSlot(current), {
        maxAnglersPerGuide: page.max_anglers_per_guide,
        overrideCents:      override,
      })

      // Narrowed to the union here: in a plain object literal the ternary widens to `string`.
      const offerMode: 'fixed' | 'custom' = page.offer_mode === 'custom' ? 'custom' : 'fixed'

      return {
        id:                 page.id,
        slug:               page.slug,
        experienceName:     page.experience_name,
        introText:          page.intro_text,
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
        tipGuidanceText:    page.tip_guidance_text,
        suitedFor:          page.suited_for ?? [],
        notSuitedFor:       page.not_suited_for ?? [],
        expectationsText:   page.expectations_text,
        daySchedule:        parseDaySchedule(page.day_schedule),
        weatherPolicyText:  page.weather_policy_text,
        offerEtaText:       page.offer_eta_text,
        seasonMonths:       page.season_months ?? [],
        skillLevel:         page.skill_level,
        minDays:            page.min_days,
        maxDays:            page.max_days,
        maxAnglersPerGuide: page.max_anglers_per_guide,
        responseSlaHours:   page.response_sla_hours,
        offerMode,
        feePct:             page.fee_pct,
        currency:           page.currency,
        priceFromCents:     page.price_from_cents,
        priceToCents:       page.price_to_cents,
        metaTitle:          page.meta_title,
        metaDescription:    page.meta_description,
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
}

export async function getInquiryForAutoSend(
  client: ServiceClient,
  inquiryId: string,
): Promise<InquiryForAutoSend | null> {
  const { data } = await client
    .from('inquiries')
    .select('id, status, trip_country, angler_email, message, trip_id, experience_page_id, angler_name, requested_dates, party_size, source')
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
