'use server'

/**
 * Guide Dashboard Server Actions — profile creation and updates.
 *
 * createGuideProfile → called from GuideOnboarding wizard (first login after registration)
 * updateGuideProfile → called from /dashboard/profile/edit
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { CancellationPolicy, BoatType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }

export type CreateGuideProfileData = {
  full_name: string
  country: string
  city?: string
  bio?: string
  fish_expertise: string[]
  languages: string[]
  years_experience?: number | null
  pricing_model: 'flat_fee' | 'commission'
}

export type UpdateGuideProfileData = {
  full_name?: string
  country?: string
  city?: string | null
  bio?: string | null
  fish_expertise?: string[]
  languages?: string[]
  years_experience?: number | null
  instagram_url?: string | null
  youtube_url?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  // ── Added: guide profile expansion ────────────────────────────────────────
  tagline?: string | null
  cancellation_policy?: CancellationPolicy
  specialties?: string[] | null
  certifications?: string[] | null
  google_profile_url?: string | null
  google_rating?: number | null
  google_review_count?: number | null
  boat_name?: string | null
  boat_type?: BoatType | null
  boat_length_m?: number | null
  boat_engine?: string | null
  boat_capacity?: number | null
}

// ── Validation schema for new constrained fields ──────────────────────────────

const updateGuideProfileSchema = z.object({
  tagline:             z.string().max(120).nullish(),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']).optional(),
  google_profile_url:  z.string().url('Google URL must start with https://').nullish(),
  google_rating:       z.number().min(1).max(5).nullish(),
  google_review_count: z.number().int().min(0).nullish(),
  boat_capacity:       z.number().int().min(1).max(12).nullish(),
})

// ─── Create guide profile ─────────────────────────────────────────────────────

/**
 * Called from the onboarding wizard on first login.
 * Creates the guides row linked to the auth user.
 */
export async function createGuideProfile(
  data: CreateGuideProfileData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user == null) {
      return { success: false, error: 'Not authenticated.', code: 'UNAUTHORIZED' }
    }

    // Guard — don't create a duplicate
    const { data: existing } = await supabase
      .from('guides')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing != null) {
      return { success: false, error: 'Guide profile already exists.', code: 'ALREADY_EXISTS' }
    }

    const { data: guide, error } = await supabase
      .from('guides')
      .insert({
        user_id:             user.id,
        full_name:           data.full_name.trim(),
        country:             data.country,
        city:                data.city?.trim() || null,
        bio:                 data.bio?.trim() || null,
        fish_expertise:      data.fish_expertise,
        languages:           data.languages,
        years_experience:    data.years_experience ?? null,
        pricing_model:       data.pricing_model,
        status:              'pending',
        is_beta_listing:     false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        total_reviews:       0,
      })
      .select('id')
      .single()

    if (error != null) {
      console.error('[createGuideProfile]', error.message)
      return { success: false, error: error.message }
    }

    return { success: true, data: { id: guide.id } }
  } catch (err) {
    console.error('[createGuideProfile] Unexpected:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Update guide profile ─────────────────────────────────────────────────────

/**
 * Called from /dashboard/profile/edit.
 * Only updates the row owned by the current auth user.
 */
export async function updateGuideProfile(
  data: UpdateGuideProfileData,
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user == null) {
      return { success: false, error: 'Not authenticated.', code: 'UNAUTHORIZED' }
    }

    // Validate constrained new fields
    const validation = updateGuideProfileSchema.safeParse({
      tagline:             data.tagline,
      cancellation_policy: data.cancellation_policy,
      google_profile_url:  data.google_profile_url,
      google_rating:       data.google_rating,
      google_review_count: data.google_review_count,
      boat_capacity:       data.boat_capacity,
    })
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message }
    }

    // Build update object — only touch provided keys
    const update: Record<string, unknown> = {}
    if (data.full_name != null)               update.full_name          = data.full_name.trim()
    if (data.country != null)                 update.country            = data.country
    if (data.city !== undefined)              update.city               = data.city?.trim() || null
    if (data.bio !== undefined)               update.bio                = data.bio?.trim() || null
    if (data.fish_expertise != null)          update.fish_expertise     = data.fish_expertise
    if (data.languages != null)               update.languages          = data.languages
    if (data.years_experience !== undefined)  update.years_experience   = data.years_experience ?? null
    if (data.instagram_url !== undefined)     update.instagram_url      = data.instagram_url?.trim() || null
    if (data.youtube_url !== undefined)       update.youtube_url        = data.youtube_url?.trim() || null
    if (data.avatar_url !== undefined)        update.avatar_url         = data.avatar_url
    if (data.cover_url !== undefined)         update.cover_url          = data.cover_url
    // ── New fields ────────────────────────────────────────────────────────────
    if (data.tagline !== undefined)           update.tagline            = data.tagline?.trim() || null
    if (data.cancellation_policy != null)     update.cancellation_policy = data.cancellation_policy
    if (data.specialties !== undefined)       update.specialties        = data.specialties
    if (data.certifications !== undefined)    update.certifications     = data.certifications
    if (data.google_profile_url !== undefined) update.google_profile_url = data.google_profile_url?.trim() || null
    if (data.google_rating !== undefined)     update.google_rating      = data.google_rating
    if (data.google_review_count !== undefined) update.google_review_count = data.google_review_count
    if (data.boat_name !== undefined)         update.boat_name          = data.boat_name?.trim() || null
    if (data.boat_type !== undefined)         update.boat_type          = data.boat_type
    if (data.boat_length_m !== undefined)     update.boat_length_m      = data.boat_length_m
    if (data.boat_engine !== undefined)       update.boat_engine        = data.boat_engine?.trim() || null
    if (data.boat_capacity !== undefined)     update.boat_capacity      = data.boat_capacity

    const { error } = await supabase
      .from('guides')
      .update(update)
      .eq('user_id', user.id)

    if (error != null) {
      console.error('[updateGuideProfile]', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[updateGuideProfile] Unexpected:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
