'use server'

/**
 * Experience Pages Server Actions.
 *
 * createExperiencePage  — FA creates a new editorial experience page.
 * updateExperiencePage  — FA updates an existing page.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpeciesDetailItem {
  name:          string
  description:   string
  image_url:     string
  image_urls?:   string[]
  season_months: number[]
  peak_months:   number[]
}

export interface SpecialAttraction {
  text:      string
  image_url: string
}

export interface Accommodation {
  heading:     string
  description: string
  image_url:   string
}

export interface Boat {
  heading:     string
  description: string
  image_url:   string
}

export interface ContentBlock {
  headline:  string
  text:      string
  image_url?: string
}

export interface FaqItem {
  question: string
  answer:   string
}

export interface ExperiencePagePayload {
  trip_id?:                          string | null
  guide_id?:                         string | null
  experience_name:                   string
  slug:                              string
  country:                           string
  region:                            string
  season_start?:                     string | null
  season_end?:                       string | null
  price_from:                        number
  price_type?:                       'per_person' | 'flat' | 'request'
  currency?:                         string
  status?:                           string
  // Quick fit
  difficulty?:                       string | null
  physical_effort?:                  string | null
  non_angler_friendly?:              boolean
  technique?:                        string[]
  target_species?:                   string[]
  environment?:                      string[]
  // Content
  intro_text?:                       string | null
  hero_image_url?:                   string | null
  gallery_image_urls?:               string[]
  story_text?:                       string | null
  meeting_point_name?:               string | null
  meeting_point_description?:        string | null
  catches_text?:                     string | null
  rod_setup?:                        string | null
  best_months?:                      string | null
  season_months?:                    number[]
  peak_months?:                      number[]
  // Per-fish species details
  species_details?:                  SpeciesDetailItem[]
  // Boat section (multi-block — replaces legacy boat_description/boat_image_url)
  boats?:                            Boat[]
  // Special attractions (multi-item, replaces old single special_attraction_* fields)
  special_attractions?:              SpecialAttraction[]
  // Accommodations (multi-item)
  accommodations?:                   Accommodation[]
  // What to bring
  what_to_bring?:                    string[]
  // Includes / Excludes
  includes?:                         string[]
  excludes?:                         string[]
  // Content photos (shown in the "Photos" section — independent from gallery_image_urls)
  content_photo_urls?:               string[]
  // Views photos (shown in the "Views" section — scenic/landscape photos)
  views_image_urls?:                 string[]
  // Page-level content blocks (shown after Season, before Trip Options)
  content_blocks?:                   ContentBlock[]
  // FAQ
  faq?:                              FaqItem[]
  // SEO
  meta_title?:                       string | null
  meta_description?:                 string | null
  og_image_url?:                     string | null
  // Map pin / area / spots
  location_lat?:                     number | null
  location_lng?:                     number | null
  location_area?:                    import('geojson').Polygon | null
  location_spots?:                   import('@/types').LocationSpot[] | null
}

export type ExperiencePageResult =
  | { success: true;  id: string; slug: string }
  | { success: false; error: string }

// ─── createExperiencePage ─────────────────────────────────────────────────────

export async function createExperiencePage(
  payload: ExperiencePagePayload,
): Promise<ExperiencePageResult> {
  const svc = createServiceClient()

  const cleanSlug = payload.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  // Validate slug uniqueness
  const { data: existing } = await svc
    .from('experience_pages')
    .select('id')
    .eq('slug', cleanSlug)
    .maybeSingle()

  if (existing != null) {
    return { success: false, error: `Slug "${cleanSlug}" already exists — choose a different one` }
  }

  if (!payload.experience_name.trim()) return { success: false, error: 'Experience name is required' }
  if (!payload.country)               return { success: false, error: 'Country is required' }
  if (!payload.region.trim())         return { success: false, error: 'Region is required' }
  if (payload.price_type !== 'request' && payload.price_from <= 0)
    return { success: false, error: 'Price must be greater than 0' }

  const { data, error } = await svc
    .from('experience_pages')
    .insert({
      trip_id:                          payload.trip_id ?? null,
      guide_id:                         payload.guide_id ?? null,
      experience_name:                  payload.experience_name.trim(),
      slug:                             cleanSlug,
      country:                          payload.country,
      region:                           payload.region.trim(),
      season_start:                     payload.season_start?.trim() || null,
      season_end:                       payload.season_end?.trim()   || null,
      price_from:                       payload.price_from,
      price_type:                       payload.price_type ?? 'per_person',
      currency:                         payload.currency ?? 'EUR',
      status:                           payload.status ?? 'draft',
      difficulty:                       payload.difficulty   ?? null,
      physical_effort:                  payload.physical_effort ?? null,
      non_angler_friendly:              payload.non_angler_friendly ?? false,
      technique:                        payload.technique       ?? [],
      target_species:                   payload.target_species  ?? [],
      environment:                      payload.environment     ?? [],
      intro_text:                       payload.intro_text      ?? null,
      hero_image_url:                   payload.hero_image_url  ?? null,
      gallery_image_urls:               payload.gallery_image_urls ?? [],
      content_photo_urls:               payload.content_photo_urls ?? [],
      views_image_urls:                 payload.views_image_urls ?? [],
      story_text:                       payload.story_text        ?? null,
      meeting_point_name:               payload.meeting_point_name ?? null,
      meeting_point_description:        payload.meeting_point_description ?? null,
      catches_text:                     payload.catches_text  ?? null,
      rod_setup:                        payload.rod_setup     ?? null,
      best_months:                      payload.best_months   ?? null,
      season_months:                    payload.season_months ?? [],
      peak_months:                      payload.peak_months   ?? [],
      species_details:                  (payload.species_details ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      boats:                            (payload.boats ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      special_attractions:              (payload.special_attractions ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      accommodations:                   (payload.accommodations ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      what_to_bring:                    payload.what_to_bring ?? [],
      includes:                         payload.includes ?? [],
      excludes:                         payload.excludes ?? [],
      meta_title:                       payload.meta_title       ?? null,
      meta_description:                 payload.meta_description ?? null,
      og_image_url:                     payload.og_image_url     ?? null,
      location_lat:                     payload.location_lat     ?? null,
      location_lng:                     payload.location_lng     ?? null,
      location_area:                    (payload.location_area   ?? null) as unknown as import('@/lib/supabase/database.types').Json,
      location_spots:                   (payload.location_spots  ?? null) as unknown as import('@/lib/supabase/database.types').Json,
    })
    .select('id, slug')
    .single()

  if (error != null || data == null) {
    console.error('[createExperiencePage] DB error:', error)
    return { success: false, error: 'Failed to create experience page' }
  }

  revalidatePath('/admin/experiences')
  console.log(`[createExperiencePage] Created ${data.id} — /experiences/${data.slug}`)
  return { success: true, id: data.id, slug: data.slug }
}

// ─── generateExperienceDrafts ─────────────────────────────────────────────────
//
// Scans all published experiences and creates a draft experience_page for each
// one that doesn't already have one (matched on trip_id).
// Safe to run multiple times — skips trips that already have a page.

export interface GenerateDraftsResult {
  created: number
  skipped: number
  errors:  string[]
}

export async function generateExperienceDrafts(): Promise<GenerateDraftsResult> {
  const svc = createServiceClient()

  // 1. Fetch all published experiences
  const { data: trips, error: tripsErr } = await svc
    .from('experiences')
    .select('id, title, guide_id, location_country, location_city, fish_types, fishing_methods, price_per_person_eur, price_range_min_eur, difficulty, what_included, what_excluded, description, images, meeting_point_address, season_from, season_to')
    .eq('published', true)

  if (tripsErr != null) {
    console.error('[generateExperienceDrafts] Failed to fetch trips:', tripsErr)
    return { created: 0, skipped: 0, errors: ['Failed to fetch trips from database'] }
  }

  const allTrips = trips ?? []
  if (allTrips.length === 0) return { created: 0, skipped: 0, errors: [] }

  // 2. Find which trip_ids already have an experience page
  const { data: existingPages } = await svc
    .from('experience_pages')
    .select('trip_id')
    .not('trip_id', 'is', null)

  const existingTripIds = new Set((existingPages ?? []).map(p => p.trip_id as string))

  // 3. Only process trips that don't have a page yet
  const toProcess = allTrips.filter(t => !existingTripIds.has(t.id))
  const skipped   = allTrips.length - toProcess.length

  if (toProcess.length === 0) return { created: 0, skipped, errors: [] }

  let created = 0
  const errors: string[] = []

  for (const trip of toProcess) {
    try {
      // Slug: title → kebab-case + 6-char trip ID suffix for uniqueness
      const baseSlug = trip.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 56)
      const slug = `${baseSlug}-${trip.id.slice(0, 6)}`

      // Season months range (handles year-wrap e.g. Nov–Feb)
      const seasonMonths: number[] = []
      if (trip.season_from != null && trip.season_to != null) {
        if (trip.season_from <= trip.season_to) {
          for (let m = trip.season_from; m <= trip.season_to; m++) seasonMonths.push(m)
        } else {
          for (let m = trip.season_from; m <= 12; m++) seasonMonths.push(m)
          for (let m = 1;               m <= trip.season_to; m++) seasonMonths.push(m)
        }
      }

      const price   = trip.price_per_person_eur ?? trip.price_range_min_eur ?? 0
      const images  = (trip.images as string[] | null) ?? []
      const methods = (trip.fishing_methods as string[] | null) ?? []

      const { error: insertErr } = await svc.from('experience_pages').insert({
        trip_id:            trip.id,
        guide_id:           trip.guide_id ?? null,
        experience_name:    trip.title,
        slug,
        country:            (trip.location_country as string | null) ?? '',
        region:             (trip.location_city    as string | null) ?? (trip.location_country as string | null) ?? '',
        price_from:         price,
        status:             'draft',
        difficulty:         (trip.difficulty as string | null) ?? null,
        technique:          methods,
        target_species:     (trip.fish_types as string[] | null) ?? [],
        hero_image_url:     images[0] ?? null,
        gallery_image_urls: images,
        story_text:         (trip.description as string | null) ?? null,
        meeting_point_name: (trip.meeting_point_address as string | null) ?? null,
        season_months:      seasonMonths,
        peak_months:        [],
        includes:           (trip.what_included as string[] | null) ?? [],
        excludes:           (trip.what_excluded as string[] | null) ?? [],
      })

      if (insertErr != null) {
        errors.push(`"${trip.title}": ${insertErr.message}`)
      } else {
        created++
        console.log(`[generateExperienceDrafts] Created draft for trip ${trip.id} — ${slug}`)
      }
    } catch (err) {
      errors.push(`"${trip.title}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { created, skipped, errors }
}

// ─── publishAllDrafts ─────────────────────────────────────────────────────────
//
// Promotes every experience_page with status='draft' to status='active'.
// Returns the number of rows updated.

export async function publishAllDrafts(): Promise<{ published: number; error?: string }> {
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('experience_pages')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('status', 'draft')
    .select('id')

  if (error != null) {
    console.error('[publishAllDrafts] DB error:', error)
    return { published: 0, error: error.message }
  }

  const count = data?.length ?? 0
  console.log(`[publishAllDrafts] Promoted ${count} draft(s) to active`)
  return { published: count }
}

// ─── updateExperiencePage ─────────────────────────────────────────────────────

export async function updateExperiencePage(
  id: string,
  payload: Partial<ExperiencePagePayload>,
): Promise<ExperiencePageResult> {
  const svc = createServiceClient()

  const { data: existing } = await svc
    .from('experience_pages')
    .select('id, slug')
    .eq('id', id)
    .single()

  if (existing == null) return { success: false, error: 'Experience page not found' }

  const update: Record<string, unknown> = {}
  if (payload.experience_name   != null) update.experience_name              = payload.experience_name.trim()
  if (payload.slug              != null) update.slug                         = payload.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (payload.country           != null) update.country                      = payload.country
  if (payload.region            != null) update.region                       = payload.region.trim()
  if (payload.season_start      !== undefined) update.season_start           = payload.season_start?.trim() || null
  if (payload.season_end        !== undefined) update.season_end             = payload.season_end?.trim()   || null
  if (payload.price_from        != null) update.price_from                   = payload.price_from
  if (payload.price_type        != null) update.price_type                   = payload.price_type
  if (payload.currency          != null) update.currency                     = payload.currency
  if (payload.status            != null) update.status                       = payload.status
  if (payload.difficulty        !== undefined) update.difficulty             = payload.difficulty
  if (payload.physical_effort   !== undefined) update.physical_effort        = payload.physical_effort
  if (payload.non_angler_friendly !== undefined) update.non_angler_friendly  = payload.non_angler_friendly
  if (payload.technique         != null) update.technique                    = payload.technique
  if (payload.target_species    != null) update.target_species               = payload.target_species
  if (payload.environment       != null) update.environment                  = payload.environment
  if (payload.intro_text        !== undefined) update.intro_text             = payload.intro_text
  if (payload.hero_image_url    !== undefined) update.hero_image_url         = payload.hero_image_url
  if (payload.gallery_image_urls != null) update.gallery_image_urls          = payload.gallery_image_urls
  if (payload.content_photo_urls != null) update.content_photo_urls          = payload.content_photo_urls
  if (payload.views_image_urls   != null) update.views_image_urls            = payload.views_image_urls
  if (payload.story_text        !== undefined) update.story_text             = payload.story_text
  if (payload.meeting_point_name !== undefined) update.meeting_point_name    = payload.meeting_point_name
  if (payload.meeting_point_description !== undefined) update.meeting_point_description = payload.meeting_point_description
  if (payload.catches_text      !== undefined) update.catches_text           = payload.catches_text
  if (payload.rod_setup         !== undefined) update.rod_setup              = payload.rod_setup
  if (payload.best_months       !== undefined) update.best_months            = payload.best_months
  if (payload.season_months     != null)       update.season_months          = payload.season_months
  if (payload.peak_months       != null)       update.peak_months            = payload.peak_months
  if (payload.species_details   != null)       update.species_details        = payload.species_details
  if (payload.boats             != null)       update.boats                  = payload.boats as unknown as import('@/lib/supabase/database.types').Json
  if (payload.special_attractions != null) update.special_attractions           = payload.special_attractions
  if (payload.accommodations      != null) update.accommodations                = payload.accommodations as unknown as import('@/lib/supabase/database.types').Json
  if (payload.what_to_bring      != null) update.what_to_bring                 = payload.what_to_bring
  if (payload.includes          != null) update.includes                       = payload.includes
  if (payload.excludes          != null) update.excludes                     = payload.excludes
  if (payload.content_blocks    != null) update.content_blocks               = payload.content_blocks as unknown as import('@/lib/supabase/database.types').Json
  if (payload.faq               != null) update.faq                          = payload.faq as unknown as import('@/lib/supabase/database.types').Json
  if (payload.meta_title        !== undefined) update.meta_title             = payload.meta_title
  if (payload.meta_description  !== undefined) update.meta_description       = payload.meta_description
  if (payload.og_image_url      !== undefined) update.og_image_url           = payload.og_image_url
  if (payload.location_lat      !== undefined) update.location_lat           = payload.location_lat
  if (payload.location_lng      !== undefined) update.location_lng           = payload.location_lng
  if (payload.location_area     !== undefined) update.location_area          = (payload.location_area ?? null) as unknown as import('@/lib/supabase/database.types').Json
  if (payload.location_spots    !== undefined) update.location_spots         = (payload.location_spots ?? null) as unknown as import('@/lib/supabase/database.types').Json
  update.updated_at = new Date().toISOString()

  const { data, error } = await svc
    .from('experience_pages')
    .update(update)
    .eq('id', id)
    .select('id, slug')
    .single()

  if (error != null || data == null) {
    console.error('[updateExperiencePage] DB error:', error)
    return { success: false, error: 'Failed to update experience page' }
  }

  // Revalidate admin + public routes so changes appear immediately
  revalidatePath(`/admin/experiences/${id}`)
  revalidatePath(`/admin/experiences/${id}/edit`)
  if (data.slug) revalidatePath(`/experiences/${data.slug}`)

  return { success: true, id: data.id, slug: data.slug }
}

// ─── Experience Page Options CRUD ─────────────────────────────────────────────
//
// Trip options let FA add multiple variants (Full Day / Half Day / Multi-Day)
// to a single experience page. Each option has its own price, catches, boat,
// special attractions, location, what-to-bring, includes, and excludes.
//
// Species sharing: each option references species by name (target_species[]).
// Full species details (description, photo, season) live on the parent page's
// species_details JSONB — no duplication.

export interface ExperiencePageOptionPayload {
  label:                     string
  price_from:                number
  price_type?:               'per_person' | 'flat' | 'request'
  description?:              string | null
  catches_text?:             string | null
  target_species?:           string[]
  boats?:                    Boat[]
  season_months?:            number[]
  peak_months?:              number[]
  special_attractions?:      SpecialAttraction[]
  meeting_point_name?:       string | null
  meeting_point_description?: string | null
  location_lat?:             number | null
  location_lng?:             number | null
  what_to_bring?:            string[]
  includes?:                 string[]
  excludes?:                 string[]
  content_blocks?:           ContentBlock[]
  sort_order?:               number
}

export type ExperiencePageOptionResult =
  | { success: true;  id: string }
  | { success: false; error: string }

export async function createExperiencePageOption(
  experiencePageId: string,
  payload: ExperiencePageOptionPayload,
): Promise<ExperiencePageOptionResult> {
  const svc = createServiceClient()

  // Determine next sort_order
  const { count } = await svc
    .from('experience_page_options')
    .select('id', { count: 'exact', head: true })
    .eq('experience_page_id', experiencePageId)

  const sortOrder = payload.sort_order ?? (count ?? 0)

  const { data, error } = await svc
    .from('experience_page_options')
    .insert({
      experience_page_id:        experiencePageId,
      sort_order:                sortOrder,
      label:                     payload.label.trim(),
      price_from:                payload.price_from,
      price_type:                payload.price_type ?? 'per_person',
      catches_text:              payload.catches_text  ?? null,
      target_species:            payload.target_species ?? [],
      boats:                     (payload.boats ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      season_months:             payload.season_months ?? [],
      peak_months:               payload.peak_months   ?? [],
      special_attractions:       (payload.special_attractions ?? []) as unknown as import('@/lib/supabase/database.types').Json,
      meeting_point_name:        payload.meeting_point_name        ?? null,
      meeting_point_description: payload.meeting_point_description ?? null,
      location_lat:              payload.location_lat ?? null,
      location_lng:              payload.location_lng ?? null,
      what_to_bring:             payload.what_to_bring ?? [],
      includes:                  payload.includes ?? [],
      excludes:                  payload.excludes ?? [],
      description:               payload.description ?? null,
      content_blocks:            (payload.content_blocks ?? []) as unknown as import('@/lib/supabase/database.types').Json,
    })
    .select('id')
    .single()

  if (error != null || data == null) {
    console.error('[createExperiencePageOption] DB error:', error)
    return { success: false, error: 'Failed to create trip option' }
  }

  console.log(`[createExperiencePageOption] Created option ${data.id} for page ${experiencePageId}`)
  return { success: true, id: data.id }
}

export async function updateExperiencePageOption(
  optionId: string,
  payload: Partial<ExperiencePageOptionPayload>,
): Promise<{ success: true } | { success: false; error: string }> {
  const svc = createServiceClient()

  const update: Record<string, unknown> = {}
  if (payload.label               != null)      update.label                     = payload.label.trim()
  if (payload.price_from          != null)      update.price_from                = payload.price_from
  if (payload.price_type          != null)      update.price_type                = payload.price_type
  if (payload.catches_text        !== undefined) update.catches_text              = payload.catches_text
  if (payload.target_species      != null)      update.target_species            = payload.target_species
  if (payload.boats               != null)      update.boats                     = payload.boats as unknown as import('@/lib/supabase/database.types').Json
  if (payload.season_months       != null)      update.season_months             = payload.season_months
  if (payload.peak_months         != null)      update.peak_months               = payload.peak_months
  if (payload.special_attractions != null)      update.special_attractions       = payload.special_attractions as unknown as import('@/lib/supabase/database.types').Json
  if (payload.meeting_point_name  !== undefined) update.meeting_point_name        = payload.meeting_point_name
  if (payload.meeting_point_description !== undefined) update.meeting_point_description = payload.meeting_point_description
  if (payload.location_lat        !== undefined) update.location_lat              = payload.location_lat
  if (payload.location_lng        !== undefined) update.location_lng              = payload.location_lng
  if (payload.what_to_bring       != null)      update.what_to_bring             = payload.what_to_bring
  if (payload.includes            != null)      update.includes                  = payload.includes
  if (payload.excludes            != null)      update.excludes                  = payload.excludes
  if (payload.sort_order          != null)      update.sort_order                = payload.sort_order
  if (payload.description         !== undefined) update.description              = payload.description
  if (payload.content_blocks      != null)      update.content_blocks            = payload.content_blocks as unknown as import('@/lib/supabase/database.types').Json
  update.updated_at = new Date().toISOString()

  const { error } = await svc
    .from('experience_page_options')
    .update(update)
    .eq('id', optionId)

  if (error != null) {
    console.error('[updateExperiencePageOption] DB error:', error)
    return { success: false, error: 'Failed to update trip option' }
  }

  return { success: true }
}

export async function deleteExperiencePageOption(
  optionId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const svc = createServiceClient()

  const { error } = await svc
    .from('experience_page_options')
    .delete()
    .eq('id', optionId)

  if (error != null) {
    console.error('[deleteExperiencePageOption] DB error:', error)
    return { success: false, error: 'Failed to delete trip option' }
  }

  return { success: true }
}
