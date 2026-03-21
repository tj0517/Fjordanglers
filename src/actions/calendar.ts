'use server'

/**
 * Calendar Server Actions — guide manages availability / blocked dates.
 *
 * Uses the `experience_blocked_dates` table (date ranges per experience).
 * A unique index on (experience_id, date_start, date_end) prevents duplicates.
 *
 * All inserts use upsert with ignoreDuplicates: true — blocking the same range
 * twice is a no-op (idempotent), not an error.
 *
 * RLS on `experience_blocked_dates` ensures a guide can only read/write rows
 * that belong to their own experiences.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarActionResult =
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

// ─── Block dates ──────────────────────────────────────────────────────────────

/**
 * Inserts one `experience_blocked_dates` row per experience for the given range.
 * Passing all experience IDs = blocks the guide's full calendar for that period.
 */
export async function blockDates(opts: {
  /** Experience IDs to block — must all belong to the authenticated guide. */
  experienceIds: string[]
  /** First blocked date, inclusive. YYYY-MM-DD */
  dateStart: string
  /** Last blocked date, inclusive. Must be >= dateStart. YYYY-MM-DD */
  dateEnd: string
  /** Optional internal note (not shown to anglers). */
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.experienceIds.length === 0) {
      return { error: 'Select at least one experience to block.' }
    }
    if (opts.dateEnd < opts.dateStart) {
      return { error: 'End date must be on or after the start date.' }
    }

    // Ownership check — verify all supplied IDs actually belong to this guide
    const { data: owned } = await supabase
      .from('experiences')
      .select('id')
      .eq('guide_id', guideId)
      .in('id', opts.experienceIds)

    if ((owned?.length ?? 0) !== opts.experienceIds.length) {
      return { error: 'One or more experiences not found.' }
    }

    // upsert with ignoreDuplicates: true → INSERT … ON CONFLICT DO NOTHING
    // Safe to call multiple times for the same range (idempotent).
    const { error } = await supabase
      .from('experience_blocked_dates')
      .upsert(
        opts.experienceIds.map((experienceId) => ({
          experience_id: experienceId,
          date_start:    opts.dateStart,
          date_end:      opts.dateEnd,
          reason:        opts.reason?.trim() || null,
        })),
        { onConflict: 'experience_id,date_start,date_end', ignoreDuplicates: true }
      )

    if (error != null) {
      console.error('[calendar/blockDates]', error.message)
      return { error: 'Failed to block dates. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/blockDates] Unexpected error:', err)
    return { error: 'Failed to block dates. Please try again.' }
  }
}

// ─── Block multiple individual dates (multi-pick) ────────────────────────────

/**
 * Inserts one row per (date × experience) — used by the multi-day picker.
 * Each row has date_start = date_end = the individual date (single-day block).
 *
 * Max 60 dates × experiences in one call to keep payload reasonable.
 */
export async function blockMultipleDates(opts: {
  /** Experience IDs to block. Must all belong to the authenticated guide. */
  experienceIds: string[]
  /** Individual YYYY-MM-DD dates to block (non-contiguous is fine). */
  dates: string[]
  /** Optional internal note. */
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.experienceIds.length === 0) {
      return { error: 'Select at least one experience to block.' }
    }
    if (opts.dates.length === 0) {
      return { error: 'No dates selected.' }
    }
    if (opts.dates.length * opts.experienceIds.length > 300) {
      return { error: 'Too many date/experience combinations. Select fewer days.' }
    }

    // Ownership check
    const { data: owned } = await supabase
      .from('experiences')
      .select('id')
      .eq('guide_id', guideId)
      .in('id', opts.experienceIds)

    if ((owned?.length ?? 0) !== opts.experienceIds.length) {
      return { error: 'One or more experiences not found.' }
    }

    // One row per date × experience (date_start = date_end = single day)
    const rows = opts.dates.flatMap((date) =>
      opts.experienceIds.map((experienceId) => ({
        experience_id: experienceId,
        date_start:    date,
        date_end:      date,
        reason:        opts.reason?.trim() || null,
      }))
    )

    // upsert with ignoreDuplicates: true → INSERT … ON CONFLICT DO NOTHING
    // Already-blocked days in the selection are silently skipped.
    const { error } = await supabase
      .from('experience_blocked_dates')
      .upsert(rows, { onConflict: 'experience_id,date_start,date_end', ignoreDuplicates: true })

    if (error != null) {
      console.error('[calendar/blockMultipleDates]', error.message)
      return { error: 'Failed to block dates. Please try again.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/blockMultipleDates] Unexpected error:', err)
    return { error: 'Failed to block dates. Please try again.' }
  }
}

// ─── Update calendar mode ─────────────────────────────────────────────────────

/**
 * Saves the guide's calendar mode preference.
 *   'per_listing' — each experience has its own availability calendar (default).
 *   'shared'      — one unified calendar; blocks always apply to ALL experiences.
 */
export async function updateCalendarMode(
  mode: 'per_listing' | 'shared',
): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (mode !== 'per_listing' && mode !== 'shared') {
      return { error: 'Invalid calendar mode.' }
    }

    const { error } = await supabase
      .from('guides')
      .update({ calendar_mode: mode })
      .eq('id', guideId)

    if (error != null) {
      console.error('[calendar/updateCalendarMode]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/updateCalendarMode] Unexpected error:', err)
    return { error: 'Failed to update calendar mode. Please try again.' }
  }
}

// ─── Toggle calendar_disabled ─────────────────────────────────────────────────

/**
 * Toggles the guide's `calendar_disabled` flag.
 * When true, trip pages show inquiry-only booking (no date picker / instant checkout).
 * Only meaningful for guides whose listings are all `icelandic` booking type.
 */
export async function toggleCalendarDisabled(
  disabled: boolean,
): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const { error } = await supabase
      .from('guides')
      .update({ calendar_disabled: disabled })
      .eq('id', guideId)

    if (error != null) {
      console.error('[calendar/toggleCalendarDisabled]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/toggleCalendarDisabled] Unexpected error:', err)
    return { error: 'Failed to update calendar setting. Please try again.' }
  }
}

// ─── Unblock dates ────────────────────────────────────────────────────────────

/**
 * Deletes a single `experience_blocked_dates` row by ID.
 * RLS guarantees guides can only delete rows for their own experiences.
 */
export async function unblockDates(blockId: string): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    const { error } = await supabase
      .from('experience_blocked_dates')
      .delete()
      .eq('id', blockId)

    if (error != null) {
      console.error('[calendar/unblockDates]', error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/unblockDates] Unexpected error:', err)
    return { error: 'Failed to unblock dates. Please try again.' }
  }
}
