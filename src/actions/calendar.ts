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
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
 *
 * Overlap guard — for each experience we first check if any existing block already
 * covers any part of [dateStart, dateEnd].  An existing block overlaps when:
 *   existing.date_start ≤ new.date_end  AND  existing.date_end ≥ new.date_start
 * If overlap is found the experience is skipped — preventing a day from ever being
 * covered by two separate block records.
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

    // Overlap guard — fetch experiences that already have a block touching the range
    const { data: overlapping } = await supabase
      .from('experience_blocked_dates')
      .select('experience_id')
      .in('experience_id', opts.experienceIds)
      .lte('date_start', opts.dateEnd)   // existing block starts before new range ends
      .gte('date_end',   opts.dateStart) // existing block ends after new range starts

    const alreadyCovered = new Set((overlapping ?? []).map(b => b.experience_id))
    const toInsert = opts.experienceIds.filter(id => !alreadyCovered.has(id))

    // All experiences already covered by an existing block — nothing to do
    if (toInsert.length === 0) return { success: true }

    // upsert with ignoreDuplicates as a safety net against concurrent calls
    const { error } = await supabase
      .from('experience_blocked_dates')
      .upsert(
        toInsert.map((experienceId) => ({
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

    // Overlap guard — fetch all existing blocks that touch ANY of the selected dates
    // for the relevant experiences, then compute a Set of already-covered (expId, date)
    // pairs so we never insert a row that would make a day have two block records.
    const sortedDates  = [...opts.dates].sort()
    const minDate      = sortedDates[0]!
    const maxDate      = sortedDates[sortedDates.length - 1]!

    const { data: existingBlocks } = await supabase
      .from('experience_blocked_dates')
      .select('experience_id, date_start, date_end')
      .in('experience_id', opts.experienceIds)
      .lte('date_start', maxDate)
      .gte('date_end',   minDate)

    // Build a covered set — O(existing × dates) but both are small (≤ 60 dates, few blocks)
    const covered = new Set<string>()
    for (const block of (existingBlocks ?? [])) {
      for (const date of sortedDates) {
        if (date >= block.date_start && date <= block.date_end) {
          covered.add(`${block.experience_id}::${date}`)
        }
      }
    }

    // One row per (date × experience) — skip pairs already covered by an existing block
    const rows = opts.dates.flatMap((date) =>
      opts.experienceIds
        .filter(expId => !covered.has(`${expId}::${date}`))
        .map((experienceId) => ({
          experience_id: experienceId,
          date_start:    date,
          date_end:      date,
          reason:        opts.reason?.trim() || null,
        }))
    )

    // Nothing new to insert — all days already blocked
    if (rows.length === 0) return { success: true }

    // upsert with ignoreDuplicates as safety net for concurrent calls
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
 *
 * Uses service client for the UPDATE — the user-scoped client may be blocked by
 * RLS column restrictions on the guides table, causing a silent 0-row update.
 * The guide's identity is already verified by `requireGuide()` before we proceed.
 */
export async function toggleCalendarDisabled(
  disabled: boolean,
): Promise<CalendarActionResult> {
  try {
    const { guideId } = await requireGuide()  // auth check — throws redirect if not guide

    // Service client bypasses RLS; auth is already confirmed above
    const service = createServiceClient()

    const { data: updated, error } = await service
      .from('guides')
      .update({ calendar_disabled: disabled })
      .eq('id', guideId)
      .select('id')

    if (error != null) {
      console.error('[calendar/toggleCalendarDisabled]', error.message)
      return { error: error.message }
    }

    if (!updated || updated.length === 0) {
      console.error('[calendar/toggleCalendarDisabled] 0 rows updated for guide', guideId)
      return { error: 'Could not update calendar setting — guide not found.' }
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
 *
 * Use this only for single-day blocks (date_start === date_end).
 * For range blocks use `unblockDaysFromRange` to avoid wiping the whole range.
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

// ─── Unblock specific days from a range block ─────────────────────────────────

/**
 * Removes specific days from an existing range block WITHOUT deleting the
 * rest of the range.
 *
 * Algorithm:
 *   1. Fetch the target block record.
 *   2. Filter `daysToRemove` to only those that fall within [date_start, date_end].
 *   3. Walk the sorted list of removed days and compute the remaining segments
 *      (the contiguous sub-ranges that are NOT being unblocked).
 *   4. Delete the original record.
 *   5. Re-insert one record per remaining segment (same experience_id + reason).
 *
 * Example — removing Apr 10 from a Jan 1–Dec 31 range:
 *   → inserts  Jan 1–Apr 9   +   Apr 11–Dec 31
 *
 * Example — removing Mar 10 and Mar 15 from Jan 1–Dec 31:
 *   → inserts  Jan 1–Mar 9   +   Mar 11–Mar 14   +   Mar 16–Dec 31
 *
 * If all days in the range are removed, the record is simply deleted.
 * Days outside [date_start, date_end] are silently ignored.
 */
export async function unblockDaysFromRange(
  blockId:      string,
  daysToRemove: string[],
): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    // Fetch the block (RLS scoped to this guide's own experiences)
    const { data: block, error: fetchErr } = await supabase
      .from('experience_blocked_dates')
      .select('id, experience_id, date_start, date_end, reason')
      .eq('id', blockId)
      .single()

    if (fetchErr != null || block == null) {
      return { error: 'Block not found.' }
    }

    // Only act on days that actually fall within this block's range
    const relevant = daysToRemove
      .filter(d => d >= block.date_start && d <= block.date_end)
      .sort()

    if (relevant.length === 0) {
      // None of the requested days are in this range — nothing to do
      return { success: true }
    }

    // Build remaining segments by walking the sorted removed-days list
    const segments: Array<{ date_start: string; date_end: string }> = []
    let cursor = block.date_start

    for (const day of relevant) {
      if (cursor < day) {
        segments.push({ date_start: cursor, date_end: shiftDay(day, -1) })
      }
      cursor = shiftDay(day, 1)
    }
    // Tail segment after the last removed day
    if (cursor <= block.date_end) {
      segments.push({ date_start: cursor, date_end: block.date_end })
    }

    // Delete the original range record
    const { error: deleteErr } = await supabase
      .from('experience_blocked_dates')
      .delete()
      .eq('id', blockId)

    if (deleteErr != null) {
      console.error('[calendar/unblockDaysFromRange] delete:', deleteErr.message)
      return { error: 'Failed to unblock. Please try again.' }
    }

    // Re-insert the remaining segments (if any)
    if (segments.length > 0) {
      const { error: insertErr } = await supabase
        .from('experience_blocked_dates')
        .insert(
          segments.map(s => ({
            experience_id: block.experience_id,
            date_start:    s.date_start,
            date_end:      s.date_end,
            reason:        block.reason,
          }))
        )

      if (insertErr != null) {
        // Original already deleted — log but don't surface as a hard error since
        // the targeted days are unblocked even if the surrounding segments failed.
        console.error('[calendar/unblockDaysFromRange] insert segments:', insertErr.message)
      }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[calendar/unblockDaysFromRange] Unexpected error:', err)
    return { error: 'Failed to unblock. Please try again.' }
  }
}

// ─── Date arithmetic ──────────────────────────────────────────────────────────

function shiftDay(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
