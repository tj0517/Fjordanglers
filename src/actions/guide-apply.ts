'use server'

/**
 * Server Action — Guide listing application.
 *
 * Saves the applicant as a new lead in the `leads` table with status "new".
 * Extra fields (email, phone, languages, bio, plan…) are serialised into `notes`
 * because the leads table is intentionally minimal (admin pipeline tool).
 *
 * Uses createServiceClient() so the insert bypasses RLS.
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'

// ─── Payload type ─────────────────────────────────────────────────────────────

export type GuideApplicationPayload = {
  plan: 'listing' | 'bookable' | 'founding'
  full_name: string
  email: string
  phone: string
  country: string
  city: string
  years_experience: string
  fish_types: string[]
  languages: string[]
  bio: string
  certifications: string
  instagram: string
  youtube: string
  website: string
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function submitGuideApplication(
  payload: GuideApplicationPayload,
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServiceClient()

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        name: payload.full_name,
        instagram_handle: payload.instagram.trim() !== '' ? payload.instagram.trim() : null,
        country: payload.country,
        fish_types: payload.fish_types,
        status: 'new',
        notes: JSON.stringify({
          email: payload.email,
          phone: payload.phone !== '' ? payload.phone : null,
          city: payload.city !== '' ? payload.city : null,
          years_experience: payload.years_experience,
          languages: payload.languages,
          bio: payload.bio !== '' ? payload.bio : null,
          certifications: payload.certifications !== '' ? payload.certifications : null,
          youtube: payload.youtube !== '' ? payload.youtube : null,
          website: payload.website !== '' ? payload.website : null,
          plan: payload.plan,
          submitted_at: new Date().toISOString(),
        }),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[guide-apply] Supabase error:', error.message)
      return {
        success: false,
        error: 'Failed to submit your application. Please try again.',
      }
    }

    return { success: true, data: { id: lead.id } }
  } catch (err) {
    console.error('[guide-apply] Unexpected error:', err)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
