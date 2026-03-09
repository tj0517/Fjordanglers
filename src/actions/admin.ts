'use server'

/**
 * Admin Server Actions — operations only accessible to users with role='admin'.
 *
 * All actions verify the caller's admin role before mutating data.
 * Beta guide listings are created with:
 *   - user_id = NULL (no linked auth user)
 *   - is_beta_listing = TRUE
 *   - status = 'active' + verified_at = NOW() (publicly visible immediately)
 */

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminActionResult =
  | { error: string }
  | { success: true; guideId: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the current user is authenticated and has role='admin'.
 * Returns the user id on success, throws/redirects on failure.
 */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return { supabase, userId: user.id }
}

// ─── Create Beta Guide Listing ────────────────────────────────────────────────

export type BetaGuidePayload = {
  full_name: string
  country: string
  city?: string
  bio?: string
  languages: string[]
  fish_expertise: string[]
  years_experience?: number | null
  avatar_url?: string
  cover_url?: string
  instagram_url?: string
  youtube_url?: string
  pricing_model: 'flat_fee' | 'commission'
  // ── Lead bridge fields ──────────────────────────────────────────────────────
  // Set when creating a listing from a lead application.
  // invite_email is used in Phase 2 to auto-link when the guide registers.
  invite_email?: string
  lead_id?: string
}

/**
 * Creates a publicly-visible guide listing on behalf of a beta guide.
 * No auth user is required — the listing appears on /guides immediately.
 */
export async function createBetaGuide(
  payload: BetaGuidePayload,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await supabase
      .from('guides')
      .insert({
        user_id:          null,
        is_beta_listing:  true,
        full_name:        payload.full_name.trim(),
        country:          payload.country,
        city:             payload.city?.trim() || null,
        bio:              payload.bio?.trim() || null,
        languages:        payload.languages,
        fish_expertise:   payload.fish_expertise,
        years_experience: payload.years_experience ?? null,
        avatar_url:       payload.avatar_url?.trim() || null,
        cover_url:        payload.cover_url?.trim() || null,
        instagram_url:    payload.instagram_url?.trim() || null,
        youtube_url:      payload.youtube_url?.trim() || null,
        pricing_model:    payload.pricing_model,
        status:           'active',
        verified_at:      new Date().toISOString(),
        // ── Lead bridge ──────────────────────────────────────────────────────
        invite_email:     payload.invite_email?.trim() || null,
        lead_id:          payload.lead_id ?? null,
      })
      .select('id')
      .single()

    if (error != null) {
      console.error('[admin/createBetaGuide]', error.message)
      return { error: error.message }
    }

    // If this listing was created from a lead, mark the lead as onboarded
    if (payload.lead_id != null) {
      await supabase
        .from('leads')
        .update({ status: 'onboarded' })
        .eq('id', payload.lead_id)
    }

    return { success: true, guideId: data.id }
  } catch (err) {
    // redirect() throws — let it bubble up
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/createBetaGuide] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Shared delete result type ────────────────────────────────────────────────

export type AdminDeleteResult =
  | { error: string }
  | { success: true }

// ─── Delete Guide (full cascade) ─────────────────────────────────────────────

/**
 * Permanently deletes a guide and ALL associated data in dependency order:
 *   payments → bookings → experience_images → experiences → guide row
 *
 * If deleteAuthAccount is true AND the guide has a linked user_id,
 * the Supabase Auth account is also removed (irreversible).
 *
 * Uses the service-role client so RLS is bypassed for every step.
 */
export async function deleteGuide(
  guideId: string,
  opts: { deleteAuthAccount?: boolean } = {},
): Promise<AdminDeleteResult> {
  try {
    await requireAdmin()
    const supabase = await createServiceClient()

    // 1. Fetch the guide's user_id and all their experience IDs before deletion
    const [{ data: guide }, { data: exps }] = await Promise.all([
      supabase.from('guides').select('user_id').eq('id', guideId).single(),
      supabase.from('experiences').select('id').eq('guide_id', guideId),
    ])

    const expIds = (exps ?? []).map((e) => e.id)

    if (expIds.length > 0) {
      // 2. Find booking IDs for these experiences (needed to cascade payments)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .in('experience_id', expIds)

      const bookingIds = (bookings ?? []).map((b) => b.id)

      // 3. Delete payments → bookings → experience_images → experiences
      if (bookingIds.length > 0) {
        await supabase.from('payments').delete().in('booking_id', bookingIds)
      }
      await supabase.from('bookings').delete().in('experience_id', expIds)
      await supabase.from('experience_images').delete().in('experience_id', expIds)
      await supabase.from('experiences').delete().eq('guide_id', guideId)
    }

    // 4. Delete remaining bookings where guide_id matches (edge-case FK)
    await supabase.from('bookings').delete().eq('guide_id', guideId)

    // 5. Delete the guide row
    const { error: guideError } = await supabase
      .from('guides')
      .delete()
      .eq('id', guideId)

    if (guideError != null) {
      console.error('[admin/deleteGuide]', guideError.message)
      return { error: guideError.message }
    }

    // 6. Optionally remove the Supabase Auth account
    if (opts.deleteAuthAccount === true && guide?.user_id != null) {
      const { error: authError } = await supabase.auth.admin.deleteUser(guide.user_id)
      if (authError != null) {
        // Non-fatal — DB rows are already gone
        console.error('[admin/deleteGuide] Auth account delete error:', authError.message)
      }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/deleteGuide] Unexpected error:', err)
    return { error: 'Failed to delete guide. Please try again.' }
  }
}

// ─── Delete Experience ────────────────────────────────────────────────────────

/**
 * Permanently deletes a single experience and its related data:
 *   payments → bookings → experience_images → experience
 */
export async function deleteExperience(
  experienceId: string,
): Promise<AdminDeleteResult> {
  try {
    await requireAdmin()
    const supabase = await createServiceClient()

    // 1. Payments for bookings of this experience
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('experience_id', experienceId)

    const bookingIds = (bookings ?? []).map((b) => b.id)
    if (bookingIds.length > 0) {
      await supabase.from('payments').delete().in('booking_id', bookingIds)
    }

    // 2. Bookings → images → experience
    await supabase.from('bookings').delete().eq('experience_id', experienceId)
    await supabase.from('experience_images').delete().eq('experience_id', experienceId)

    const { error } = await supabase
      .from('experiences')
      .delete()
      .eq('id', experienceId)

    if (error != null) {
      console.error('[admin/deleteExperience]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/deleteExperience] Unexpected error:', err)
    return { error: 'Failed to delete experience. Please try again.' }
  }
}

// ─── Delete Lead ──────────────────────────────────────────────────────────────

/**
 * Permanently deletes a single lead from the pipeline.
 * Does NOT delete any guide listing that may have been created from this lead —
 * the guides.lead_id FK is nullable, so that row will simply lose the reference.
 */
export async function deleteLead(leadId: string): Promise<AdminDeleteResult> {
  try {
    await requireAdmin()
    const supabase = await createServiceClient()

    // Nullify the FK reference on any guide that was created from this lead
    await supabase
      .from('guides')
      .update({ lead_id: null })
      .eq('lead_id', leadId)

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)

    if (error != null) {
      console.error('[admin/deleteLead]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/deleteLead] Unexpected error:', err)
    return { error: 'Failed to delete lead. Please try again.' }
  }
}

// ─── Update Guide ─────────────────────────────────────────────────────────────

export type UpdateGuidePayload = {
  full_name: string
  country: string
  city?: string
  bio?: string
  languages: string[]
  fish_expertise: string[]
  years_experience?: number | null
  avatar_url?: string
  cover_url?: string
  instagram_url?: string
  youtube_url?: string
  pricing_model: 'flat_fee' | 'commission'
  status: 'pending' | 'verified' | 'active' | 'suspended'
}

export type AdminUpdateResult =
  | { error: string }
  | { success: true }

/**
 * Updates an existing guide profile.
 * Sets verified_at = NOW() when transitioning to 'active' or 'verified'
 * for the first time (i.e. when it was previously NULL).
 */
export async function updateGuide(
  guideId: string,
  payload: UpdateGuidePayload,
): Promise<AdminUpdateResult> {
  try {
    const { supabase } = await requireAdmin()

    // Fetch current verified_at so we only set it once (on first activation)
    const { data: current } = await supabase
      .from('guides')
      .select('verified_at')
      .eq('id', guideId)
      .single()

    const isActivating =
      payload.status === 'active' || payload.status === 'verified'
    const setVerifiedAt = isActivating && current?.verified_at == null

    const { error } = await supabase
      .from('guides')
      .update({
        full_name:        payload.full_name.trim(),
        country:          payload.country,
        city:             payload.city?.trim() || null,
        bio:              payload.bio?.trim() || null,
        languages:        payload.languages,
        fish_expertise:   payload.fish_expertise,
        years_experience: payload.years_experience ?? null,
        avatar_url:       payload.avatar_url?.trim() || null,
        cover_url:        payload.cover_url?.trim() || null,
        instagram_url:    payload.instagram_url?.trim() || null,
        youtube_url:      payload.youtube_url?.trim() || null,
        pricing_model:    payload.pricing_model,
        status:           payload.status,
        ...(setVerifiedAt ? { verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', guideId)

    if (error != null) {
      console.error('[admin/updateGuide]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/updateGuide] Unexpected error:', err)
    return { error: 'Failed to update guide. Please try again.' }
  }
}

// ─── Update Lead Status ───────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'responded' | 'onboarded' | 'rejected'

/**
 * Updates the status of a lead in the pipeline.
 * Used by the admin leads page action buttons.
 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const updateData: Record<string, unknown> = { status }

    // Set timestamp fields based on the new status
    if (status === 'contacted') {
      updateData.contacted_at = new Date().toISOString()
    } else if (status === 'responded') {
      updateData.responded_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)

    if (error != null) {
      console.error('[admin/updateLeadStatus]', error.message)
      return { error: error.message }
    }

    return { success: true, guideId: leadId }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[admin/updateLeadStatus] Unexpected error:', err)
    return { error: 'Failed to update lead status. Please try again.' }
  }
}
