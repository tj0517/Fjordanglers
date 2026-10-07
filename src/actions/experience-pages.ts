'use server'

/**
 * Experience Pages Server Actions.
 *
 * createExperiencePage  — FA creates a new editorial experience page.
 * updateExperiencePage  — FA updates an existing page.
 *
 * Offer v2 editor (FA-1.56), at the bottom of the file: guides, mode and price, the price
 * grid, v2 content, v2 option fields, page_version and slug aliases.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { CACHE_TAG_EXPERIENCES } from '@/lib/supabase/queries'
import { availabilityWindow } from '@/lib/availability-window'
import type { Database } from '@/lib/supabase/database.types'
import {
  basePriceCents,
  contentSchema,
  dayScheduleSchema,
  formatIssues,
  guidesSchema,
  idSchema,
  isActivePrimary,
  licenseInfoOrNullSchema,
  missingForV2,
  offerSchema,
  optionV2Schema,
  overrideExceedsCap,
  pageVersionSchema,
  priceSlotKey,
  pricesSchema,
  sampleItinerarySchema,
  slugSchema,
  suggestedLodgingSchema,
  type ContentInput,
  type DayScheduleItem,
  type EditorPriceCell,
  type GuideRowInput,
  type ItineraryItem,
  type LicenseInfo,
  type LodgingItem,
  type OfferInput,
  type OptionV2Input,
} from '@/lib/experiences/v2-editor'

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
  await requireAdmin()
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

// ─── publishAllDrafts ─────────────────────────────────────────────────────────
//
// Promotes every experience_page with status='draft' to status='active'.
// Returns the number of rows updated.

export async function publishAllDrafts(): Promise<{ published: number; error?: string }> {
  await requireAdmin()
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
  await requireAdmin()
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
  await requireAdmin()
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

  const { data: ep } = await svc.from('experience_pages').select('slug').eq('id', experiencePageId).single()
  if (ep?.slug) revalidatePath(`/experiences/${ep.slug}`)

  return { success: true, id: data.id }
}

export async function updateExperiencePageOption(
  optionId: string,
  payload: Partial<ExperiencePageOptionPayload>,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAdmin()
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

  const { data: opt } = await svc.from('experience_page_options').select('experience_page_id').eq('id', optionId).single()
  if (opt?.experience_page_id) {
    const { data: ep } = await svc.from('experience_pages').select('slug').eq('id', opt.experience_page_id).single()
    if (ep?.slug) revalidatePath(`/experiences/${ep.slug}`)
  }

  return { success: true }
}

export async function deleteExperiencePageOption(
  optionId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAdmin()
  const svc = createServiceClient()

  // Look up before delete so we can revalidate the public page afterwards
  const { data: opt } = await svc.from('experience_page_options').select('experience_page_id').eq('id', optionId).single()

  const { error } = await svc
    .from('experience_page_options')
    .delete()
    .eq('id', optionId)

  if (error != null) {
    console.error('[deleteExperiencePageOption] DB error:', error)
    return { success: false, error: 'Failed to delete trip option' }
  }

  if (opt?.experience_page_id) {
    const { data: ep } = await svc.from('experience_pages').select('slug').eq('id', opt.experience_page_id).single()
    if (ep?.slug) revalidatePath(`/experiences/${ep.slug}`)
  }

  return { success: true }
}

// ─── Offer v2 editor (FA-1.56) ────────────────────────────────────────────────
//
// The "Offer v2" tab of the admin page writes the FA-1.50 schema: experience_guides,
// experience_prices, experience_slug_aliases and the v2 columns of experience_pages and
// experience_page_options.
//
// There is no transaction here (no RPC — tj, 2026-10-07), so every action is built from
// statements that are each atomic on their own, in an order where stopping after any one
// of them leaves a page that still makes sense. Each action's comment says what that
// order is and what is left behind if a later statement fails.
//
// Deliberately NOT written: experience_pages.guide_id and price_from. Keeping them in
// step with the tables above is the job of the FA-1.51 triggers.

type ServiceClient = ReturnType<typeof createServiceClient>
type GuideLinkInsert = Database['public']['Tables']['experience_guides']['Insert']

export type ExperienceV2SaveResult =
  | { success: true;  warnings: string[] }
  | { success: false; error: string }

interface ExperienceV2EditorGuide {
  guideId:       string
  fullName:      string
  role:          'primary' | 'backup'
  status:        'active' | 'paused'
  showOnPage:    boolean
  sortOrder:     number
  overrideCents: number | null
}

export interface ExperienceV2EditorOption {
  id:              string
  label:           string
  kind:            'variant' | 'archetype' | 'addon'
  priceFromCents:  number | null
  priceToCents:    number | null
  currency:        string | null
  durationDaysMin: number | null
  durationDaysMax: number | null
  sampleItinerary: ItineraryItem[]
}

export interface ExperienceV2EditorData {
  page: {
    id:                 string
    slug:               string
    status:             string
    currency:           string
    /** experience_pages.guide_id — who v1 inquiries go to. Shown, never written here. */
    legacyGuideId:      string | null
    pageVersion:        1 | 2
    offerMode:          'fixed' | 'custom'
    priceFromCents:     number | null
    priceToCents:       number | null
    feeBp:              number
    maxAnglersPerGuide: number
    minDays:            number
    maxDays:            number | null
    suitedFor:          string[]
    notSuitedFor:       string[]
    expectationsText:   string | null
    skillLevel:         number | null
    walkingKmMin:       number | null
    walkingKmMax:       number | null
    daySchedule:        DayScheduleItem[]
    nearestAirport:     string | null
    suggestedLodging:   LodgingItem[]
    licenseInfo:        LicenseInfo | null
    tipGuidanceText:    string | null
    weatherPolicyText:  string | null
    responseSlaHours:   number
    offerEtaText:       string | null
  }
  guides:          ExperienceV2EditorGuide[]
  /** Every guide, for the "add a guide" picker. */
  availableGuides: { id: string; fullName: string; country: string }[]
  prices:          (EditorPriceCell & { currency: string })[]
  options:         ExperienceV2EditorOption[]
  aliases:         string[]
  /** The date `valid_from`/`valid_to` are compared against — read once, on the server. */
  today:           string
  /** Stored jsonb that did not have the documented shape and is therefore shown empty. */
  shapeWarnings:   string[]
}

function invalid(error: string): { success: false; error: string } {
  return { success: false, error }
}

function revalidateExperience(experienceId: string, slug: string | null) {
  // The public page reads through unstable_cache tagged with this (routing, v2 data).
  revalidateTag(CACHE_TAG_EXPERIENCES, {})
  revalidatePath('/admin/experiences')
  revalidatePath(`/admin/experiences/${experienceId}/edit`)
  if (slug) revalidatePath(`/experiences/${slug}`)
}

async function loadPriceCells(svc: ServiceClient, experienceId: string) {
  const { data, error } = await svc
    .from('experience_prices')
    .select('id, days, anglers, guide_price_cents, currency, valid_from, valid_to')
    .eq('experience_id', experienceId)
    .order('days', { ascending: true })
    .order('anglers', { ascending: true })

  if (error != null) throw new Error(`experience_prices: ${error.message}`)

  return (data ?? []).map(row => ({
    id:              row.id,
    days:            row.days,
    anglers:         row.anglers,
    guidePriceCents: row.guide_price_cents,
    currency:        row.currency,
    validFrom:       row.valid_from,
    validTo:         row.valid_to,
  }))
}

/**
 * The gap the schema documents on guide_price_override_cents: the trigger checks an
 * override when it is written, not when prices or max_anglers_per_guide move afterwards.
 * Whoever moves them is told here which overrides no longer fit.
 */
async function staleOverrideWarnings(
  svc: ServiceClient,
  experienceId: string,
  baseCents: number | null,
): Promise<string[]> {
  const { data, error } = await svc
    .from('experience_guides')
    .select('guide_price_override_cents')
    .eq('experience_id', experienceId)
    .not('guide_price_override_cents', 'is', null)

  if (error != null) return [`Saved, but the guides' price overrides could not be re-checked: ${error.message}`]

  const overrides = (data ?? []).flatMap(row => row.guide_price_override_cents ?? [])
  if (overrides.length === 0) return []

  if (baseCents == null) {
    return [`${overrides.length} guide price override(s) now have no base row to apply to (1 day × max anglers per guide) — see Guides`]
  }
  const over = overrides.filter(cents => overrideExceedsCap(cents, baseCents)).length
  return over === 0 ? [] : [`${over} guide price override(s) are now above 115% of the base price — see Guides`]
}

// ─── getExperienceV2Editor ────────────────────────────────────────────────────

/**
 * Everything the "Offer v2" tab shows. A read, but exported from a 'use server' file and
 * therefore callable by anyone — so it is guarded like a mutation.
 *
 * A failed sub-read throws instead of returning an empty list: an editor that shows "no
 * guides" because a query failed would delete them all on the next save.
 */
export async function getExperienceV2Editor(experienceId: string): Promise<ExperienceV2EditorData | null> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return null

  const svc = createServiceClient()

  const { data: page, error } = await svc
    .from('experience_pages')
    .select(`
      id, slug, status, currency, guide_id, page_version, offer_mode,
      price_from_cents, price_to_cents, fee_pct, max_anglers_per_guide, min_days, max_days,
      suited_for, not_suited_for, expectations_text, skill_level, walking_km_min, walking_km_max,
      day_schedule, nearest_airport, suggested_lodging, license_info,
      tip_guidance_text, weather_policy_text, response_sla_hours, offer_eta_text
    `)
    .eq('id', experienceId)
    .maybeSingle()

  if (error != null) throw new Error(`experience_pages: ${error.message}`)
  if (page == null) return null

  const [links, allGuides, prices, options, aliases] = await Promise.all([
    svc
      .from('experience_guides')
      .select('guide_id, role, status, show_on_page, sort_order, guide_price_override_cents')
      .eq('experience_id', experienceId)
      .order('sort_order', { ascending: true }),
    svc.from('guides').select('id, full_name, country').order('full_name', { ascending: true }),
    loadPriceCells(svc, experienceId),
    svc
      .from('experience_page_options')
      .select('id, label, kind, price_from_cents, price_to_cents, currency, duration_days_min, duration_days_max, sample_itinerary')
      .eq('experience_page_id', experienceId)
      .order('sort_order', { ascending: true }),
    svc.from('experience_slug_aliases').select('slug').eq('experience_id', experienceId).order('slug', { ascending: true }),
  ])

  if (links.error != null)     throw new Error(`experience_guides: ${links.error.message}`)
  if (allGuides.error != null) throw new Error(`guides: ${allGuides.error.message}`)
  if (options.error != null)   throw new Error(`experience_page_options: ${options.error.message}`)
  if (aliases.error != null)   throw new Error(`experience_slug_aliases: ${aliases.error.message}`)

  const shapeWarnings: string[] = []
  const names = new Map((allGuides.data ?? []).map(g => [g.id, g.full_name]))

  const daySchedule = dayScheduleSchema.safeParse(page.day_schedule)
  if (!daySchedule.success) shapeWarnings.push('day_schedule')
  const suggestedLodging = suggestedLodgingSchema.safeParse(page.suggested_lodging)
  if (!suggestedLodging.success) shapeWarnings.push('suggested_lodging')
  const licenseInfo = licenseInfoOrNullSchema.safeParse(page.license_info)
  if (!licenseInfo.success) shapeWarnings.push('license_info')

  return {
    page: {
      id:                 page.id,
      slug:               page.slug,
      status:             page.status,
      currency:           page.currency,
      legacyGuideId:      page.guide_id,
      pageVersion:        page.page_version === 2 ? 2 : 1,
      offerMode:          page.offer_mode === 'custom' ? 'custom' : 'fixed',
      priceFromCents:     page.price_from_cents,
      priceToCents:       page.price_to_cents,
      feeBp:              Math.round(page.fee_pct * 10_000),
      maxAnglersPerGuide: page.max_anglers_per_guide,
      minDays:            page.min_days,
      maxDays:            page.max_days,
      suitedFor:          page.suited_for,
      notSuitedFor:       page.not_suited_for,
      expectationsText:   page.expectations_text,
      skillLevel:         page.skill_level,
      walkingKmMin:       page.walking_km_min,
      walkingKmMax:       page.walking_km_max,
      daySchedule:        daySchedule.success ? daySchedule.data : [],
      nearestAirport:     page.nearest_airport,
      suggestedLodging:   suggestedLodging.success ? suggestedLodging.data : [],
      licenseInfo:        licenseInfo.success ? licenseInfo.data : null,
      tipGuidanceText:    page.tip_guidance_text,
      weatherPolicyText:  page.weather_policy_text,
      responseSlaHours:   page.response_sla_hours,
      offerEtaText:       page.offer_eta_text,
    },
    guides: (links.data ?? []).map(link => ({
      guideId:       link.guide_id,
      fullName:      names.get(link.guide_id) ?? link.guide_id,
      role:          link.role === 'backup' ? 'backup' : 'primary',
      status:        link.status === 'paused' ? 'paused' : 'active',
      showOnPage:    link.show_on_page,
      sortOrder:     link.sort_order,
      overrideCents: link.guide_price_override_cents,
    })),
    availableGuides: (allGuides.data ?? []).map(g => ({ id: g.id, fullName: g.full_name, country: g.country })),
    prices,
    options: (options.data ?? []).map(option => {
      const itinerary = sampleItinerarySchema.safeParse(option.sample_itinerary)
      if (!itinerary.success) shapeWarnings.push(`sample_itinerary of option "${option.label}"`)
      return {
        id:              option.id,
        label:           option.label,
        kind:            option.kind === 'archetype' || option.kind === 'addon' ? option.kind : 'variant',
        priceFromCents:  option.price_from_cents,
        priceToCents:    option.price_to_cents,
        currency:        option.currency,
        durationDaysMin: option.duration_days_min,
        durationDaysMax: option.duration_days_max,
        sampleItinerary: itinerary.success ? itinerary.data : [],
      }
    }),
    aliases: (aliases.data ?? []).map(a => a.slug),
    today:   availabilityWindow(0).from,
    shapeWarnings,
  }
}

// ─── getExperienceGuideCounts ─────────────────────────────────────────────────

/** Guides per page for the /admin/experiences list: all rows, and how many are active. */
export async function getExperienceGuideCounts(): Promise<Record<string, { total: number; active: number }>> {
  await requireAdmin()
  const svc = createServiceClient()

  const { data, error } = await svc.from('experience_guides').select('experience_id, status')
  if (error != null) throw new Error(`experience_guides: ${error.message}`)

  const counts: Record<string, { total: number; active: number }> = {}
  for (const row of data ?? []) {
    const entry = counts[row.experience_id] ?? { total: 0, active: 0 }
    entry.total += 1
    if (row.status === 'active') entry.active += 1
    counts[row.experience_id] = entry
  }
  return counts
}

// ─── saveExperienceV2Guides ───────────────────────────────────────────────────

/**
 * Replaces the page's guide list with the one given.
 *
 * Three steps, each a single statement:
 *
 *  1. ONE upsert carrying role / status / visibility / order of every row. Rows are
 *     ordered so that whoever stops being the active primary is written before whoever
 *     becomes it — the unique index `experience_guides_one_primary` is checked row by
 *     row, and in this order it never sees two. Guides being removed are in the same
 *     statement, paused and hidden, so removing the primary and naming a new one is still
 *     one statement. It either applies completely or not at all: there is no moment with
 *     two primaries and none where the old primary is gone and the new one is not in.
 *     The override column is not in this statement on purpose — an INSERT … ON CONFLICT
 *     that carried it would re-run the 115% trigger on rows nobody touched.
 *  2. One UPDATE per override that actually changed (the trigger checks it again).
 *     If one fails: roles are saved, that override is not, and the error says so.
 *  3. One DELETE of the removed rows. If it fails they stay paused and hidden — off the
 *     page and out of the primary slot — and saving again retries.
 */
export async function saveExperienceV2Guides(
  experienceId: string,
  guides: GuideRowInput[],
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug, page_version, max_anglers_per_guide')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  const { data: existing, error: existingError } = await svc
    .from('experience_guides')
    .select('guide_id, sort_order, guide_price_override_cents')
    .eq('experience_id', experienceId)
  if (existingError != null) return invalid(`Could not read the current guides: ${existingError.message}`)

  let baseCents: number | null
  try {
    baseCents = basePriceCents(await loadPriceCells(svc, experienceId), page.max_anglers_per_guide, availabilityWindow(0).from)
  } catch (err) {
    return invalid(`Could not read the price grid: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  const storedOverrides = new Map((existing ?? []).map(row => [row.guide_id, row.guide_price_override_cents]))

  const parsed = guidesSchema({ baseCents, storedOverrides }).safeParse(guides)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const desired = parsed.data

  if (page.page_version === 2 && !desired.some(isActivePrimary)) {
    return invalid('This page is on v2 and needs an active primary guide. Name another primary, or switch the page back to v1 first (Publication).')
  }

  const newIds = desired.map(row => row.guideId).filter(id => !storedOverrides.has(id))
  if (newIds.length > 0) {
    const { data: found } = await svc.from('guides').select('id').in('id', newIds)
    if ((found ?? []).length !== newIds.length) return invalid('One of the added guides no longer exists — reload the page')
  }

  const desiredIds = new Set(desired.map(row => row.guideId))
  const removed    = (existing ?? []).filter(row => !desiredIds.has(row.guide_id))

  const toRow = (row: GuideRowInput): GuideLinkInsert => ({
    experience_id: experienceId,
    guide_id:      row.guideId,
    role:          row.role,
    status:        row.status,
    show_on_page:  row.showOnPage,
    sort_order:    row.sortOrder,
  })

  // Step 1 — demotions first, the one promotion last.
  const roleRows: GuideLinkInsert[] = [
    ...removed.map(row => ({
      experience_id: experienceId,
      guide_id:      row.guide_id,
      role:          'backup',
      status:        'paused',
      show_on_page:  false,
      sort_order:    row.sort_order,
    })),
    ...desired.filter(row => !isActivePrimary(row)).map(toRow),
    ...desired.filter(isActivePrimary).map(toRow),
  ]

  if (roleRows.length > 0) {
    const { error } = await svc.from('experience_guides').upsert(roleRows, { onConflict: 'experience_id,guide_id' })
    if (error != null) {
      console.error('[saveExperienceV2Guides] roles:', error.message)
      return invalid(`Nothing was changed — the guide list could not be saved: ${error.message}`)
    }
  }

  // Step 2 — overrides that changed.
  for (const row of desired) {
    if ((storedOverrides.get(row.guideId) ?? null) === row.overrideCents) continue

    const { error } = await svc
      .from('experience_guides')
      .update({ guide_price_override_cents: row.overrideCents })
      .eq('experience_id', experienceId)
      .eq('guide_id', row.guideId)

    if (error != null) {
      console.error('[saveExperienceV2Guides] override:', error.message)
      revalidateExperience(experienceId, page.slug)
      return invalid(`Roles, visibility and order were saved, but a price override was not: ${error.message}`)
    }
  }

  // Step 3 — remove what was taken off the list.
  if (removed.length > 0) {
    const { error } = await svc
      .from('experience_guides')
      .delete()
      .eq('experience_id', experienceId)
      .in('guide_id', removed.map(row => row.guide_id))

    if (error != null) {
      console.error('[saveExperienceV2Guides] delete:', error.message)
      revalidateExperience(experienceId, page.slug)
      return invalid(`Saved, but ${removed.length} guide(s) could not be removed — they are paused and hidden instead. Save again to retry. (${error.message})`)
    }
  }

  revalidateExperience(experienceId, page.slug)
  console.log(`[saveExperienceV2Guides] page ${experienceId} — ${desired.length} guide(s), ${removed.length} removed`)
  return { success: true, warnings: [] }
}

// ─── saveExperienceV2Offer ────────────────────────────────────────────────────

/** Mode and price — one UPDATE of one row. */
export async function saveExperienceV2Offer(
  experienceId: string,
  offer: OfferInput,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsed = offerSchema.safeParse(offer)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const input = parsed.data

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug, page_version')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  if (page.page_version === 2 && (input.priceFromCents == null || input.priceFromCents <= 0)) {
    return invalid('This page is on v2 and needs a "from" price greater than 0. Switch it back to v1 first (Publication) to clear the price.')
  }

  const { error } = await svc
    .from('experience_pages')
    .update({
      offer_mode:            input.offerMode,
      price_from_cents:      input.priceFromCents,
      price_to_cents:        input.priceToCents,
      fee_pct:               input.feeBp / 10_000,
      max_anglers_per_guide: input.maxAnglersPerGuide,
      min_days:              input.minDays,
      max_days:              input.maxDays,
      updated_at:            new Date().toISOString(),
    })
    .eq('id', experienceId)

  if (error != null) {
    console.error('[saveExperienceV2Offer] DB error:', error.message)
    return invalid(`Mode and price could not be saved: ${error.message}`)
  }

  // max_anglers_per_guide decides which price row is the base row.
  let warnings: string[]
  try {
    const base = basePriceCents(await loadPriceCells(svc, experienceId), input.maxAnglersPerGuide, availabilityWindow(0).from)
    warnings = await staleOverrideWarnings(svc, experienceId, base)
  } catch {
    warnings = ['Saved, but the price grid could not be read to re-check the guides\' overrides']
  }

  revalidateExperience(experienceId, page.slug)
  return { success: true, warnings }
}

// ─── saveExperienceV2Prices ───────────────────────────────────────────────────

/**
 * Replaces the page's price table with the grid given. Every row is stored in the page's
 * currency (the calculator refuses a table with mixed currencies).
 *
 * Two statements:
 *
 *  1. ONE upsert of every cell of the grid, keyed by row id. A cell that already has a
 *     row (same days × anglers × valid_from) keeps that row's id, so nothing here can
 *     collide with the table's unique slot. All of it applies or none of it does.
 *  2. ONE DELETE of the rows the grid no longer contains.
 *
 * New prices go in before old ones come out: if step 2 fails, the page has the new prices
 * plus some old rows, and says so. The other order could leave a page with no prices.
 */
export async function saveExperienceV2Prices(
  experienceId: string,
  cells: EditorPriceCell[],
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsed = pricesSchema.safeParse(cells)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const desired = parsed.data

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug, currency, max_anglers_per_guide')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  let existing: Awaited<ReturnType<typeof loadPriceCells>>
  try {
    existing = await loadPriceCells(svc, experienceId)
  } catch (err) {
    return invalid(`Could not read the current prices: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  const idBySlot = new Map(existing.map(row => [priceSlotKey(row), row.id]))
  const keptIds  = new Set<string>()

  const rows = desired.map(cell => {
    const id = idBySlot.get(priceSlotKey(cell)) ?? crypto.randomUUID()
    keptIds.add(id)
    return {
      id,
      experience_id:     experienceId,
      days:              cell.days,
      anglers:           cell.anglers,
      guide_price_cents: cell.guidePriceCents,
      currency:          page.currency,
      valid_from:        cell.validFrom,
      valid_to:          cell.validTo,
    }
  })

  if (rows.length > 0) {
    const { error } = await svc.from('experience_prices').upsert(rows, { onConflict: 'id' })
    if (error != null) {
      console.error('[saveExperienceV2Prices] upsert:', error.message)
      return invalid(`Nothing was changed — the price grid could not be saved: ${error.message}`)
    }
  }

  const removedIds = existing.map(row => row.id).filter(id => !keptIds.has(id))
  if (removedIds.length > 0) {
    const { error } = await svc
      .from('experience_prices')
      .delete()
      .eq('experience_id', experienceId)
      .in('id', removedIds)

    if (error != null) {
      console.error('[saveExperienceV2Prices] delete:', error.message)
      revalidateExperience(experienceId, page.slug)
      return invalid(`The new prices were saved, but ${removedIds.length} old row(s) could not be removed. Save again to retry. (${error.message})`)
    }
  }

  const base     = basePriceCents(desired, page.max_anglers_per_guide, availabilityWindow(0).from)
  const warnings = await staleOverrideWarnings(svc, experienceId, base)

  revalidateExperience(experienceId, page.slug)
  console.log(`[saveExperienceV2Prices] page ${experienceId} — ${rows.length} row(s), ${removedIds.length} removed`)
  return { success: true, warnings }
}

// ─── saveExperienceV2Content ──────────────────────────────────────────────────

/** Content of sections S3–S9 and S11–S13 — one UPDATE of one row. */
export async function saveExperienceV2Content(
  experienceId: string,
  content: ContentInput,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsed = contentSchema.safeParse(content)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const input = parsed.data

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug, page_version')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  if (page.page_version === 2 && input.suitedFor.length === 0) {
    return invalid('This page is on v2 and needs at least one "Suited for" line. Switch it back to v1 first (Publication) to clear the list.')
  }

  const { error } = await svc
    .from('experience_pages')
    .update({
      suited_for:          input.suitedFor,
      not_suited_for:      input.notSuitedFor,
      expectations_text:   input.expectationsText,
      skill_level:         input.skillLevel,
      walking_km_min:      input.walkingKmMin,
      walking_km_max:      input.walkingKmMax,
      day_schedule:        input.daySchedule,
      nearest_airport:     input.nearestAirport,
      suggested_lodging:   input.suggestedLodging,
      license_info:        input.licenseInfo,
      tip_guidance_text:   input.tipGuidanceText,
      weather_policy_text: input.weatherPolicyText,
      response_sla_hours:  input.responseSlaHours,
      offer_eta_text:      input.offerEtaText,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', experienceId)

  if (error != null) {
    console.error('[saveExperienceV2Content] DB error:', error.message)
    return invalid(`Content could not be saved: ${error.message}`)
  }

  revalidateExperience(experienceId, page.slug)
  return { success: true, warnings: [] }
}

// ─── updateExperienceOptionV2 ─────────────────────────────────────────────────

/**
 * The v2 fields of one existing option — one UPDATE of one row. Creating and deleting
 * options stays with the actions above; the amounts are stored in the page's currency,
 * as the FA-1.50 backfill did.
 */
export async function updateExperienceOptionV2(
  optionId: string,
  option: OptionV2Input,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(optionId).success) return invalid('Trip option not found')

  const parsed = optionV2Schema.safeParse(option)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const input = parsed.data

  const svc = createServiceClient()

  const { data: existing } = await svc
    .from('experience_page_options')
    .select('id, experience_page_id')
    .eq('id', optionId)
    .maybeSingle()
  if (existing == null) return invalid('Trip option not found')

  const { data: page } = await svc
    .from('experience_pages')
    .select('slug, currency')
    .eq('id', existing.experience_page_id)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  const { error } = await svc
    .from('experience_page_options')
    .update({
      kind:              input.kind,
      price_from_cents:  input.priceFromCents,
      price_to_cents:    input.priceToCents,
      currency:          page.currency,
      duration_days_min: input.durationDaysMin,
      duration_days_max: input.durationDaysMax,
      sample_itinerary:  input.sampleItinerary,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', optionId)

  if (error != null) {
    console.error('[updateExperienceOptionV2] DB error:', error.message)
    return invalid(`The option could not be saved: ${error.message}`)
  }

  revalidateExperience(existing.experience_page_id, page.slug)
  return { success: true, warnings: [] }
}

// ─── setExperiencePageVersion ─────────────────────────────────────────────────

/**
 * The per-page template switch. Version 2 is refused unless the page has what the v2
 * template cannot render without; the error lists everything missing at once.
 *
 * The two conditions that live on the page row itself are repeated in the UPDATE's WHERE,
 * so they hold at the instant of the write. The guide condition lives in another table
 * and is checked just before — without a transaction that is as close as it gets.
 */
export async function setExperiencePageVersion(
  experienceId: string,
  version: number,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsedVersion = pageVersionSchema.safeParse(version)
  if (!parsedVersion.success) return invalid(formatIssues(parsedVersion.error))
  const target = parsedVersion.data

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug, price_from_cents, suited_for')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  if (target === 2) {
    const { count, error: countError } = await svc
      .from('experience_guides')
      .select('guide_id', { count: 'exact', head: true })
      .eq('experience_id', experienceId)
      .eq('role', 'primary')
      .eq('status', 'active')
    if (countError != null) return invalid(`Could not read the page's guides: ${countError.message}`)

    const missing = missingForV2({
      priceFromCents:      page.price_from_cents,
      activePrimaryGuides: count ?? 0,
      suitedFor:           page.suited_for,
    })
    if (missing.length > 0) return invalid(`Cannot switch to v2 — missing: ${missing.join('; ')}`)
  }

  const update = svc
    .from('experience_pages')
    .update({ page_version: target, updated_at: new Date().toISOString() })
    .eq('id', experienceId)

  const { data: updated, error } = await (
    target === 2 ? update.gt('price_from_cents', 0).not('suited_for', 'eq', '{}') : update
  ).select('id')

  if (error != null) {
    console.error('[setExperiencePageVersion] DB error:', error.message)
    return invalid(`Page version could not be saved: ${error.message}`)
  }
  if ((updated ?? []).length === 0) {
    return invalid('The page changed while saving — reload and try again')
  }

  revalidateExperience(experienceId, page.slug)
  console.log(`[setExperiencePageVersion] page ${experienceId} → v${target}`)
  return { success: true, warnings: [] }
}

// ─── Slug aliases ─────────────────────────────────────────────────────────────

/**
 * Adds a retired slug that redirects to this page (merging twin pages by hand, proposal
 * §3 step 8). One INSERT.
 *
 * Refused when the slug is this page's own, the slug of a page that is live (the router
 * looks at active pages first, so the alias would never fire — archive that page first),
 * or already an alias. The primary key on `slug` is what finally guarantees "one alias,
 * one page"; the checks before it exist to give a readable reason.
 */
export async function addExperienceSlugAlias(
  experienceId: string,
  slug: string,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return invalid(formatIssues(parsed.error))
  const alias = parsed.data

  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('id, slug')
    .eq('id', experienceId)
    .maybeSingle()
  if (page == null) return invalid('Experience page not found')

  if (alias === page.slug) return invalid(`"${alias}" is this page's own slug`)

  const { data: live } = await svc
    .from('experience_pages')
    .select('experience_name')
    .eq('slug', alias)
    .eq('status', 'active')
    .maybeSingle()
  if (live != null) {
    return invalid(`"${alias}" is the slug of the live page "${live.experience_name}" — archive that page first, then add the alias`)
  }

  const { data: taken } = await svc
    .from('experience_slug_aliases')
    .select('experience_id')
    .eq('slug', alias)
    .maybeSingle()
  if (taken != null) {
    return invalid(taken.experience_id === experienceId
      ? `"${alias}" is already an alias of this page`
      : `"${alias}" is already an alias of another page`)
  }

  const { error } = await svc.from('experience_slug_aliases').insert({ slug: alias, experience_id: experienceId })
  if (error != null) {
    if (error.code === '23505') return invalid(`"${alias}" is already an alias`)
    console.error('[addExperienceSlugAlias] DB error:', error.message)
    return invalid(`The alias could not be saved: ${error.message}`)
  }

  revalidateExperience(experienceId, page.slug)
  revalidatePath(`/experiences/${alias}`)
  console.log(`[addExperienceSlugAlias] /experiences/${alias} → /experiences/${page.slug}`)
  return { success: true, warnings: [] }
}

/** Removes an alias of this page — one DELETE, scoped to the page so it cannot touch another's. */
export async function removeExperienceSlugAlias(
  experienceId: string,
  slug: string,
): Promise<ExperienceV2SaveResult> {
  await requireAdmin()
  if (!idSchema.safeParse(experienceId).success) return invalid('Experience page not found')

  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return invalid(formatIssues(parsed.error))

  const svc = createServiceClient()

  const { error } = await svc
    .from('experience_slug_aliases')
    .delete()
    .eq('experience_id', experienceId)
    .eq('slug', parsed.data)

  if (error != null) {
    console.error('[removeExperienceSlugAlias] DB error:', error.message)
    return invalid(`The alias could not be removed: ${error.message}`)
  }

  revalidateExperience(experienceId, null)
  revalidatePath(`/experiences/${parsed.data}`)
  return { success: true, warnings: [] }
}
