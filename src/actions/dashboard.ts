'use server'

/**
 * Guide Dashboard Server Actions.
 *
 * acceptGuideTerms          → the TermsGate modal
 * setPhotoMarketingConsent  → the marketing toggle on /dashboard/account
 *
 * Guides no longer edit their listing (FA-M.08): the wide profile-update action was removed
 * with the profile editor. The only listing field a guide sets is their photo marketing
 * consent, and only on their own row.
 */

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireGuide } from '@/lib/auth/guards'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }

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

// ─── Photo marketing consent ──────────────────────────────────────────────────

/**
 * Sets `photo_marketing_consent` on the signed-in guide's own listing — nothing else.
 *
 * The row is the one requireGuide() resolves from the session; there is no guide id
 * parameter, so a caller cannot point it at another listing. Anything but a single boolean is
 * refused (a crafted call with an object carrying other fields changes nothing).
 * Written with the service client after the guard: the update touches exactly one column.
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
