'use server'

/**
 * Guide Dashboard Server Actions.
 *
 * acceptGuideTerms          → the TermsGate modal
 * setPhotoMarketingConsent  → the marketing toggle on /dashboard/account
 *
 * Guides no longer edit their listing (FA-M.08): the wide profile-update action was removed
 * with the profile editor. The only listing fields a guide sets are the terms stamp and their
 * photo marketing consent — each through one of these actions, only on their own row.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireGuide } from '@/lib/auth/guards'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }

// ─── Accept guide terms ───────────────────────────────────────────────────────

/**
 * Called from the TermsGate modal when the guide accepts Terms of Use + Privacy Policy.
 * Stamps `terms_accepted_at` (and nothing else) on the signed-in guide's own row — the one
 * requireGuide() resolves from the session. It takes no arguments; a crafted call with any
 * argument (e.g. another listing's id) is refused before anything is written. The modal saves
 * the marketing choice separately through setPhotoMarketingConsent.
 *
 * Service-client write after the guard: since FA-M.08 `authenticated` holds no UPDATE on
 * `guides` (migration 20261115000000), so no guide session can write the table directly.
 */
export async function acceptGuideTerms(...extra: unknown[]): Promise<ActionResult> {
  const { guide } = await requireGuide()

  if (extra.length > 0) {
    return { success: false, error: 'Invalid value.' }
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('guides')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', guide.id)

  if (error != null) {
    console.error('[acceptGuideTerms]', error.message)
    return { success: false, error: 'Could not save. Please try again.' }
  }

  // Force the dashboard layout to re-fetch fresh guide data on next navigation
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

// ─── Photo marketing consent ──────────────────────────────────────────────────

/**
 * Sets `photo_marketing_consent` on the signed-in guide's own listing — nothing else.
 *
 * The row is the one requireGuide() resolves from the session; there is no guide id
 * parameter, so a caller cannot point it at another listing. Anything but a single boolean is
 * refused (a crafted call with an object carrying other fields changes nothing).
 * Written with the service client after the guard (no guide session can UPDATE `guides`
 * since FA-M.08); the update touches exactly one column.
 */
export async function setPhotoMarketingConsent(consent: boolean, ...extra: unknown[]): Promise<ActionResult> {
  const { guide } = await requireGuide()

  // Exactly one boolean. A crafted request with an object, or with a second argument such as
  // another listing's id, is refused before anything is written.
  if (typeof consent !== 'boolean' || extra.length > 0) {
    return { success: false, error: 'Invalid value.' }
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('guides')
    .update({ photo_marketing_consent: consent })
    .eq('id', guide.id)

  if (error != null) {
    console.error('[setPhotoMarketingConsent]', error.message)
    return { success: false, error: 'Could not save. Please try again.' }
  }

  revalidatePath('/dashboard/account')
  return { success: true }
}
