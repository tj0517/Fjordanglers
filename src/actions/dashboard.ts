'use server'

/**
 * Guide Dashboard Server Actions — profile updates.
 *
 * updateGuideProfile → called from /dashboard/profile/edit
 */

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { CancellationPolicy, BoatType } from '@/types'
import { CACHE_TAG_GUIDES, CACHE_TAG_EXPERIENCES } from '@/lib/supabase/queries'
import { requireGuide } from '@/lib/auth/guards'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }

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
  facebook_url?: string | null
  website_url?: string | null
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
  landscape_url?: string | null
  photo_marketing_consent?: boolean
  is_hidden?: boolean
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

// ─── Accept guide terms ───────────────────────────────────────────────────────

/**
 * Called from the TermsGate modal when the guide accepts Terms of Use + Privacy Policy.
 * Stamps `terms_accepted_at` with the current UTC time and saves marketing consent.
 */
export async function acceptGuideTerms({
  marketingConsent,
}: {
  marketingConsent: boolean
}): Promise<ActionResult> {
  const { userId } = await requireGuide()
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('guides')
      .update({
        terms_accepted_at:      new Date().toISOString(),
        photo_marketing_consent: marketingConsent,
      })
      .eq('user_id', userId)

    if (error != null) {
      console.error('[acceptGuideTerms]', error.message)
      return { success: false, error: error.message }
    }

    // Force the dashboard layout to re-fetch fresh guide data on next navigation
    revalidatePath('/dashboard', 'layout')

    return { success: true }
  } catch (err) {
    console.error('[acceptGuideTerms] Unexpected:', err)
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
  const { userId } = await requireGuide()
  try {
    const supabase = await createClient()

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
    if (data.facebook_url !== undefined)      update.facebook_url       = data.facebook_url?.trim() || null
    if (data.website_url !== undefined)       update.website_url        = data.website_url?.trim() || null
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
    if (data.boat_capacity !== undefined)  update.boat_capacity  = data.boat_capacity
    if (data.landscape_url !== undefined)  update.landscape_url  = data.landscape_url
    if (data.photo_marketing_consent !== undefined) update.photo_marketing_consent = data.photo_marketing_consent
    if (data.is_hidden !== undefined)              update.is_hidden               = data.is_hidden

    const { error } = await supabase
      .from('guides')
      .update(update)
      .eq('user_id', userId)

    if (error != null) {
      console.error('[updateGuideProfile]', error.message)
      return { success: false, error: error.message }
    }

    revalidateTag(CACHE_TAG_GUIDES, {})
    revalidateTag(CACHE_TAG_EXPERIENCES, {}) // guide data is embedded in experience queries
    return { success: true }
  } catch (err) {
    console.error('[updateGuideProfile] Unexpected:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
