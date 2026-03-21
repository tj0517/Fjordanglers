'use server'

/**
 * Weekly Schedule Server Actions — guide sets recurring weekday blocks over a period.
 *
 * A weekly schedule defines which days of the week are blocked within a date range.
 * Example: block Mon-Fri from May 1 to Sep 30 → the guide is only available on weekends.
 *
 * blocked_weekdays encoding: 0 = Monday … 6 = Sunday  (ISO weekday - 1)
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeeklySchedule = {
  id:               string
  guide_id:         string
  label:            string | null
  period_from:      string   // YYYY-MM-DD
  period_to:        string   // YYYY-MM-DD
  blocked_weekdays: number[] // 0=Mon … 6=Sun
  created_at:       string
}

export type WeeklyScheduleActionResult =
  | { error: string }
  | { success: true }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireGuide() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/calendar')

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  return { supabase, guideId: guide.id }
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new weekly schedule for the authenticated guide.
 * blockedWeekdays: array of 0..6 (Monday = 0, Sunday = 6).
 */
export async function createWeeklySchedule(opts: {
  periodFrom:      string   // YYYY-MM-DD
  periodTo:        string   // YYYY-MM-DD
  blockedWeekdays: number[] // 0=Mon … 6=Sun
  label?:          string
}): Promise<WeeklyScheduleActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.blockedWeekdays.length === 0) {
      return { error: 'Select at least one weekday to block.' }
    }
    if (opts.periodTo < opts.periodFrom) {
      return { error: 'End date must be on or after the start date.' }
    }
    if (opts.blockedWeekdays.some(d => d < 0 || d > 6)) {
      return { error: 'Invalid weekday value.' }
    }

    const { error } = await supabase
      .from('guide_weekly_schedules')
      .insert({
        guide_id:         guideId,
        label:            opts.label?.trim() || null,
        period_from:      opts.periodFrom,
        period_to:        opts.periodTo,
        blocked_weekdays: opts.blockedWeekdays,
      })

    if (error != null) {
      console.error('[weekly-schedules/create]', error.message)
      return { error: 'Failed to create schedule. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[weekly-schedules/create] Unexpected error:', err)
    return { error: 'Failed to create schedule. Please try again.' }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a weekly schedule by ID.
 * RLS ensures guides can only delete their own schedules.
 */
export async function deleteWeeklySchedule(id: string): Promise<WeeklyScheduleActionResult> {
  try {
    const { supabase } = await requireGuide()

    const { error } = await supabase
      .from('guide_weekly_schedules')
      .delete()
      .eq('id', id)

    if (error != null) {
      console.error('[weekly-schedules/delete]', error.message)
      return { error: 'Failed to delete schedule. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[weekly-schedules/delete] Unexpected error:', err)
    return { error: 'Failed to delete schedule. Please try again.' }
  }
}
