'use server'

/**
 * Calendar Server Actions — guide manages availability / blocked dates.
 *
 * As of migration 20260402200000, ALL blocking uses `calendar_blocked_dates`.
 * `experience_blocked_dates` is empty and no longer used.
 *
 * Every block/unblock action requires a `calendarId`.
 * All inserts use upsert with ignoreDuplicates: true — idempotent.
 * RLS ensures a guide can only read/write rows for their own calendars.
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
 * Blocks a date range for a named calendar.
 * Merges overlapping/adjacent ranges so the calendar never has duplicates.
 */
export async function blockDates(opts: {
  calendarId: string
  dateStart: string
  dateEnd: string
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.dateEnd < opts.dateStart) {
      return { error: 'End date must be on or after the start date.' }
    }

    // Verify ownership
    const { data: cal } = await supabase
      .from('guide_calendars')
      .select('id')
      .eq('id', opts.calendarId)
      .eq('guide_id', guideId)
      .single()

    if (cal == null) return { error: 'Calendar not found.' }

    // Find all existing blocks that overlap with the new range.
    const { data: overlapping } = await supabase
      .from('calendar_blocked_dates')
      .select('id, date_start, date_end')
      .eq('calendar_id', opts.calendarId)
      .lte('date_start', opts.dateEnd)
      .gte('date_end', opts.dateStart)

    const existing = overlapping ?? []

    // If already fully covered → nothing to do.
    const fullyCovered = existing.some(
      b => b.date_start <= opts.dateStart && b.date_end >= opts.dateEnd
    )
    if (fullyCovered) return { success: true }

    if (existing.length > 0) {
      // Merge: compute union of the new range + all overlapping blocks.
      const mergedStart = existing.reduce(
        (min, b) => b.date_start < min ? b.date_start : min,
        opts.dateStart
      )
      const mergedEnd = existing.reduce(
        (max, b) => b.date_end > max ? b.date_end : max,
        opts.dateEnd
      )

      const { error: delErr } = await supabase
        .from('calendar_blocked_dates')
        .delete()
        .eq('calendar_id', opts.calendarId)
        .in('id', existing.map(b => b.id))

      if (delErr != null) {
        console.error('[calendar/blockDates merge delete]', delErr.message)
        return { error: 'Failed to block dates. Please try again.' }
      }

      const { error: insErr } = await supabase
        .from('calendar_blocked_dates')
        .insert({
          calendar_id: opts.calendarId,
          date_start:  mergedStart,
          date_end:    mergedEnd,
          reason:      opts.reason?.trim() || null,
        })

      if (insErr != null) {
        console.error('[calendar/blockDates merge insert]', insErr.message)
        return { error: 'Failed to block dates. Please try again.' }
      }

      return { success: true }
    }

    // No overlap → simple insert.
    const { error } = await supabase
      .from('calendar_blocked_dates')
      .insert({
        calendar_id: opts.calendarId,
        date_start:  opts.dateStart,
        date_end:    opts.dateEnd,
        reason:      opts.reason?.trim() || null,
      })

    if (error != null) {
      console.error('[calendar/blockDates insert]', error.message)
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
 * Blocks multiple individual dates (non-contiguous multi-pick).
 * Each date becomes a separate row (date_start = date_end = individual date).
 */
export async function blockMultipleDates(opts: {
  calendarId: string
  dates: string[]
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.dates.length === 0) {
      return { error: 'No dates selected.' }
    }

    // Verify ownership
    const { data: cal } = await supabase
      .from('guide_calendars')
      .select('id')
      .eq('id', opts.calendarId)
      .eq('guide_id', guideId)
      .single()

    if (cal == null) return { error: 'Calendar not found.' }

    const sortedDates = [...opts.dates].sort()
    const minDate = sortedDates[0]!
    const maxDate = sortedDates[sortedDates.length - 1]!

    // Overlap guard — find which dates are already covered
    const { data: existing } = await supabase
      .from('calendar_blocked_dates')
      .select('date_start, date_end')
      .eq('calendar_id', opts.calendarId)
      .lte('date_start', maxDate)
      .gte('date_end', minDate)

    const covered = new Set<string>()
    for (const block of (existing ?? [])) {
      for (const date of sortedDates) {
        if (date >= block.date_start && date <= block.date_end) {
          covered.add(date)
        }
      }
    }

    const rows = opts.dates
      .filter(d => !covered.has(d))
      .map(d => ({
        calendar_id: opts.calendarId,
        date_start:  d,
        date_end:    d,
        reason:      opts.reason?.trim() || null,
      }))

    if (rows.length === 0) return { success: true }

    const { error } = await supabase
      .from('calendar_blocked_dates')
      .upsert(rows, { ignoreDuplicates: true })

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

export async function toggleCalendarDisabled(
  disabled: boolean,
): Promise<CalendarActionResult> {
  try {
    const { guideId } = await requireGuide()

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

    // ── DISABLE: wipe all calendar data (calendar_blocked_dates cascade-deleted) ──
    if (disabled) {
      const calsRes = await service
        .from('guide_calendars')
        .select('id')
        .eq('guide_id', guideId)

      const calIds = (calsRes.data ?? []).map(c => c.id)

      if (calIds.length > 0) {
        await service
          .from('calendar_experiences')
          .delete()
          .in('calendar_id', calIds)
          .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] calendar_experiences:', e.message) })
      }

      await Promise.all([
        service.from('guide_calendars').delete().eq('guide_id', guideId)
          .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] guide_calendars:', e.message) }),
        service.from('guide_weekly_schedules').delete().eq('guide_id', guideId)
          .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] weekly_schedules:', e.message) }),
        // calendar_blocked_dates are cascade-deleted when guide_calendars rows are deleted
      ])
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
 * Deletes a single blocked-date row by ID from `calendar_blocked_dates`.
 */
export async function unblockDates(blockId: string): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    const { error } = await supabase
      .from('calendar_blocked_dates')
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
 * Removes specific days from an existing range block without deleting the rest.
 * Operates exclusively on `calendar_blocked_dates`.
 *
 * Algorithm:
 *   1. Fetch the target block.
 *   2. Filter daysToRemove to those within [date_start, date_end].
 *   3. Compute remaining contiguous segments.
 *   4. Delete the original record.
 *   5. Re-insert remaining segments with the same calendar_id + reason.
 */
export async function unblockDaysFromRange(
  blockId:      string,
  daysToRemove: string[],
): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    const { data: block, error: fetchErr } = await supabase
      .from('calendar_blocked_dates')
      .select('id, calendar_id, date_start, date_end, reason')
      .eq('id', blockId)
      .single()

    if (fetchErr != null || block == null) {
      return { error: 'Block not found.' }
    }

    const relevant = daysToRemove
      .filter(d => d >= block.date_start && d <= block.date_end)
      .sort()

    if (relevant.length === 0) return { success: true }

    const segments = buildSegments(block.date_start, block.date_end, relevant)

    const { error: deleteErr } = await supabase
      .from('calendar_blocked_dates')
      .delete()
      .eq('id', blockId)

    if (deleteErr != null) {
      console.error('[calendar/unblockDaysFromRange] delete:', deleteErr.message)
      return { error: 'Failed to unblock. Please try again.' }
    }

    if (segments.length > 0) {
      const { error: insertErr } = await supabase
        .from('calendar_blocked_dates')
        .insert(
          segments.map(s => ({
            calendar_id: block.calendar_id,
            date_start:  s.date_start,
            date_end:    s.date_end,
            reason:      block.reason,
          }))
        )
      if (insertErr != null) {
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

/**
 * Given a block range [rangeStart, rangeEnd] and a sorted list of days to
 * remove, returns the remaining contiguous segments.
 */
function buildSegments(
  rangeStart: string,
  rangeEnd:   string,
  sortedRemovedDays: string[],
): Array<{ date_start: string; date_end: string }> {
  const segments: Array<{ date_start: string; date_end: string }> = []
  let cursor = rangeStart

  for (const day of sortedRemovedDays) {
    if (cursor < day) {
      segments.push({ date_start: cursor, date_end: shiftDay(day, -1) })
    }
    cursor = shiftDay(day, 1)
  }

  if (cursor <= rangeEnd) {
    segments.push({ date_start: cursor, date_end: rangeEnd })
  }

  return segments
}
