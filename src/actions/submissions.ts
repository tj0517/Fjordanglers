'use server'

/**
 * Guide submission Server Actions.
 *
 * createGuideSubmission  — guide submits raw trip info; FA builds the page.
 * markSubmissionInProgress — FA marks a submission as in_progress when starting to build.
 */

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmissionPayload {
  location_name:    string
  country:          string
  region:           string | null
  species:          string[]
  fishing_methods:  string[]
  season_months:    number[]
  trip_types:       string[]
  max_anglers:      number
  price_approx_eur: number | null
  includes:         string[]
  includes_notes:   string | null
  personal_note:    string | null
}

export type SubmissionResult =
  | { success: true;  id: string }
  | { success: false; error: string }

// ─── createGuideSubmission ────────────────────────────────────────────────────

export async function createGuideSubmission(
  payload: SubmissionPayload,
): Promise<SubmissionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) return { success: false, error: 'Guide profile not found' }

  // Validate required fields server-side
  if (!payload.location_name.trim()) return { success: false, error: 'Location name is required' }
  if (!payload.country)               return { success: false, error: 'Country is required' }
  if (payload.species.length === 0)   return { success: false, error: 'At least one species is required' }
  if (payload.season_months.length === 0) return { success: false, error: 'At least one season month is required' }

  const svc = createServiceClient()

  const { data, error } = await svc
    .from('guide_submissions')
    .insert({
      guide_id:         guide.id,
      location_name:    payload.location_name.trim(),
      country:          payload.country,
      region:           payload.region?.trim() || null,
      species:          payload.species,
      fishing_methods:  payload.fishing_methods,
      season_months:    payload.season_months,
      trip_types:       payload.trip_types,
      max_anglers:      payload.max_anglers,
      price_approx_eur: payload.price_approx_eur,
      includes:         payload.includes,
      includes_notes:   payload.includes_notes?.trim() || null,
      personal_note:    payload.personal_note?.trim() || null,
      status:           'submitted',
    })
    .select('id')
    .single()

  if (error != null || data == null) {
    console.error('[createGuideSubmission] DB error:', error)
    return { success: false, error: 'Failed to save submission' }
  }

  console.log(`[createGuideSubmission] Created submission ${data.id} for guide ${guide.id}`)
  return { success: true, id: data.id }
}

// ─── markSubmissionInProgress ─────────────────────────────────────────────────

/**
 * FA marks a submission as in_progress when they start building the experience.
 * Returns the guide_id so the caller can navigate to the admin trip creation page.
 */
export async function markSubmissionInProgress(
  submissionId: string,
): Promise<{ guideId: string } | { error: string }> {
  const svc = createServiceClient()

  const { data: sub } = await svc
    .from('guide_submissions')
    .select('id, guide_id, status')
    .eq('id', submissionId)
    .single()

  if (sub == null) return { error: 'Submission not found' }

  await svc
    .from('guide_submissions')
    .update({ status: 'in_progress' })
    .eq('id', submissionId)

  return { guideId: sub.guide_id }
}
