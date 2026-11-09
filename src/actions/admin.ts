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

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { requireAdmin } from '@/lib/auth/guards'
import { activationBlocker, slugChangeBlocker, validateGuideSlug } from '@/lib/guide-slug'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminActionResult =
  | { error: string }
  | { success: true; guideId: string }

/** True when another guide already uses `slug` (slugs are unique, public URLs). */
async function isGuideSlugTaken(
  supabase: ReturnType<typeof createServiceClient>,
  slug: string,
  exceptGuideId?: string,
): Promise<boolean> {
  const { data } = await supabase.from('guides').select('id').eq('slug', slug).maybeSingle()
  return data != null && data.id !== exceptGuideId
}

const SLUG_TAKEN_ERROR = 'That slug is already used by another guide. Choose a different one.'

// ─── Create Beta Guide Listing ────────────────────────────────────────────────

export type GuideGalleryImage = {
  url: string
  is_cover: boolean
  sort_order: number
}

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
  /** Full-width hero landscape shown on the guide's profile page. */
  landscape_url?: string | null
  instagram_url?: string
  youtube_url?: string
  pricing_model: 'flat_fee' | 'commission'
  /** Gallery photos to save into guide_images table. */
  gallery_images?: GuideGalleryImage[]
  /** Used by /auth/callback to auto-link the guide's auth account on registration. */
  invite_email?: string
  /** Public profile slug. Required: a beta listing is created `active`, and an active guide needs one. */
  slug: string
}

/**
 * Creates a publicly-visible guide listing on behalf of a beta guide.
 * No auth user is required — the listing appears on /guides immediately.
 */
export async function createBetaGuide(
  payload: BetaGuidePayload,
): Promise<AdminActionResult> {
  await requireAdmin()
  const slug = payload.slug?.trim() ?? ''
  const slugError = validateGuideSlug(slug)
  if (slugError != null) return { error: slugError }
  try {
    const supabase = createServiceClient()

    if (await isGuideSlugTaken(supabase, slug)) return { error: SLUG_TAKEN_ERROR }

    const { data, error } = await supabase
      .from('guides')
      .insert({
        user_id:          null,
        slug,
        is_beta_listing:  true,
        is_hidden:        false,
        full_name:        payload.full_name.trim(),
        country:          payload.country,
        city:             payload.city?.trim() || null,
        bio:              payload.bio?.trim() || null,
        languages:        payload.languages,
        fish_expertise:   payload.fish_expertise,
        years_experience: payload.years_experience ?? null,
        avatar_url:       payload.avatar_url?.trim() || null,
        cover_url:        payload.cover_url?.trim() || null,
        landscape_url:    payload.landscape_url?.trim() || null,
        instagram_url:    payload.instagram_url?.trim() || null,
        youtube_url:      payload.youtube_url?.trim() || null,
        pricing_model:    payload.pricing_model,
        status:           'active',
        verified_at:      new Date().toISOString(),
        invite_email:     payload.invite_email?.trim() || null,
      })
      .select('id')
      .single()

    if (error != null) {
      console.error('[admin/createBetaGuide]', error.message)
      return { error: error.code === '23505' ? SLUG_TAKEN_ERROR : error.message }
    }

    // Save gallery images
    if (payload.gallery_images != null && payload.gallery_images.length > 0) {
      await supabase.from('guide_images').insert(
        payload.gallery_images.map((img, i) => ({
          guide_id:   data.id,
          url:        img.url,
          is_cover:   i === 0,
          sort_order: i,
        })),
      )
    }

    return { success: true, guideId: data.id }
  } catch (err) {
    console.error('[admin/createBetaGuide] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── Shared delete result type ────────────────────────────────────────────────

export type AdminDeleteResult =
  | { error: string }
  | { success: true }

// ─── Delete Guide ─────────────────────────────────────────────────────────────

/**
 * Permanently deletes a guide row. Dependent rows in live tables follow the
 * FK `ON DELETE` rules of the baseline schema.
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
  await requireAdmin()
  try {
    const supabase = createServiceClient()

    // 1. Fetch the guide's user_id before deletion
    const { data: guide } = await supabase.from('guides').select('user_id').eq('id', guideId).single()

    // 2. Delete the guide row
    const { error: guideError } = await supabase
      .from('guides')
      .delete()
      .eq('id', guideId)

    if (guideError != null) {
      console.error('[admin/deleteGuide]', guideError.message)
      return { error: guideError.message }
    }

    // 3. Optionally remove the Supabase Auth account
    if (opts.deleteAuthAccount === true && guide?.user_id != null) {
      const { error: authError } = await supabase.auth.admin.deleteUser(guide.user_id)
      if (authError != null) {
        // Non-fatal — DB rows are already gone
        console.error('[admin/deleteGuide] Auth account delete error:', authError.message)
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[admin/deleteGuide] Unexpected error:', err)
    return { error: 'Failed to delete guide. Please try again.' }
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
  /** Full-width hero landscape shown on the guide's profile page. */
  landscape_url?: string | null
  instagram_url?: string
  youtube_url?: string
  pricing_model: 'flat_fee' | 'commission'
  status: 'pending' | 'verified' | 'active' | 'suspended'
  /** When set, replaces all existing guide_images rows. */
  gallery_images?: GuideGalleryImage[]
  /**
   * Email address used to auto-link the guide's auth account on registration.
   * When a guide registers with this exact email, /auth/callback pins them
   * to this listing automatically. Pass null to clear.
   */
  invite_email?: string | null
  /**
   * Public profile slug. `undefined` = untouched. Required for the guide to be `active`;
   * read-only once the guide is active (rename = deactivate first).
   */
  slug?: string | null
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
  await requireAdmin()
  try {
    const supabase = createServiceClient()

    // Fetch current verified_at so we only set it once (on first activation)
    const { data: current } = await supabase
      .from('guides')
      .select('verified_at, status, slug')
      .eq('id', guideId)
      .single()
    if (current == null) return { error: 'Guide not found.' }

    // Slug rules (FA-1.86): an active guide keeps its slug; activating needs one. The database
    // enforces the same (`guides_active_requires_slug`) — these errors are the readable version.
    const slugChange = slugChangeBlocker(current, payload.slug)
    if (slugChange != null) return { error: slugChange }

    const nextSlug = payload.slug !== undefined ? payload.slug?.trim() || null : current.slug
    if (payload.slug !== undefined && nextSlug != null) {
      const invalid = validateGuideSlug(nextSlug)
      if (invalid != null) return { error: invalid }
      if (nextSlug !== current.slug && await isGuideSlugTaken(supabase, nextSlug, guideId)) {
        return { error: SLUG_TAKEN_ERROR }
      }
    }
    const blocker = activationBlocker(payload.status, nextSlug)
    if (blocker != null) return { error: blocker }

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
        landscape_url:    payload.landscape_url?.trim() || null,
        instagram_url:    payload.instagram_url?.trim() || null,
        youtube_url:      payload.youtube_url?.trim() || null,
        pricing_model:    payload.pricing_model,
        status:           payload.status,
        ...(payload.slug !== undefined ? { slug: nextSlug } : {}),
        // undefined = untouched; null = cleared; string = new value
        ...(payload.invite_email !== undefined
          ? { invite_email: payload.invite_email?.trim() || null }
          : {}),
        ...(setVerifiedAt ? { verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', guideId)

    if (error != null) {
      console.error('[admin/updateGuide]', error.message)
      return { error: error.code === '23505' ? SLUG_TAKEN_ERROR : error.message }
    }

    // Replace gallery images when provided
    if (payload.gallery_images !== undefined) {
      await supabase.from('guide_images').delete().eq('guide_id', guideId)
      if (payload.gallery_images.length > 0) {
        await supabase.from('guide_images').insert(
          payload.gallery_images.map((img, i) => ({
            guide_id:   guideId,
            url:        img.url,
            is_cover:   i === 0,
            sort_order: i,
          })),
        )
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[admin/updateGuide] Unexpected error:', err)
    return { error: 'Failed to update guide. Please try again.' }
  }
}

// ─── Link Guide Account ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Pins an existing Supabase Auth account to a guide listing.
 *
 * @param guideId  - guides.id to link to
 * @param input    - email address OR auth user UUID.
 *                   If omitted, falls back to guides.invite_email (auto-link).
 *
 * On success:
 *   - guides.user_id       = resolved auth user id
 *   - guides.is_beta_listing = false  (unlocks dashboard access)
 *   - profiles.role        = 'guide'  (ensures correct role for middleware)
 */
export async function linkGuideAccount(
  guideId: string,
  input?: string,
): Promise<AdminDeleteResult> {
  await requireAdmin()
  try {
    const supabase = createServiceClient()

    // 1. Fetch guide — must be unlinked
    const { data: guide } = await supabase
      .from('guides')
      .select('id, user_id, invite_email')
      .eq('id', guideId)
      .single()

    if (guide == null) return { error: 'Guide not found' }
    if (guide.user_id != null) return { error: 'Guide already has a linked account' }

    // 2. Resolve the lookup value: explicit input > stored invite_email
    const lookup = input?.trim() || guide.invite_email
    if (!lookup) return { error: 'No email or user ID provided' }

    // 3. Find the auth user — by UUID directly, or by email scan
    let authUserId: string

    if (UUID_RE.test(lookup)) {
      // Direct UUID — just verify it exists
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(lookup)
      if (userErr != null || user == null) return { error: `No auth account found for ID: ${lookup}` }
      authUserId = user.id
    } else {
      // Email — scan auth users list (fine for MVP scale)
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (listErr != null) return { error: `Auth lookup failed: ${listErr.message}` }
      const found = listData.users.find(u => u.email === lookup)
      if (found == null) return { error: `No auth account found for: ${lookup}` }
      authUserId = found.id
    }

    // 4. Link guide → auth user
    const { error: updateErr } = await supabase
      .from('guides')
      .update({ user_id: authUserId, is_beta_listing: false })
      .eq('id', guideId)

    if (updateErr != null) return { error: updateErr.message }

    // 5. Ensure profile.role = 'guide' (only sets role, preserves other columns)
    await supabase
      .from('profiles')
      .upsert({ id: authUserId, role: 'guide' }, { onConflict: 'id' })

    return { success: true }
  } catch (err) {
    console.error('[admin/linkGuideAccount]', err)
    return { error: 'Failed to link account. Please try again.' }
  }
}

// ─── Set Guide Status ─────────────────────────────────────────────────────────

/**
 * Quick status toggle for admin — activate, suspend, or reset to pending.
 * Sets verified_at on first activation.
 */
export async function adminSetGuideStatus(
  guideId: string,
  status: 'active' | 'suspended' | 'pending',
): Promise<AdminDeleteResult> {
  await requireAdmin()
  try {
    const supabase = createServiceClient()

    const { data: current } = await supabase
      .from('guides')
      .select('verified_at, slug')
      .eq('id', guideId)
      .single()
    if (current == null) return { error: 'Guide not found.' }

    // Activation needs a slug (FA-1.86) — refuse with a readable error before the database does.
    const blocker = activationBlocker(status, current.slug)
    if (blocker != null) return { error: blocker }

    const isActivating  = status === 'active'
    const setVerifiedAt = isActivating && current?.verified_at == null

    const { error } = await supabase
      .from('guides')
      .update({
        status,
        ...(setVerifiedAt ? { verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', guideId)

    if (error != null) return { error: error.message }

    revalidatePath(`/admin/guides/${guideId}`)
    revalidatePath(`/guides/${guideId}`)
    revalidatePath('/guides')
    return { success: true }
  } catch (err) {
    console.error('[admin/adminSetGuideStatus]', err)
    return { error: 'Failed to update status. Please try again.' }
  }
}

// ─── Sync Stripe Account Status ───────────────────────────────────────────────

/**
 * Pulls the current account status from Stripe and syncs to DB.
 * Useful when account.updated webhook was missed.
 */
export async function adminSyncStripeStatus(
  guideId: string,
): Promise<{ success: true; chargesEnabled: boolean; payoutsEnabled: boolean } | { error: string }> {
  await requireAdmin()
  try {
    const supabase = createServiceClient()

    const { data: guide } = await supabase
      .from('guides')
      .select('id, stripe_account_id')
      .eq('id', guideId)
      .single()

    if (!guide) return { error: 'Guide not found' }
    if (!guide.stripe_account_id) return { error: 'No Stripe account linked for this guide' }

    const account = await stripe.accounts.retrieve(guide.stripe_account_id)

    const { error: dbErr } = await supabase
      .from('guides')
      .update({
        stripe_charges_enabled: account.charges_enabled ?? false,
        stripe_payouts_enabled: account.payouts_enabled ?? false,
      })
      .eq('id', guideId)

    if (dbErr != null) return { error: dbErr.message }

    revalidatePath(`/admin/guides/${guideId}`)
    return {
      success:        true,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
    }
  } catch (err) {
    console.error('[admin/adminSyncStripeStatus]', err)
    return { error: 'Failed to sync Stripe status. Please try again.' }
  }
}
