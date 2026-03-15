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
 *   /admin/guides/[id]/experiences/new  (admin creates for guide)
 *   /dashboard/experiences/new          (guide creates own)
 *   /dashboard/experiences/[id]/edit    (guide edits own)
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

export type GroupPricingPayload = {
  model: 'per_size'
  prices: Record<string, number>
}

export type InclusionsPayload = {
  rods: boolean
  tackle: boolean
  bait: boolean
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

export type ExperiencePayload = {
  title: string
  description: string
  fish_types: string[]
  technique?: string | null
  difficulty?: 'beginner' | 'intermediate' | 'expert' | null
  catch_and_release: boolean
  // Backward-compat scalars (derived from first duration option)
  duration_hours?: number | null
  duration_days?: number | null
  max_guests: number
  /** null for booking_type='icelandic' (price on request) */
  price_per_person_eur: number | null
  location_country?: string | null
  location_city?: string | null
  meeting_point?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_area?: GeoJSON.Polygon | null
  location_spots?: LocationSpot[] | null
  booking_type?: 'classic' | 'icelandic'
  // Backward-compat arrays (derived from inclusions toggles)
  what_included: string[]
  what_excluded: string[]
  published: boolean
  images: ImageInput[]
  // ── New structured fields ─────────────────────────────────────────────────
  season_from?: number | null
  season_to?: number | null
  fishing_methods?: string[]
  /** null for booking_type='icelandic' — clears previous duration data */
  duration_options?: DurationOptionPayload[] | null
  group_pricing?: GroupPricingPayload | null
  inclusions_data?: InclusionsPayload | null
  landscape_url?: string | null
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

// ─── Create Experience ────────────────────────────────────────────────────────

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
        technique:            payload.technique?.trim() || null,
        difficulty:           payload.difficulty ?? null,
        catch_and_release:    payload.catch_and_release,
        duration_hours:       payload.duration_hours ?? null,
        duration_days:        payload.duration_days ?? null,
        max_guests:           payload.max_guests,
        price_per_person_eur: payload.price_per_person_eur,
        location_country:     payload.location_country?.trim() || null,
        location_city:        payload.location_city?.trim() || null,
        meeting_point:        payload.meeting_point?.trim() || null,
        location_lat:         payload.location_lat ?? null,
        location_lng:         payload.location_lng ?? null,
        location_area:        (payload.location_area as unknown as import('@/lib/supabase/database.types').Json) ?? null,
        location_spots:       (payload.location_spots as unknown as import('@/lib/supabase/database.types').Json) ?? null,
        booking_type:         payload.booking_type ?? 'classic',
        what_included:        payload.what_included.filter(s => s.trim() !== ''),
        what_excluded:        payload.what_excluded.filter(s => s.trim() !== ''),
        published:            payload.published,
        // New structured fields
        season_from:          payload.season_from ?? null,
        season_to:            payload.season_to ?? null,
        fishing_methods:      payload.fishing_methods ?? [],
        duration_options:     (payload.duration_options ?? null) as import('@/lib/supabase/database.types').Json | null,
        group_pricing:        (payload.group_pricing ?? null) as import('@/lib/supabase/database.types').Json | null,
        inclusions:           (payload.inclusions_data ?? null) as import('@/lib/supabase/database.types').Json | null,
        landscape_url:        payload.landscape_url ?? null,
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
    if (payload.technique !== undefined)     update.technique           = payload.technique?.trim() || null
    if (payload.difficulty !== undefined)    update.difficulty          = payload.difficulty ?? null
    if (payload.catch_and_release != null)   update.catch_and_release   = payload.catch_and_release
    if (payload.duration_hours !== undefined) update.duration_hours     = payload.duration_hours ?? null
    if (payload.duration_days !== undefined)  update.duration_days      = payload.duration_days ?? null
    if (payload.max_guests != null)          update.max_guests          = payload.max_guests
    if (payload.price_per_person_eur !== undefined) update.price_per_person_eur = payload.price_per_person_eur ?? null
    if (payload.location_country !== undefined) update.location_country = payload.location_country?.trim() || null
    if (payload.location_city !== undefined) update.location_city       = payload.location_city?.trim() || null
    if (payload.meeting_point !== undefined) update.meeting_point       = payload.meeting_point?.trim() || null
    if (payload.location_lat !== undefined)  update.location_lat        = payload.location_lat ?? null
    if (payload.location_lng !== undefined)  update.location_lng        = payload.location_lng ?? null
    if (payload.location_area !== undefined)  update.location_area      = (payload.location_area as unknown as import('@/lib/supabase/database.types').Json) ?? null
    if (payload.location_spots !== undefined) update.location_spots     = (payload.location_spots as unknown as import('@/lib/supabase/database.types').Json) ?? null
    if (payload.booking_type != null)         update.booking_type       = payload.booking_type
    if (payload.what_included != null)       update.what_included       = payload.what_included.filter(s => s.trim() !== '')
    if (payload.what_excluded != null)       update.what_excluded       = payload.what_excluded.filter(s => s.trim() !== '')
    if (payload.published != null)           update.published           = payload.published
    // New structured fields
    if (payload.season_from !== undefined)    update.season_from        = payload.season_from ?? null
    if (payload.season_to !== undefined)      update.season_to          = payload.season_to ?? null
    if (payload.fishing_methods != null)      update.fishing_methods    = payload.fishing_methods
    if (payload.duration_options !== undefined) update.duration_options  = payload.duration_options ?? null
    if (payload.group_pricing !== undefined)  update.group_pricing      = payload.group_pricing ?? null
    if (payload.inclusions_data !== undefined) update.inclusions        = payload.inclusions_data ?? null
    if (payload.landscape_url !== undefined)   update.landscape_url     = payload.landscape_url ?? null

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

// ─── Delete Experience ────────────────────────────────────────────────────────

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
