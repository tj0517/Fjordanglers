'use server'

/**
 * Calendar Server Actions — guide manages availability / blocked dates.
 *
 * As of 2026-04-02, blocking operates at TWO levels:
 *   • calendar_blocked_dates  — when a calendarId is provided (named calendar)
 *   • experience_blocked_dates — when individual experienceIds are provided
 *     (All Trips view / guides without named calendars)
 *
 * Unblocking checks both tables so old rows (migrated from the previous schema)
 * are handled transparently.
 *
 * All inserts use upsert with ignoreDuplicates: true — blocking the same range
 * twice is a no-op (idempotent), not an error.
 *
 * RLS ensures a guide can only read/write rows that belong to their own
 * calendars / experiences.
 */

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { blockBookingDates, expandBookingDateRange } from '@/lib/booking-blocks'

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
 * Blocks a date range.
 *
 * Two modes:
 *   • calendarId provided → writes to `calendar_blocked_dates` (calendar-scoped)
 *   • experienceIds provided → writes to `experience_blocked_dates` (per-listing)
 *
 * For calendar mode, ownership is verified via guide_calendars.guide_id.
 * For experience mode, ownership is verified via experiences.guide_id.
 *
 * Overlap guard prevents a day from being covered by two separate block records.
 */
export async function blockDates(opts: {
  /** Calendar ID — when set, writes a single calendar-level block. */
  calendarId?: string
  /** Experience IDs — used for All Trips / per-listing mode (legacy). */
  experienceIds?: string[]
  /** First blocked date, inclusive. YYYY-MM-DD */
  dateStart: string
  /** Last blocked date, inclusive. Must be >= dateStart. YYYY-MM-DD */
  dateEnd: string
  /** Optional internal note (not shown to anglers). */
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.dateEnd < opts.dateStart) {
      return { error: 'End date must be on or after the start date.' }
    }

    // ── Calendar-scoped mode ────────────────────────────────────────────────
    if (opts.calendarId != null) {
      // Verify ownership
      const { data: cal } = await supabase
        .from('guide_calendars')
        .select('id')
        .eq('id', opts.calendarId)
        .eq('guide_id', guideId)
        .single()

      if (cal == null) return { error: 'Calendar not found.' }

      // Find all existing blocks that overlap with the new range.
      // Overlap condition: existing.date_start <= newEnd AND existing.date_end >= newStart
      const { data: overlapping } = await supabase
        .from('calendar_blocked_dates')
        .select('id, date_start, date_end')
        .eq('calendar_id', opts.calendarId)
        .lte('date_start', opts.dateEnd)
        .gte('date_end', opts.dateStart)

      const existing = overlapping ?? []

      // If a single existing block already fully contains the new range → nothing to do.
      const fullyCovered = existing.some(
        b => b.date_start <= opts.dateStart && b.date_end >= opts.dateEnd
      )
      if (fullyCovered) return { success: true }

      if (existing.length > 0) {
        // Merge: compute union of the new range + all overlapping blocks so we end up
        // with a single wider block instead of overlapping/adjacent ones.
        const mergedStart = existing.reduce(
          (min, b) => b.date_start < min ? b.date_start : min,
          opts.dateStart
        )
        const mergedEnd = existing.reduce(
          (max, b) => b.date_end > max ? b.date_end : max,
          opts.dateEnd
        )

        // Delete the absorbed blocks first, then insert the merged range.
        const { error: delErr } = await supabase
          .from('calendar_blocked_dates')
          .delete()
          .eq('calendar_id', opts.calendarId)
          .in('id', existing.map(b => b.id))

        if (delErr != null) {
          console.error('[calendar/blockDates calendar merge delete]', delErr.message)
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
          console.error('[calendar/blockDates calendar merge insert]', insErr.message)
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
        console.error('[calendar/blockDates calendar]', error.message)
        return { error: 'Failed to block dates. Please try again.' }
      }

      return { success: true }
    }

    // ── Per-experience mode ─────────────────────────────────────────────────
    const expIds = opts.experienceIds ?? []
    if (expIds.length === 0) {
      return { error: 'Select at least one experience to block.' }
    }

    // Ownership check
    const { data: owned } = await supabase
      .from('experiences')
      .select('id')
      .eq('guide_id', guideId)
      .in('id', expIds)

    if ((owned?.length ?? 0) !== expIds.length) {
      return { error: 'One or more experiences not found.' }
    }

    // Overlap guard
    const { data: overlapping } = await supabase
      .from('experience_blocked_dates')
      .select('experience_id')
      .in('experience_id', expIds)
      .lte('date_start', opts.dateEnd)
      .gte('date_end', opts.dateStart)

    const alreadyCovered = new Set((overlapping ?? []).map(b => b.experience_id))
    const toInsert = expIds.filter(id => !alreadyCovered.has(id))

    if (toInsert.length === 0) return { success: true }

    const { error } = await supabase
      .from('experience_blocked_dates')
      .upsert(
        toInsert.map(experienceId => ({
          experience_id: experienceId,
          date_start:    opts.dateStart,
          date_end:      opts.dateEnd,
          reason:        opts.reason?.trim() || null,
        })),
        { onConflict: 'experience_id,date_start,date_end', ignoreDuplicates: true }
      )

    if (error != null) {
      console.error('[calendar/blockDates experience]', error.message)
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
 *
 * Same routing as blockDates: calendarId or experienceIds.
 */
export async function blockMultipleDates(opts: {
  /** Calendar ID — when set, writes calendar-level blocks. */
  calendarId?: string
  /** Experience IDs — per-listing mode. */
  experienceIds?: string[]
  /** Individual YYYY-MM-DD dates to block. */
  dates: string[]
  /** Optional internal note. */
  reason?: string
}): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    if (opts.dates.length === 0) {
      return { error: 'No dates selected.' }
    }

    // ── Calendar-scoped mode ────────────────────────────────────────────────
    if (opts.calendarId != null) {
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
          calendar_id: opts.calendarId!,
          date_start:  d,
          date_end:    d,
          reason:      opts.reason?.trim() || null,
        }))

      if (rows.length === 0) return { success: true }

      const { error } = await supabase
        .from('calendar_blocked_dates')
        .upsert(rows, { ignoreDuplicates: true })

      if (error != null) {
        console.error('[calendar/blockMultipleDates calendar]', error.message)
        return { error: 'Failed to block dates. Please try again.' }
      }

      return { success: true }
    }

    // ── Per-experience mode ─────────────────────────────────────────────────
    const expIds = opts.experienceIds ?? []
    if (expIds.length === 0) {
      return { error: 'Select at least one experience to block.' }
    }
    if (opts.dates.length * expIds.length > 300) {
      return { error: 'Too many date/experience combinations. Select fewer days.' }
    }

    // Ownership check
    const { data: owned } = await supabase
      .from('experiences')
      .select('id')
      .eq('guide_id', guideId)
      .in('id', expIds)

    if ((owned?.length ?? 0) !== expIds.length) {
      return { error: 'One or more experiences not found.' }
    }

    const sortedDates  = [...opts.dates].sort()
    const minDate      = sortedDates[0]!
    const maxDate      = sortedDates[sortedDates.length - 1]!

    const { data: existingBlocks } = await supabase
      .from('experience_blocked_dates')
      .select('experience_id, date_start, date_end')
      .in('experience_id', expIds)
      .lte('date_start', maxDate)
      .gte('date_end',   minDate)

    const covered = new Set<string>()
    for (const block of (existingBlocks ?? [])) {
      for (const date of sortedDates) {
        if (date >= block.date_start && date <= block.date_end) {
          covered.add(`${block.experience_id}::${date}`)
        }
      }
    }

    const rows = opts.dates.flatMap(date =>
      expIds
        .filter(expId => !covered.has(`${expId}::${date}`))
        .map(experienceId => ({
          experience_id: experienceId,
          date_start:    date,
          date_end:      date,
          reason:        opts.reason?.trim() || null,
        }))
    )

    if (rows.length === 0) return { success: true }

    const { error } = await supabase
      .from('experience_blocked_dates')
      .upsert(rows, { onConflict: 'experience_id,date_start,date_end', ignoreDuplicates: true })

    if (error != null) {
      console.error('[calendar/blockMultipleDates experience]', error.message)
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

    // Service client bypasses RLS; auth already confirmed above
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

    // ── DISABLE: wipe ALL calendar data ───────────────────────────────────────
    if (disabled) {
      const [expsRes, calsRes] = await Promise.all([
        service.from('experiences').select('id').eq('guide_id', guideId),
        service.from('guide_calendars').select('id').eq('guide_id', guideId),
      ])

      const expIds = (expsRes.data ?? []).map(e => e.id)
      const calIds = (calsRes.data ?? []).map(c => c.id)

      // Step 1: delete calendar_experiences (FK → guide_calendars)
      if (calIds.length > 0) {
        const { error: e1 } = await service
          .from('calendar_experiences')
          .delete()
          .in('calendar_id', calIds)
        if (e1) console.error('[toggleCalendarDisabled] calendar_experiences:', e1.message)
      }

      // Step 2: delete calendars + weekly schedules + ALL blocked dates (both tables)
      await Promise.all([
        service.from('guide_calendars').delete().eq('guide_id', guideId)
          .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] guide_calendars:', e.message) }),
        service.from('guide_weekly_schedules').delete().eq('guide_id', guideId)
          .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] weekly_schedules:', e.message) }),
        // calendar_blocked_dates cascade-deleted via guide_calendars FK above
        ...(expIds.length > 0
          ? [service.from('experience_blocked_dates').delete().in('experience_id', expIds)
              .then(({ error: e }) => { if (e) console.error('[toggleCalendarDisabled] experience_blocked_dates:', e.message) })]
          : []),
      ])
    }

    // ── ENABLE: re-block dates from all active upcoming bookings ───────────
    if (!disabled) {
      const today = new Date().toISOString().slice(0, 10)

      const { data: activeBookings } = await service
        .from('bookings')
        .select('id, status, experience_id, booking_date, date_to, requested_dates, offer_days, offer_date_from, offer_date_to')
        .eq('guide_id', guideId)
        .in('status', ['accepted', 'confirmed', 'offer_sent', 'offer_accepted'])
        .gte('booking_date', today)

      for (const b of (activeBookings ?? [])) {
        let dates: string[] = []

        if (b.status === 'offer_sent' || b.status === 'offer_accepted') {
          dates = (b.offer_days as string[] | null) ??
            expandBookingDateRange(b.offer_date_from, b.offer_date_to)
        } else {
          dates = (b.requested_dates as string[] | null) ??
            expandBookingDateRange(b.booking_date as string | null, (b as { date_to?: string | null }).date_to ?? null)
          if (dates.length === 0 && b.booking_date) dates = [b.booking_date as string]
        }

        if (dates.length > 0) {
          blockBookingDates(service, b.id, guideId, dates, b.experience_id ?? undefined)
            .catch(e => console.error('[toggleCalendarDisabled] blockBookingDates:', e))
        }
      }
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
 * Deletes a single blocked-date row by ID.
 * Checks both `calendar_blocked_dates` and `experience_blocked_dates` —
 * whichever table the row lives in will be cleaned up.
 *
 * Use this only for single-day blocks (date_start === date_end).
 * For range blocks use `unblockDaysFromRange` to avoid wiping the whole range.
 */
export async function unblockDates(blockId: string): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    // Try calendar_blocked_dates first (new schema)
    const { data: calRow } = await supabase
      .from('calendar_blocked_dates')
      .select('id')
      .eq('id', blockId)
      .maybeSingle()

    if (calRow != null) {
      const { error } = await supabase
        .from('calendar_blocked_dates')
        .delete()
        .eq('id', blockId)
      if (error != null) {
        console.error('[calendar/unblockDates calendar]', error.message)
        return { error: error.message }
      }
      return { success: true }
    }

    // Fall back to experience_blocked_dates (legacy / uncalendared)
    const { error } = await supabase
      .from('experience_blocked_dates')
      .delete()
      .eq('id', blockId)

    if (error != null) {
      console.error('[calendar/unblockDates experience]', error.message)
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
 *
 * Checks both `calendar_blocked_dates` and `experience_blocked_dates`.
 * The segment-splitting algorithm is applied to whichever table holds the row.
 *
 * Algorithm:
 *   1. Fetch the target block (try calendar table, then experience table).
 *   2. Filter daysToRemove to those within [date_start, date_end].
 *   3. Compute remaining segments (contiguous sub-ranges NOT being unblocked).
 *   4. Delete the original record.
 *   5. Re-insert remaining segments with the same calendar_id / experience_id + reason.
 */
export async function unblockDaysFromRange(
  blockId:      string,
  daysToRemove: string[],
): Promise<CalendarActionResult> {
  try {
    const { supabase } = await requireGuide()

    // ── Try calendar_blocked_dates first ──────────────────────────────────
    const { data: calBlock } = await supabase
      .from('calendar_blocked_dates')
      .select('id, calendar_id, date_start, date_end, reason')
      .eq('id', blockId)
      .maybeSingle()

    if (calBlock != null) {
      const relevant = daysToRemove
        .filter(d => d >= calBlock.date_start && d <= calBlock.date_end)
        .sort()

      if (relevant.length === 0) return { success: true }

      const segments = buildSegments(calBlock.date_start, calBlock.date_end, relevant)

      const { error: deleteErr } = await supabase
        .from('calendar_blocked_dates')
        .delete()
        .eq('id', blockId)

      if (deleteErr != null) {
        console.error('[calendar/unblockDaysFromRange] calendar delete:', deleteErr.message)
        return { error: 'Failed to unblock. Please try again.' }
      }

      if (segments.length > 0) {
        const { error: insertErr } = await supabase
          .from('calendar_blocked_dates')
          .insert(
            segments.map(s => ({
              calendar_id: calBlock.calendar_id,
              date_start:  s.date_start,
              date_end:    s.date_end,
              reason:      calBlock.reason,
            }))
          )
        if (insertErr != null) {
          console.error('[calendar/unblockDaysFromRange] calendar insert segments:', insertErr.message)
        }
      }

      return { success: true }
    }

    // ── Fall back to experience_blocked_dates ──────────────────────────────
    const { data: expBlock, error: fetchErr } = await supabase
      .from('experience_blocked_dates')
      .select('id, experience_id, date_start, date_end, reason')
      .eq('id', blockId)
      .single()

    if (fetchErr != null || expBlock == null) {
      return { error: 'Block not found.' }
    }

    const relevant = daysToRemove
      .filter(d => d >= expBlock.date_start && d <= expBlock.date_end)
      .sort()

    if (relevant.length === 0) return { success: true }

    const segments = buildSegments(expBlock.date_start, expBlock.date_end, relevant)

    const { error: deleteErr } = await supabase
      .from('experience_blocked_dates')
      .delete()
      .eq('id', blockId)

    if (deleteErr != null) {
      console.error('[calendar/unblockDaysFromRange] experience delete:', deleteErr.message)
      return { error: 'Failed to unblock. Please try again.' }
    }

    if (segments.length > 0) {
      const { error: insertErr } = await supabase
        .from('experience_blocked_dates')
        .insert(
          segments.map(s => ({
            experience_id: expBlock.experience_id,
            date_start:    s.date_start,
            date_end:      s.date_end,
            reason:        expBlock.reason,
          }))
        )
      if (insertErr != null) {
        console.error('[calendar/unblockDaysFromRange] experience insert segments:', insertErr.message)
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
