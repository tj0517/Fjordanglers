'use server'

/**
 * Guide Calendar Server Actions — CRUD for named calendar groups.
 *
 * A guide can create multiple calendars and assign any subset of their
 * experiences to each. Used by the CalendarsPanel component.
 *
 * Blocking model (as of 2026-04-02):
 *   Availability blocks are stored in `calendar_blocked_dates` at the calendar
 *   level — one row per (calendar × date), not per experience.  All experiences
 *   in a calendar automatically inherit the same unavailability.
 *
 *   When an experience moves between calendars (or is added/removed from one),
 *   NO per-experience block sync is needed.  The angler date picker always reads
 *   from the experience's current calendar.
 *
 *   `experience_blocked_dates` is empty (cleared by migration 20260402200000)
 *   and must NOT be used.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuideCalendar = {
  id:         string
  guide_id:   string
  name:       string
  created_at: string
}

export type CalendarActionResult =
  | { error: string }
  | { success: true; id?: string; unassignedExpIds?: string[] }

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

// ─── Create calendar ──────────────────────────────────────────────────────────

export async function createCalendar(name: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const trimmed = name.trim()
    if (!trimmed)            return { error: 'Calendar name is required.' }
    if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

    const { data, error } = await supabase
      .from('guide_calendars')
      .insert({ guide_id: guideId, name: trimmed })
      .select('id')
      .single()

    if (error != null) {
      console.error('[createCalendar]', error.message)
      return { error: 'Failed to create calendar.' }
    }

    return { success: true, id: data.id }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[createCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Update calendar name ──────────────────────────────────────────────────────

export async function updateCalendar(id: string, name: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const trimmed = name.trim()
    if (!trimmed)            return { error: 'Calendar name is required.' }
    if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

    const { error } = await supabase
      .from('guide_calendars')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('guide_id', guideId)  // ownership

    if (error != null) {
      console.error('[updateCalendar]', error.message)
      return { error: 'Failed to update calendar.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[updateCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Delete calendar ──────────────────────────────────────────────────────────

export async function deleteCalendar(id: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const { error } = await supabase
      .from('guide_calendars')
      .delete()
      .eq('id', id)
      .eq('guide_id', guideId)  // ownership

    if (error != null) {
      console.error('[deleteCalendar]', error.message)
      return { error: 'Failed to delete calendar.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[deleteCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Set experiences for a calendar ──────────────────────────────────────────

/**
 * Replaces all experience assignments for a calendar.
 * Passing an empty array removes all experiences from the calendar.
 *
 * Block migration rules when moving an experience between calendars:
 *
 *   • Booking blocks  (reason = 'booking:<id>')
 *       → Follow the experience to the destination calendar (MOVED, not just
 *         copied).  After copying to the destination, they are deleted from
 *         the source calendar — those dates were blocked because of this
 *         experience's bookings, so they have no place in the source once
 *         the experience leaves.
 *
 *   • Manual blocks (reason IS NULL)
 *       → Stay in the source calendar.  They represent availability decisions
 *         tied to that calendar/group of trips, not to the specific experience.
 *
 * Step order matters:
 *   1. Detect newExpIds BEFORE modifying calendar_experiences (need to look up
 *      source calendar, which is queryable as long as we haven't changed this
 *      calendar's assignments yet — other calendars are untouched).
 *   2. Copy booking blocks from source → destination.
 *   3. Replace calendar_experiences assignments.
 */
export async function setCalendarExperiences(
  calendarId:    string,
  experienceIds: string[],
): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    // Verify calendar ownership
    const { data: cal } = await supabase
      .from('guide_calendars')
      .select('id')
      .eq('id', calendarId)
      .eq('guide_id', guideId)
      .single()

    if (cal == null) return { error: 'Calendar not found.' }

    // Verify all experiences belong to this guide
    if (experienceIds.length > 0) {
      const { data: owned } = await supabase
        .from('experiences')
        .select('id')
        .eq('guide_id', guideId)
        .in('id', experienceIds)

      if ((owned?.length ?? 0) !== experienceIds.length) {
        return { error: 'One or more experiences not found.' }
      }
    }

    // Snapshot current assignments to detect newly added experiences.
    // Must happen BEFORE the DELETE below — source calendar lookups rely on
    // the current state of calendar_experiences for *other* calendars, which
    // this DELETE doesn't touch, so the order is safe.
    const { data: currentAssignments } = await supabase
      .from('calendar_experiences')
      .select('experience_id')
      .eq('calendar_id', calendarId)
    const previousIds = new Set((currentAssignments ?? []).map(r => r.experience_id))
    const newExpIds   = experienceIds.filter(id => !previousIds.has(id))

    // ── Copy booking blocks from source calendar → this calendar ──────────────
    //
    // For each experience being moved INTO this calendar:
    //   1. Find its current (source) calendar.
    //   2. Fetch all booking blocks (reason LIKE 'booking:%') from that calendar.
    //   3. Filter to blocks whose booking.experience_id matches this experience.
    //   4. Upsert those blocks into this calendar (ignoreDuplicates = idempotent).
    //
    // Manual blocks (reason IS NULL) are deliberately excluded — they remain
    // in the source calendar and do NOT follow the experience.
    if (newExpIds.length > 0) {
      for (const expId of newExpIds) {
        // Step 1 — source calendar (first assignment found; experiences should
        // be in at most one calendar, so maybeSingle() is correct here)
        const { data: sourceCalRow } = await supabase
          .from('calendar_experiences')
          .select('calendar_id')
          .eq('experience_id', expId)
          .limit(1)
          .maybeSingle()

        // Skip: coming from no calendar (first-time assignment) or same calendar
        if (sourceCalRow == null || sourceCalRow.calendar_id === calendarId) continue

        // Step 2 — all booking blocks in the source calendar
        const { data: sourceBlocks } = await supabase
          .from('calendar_blocked_dates')
          .select('date_start, date_end, reason')
          .eq('calendar_id', sourceCalRow.calendar_id)
          .like('reason', 'booking:%')

        if (!sourceBlocks || sourceBlocks.length === 0) continue

        // Step 3 — filter to blocks whose underlying booking is for this experience
        const bookingIds = sourceBlocks.map(b => b.reason!.replace('booking:', ''))

        const { data: expBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('experience_id', expId)
          .in('id', bookingIds)

        const expBookingIdSet = new Set((expBookings ?? []).map(b => b.id))
        const blocksToCarry   = sourceBlocks.filter(
          b => expBookingIdSet.has(b.reason!.replace('booking:', ''))
        )

        if (blocksToCarry.length === 0) continue

        // Step 4 — copy to destination calendar
        const { error: copyErr } = await supabase
          .from('calendar_blocked_dates')
          .upsert(
            blocksToCarry.map(b => ({
              calendar_id: calendarId,
              date_start:  b.date_start,
              date_end:    b.date_end,
              reason:      b.reason,
            })),
            { ignoreDuplicates: true }
          )

        if (copyErr != null) {
          console.error('[setCalendarExperiences] block copy failed:', copyErr.message)
          // Non-fatal: log and continue — availability may be incomplete but
          // the assignment change itself should succeed.
        } else {
          console.log(
            `[setCalendarExperiences] copied ${blocksToCarry.length} booking block(s)` +
            ` for exp ${expId} from cal ${sourceCalRow.calendar_id} → ${calendarId}`
          )

          // Step 5 — remove those same booking blocks from the source calendar.
          // They belonged to this experience's bookings; once the experience has
          // moved, the source calendar should no longer show those dates as blocked.
          const reasonsToRemove = blocksToCarry.map(b => b.reason!)
          const { error: cleanupErr } = await supabase
            .from('calendar_blocked_dates')
            .delete()
            .eq('calendar_id', sourceCalRow.calendar_id)
            .in('reason', reasonsToRemove)

          if (cleanupErr != null) {
            console.error('[setCalendarExperiences] source cleanup failed:', cleanupErr.message)
            // Non-fatal
          } else {
            console.log(
              `[setCalendarExperiences] removed ${reasonsToRemove.length} stale booking block(s)` +
              ` from source cal ${sourceCalRow.calendar_id} for exp ${expId}`
            )
          }
        }
      }
    }

    // ── Auto-remove newly-added experiences from any other calendar ───────────
    // An experience can belong to AT MOST ONE calendar.  If E1 is being added
    // here and it was previously in Calendar A, remove it from A so it doesn't
    // appear in two calendars simultaneously.
    // We do this AFTER copying blocks (above) so the source calendar is still
    // queryable.
    if (newExpIds.length > 0) {
      const { error: evictErr } = await supabase
        .from('calendar_experiences')
        .delete()
        .in('experience_id', newExpIds)
        .neq('calendar_id', calendarId)   // remove from ALL other calendars

      if (evictErr != null) {
        console.error('[setCalendarExperiences] evict from old calendars:', evictErr.message)
        // Non-fatal — log only
      }
    }

    // ── Replace assignments for THIS calendar ─────────────────────────────────
    await supabase
      .from('calendar_experiences')
      .delete()
      .eq('calendar_id', calendarId)

    if (experienceIds.length > 0) {
      const { error } = await supabase
        .from('calendar_experiences')
        .insert(
          experienceIds.map(expId => ({
            calendar_id:   calendarId,
            experience_id: expId,
          }))
        )

      if (error != null) {
        console.error('[setCalendarExperiences]', error.message)
        return { error: 'Failed to assign experiences.' }
      }
    }

    // ── Compute unassigned experiences ────────────────────────────────────────
    // After all assignment changes, find guide experiences that are no longer
    // in any calendar.  Returned to the client so it can show a warning.
    const { data: allGuideExps } = await supabase
      .from('experiences')
      .select('id')
      .eq('guide_id', guideId)

    const allExpIds = (allGuideExps ?? []).map(e => e.id)
    let unassignedExpIds: string[] = []

    if (allExpIds.length > 0) {
      const { data: assigned } = await supabase
        .from('calendar_experiences')
        .select('experience_id')
        .in('experience_id', allExpIds)

      const assignedSet = new Set((assigned ?? []).map(r => r.experience_id))
      unassignedExpIds = allExpIds.filter(id => !assignedSet.has(id))
    }

    return { success: true, unassignedExpIds }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[setCalendarExperiences] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Fetch helpers (used by Server Components) ────────────────────────────────

/**
 * Returns all guide_calendars for a given guide, ordered by created_at.
 */
export async function getGuideCalendars(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  guideId: string,
): Promise<GuideCalendar[]> {
  const { data } = await supabase
    .from('guide_calendars')
    .select('id, guide_id, name, created_at')
    .eq('guide_id', guideId)
    .order('created_at')

  return (data ?? []) as GuideCalendar[]
}

/**
 * Returns a map of calendarId → experienceId[] for a list of calendars.
 */
export async function getCalendarExperienceMap(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  calendarIds: string[],
): Promise<Record<string, string[]>> {
  if (calendarIds.length === 0) return {}

  const { data } = await supabase
    .from('calendar_experiences')
    .select('calendar_id, experience_id')
    .in('calendar_id', calendarIds)

  const map: Record<string, string[]> = {}
  for (const row of (data ?? [])) {
    if (map[row.calendar_id] == null) map[row.calendar_id] = []
    map[row.calendar_id]!.push(row.experience_id)
  }
  return map
}
