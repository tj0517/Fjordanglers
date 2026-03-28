'use server'

/**
 * Guide invite actions — claim a pre-built guide profile.
 *
 * Uses auth.admin.createUser() with email_confirm: true so the guide's
 * account is active immediately — no email confirmation step needed.
 * The guide profile is linked to the new account in the same transaction.
 *
 * Only callable from the /invite/[guideId] page (no admin auth required —
 * the guideId itself is the invite token; UUIDs are unguessable).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { sendGuideWelcomeEmail } from '@/lib/email'
import { env } from '@/lib/env'

export type ClaimResult = { success: true } | { error: string }

/**
 * Creates a new Supabase auth account for a guide and immediately links it
 * to the pre-built guide listing identified by guideId.
 *
 * @param guideId  - The guide profile to claim (acts as the invite token)
 * @param fullName - Guide's display name
 * @param email    - Guide's chosen email (any address — no matching required)
 * @param password - Guide's chosen password (min 8 chars enforced client-side)
 */
export async function claimGuideProfile(
  guideId: string,
  fullName: string,
  email: string,
  password: string,
): Promise<ClaimResult> {
  try {
    const supabase = createServiceClient()

    // ── 1. Verify the guide profile exists and is still unclaimed ─────────────
    const { data: guide } = await supabase
      .from('guides')
      .select('id, user_id')
      .eq('id', guideId)
      .single()

    if (guide == null) {
      return { error: 'Guide profile not found.' }
    }
    if (guide.user_id != null) {
      return { error: 'This profile has already been claimed. Contact support if you need help.' }
    }

    // ── 2. Create the auth account — email pre-confirmed, no email step ───────
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,        // skip email verification entirely
      user_metadata: {
        full_name: fullName.trim(),
        role: 'guide',
      },
    })

    if (createError != null) {
      // Friendly message for duplicate email
      if (
        createError.message.toLowerCase().includes('already registered') ||
        createError.message.toLowerCase().includes('already been registered') ||
        createError.message.toLowerCase().includes('email address is already')
      ) {
        return { error: 'An account with this email already exists. Try signing in instead.' }
      }
      console.error('[invite/claimGuideProfile] createUser error:', createError.message)
      return { error: createError.message }
    }

    const userId = created.user.id

    // ── 3. Link guide row → new auth user ─────────────────────────────────────
    // .select('id') is critical: without it Supabase returns { error: null }
    // even when 0 rows were updated (e.g. user_id was already set by a race).
    const { data: linked, error: updateError } = await supabase
      .from('guides')
      .update({ user_id: userId, is_beta_listing: false })
      .eq('id', guideId)
      .is('user_id', null) // only update if still unclaimed
      .select('id')

    if (updateError != null || !linked || linked.length === 0) {
      // Link failed — clean up the auth account so the guide can try again
      await supabase.auth.admin.deleteUser(userId).catch((e: unknown) => {
        console.error('[invite/claimGuideProfile] cleanup deleteUser error:', e)
      })

      if (updateError != null) {
        console.error('[invite/claimGuideProfile] guide link error:', updateError.message)
        return { error: 'Failed to link your account to the guide profile. Please try again.' }
      }

      // 0 rows updated = guide was claimed by someone else between our check and update
      return { error: 'This profile was just claimed by another account. Contact support if this is a mistake.' }
    }

    // ── 4. Ensure profile row has role = 'guide' ──────────────────────────────
    // Supabase's handle_new_user trigger may have already inserted a profiles row
    // with a default role. We upsert to make sure role is 'guide'.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, role: 'guide' },
        { onConflict: 'id' }, // UPDATE if row exists, INSERT if not
      )

    if (profileError != null) {
      // Non-fatal: guide row is linked, dashboard access works via guides.user_id.
      // Admin can fix the profile role manually if needed.
      console.error('[invite/claimGuideProfile] profile upsert error:', profileError.message)
    }

    // Fire-and-forget — email failure must not block dashboard access
    sendGuideWelcomeEmail({
      to: email.trim(),
      name: fullName.trim(),
      dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
    }).catch((err: unknown) => {
      console.error('[invite/claimGuideProfile] Email send error:', err)
    })

    return { success: true }
  } catch (err) {
    console.error('[invite/claimGuideProfile] Unexpected error:', err)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
