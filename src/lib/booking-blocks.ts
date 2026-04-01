/**
 * booking-blocks — write/remove date blocks for bookings.
 *
 * Calendar-level blocking (2026-04-02):
 *   When a booking is accepted/offer sent for an experience that belongs to a
 *   named calendar, we write ONE row per date to `calendar_blocked_dates` keyed
 *   to that calendar.  All experiences in the calendar automatically read the
 *   same unavailability — no per-experience rows needed.
 *
 *   When the experience is NOT in any named calendar (or experienceId is omitted
 *   for inquiry-flow bookings), we fall back to `experience_blocked_dates` and
 *   write one row per (date × all guide experiences) — the original guide-wide
 *   behaviour.
 *
 * Each row uses:  reason = 'booking:<bookingId>'
 * One row per individual ISO date — avoids range-split complexity on cleanup.
 *
 * Table routing:
 *   experienceId + in a calendar → calendar_blocked_dates  (calendar-scoped)
 *   experienceId NOT in a calendar → experience_blocked_dates (guide-wide)
 *   no experienceId (inquiry)     → experience_blocked_dates (guide-wide)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insert blocked-date rows for `dates`.
 *
 * Routing:
 *   • experienceId provided + experience in a named calendar
 *       → one row per date in `calendar_blocked_dates` (calendar-scoped)
 *   • experienceId provided but NOT in any calendar
 *       → one row per (date × ALL guide experiences) in `experience_blocked_dates`
 *   • experienceId omitted (inquiry flow)
 *       → one row per (date × ALL guide experiences) in `experience_blocked_dates`
 *
 * Fire-and-forget safe: call with `.catch()` so booking operations are
 * not blocked by a blocking-write failure.
 */
export async function blockBookingDates(
  db:            SupabaseClient<Database>,
  bookingId:     string,
  guideId:       string,
  dates:         string[],  // individual ISO 'YYYY-MM-DD' strings
  experienceId?: string,    // omit for inquiry / guide-wide blocking
): Promise<void> {
  if (dates.length === 0) return

  const reason = bookingReason(bookingId)

  // ── Check if experience belongs to a named calendar ───────────────────────
  if (experienceId != null) {
    const { data: calExp } = await db
      .from('calendar_experiences')
      .select('calendar_id')
      .eq('experience_id', experienceId)
      .maybeSingle()

    if (calExp != null) {
      // ── Calendar-scoped: one row per date in calendar_blocked_dates ────────
      const rows = dates.map(d => ({
        calendar_id: calExp.calendar_id,
        date_start:  d,
        date_end:    d,
        reason,
      }))

      const { error } = await db
        .from('calendar_blocked_dates')
        .upsert(rows, { ignoreDuplicates: true })

      if (error) {
        console.error('[blockBookingDates] calendar insert failed:', error.message)
      } else {
        console.log(
          `[blockBookingDates] blocked ${dates.length} date(s) on calendar ${calExp.calendar_id} for booking ${bookingId}`,
        )
      }
      return
    }
    // Fall through: experience exists but not in any calendar → guide-wide
  }

  // ── Guide-wide fallback: one row per (date × all guide experiences) ────────
  const { data: allExps } = await db
    .from('experiences')
    .select('id')
    .eq('guide_id', guideId)

  const expIds = (allExps ?? []).map(e => e.id)
  if (expIds.length === 0) return

  const rows = expIds.flatMap(expId =>
    dates.map(d => ({
      experience_id: expId,
      date_start:    d,
      date_end:      d,
      reason,
    }))
  )

  const { error } = await db
    .from('experience_blocked_dates')
    .upsert(rows, { ignoreDuplicates: true })

  if (error) {
    console.error('[blockBookingDates] experience insert failed:', error.message)
  } else {
    console.log(
      `[blockBookingDates] blocked ${dates.length} date(s) × ${expIds.length} experience(s) for booking ${bookingId}`,
    )
  }
}

/**
 * Remove all blocked-date rows created for this booking from BOTH tables.
 * Called when a booking is declined, cancelled, or refunded.
 */
export async function unblockBookingDates(
  db:        SupabaseClient<Database>,
  bookingId: string,
): Promise<void> {
  const reason = bookingReason(bookingId)

  const [calResult, expResult] = await Promise.all([
    db
      .from('calendar_blocked_dates')
      .delete({ count: 'exact' })
      .eq('reason', reason),
    db
      .from('experience_blocked_dates')
      .delete({ count: 'exact' })
      .eq('reason', reason),
  ])

  if (calResult.error) {
    console.error('[unblockBookingDates] calendar delete failed:', calResult.error.message)
  }
  if (expResult.error) {
    console.error('[unblockBookingDates] experience delete failed:', expResult.error.message)
  }

  const total = (calResult.count ?? 0) + (expResult.count ?? 0)
  if (total > 0) {
    console.log(`[unblockBookingDates] removed ${total} block(s) for booking ${bookingId}`)
  }
}

/**
 * Back-fill blocked dates for newly created experiences that are NOT in any
 * named calendar (guide-wide mode).
 *
 * Used by `createExperience` when the guide has no calendars — syncs booking
 * blocks from all existing guide experiences so the new listing immediately
 * shows the correct availability in `experience_blocked_dates`.
 *
 * NOT needed for calendared experiences: they inherit availability through
 * `calendar_blocked_dates` automatically.
 *
 * Fire-and-forget safe: call with `.catch()`.
 */
export async function syncNewExperienceBlocks(
  db:        SupabaseClient<Database>,
  guideId:   string,
  newExpIds: string[],
): Promise<void> {
  if (newExpIds.length === 0) return

  // Query all guide experiences (except the new ones)
  const { data: allExps } = await db
    .from('experiences')
    .select('id')
    .eq('guide_id', guideId)

  if (!allExps || allExps.length === 0) return
  const siblingIds = allExps.map(e => e.id).filter(id => !newExpIds.includes(id))
  if (siblingIds.length === 0) return  // first experience ever — nothing to copy

  // Fetch ALL blocks from siblings in experience_blocked_dates
  const { data: blocks } = await db
    .from('experience_blocked_dates')
    .select('reason, date_start, date_end')
    .in('experience_id', siblingIds)

  if (!blocks || blocks.length === 0) return

  // Deduplicate by (reason, date_start, date_end)
  const seen = new Set<string>()
  const unique: Array<{ reason: string | null; date_start: string; date_end: string }> = []
  for (const b of blocks) {
    const key = `${b.reason ?? ''}|${b.date_start}|${b.date_end}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push({ reason: b.reason, date_start: b.date_start, date_end: b.date_end })
    }
  }
  if (unique.length === 0) return

  // Fetch blocks that the target experiences ALREADY have
  const { data: existing } = await db
    .from('experience_blocked_dates')
    .select('experience_id, reason, date_start, date_end')
    .in('experience_id', newExpIds)

  const existingKeys = new Set(
    (existing ?? []).map(r => `${r.experience_id}|${r.reason ?? ''}|${r.date_start}|${r.date_end}`)
  )

  const rows = newExpIds.flatMap(expId =>
    unique
      .filter(u => !existingKeys.has(`${expId}|${u.reason ?? ''}|${u.date_start}|${u.date_end}`))
      .map(u => ({
        experience_id: expId,
        date_start:    u.date_start,
        date_end:      u.date_end,
        reason:        u.reason,
      }))
  )

  if (rows.length === 0) return

  const { error } = await db
    .from('experience_blocked_dates')
    .upsert(rows, { ignoreDuplicates: true })

  if (error) {
    console.error('[syncNewExperienceBlocks] insert failed:', error.message)
  } else {
    console.log(
      `[syncNewExperienceBlocks] synced ${rows.length} block(s) to ${newExpIds.length} experience(s)`,
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bookingReason(bookingId: string): string {
  return `booking:${bookingId}`
}

/**
 * Expand a date range into individual ISO date strings (inclusive).
 * Returns [] if either bound is missing.
 */
export function expandBookingDateRange(from: string | null | undefined, to: string | null | undefined): string[] {
  if (!from || !to) return []
  const days: string[] = []
  const cur = new Date(from + 'T12:00:00')
  const end = new Date(to   + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0]!)
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
