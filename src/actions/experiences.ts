'use server'

import type * as GeoJSON from 'geojson'
import type { LocationSpot } from '@/types'

/**
 * Experience Server Actions.
 *
 * Authorization model:
 *   • Admin (profiles.role = 'admin') → can create/edit experiences for ANY guide
 *   • Guide (profiles.role = 'guide') → can only create/edit their OWN experiences
 *     (verified via guides.user_id = auth.uid())
 *
 * Used from:
 *   /admin/guides/[id]/trips/new  (admin creates for guide)
 *   /dashboard/trips/new          (guide creates own)
 *   /dashboard/trips/[id]/edit    (guide edits own)
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }

export type ImageInput = {
  url: string
  is_cover: boolean
  sort_order: number
}

/**
 * Per-package duration option sent by ExperienceForm.
 * The action converts these into the canonical `packages` JSONB structure.
 */
export type DurationOptionPayload = {
  label: string
  hours: number | null
  days: number | null
  /** How the guide charges: per person, flat boat rate, or variable by group size */
  pricing_type: 'per_person' | 'per_boat' | 'per_group'
  /** Base price — per-person rate, boat flat rate, or minimum group price */
  price_eur: number
  /** Only set when pricing_type = 'per_group'. Key = group size as string ("1", "2", …) */
  group_prices?: Record<string, number>
  includes_lodging: boolean
}

/** @deprecated — kept for form backwards-compat; no longer stored as a separate DB column. */
export type GroupPricingPayload = {
  model: 'per_size'
  prices: Record<string, number>
}

export type InclusionsPayload = {
  rods: boolean
  tackle: boolean
  boat: boolean
  safety: boolean
  license: boolean
  lunch: boolean
  drinks: boolean
  fish_cleaning: boolean
  transport: boolean
  accommodation: boolean
  custom_included: string[]
  custom_excluded: string[]
}

export type ItineraryStep = {
  time: string   // e.g. "06:00" or "Morning" — optional hint, can be empty
  label: string  // step description
}

export type ExperiencePayload = {
  title: string
  description: string
  fish_types: string[]
  /** @deprecated — kept for form compat; no longer written to DB. Use fishing_methods. */
  technique?: string | null
  /** @deprecated — kept for form compat; now per-package via packages[].level. */
  difficulty?: 'beginner' | 'intermediate' | 'expert' | null
  catch_and_release: boolean
  /** @deprecated — kept for form compat; now per-package via packages[]. */
  duration_hours?: number | null
  /** @deprecated — kept for form compat; now per-package via packages[]. */
  duration_days?: number | null
  /** @deprecated — kept for form compat; now per-package via packages[]. */
  max_guests?: number | null
  /** @deprecated — kept for form compat; now per-package via packages[].price_eur. */
  price_per_person_eur?: number | null
  location_country?: string | null
  location_city?: string | null
  /** @deprecated — kept for form compat; value written to meeting_point_address. */
  meeting_point?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_area?: GeoJSON.Polygon | null
  location_spots?: LocationSpot[] | null
  booking_type?: 'classic' | 'icelandic' | 'both'
  /** @deprecated — kept for form compat; no longer stored as separate columns. */
  what_included: string[]
  /** @deprecated — kept for form compat; no longer stored as separate columns. */
  what_excluded: string[]
  published: boolean
  images: ImageInput[]
  // ── Structured fields ─────────────────────────────────────────────────────
  season_from?: number | null
  season_to?: number | null
  fishing_methods?: string[]
  /**
   * Duration options from the form — converted to canonical `packages` on save.
   * @deprecated column name; the canonical DB column is now `packages`.
   */
  duration_options?: DurationOptionPayload[] | null
  /** @deprecated — no longer stored; pricing model lives in packages[].pricing_model. */
  group_pricing?: GroupPricingPayload | null
  inclusions_data?: InclusionsPayload | null
  landscape_url?: string | null
  // ── Trip content fields (optional) ───────────────────────────────────────
  itinerary?: ItineraryStep[] | null
  location_description?: string | null
  boat_description?: string | null
  accommodation_description?: string | null
  food_description?: string | null
  license_description?: string | null
  gear_description?: string | null
  transport_description?: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type DbJson = import('@/lib/supabase/database.types').Json

/**
 * Convert form DurationOptionPayload[] + trip-level scalars into the canonical
 * packages JSONB structure (trips-spec.md §5).
 *
 * For icelandic (on-request) experiences, payload.duration_options will be null
 * and this function returns null.
 */
function buildPackages(payload: ExperiencePayload): DbJson | null {
  const opts = payload.duration_options
  if (opts == null || opts.length === 0) return null

  return opts.map((opt, i) => {
    const id = opt.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `pkg-${i}`
    return {
      id,
      label:          opt.label,
      duration_hours: opt.hours,
      duration_days:  opt.days,
      pricing_model:  opt.pricing_type,
      price_eur:      opt.price_eur,
      group_prices:   opt.group_prices ?? null,
      level:          payload.difficulty ?? 'all',
      max_group:      payload.max_guests ?? 8,
      min_group:      1,
      availability: {
        season_from:   payload.season_from ?? null,
        season_to:     payload.season_to ?? null,
        blocked_dates: [],
        notes:         null,
      },
    }
  }) as unknown as DbJson
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

type AuthContext = {
  userId: string
  isAdmin: boolean
  guideId: string | null   // null for pure admins without a guide profile
}

async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let guideId: string | null = null
  if (!isAdmin) {
    const { data: guide } = await supabase
      .from('guides')
      .select('id')
      .eq('user_id', user.id)
      .single()
    guideId = guide?.id ?? null
  }

  return { userId: user.id, isAdmin, guideId }
}

/** Verify the caller can mutate experiences for a given guideId. */
async function assertCanManageGuide(guideId: string): Promise<
  | { ok: true }
  | { ok: false; error: string; code: string }
> {
  const ctx = await getAuthContext()
  if (ctx == null) return { ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
  if (ctx.isAdmin) return { ok: true }
  if (ctx.guideId === guideId) return { ok: true }
  return { ok: false, error: 'Forbidden — this guide profile is not yours', code: 'FORBIDDEN' }
}

/** Verify the caller can mutate a specific experience (by expId). */
async function assertCanManageExperience(expId: string): Promise<
  | { ok: true; guideId: string }
  | { ok: false; error: string; code: string }
> {
  const supabase = await createClient()
  const ctx = await getAuthContext()
  if (ctx == null) return { ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }

  const { data: exp } = await supabase
    .from('experiences')
    .select('guide_id')
    .eq('id', expId)
    .single()

  if (exp == null) return { ok: false, error: 'Experience not found', code: 'NOT_FOUND' }
  if (ctx.isAdmin) return { ok: true, guideId: exp.guide_id }
  if (ctx.guideId === exp.guide_id) return { ok: true, guideId: exp.guide_id }
  return { ok: false, error: 'Forbidden', code: 'FORBIDDEN' }
}

// ─── Create Trip ────────────────────────────────────────────────────────

export async function createExperience(
  guideId: string,
  payload: ExperiencePayload,
): Promise<ActionResult<{ id: string }>> {
  try {
    const perm = await assertCanManageGuide(guideId)
    if (!perm.ok) return { success: false, error: perm.error, code: perm.code }

    // Admins bypass RLS via service client; guides use their own session
    const ctx = await getAuthContext()
    const supabase = ctx?.isAdmin ? createServiceClient() : await createClient()

    // ── 1. Insert experience ────────────────────────────────────────────────
    const { data: exp, error: expError } = await supabase
      .from('experiences')
      .insert({
        guide_id:             guideId,
        title:                payload.title.trim(),
        description:          payload.description.trim(),
        fish_types:           payload.fish_types,
        catch_and_release:    payload.catch_and_release,
        location_country:     payload.location_country?.trim() || null,
        location_city:        payload.location_city?.trim() || null,
        // meeting_point → meeting_point_address (old column dropped)
        meeting_point_address: payload.meeting_point?.trim() || null,
        location_lat:         payload.location_lat ?? null,
        location_lng:         payload.location_lng ?? null,
        location_area:        (payload.location_area as unknown as DbJson) ?? null,
        location_spots:       (payload.location_spots as unknown as DbJson) ?? null,
        booking_type:         payload.booking_type ?? 'classic',
        published:            payload.published,
        // Pricing / duration (legacy + new packages)
        duration_options:     (payload.duration_options as unknown as DbJson) ?? null,
        duration_hours:       payload.duration_hours ?? null,
        duration_days:        payload.duration_days ?? null,
        price_per_person_eur: payload.price_per_person_eur ?? null,
        max_guests:           payload.max_guests ?? 8,
        difficulty:           payload.difficulty ?? null,
        packages:             buildPackages(payload),
        // Structured fields
        season_from:          payload.season_from ?? null,
        season_to:            payload.season_to ?? null,
        fishing_methods:      payload.fishing_methods ?? [],
        inclusions:           (payload.inclusions_data ?? null) as DbJson | null,
        landscape_url:        payload.landscape_url ?? null,
        // Trip content fields
        itinerary:                    (payload.itinerary ?? null) as DbJson | null,
        location_description:         payload.location_description?.trim() || null,
        boat_description:             payload.boat_description?.trim() || null,
        accommodation_description:    payload.accommodation_description?.trim() || null,
        food_description:             payload.food_description?.trim() || null,
        license_description:          payload.license_description?.trim() || null,
        gear_description:             payload.gear_description?.trim() || null,
        transport_description:        payload.transport_description?.trim() || null,
      })
      .select('id')
      .single()

    if (expError != null) {
      console.error('[createExperience]', expError.message)
      return { success: false, error: expError.message }
    }

    // ── 2. Insert images ────────────────────────────────────────────────────
    if (payload.images.length > 0) {
      const imageRows = payload.images.map(img => ({
        experience_id: exp.id,
        url:           img.url,
        is_cover:      img.is_cover,
        sort_order:    img.sort_order,
      }))

      const { error: imgError } = await supabase
        .from('experience_images')
        .insert(imageRows)

      if (imgError != null) {
        console.error('[createExperience/images]', imgError.message)
        // Experience was created — don't fail; images are not critical
      }
    }

    return { success: true, data: { id: exp.id } }
  } catch (err) {
    console.error('[createExperience] Unexpected:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Update Experience ────────────────────────────────────────────────────────

export async function updateExperience(
  expId: string,
  payload: Partial<ExperiencePayload>,
): Promise<ActionResult> {
  try {
    const perm = await assertCanManageExperience(expId)
    if (!perm.ok) return { success: false, error: perm.error, code: perm.code }

    const ctx = await getAuthContext()
    const supabase = ctx?.isAdmin ? createServiceClient() : await createClient()

    // Build update object — only include provided fields
    const update: Record<string, unknown> = {}
    if (payload.title != null)               update.title               = payload.title.trim()
    if (payload.description != null)         update.description         = payload.description.trim()
    if (payload.fish_types != null)          update.fish_types          = payload.fish_types
    if (payload.catch_and_release != null)   update.catch_and_release   = payload.catch_and_release
    if (payload.location_country !== undefined) update.location_country = payload.location_country?.trim() || null
    if (payload.location_city !== undefined) update.location_city       = payload.location_city?.trim() || null
    // meeting_point → meeting_point_address (old column dropped)
    if (payload.meeting_point !== undefined) update.meeting_point_address = payload.meeting_point?.trim() || null
    if (payload.location_lat !== undefined)  update.location_lat        = payload.location_lat ?? null
    if (payload.location_lng !== undefined)  update.location_lng        = payload.location_lng ?? null
    if (payload.location_area !== undefined)  update.location_area      = (payload.location_area as unknown as DbJson) ?? null
    if (payload.location_spots !== undefined) update.location_spots     = (payload.location_spots as unknown as DbJson) ?? null
    if (payload.booking_type != null)         update.booking_type       = payload.booking_type
    if (payload.published != null)           update.published           = payload.published
    // New structured fields
    if (payload.season_from !== undefined)    update.season_from        = payload.season_from ?? null
    if (payload.season_to !== undefined)          update.season_to          = payload.season_to ?? null
    if (payload.fishing_methods != null)          update.fishing_methods    = payload.fishing_methods
    // Pricing / duration — write to legacy columns + new packages
    if (payload.duration_options !== undefined)   update.duration_options   = (payload.duration_options as unknown as DbJson) ?? null
    if (payload.difficulty !== undefined)         update.difficulty         = payload.difficulty ?? null
    if (payload.max_guests !== undefined)         update.max_guests         = payload.max_guests ?? null
    if (payload.price_per_person_eur !== undefined) update.price_per_person_eur = payload.price_per_person_eur ?? null
    if (payload.duration_hours !== undefined)     update.duration_hours     = payload.duration_hours ?? null
    if (payload.duration_days !== undefined)      update.duration_days      = payload.duration_days ?? null
    if (
      payload.duration_options !== undefined ||
      payload.difficulty       !== undefined ||
      payload.max_guests       !== undefined
    ) {
      update.packages = buildPackages(payload as ExperiencePayload)
    }
    if (payload.inclusions_data !== undefined)    update.inclusions         = payload.inclusions_data ?? null
    if (payload.landscape_url !== undefined)      update.landscape_url      = payload.landscape_url ?? null
    // Trip content fields
    if (payload.itinerary !== undefined)                  update.itinerary                 = (payload.itinerary ?? null) as DbJson | null
    if (payload.location_description !== undefined)       update.location_description      = payload.location_description?.trim() || null
    if (payload.boat_description !== undefined)           update.boat_description          = payload.boat_description?.trim() || null
    if (payload.accommodation_description !== undefined)  update.accommodation_description = payload.accommodation_description?.trim() || null
    if (payload.food_description !== undefined)           update.food_description          = payload.food_description?.trim() || null
    if (payload.license_description !== undefined)        update.license_description       = payload.license_description?.trim() || null
    if (payload.gear_description !== undefined)           update.gear_description          = payload.gear_description?.trim() || null
    if (payload.transport_description !== undefined)      update.transport_description     = payload.transport_description?.trim() || null

    const { error } = await supabase
      .from('experiences')
      .update(update)
      .eq('id', expId)

    if (error != null) {
      console.error('[updateExperience]', error.message)
      return { success: false, error: error.message }
    }

    // Re-sync images if provided
    if (payload.images != null) {
      // Delete existing images
      await supabase.from('experience_images').delete().eq('experience_id', expId)

      if (payload.images.length > 0) {
        await supabase.from('experience_images').insert(
          payload.images.map(img => ({
            experience_id: expId,
            url:        img.url,
            is_cover:   img.is_cover,
            sort_order: img.sort_order,
          }))
        )
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[updateExperience] Unexpected:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Toggle Publish ───────────────────────────────────────────────────────────

export async function togglePublishExperience(
  expId: string,
  published: boolean,
): Promise<ActionResult> {
  try {
    const perm = await assertCanManageExperience(expId)
    if (!perm.ok) return { success: false, error: perm.error, code: perm.code }

    const ctx = await getAuthContext()
    const supabase = ctx?.isAdmin ? createServiceClient() : await createClient()
    const { error } = await supabase
      .from('experiences')
      .update({ published })
      .eq('id', expId)

    if (error != null) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error('[togglePublishExperience]', err)
    return { success: false, error: 'Failed to update publish status.' }
  }
}

// ─── Delete Trip ────────────────────────────────────────────────────────

export async function deleteExperience(expId: string): Promise<ActionResult> {
  try {
    const perm = await assertCanManageExperience(expId)
    if (!perm.ok) return { success: false, error: perm.error, code: perm.code }

    const ctx = await getAuthContext()
    const supabase = ctx?.isAdmin ? createServiceClient() : await createClient()

    // Images are FK-cascaded on delete in the DB schema
    const { error } = await supabase
      .from('experiences')
      .delete()
      .eq('id', expId)

    if (error != null) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    console.error('[deleteExperience]', err)
    return { success: false, error: 'Failed to delete experience.' }
  }
}
