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
  '*, guide:guides ( id, full_name, avatar_url, country, city, average_rating ), images:experience_images ( id, experience_id, url, is_cover, sort_order, created_at )'

// ─── Experiences ──────────────────────────────────────────────────────────────

export type ExperienceSearchParams = {
  country?: string
  fish?: string
  difficulty?: string
  sort?: string
  minPrice?: string
  maxPrice?: string
}

/**
 * All published experiences with optional country / species / difficulty filtering
 * and price / duration sorting. Used by the /experiences listing page.
 */
export async function getExperiences(
  params: ExperienceSearchParams = {},
): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  let query = db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('published', true)

  if (params.country)    query = query.eq('location_country', params.country)
  if (params.fish)       query = query.contains('fish_types', [params.fish])
  if (params.difficulty) query = query.eq('difficulty', params.difficulty as Difficulty)
  if (params.minPrice)   query = query.gte('price_per_person_eur', Number(params.minPrice))
  if (params.maxPrice)   query = query.lte('price_per_person_eur', Number(params.maxPrice))

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
    default:
      query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error('[getExperiences]', error.message)
    return []
  }

  return (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))
}

/**
 * Latest published experiences — used in the home page "Featured" section.
 */
export async function getFeaturedExperiences(limit = 3): Promise<ExperienceWithGuide[]> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('experiences')
    .select(EXP_SELECT)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[getFeaturedExperiences]', error.message)
    return []
  }

  return (data as unknown as ExperienceWithGuide[]).map(exp => ({
    ...exp,
    images: sortImages(exp.images ?? []),
  }))
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

  const [guidesRes, expCountRes, countriesRes, languagesRes] = await Promise.all([
    // Verified guides only
    db
      .from('guides')
      .select('id', { count: 'exact', head: true })
      .not('verified_at', 'is', null),

    // Published experiences
    db
      .from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('published', true),

    // Unique countries from published experiences
    db
      .from('experiences')
      .select('location_country')
      .eq('published', true)
      .not('location_country', 'is', null),

    // Unique languages from verified guides
    db
      .from('guides')
      .select('languages')
      .not('verified_at', 'is', null)
      .not('languages', 'is', null),
  ])

  const uniqueCountries = new Set(
    (countriesRes.data ?? [])
      .map(r => r.location_country)
      .filter((c): c is string => c != null),
  )

  const uniqueLanguages = new Set(
    (languagesRes.data ?? [])
      .flatMap(r => (r.languages as string[] | null) ?? []),
  )

  return {
    guideCount:      guidesRes.count    ?? 0,
    experienceCount: expCountRes.count  ?? 0,
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

// ─── Guides ───────────────────────────────────────────────────────────────────

export type GuideRow = Database['public']['Tables']['guides']['Row']

export type GuideSearchParams = {
  country?: string
  language?: string
}

/**
 * All active (verified) guides with optional country + language filtering.
 * Used by the /guides listing page.
 */
export async function getGuides(params: GuideSearchParams = {}): Promise<GuideRow[]> {
  const db = createPublicClient()

  let query = db
    .from('guides')
    .select('*')
    .eq('status', 'active')
    .not('verified_at', 'is', null)
    .order('average_rating', { ascending: false, nullsFirst: false })

  if (params.country) query = query.eq('country', params.country)
  if (params.language) query = query.contains('languages', [params.language])

  const { data, error } = await query

  if (error) {
    console.error('[getGuides]', error.message)
    return []
  }

  return data ?? []
}

/**
 * Single guide by ID. Returns null if not found or not active.
 */
export async function getGuide(id: string): Promise<GuideRow | null> {
  const db = createPublicClient()

  const { data, error } = await db
    .from('guides')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error) return null
  return data
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
