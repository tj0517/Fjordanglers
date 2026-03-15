/**
 * Public Supabase query helpers — server-side, ISR-friendly.
 *
 * Uses the plain @supabase/supabase-js client (no cookies) so that
 * Next.js can cache these fetches and serve them via ISR / static rendering.
 * All queries read only publicly-visible data (published = true, verified guides).
 *
 * Import only in Server Components or Server Actions — never in Client Components.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { ExperienceWithGuide, Difficulty } from '@/types'

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

/** Sort experience images by `sort_order` ascending (cover first). */
function sortImages<T extends { sort_order: number }>(images: T[]): T[] {
  return [...images].sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Supabase select columns for an experience with embedded guide snippet + images.
 * Uses FK-based embedding: guide_id → guides, experience_id → experience_images.
 */
const EXP_SELECT =
  '*, guide:guides ( id, full_name, avatar_url, country, city, average_rating, cancellation_policy, languages ), images:experience_images ( id, experience_id, url, is_cover, sort_order, created_at )'

// ─── Experiences ──────────────────────────────────────────────────────────────

export type ExperienceSearchParams = {
  country?: string      // comma-separated list: 'Norway,Sweden'
  fish?: string         // comma-separated list: 'Salmon,Pike'
  difficulty?: string
  sort?: string
  minPrice?: string
  maxPrice?: string
  // ── New filter dimensions ──────────────────────────────────────────────────
  technique?: string    // e.g. 'Fly fishing' | 'Lure fishing' | …
  duration?: string     // 'half-day' | 'full-day' | 'overnight' | 'multi-day' | 'expedition'
  catchRelease?: string // 'true' to filter catch-and-release only
  guests?: string       // minimum guests the trip must accommodate: '2' | '4' | '6' | '10'
  dateFrom?: string     // ISO date: '2025-07-01'
  dateTo?: string       // ISO date: '2025-07-07'
  // ── Pagination ─────────────────────────────────────────────────────────────
  page?: string         // current page number as string (default '1')
  pageSize?: number     // items per page (default 12)
}

/** Paginated result shape returned by getExperiences(). */
export type ExperiencesPage = { experiences: ExperienceWithGuide[]; total: number }

/**
 * All published experiences with optional filtering and sorting.
 * Used by the /experiences listing page.
 */
export async function getExperiences(
  params: ExperienceSearchParams = {},
): Promise<ExperiencesPage> {
  const db = createPublicClient()

  let query = db
    .from('experiences')
    .select(EXP_SELECT, { count: 'exact' })
    .eq('published', true)

  // ── Existing filters ───────────────────────────────────────────────────────
  if (params.country) {
    const countryList = params.country.split(',').map(c => c.trim()).filter(Boolean)
    if (countryList.length === 1) {
      query = query.ilike('location_country', countryList[0])
    } else if (countryList.length > 1) {
      query = query.or(countryList.map(c => `location_country.ilike.${c}`).join(','))
    }
  }
  if (params.fish) {
    const fishList = params.fish.split(',').filter(Boolean)
    if (fishList.length === 1) query = query.contains('fish_types', [fishList[0]])
    else if (fishList.length > 1) query = query.overlaps('fish_types', fishList)
  }
  if (params.difficulty) query = query.eq('difficulty', params.difficulty as Difficulty)
  if (params.minPrice)   query = query.gte('price_per_person_eur', Number(params.minPrice))
  if (params.maxPrice)   query = query.lte('price_per_person_eur', Number(params.maxPrice))

  // ── Technique ─────────────────────────────────────────────────────────────
  if (params.technique)  query = query.ilike('technique', params.technique)

  // ── Duration ──────────────────────────────────────────────────────────────
  if (params.duration) {
    switch (params.duration) {
      case 'half-day':
        // Up to 6 h, no overnight component
        query = query.not('duration_hours', 'is', null).lte('duration_hours', 6)
        break
      case 'full-day':
        // More than 6 h but still same-day (no duration_days)
        query = query.not('duration_hours', 'is', null).gt('duration_hours', 6)
        break
      case 'overnight':
        // Exactly 1 day
        query = query.eq('duration_days', 1)
        break
      case 'multi-day':
        // 2 – 4 days
        query = query.gte('duration_days', 2).lte('duration_days', 4)
        break
      case 'expedition':
        // 5 days or more
        query = query.gte('duration_days', 5)
        break
    }
  }

  // ── Catch & Release ───────────────────────────────────────────────────────
  if (params.catchRelease === 'true') query = query.eq('catch_and_release', true)

  // ── Group size (trip must accommodate at least N guests) ──────────────────
  if (params.guests) query = query.gte('max_guests', Number(params.guests))

  switch (params.sort) {
    case 'price-asc':
      query = query.order('price_per_person_eur', { ascending: true })
      break
    case 'price-desc':
      query = query.order('price_per_person_eur', { ascending: false })
      break
    case 'duration-asc':
      // Hours-based sort; multi-day experiences (duration_hours = null) go last
      query = query.order('duration_hours', { ascending: true, nullsFirst: false })
      break
    case 'duration-desc':
      query = query.order('duration_days', { ascending: false, nullsFirst: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageSize = params.pageSize ?? 12
  const page = Math.max(1, Number(params.page ?? 1))
  const offset = (page - 1) * pageSize
  query = query.range(offset, offset + pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[getExperiences]', error.message)
    return { experiences: [], total: 0 }
  }

  return {
    experiences: (data as unknown as ExperienceWithGuide[]).map(exp => ({
      ...exp,
      images: sortImages(exp.images ?? []),
    })),
    total: count ?? 0,
  }
}

/**
 * Random published experiences — used in the home page "Featured" section.
 * Fetches a larger pool and shuffles server-side for variety on each visit.
 */
export async function getFeaturedExperiences(limit = 4): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('published', true)
    .limit(20)

  if (error) {
    console.error('[getFeaturedExperiences]', error.message)
    return []
  }

  const all = (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))

  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }

  return all.slice(0, limit)
}

/**
 * Random verified guides — used in the home page "Meet the guides" section.
 */
export async function getFeaturedGuides(limit = 4): Promise<GuideRow[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('guides')
    .select('*')
    .eq('status', 'active')
    .not('verified_at', 'is', null)
    .limit(20)

  if (error) {
    console.error('[getFeaturedGuides]', error.message)
    return []
  }

  const all = data ?? []
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }

  return all.slice(0, limit)
}

/**
 * Single published experience by ID.
 * Returns null when not found or unpublished (triggers notFound() in the page).
 */
export async function getExperience(id: string): Promise<ExperienceWithGuide | null> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('id', id)
    .eq('published', true)
    .single()

  if (error) return null

  const exp = data as unknown as ExperienceWithGuide
  return {
    ...exp,
    images: sortImages(exp.images ?? []),
  }
}

/** Bounding box used for client-side viewport filtering. */
export type MapBounds = { north: number; south: number; east: number; west: number }

/**
 * All published experiences that have coordinates, with the same filter params
 * as getExperiences but WITHOUT pagination. Used by the map viewport filter.
 */
export async function getAllExperiencesWithCoords(
  params: Omit<ExperienceSearchParams, 'page' | 'pageSize'> = {},
): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  let query = db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('published', true)
    // Include experiences that have either a primary pin (lat/lng) OR
    // multi-spot data (location_spots). Both types appear as map markers.
    .or('location_lat.not.is.null,location_spots.not.is.null')

  if (params.country) {
    const countryList = params.country.split(',').map(c => c.trim()).filter(Boolean)
    if (countryList.length === 1) {
      query = query.ilike('location_country', countryList[0])
    } else if (countryList.length > 1) {
      query = query.or(countryList.map(c => `location_country.ilike.${c}`).join(','))
    }
  }
  if (params.fish) {
    const fishList = params.fish.split(',').filter(Boolean)
    if (fishList.length === 1) query = query.contains('fish_types', [fishList[0]])
    else if (fishList.length > 1) query = query.overlaps('fish_types', fishList)
  }
  if (params.difficulty) query = query.eq('difficulty', params.difficulty as Difficulty)
  if (params.minPrice)   query = query.gte('price_per_person_eur', Number(params.minPrice))
  if (params.maxPrice)   query = query.lte('price_per_person_eur', Number(params.maxPrice))
  if (params.technique)  query = query.ilike('technique', params.technique)

  if (params.duration) {
    switch (params.duration) {
      case 'half-day':
        query = query.not('duration_hours', 'is', null).lte('duration_hours', 6)
        break
      case 'full-day':
        query = query.not('duration_hours', 'is', null).gt('duration_hours', 6)
        break
      case 'overnight':
        query = query.eq('duration_days', 1)
        break
      case 'multi-day':
        query = query.gte('duration_days', 2).lte('duration_days', 4)
        break
      case 'expedition':
        query = query.gte('duration_days', 5)
        break
    }
  }

  if (params.catchRelease === 'true') query = query.eq('catch_and_release', true)
  if (params.guests) query = query.gte('max_guests', Number(params.guests))

  query = query.order('created_at', { ascending: false }).limit(1000)

  const { data, error } = await query

  if (error) {
    console.error('[getAllExperiencesWithCoords]', error.message)
    return []
  }

  return (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))
}

/**
 * Other published experiences by the same guide.
 * Excludes `excludeId` (the currently viewed experience).
 */
export async function getMoreFromGuide(
  guideId: string,
  excludeId: string,
  limit = 3,
): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('guide_id', guideId)
    .eq('published', true)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))
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
 * Three parallel HEAD requests — fast and cheap.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = createPublicClient()

  const [guidesRes, expCountRes] = await Promise.all([
    // Active guides (status = 'active' OR verified_at set)
    db
      .from('guides')
      .select('country, languages')
      .or('status.eq.active,verified_at.not.is.null'),

    // Published experiences
    db
      .from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('published', true),
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
    guideCount:      activeGuides.length,
    experienceCount: expCountRes.count ?? 0,
    countryCount:    uniqueCountries.size,
    languageCount:   uniqueLanguages.size,
  }
}

// ─── Species counts ───────────────────────────────────────────────────────────

/**
 * Returns a map of { [fishName]: tripCount } for all published experiences.
 * Used to display live counts on the home page species picker.
 */
export async function getSpeciesCounts(): Promise<Record<string, number>> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select('fish_types')
    .eq('published', true)

  if (error) return {}

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    for (const fish of row.fish_types) {
      counts[fish] = (counts[fish] ?? 0) + 1
    }
  }
  return counts
}

// ─── Locations ────────────────────────────────────────────────────────────────

export type LocationEntry = { city: string; country: string }

/**
 * All unique (city, country) pairs from published experiences.
 * Used to power the hero search bar autocomplete.
 */
export async function getExperienceLocations(): Promise<LocationEntry[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select('location_city, location_country')
    .eq('published', true)
    .not('location_city', 'is', null)
    .not('location_country', 'is', null)

  if (error) return []

  const seen = new Set<string>()
  const result: LocationEntry[] = []
  for (const row of data ?? []) {
    const key = `${row.location_city}|${row.location_country}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ city: row.location_city!, country: row.location_country! })
    }
  }
  return result.sort((a, b) => a.city.localeCompare(b.city))
}

// ─── Guides ───────────────────────────────────────────────────────────────────

export type GuideRow = Database['public']['Tables']['guides']['Row']

export type GuideImageRow = Database['public']['Tables']['guide_images']['Row']

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
  const db = createPublicClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * GUIDES_PAGE_SIZE
  const to   = from + GUIDES_PAGE_SIZE - 1

  let query = db
    .from('guides')
    .select('*', { count: 'exact' })
    .or('status.eq.active,verified_at.not.is.null')
    .order('average_rating', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (params.country) query = query.eq('country', params.country)
  if (params.language) query = query.contains('languages', [params.language])

  const { data, error, count } = await query

  if (error) {
    console.error('[getGuides]', error.message)
    return { guides: [], total: 0 }
  }

  return { guides: data ?? [], total: count ?? 0 }
}

/**
 * Single guide by ID with embedded gallery images.
 * Returns null if not found or not active.
 */
export async function getGuide(id: string): Promise<GuideWithImages | null> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('guides')
    .select('*, images:guide_images ( id, guide_id, url, is_cover, sort_order, created_at )')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error) return null

  const guide = data as unknown as GuideWithImages
  return {
    ...guide,
    images: sortImages(guide.images ?? []),
  }
}

/**
 * Published experiences belonging to a specific guide.
 * Used on the guide profile page.
 */
export async function getGuideExperiences(guideId: string): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('guide_id', guideId)
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) return []

  return (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))
}
