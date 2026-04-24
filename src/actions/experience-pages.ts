'use server'

/**
 * Experience Pages Server Actions.
 *
 * createExperiencePage  — FA creates a new editorial experience page.
 * updateExperiencePage  — FA updates an existing page.
 */

import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExperiencePagePayload {
  trip_id?:                   string | null
  guide_id?:                  string | null
  experience_name:            string
  slug:                       string
  country:                    string
  region:                     string
  season_start?:              string | null
  season_end?:                string | null
  price_from:                 number
  currency?:                  string
  status?:                    string
  // Quick fit
  difficulty?:                string | null
  physical_effort?:           string | null
  non_angler_friendly?:       boolean
  technique?:                 string[]
  target_species?:            string[]
  environment?:               string[]
  // Content
  hero_image_url?:            string | null
  gallery_image_urls?:        string[]
  story_text?:                string | null
  meeting_point_name?:        string | null
  meeting_point_description?: string | null
  catches_text?:              string | null
  rod_setup?:                 string | null
  best_months?:               string | null
  season_months?:             number[]
  peak_months?:               number[]
  // Includes / Excludes
  includes?:                  string[]
  excludes?:                  string[]
  // SEO
  meta_title?:                string | null
  meta_description?:          string | null
  og_image_url?:              string | null
  // Map pin
  location_lat?:              number | null
  location_lng?:              number | null
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
  if (payload.price_from <= 0)        return { success: false, error: 'Price must be greater than 0' }

  const { data, error } = await svc
    .from('experience_pages')
    .insert({
      trip_id:                   payload.trip_id ?? null,
      guide_id:                  payload.guide_id ?? null,
      experience_name:           payload.experience_name.trim(),
      slug:                      cleanSlug,
      country:                   payload.country,
      region:                    payload.region.trim(),
      season_start:              payload.season_start?.trim() || null,
      season_end:                payload.season_end?.trim()   || null,
      price_from:                payload.price_from,
      currency:                  payload.currency ?? 'EUR',
      status:                    payload.status ?? 'draft',
      difficulty:                payload.difficulty   ?? null,
      physical_effort:           payload.physical_effort ?? null,
      non_angler_friendly:       payload.non_angler_friendly ?? false,
      technique:                 payload.technique       ?? [],
      target_species:            payload.target_species  ?? [],
      environment:               payload.environment     ?? [],
      hero_image_url:            payload.hero_image_url  ?? null,
      gallery_image_urls:        payload.gallery_image_urls ?? [],
      story_text:                payload.story_text        ?? null,
      meeting_point_name:        payload.meeting_point_name ?? null,
      meeting_point_description: payload.meeting_point_description ?? null,
      catches_text:              payload.catches_text  ?? null,
      rod_setup:                 payload.rod_setup     ?? null,
      best_months:               payload.best_months   ?? null,
      season_months:             payload.season_months ?? [],
      peak_months:               payload.peak_months   ?? [],
      includes:                  payload.includes ?? [],
      excludes:                  payload.excludes ?? [],
      meta_title:                payload.meta_title       ?? null,
      meta_description:          payload.meta_description ?? null,
      og_image_url:              payload.og_image_url     ?? null,
      location_lat:              payload.location_lat     ?? null,
      location_lng:              payload.location_lng     ?? null,
    })
    .select('id, slug')
    .single()

  if (error != null || data == null) {
    console.error('[createExperiencePage] DB error:', error)
    return { success: false, error: 'Failed to create experience page' }
  }

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
  if (payload.experience_name   != null) update.experience_name           = payload.experience_name.trim()
  if (payload.slug              != null) update.slug                      = payload.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (payload.country           != null) update.country                   = payload.country
  if (payload.region            != null) update.region                    = payload.region.trim()
  if (payload.season_start      !== undefined) update.season_start        = payload.season_start?.trim() || null
  if (payload.season_end        !== undefined) update.season_end          = payload.season_end?.trim()   || null
  if (payload.price_from        != null) update.price_from                = payload.price_from
  if (payload.currency          != null) update.currency                  = payload.currency
  if (payload.status            != null) update.status                    = payload.status
  if (payload.difficulty        !== undefined) update.difficulty          = payload.difficulty
  if (payload.physical_effort   !== undefined) update.physical_effort     = payload.physical_effort
  if (payload.non_angler_friendly !== undefined) update.non_angler_friendly = payload.non_angler_friendly
  if (payload.technique         != null) update.technique                 = payload.technique
  if (payload.target_species    != null) update.target_species            = payload.target_species
  if (payload.environment       != null) update.environment               = payload.environment
  if (payload.hero_image_url    !== undefined) update.hero_image_url      = payload.hero_image_url
  if (payload.gallery_image_urls != null) update.gallery_image_urls       = payload.gallery_image_urls
  if (payload.story_text        !== undefined) update.story_text          = payload.story_text
  if (payload.meeting_point_name !== undefined) update.meeting_point_name = payload.meeting_point_name
  if (payload.meeting_point_description !== undefined) update.meeting_point_description = payload.meeting_point_description
  if (payload.catches_text      !== undefined) update.catches_text        = payload.catches_text
  if (payload.rod_setup         !== undefined) update.rod_setup           = payload.rod_setup
  if (payload.best_months       !== undefined) update.best_months         = payload.best_months
  if (payload.season_months     != null)       update.season_months       = payload.season_months
  if (payload.peak_months       != null)       update.peak_months         = payload.peak_months
  if (payload.includes          != null) update.includes                  = payload.includes
  if (payload.excludes          != null) update.excludes                  = payload.excludes
  if (payload.meta_title        !== undefined) update.meta_title          = payload.meta_title
  if (payload.meta_description  !== undefined) update.meta_description    = payload.meta_description
  if (payload.og_image_url      !== undefined) update.og_image_url        = payload.og_image_url
  if (payload.location_lat      !== undefined) update.location_lat        = payload.location_lat
  if (payload.location_lng      !== undefined) update.location_lng        = payload.location_lng
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

  return { success: true, id: data.id, slug: data.slug }
}
