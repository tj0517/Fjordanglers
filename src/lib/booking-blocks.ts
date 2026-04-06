/**
 * booking-blocks — write/remove date blocks for bookings.
 *
 * As of 2026-04-02 migration, `calendar_blocked_dates` is the ONLY table used.
 * `experience_blocked_dates` is empty and must NOT be written to or read from.
 *
 * Rule: a booking blocks ONLY the calendar its trip belongs to.
 *   • experienceId provided → find that trip's calendar → block it
 *   • no calendar found (no experienceId, or trip not in any calendar) → no-op
 *
 * Each calendar is an independent availability pool. Blocking Calendar A
 * never affects Calendar B, regardless of booking type.
 *
 * Each row uses:  reason = 'booking:<bookingId>'
 * One row per individual ISO date — avoids range-split complexity on cleanup.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insert blocked-date rows for `dates` into `calendar_blocked_dates`.
 *
 * Two resolution strategies:
 *   • experienceId provided → block ONLY the calendar that experience belongs to
 *   • no experienceId (inquiry/custom trip) → block ALL calendars for this guide
 *
 * Both direct and inquiry bookings use this same function.
 * Fire-and-forget safe: call with `.catch()`.
 */
export async function blockBookingDates(
  db:            SupabaseClient<Database>,
  bookingId:     string,
  guideId:       string,
  dates:         string[],  // individual ISO 'YYYY-MM-DD' strings
  experienceId?: string,
): Promise<void> {
  if (dates.length === 0) return

  const reason = bookingReason(bookingId)
  let calendarIds: string[]

  if (experienceId != null) {
    // Experience-linked (direct booking): block only the calendar this experience belongs to
    const { data: calExp } = await db
      .from('calendar_experiences')
      .select('calendar_id')
      .eq('experience_id', experienceId)
      .maybeSingle()

    if (calExp == null) return
    calendarIds = [calExp.calendar_id]
  } else {
    // Inquiry/custom booking (no experience_id): block ALL calendars for this guide.
    // The guide is committed regardless of which experience the calendar tracks.
    const { data: cals } = await db
      .from('guide_calendars')
      .select('id')
      .eq('guide_id', guideId)

    calendarIds = (cals ?? []).map(c => c.id)

    if (calendarIds.length === 0) return
  }

  const rows = calendarIds.flatMap(calendarId =>
    dates.map(d => ({
      calendar_id: calendarId,
      date_start:  d,
      date_end:    d,
      reason,
    }))
  )

  const { error } = await db
    .from('calendar_blocked_dates')
    .upsert(rows, { ignoreDuplicates: true })

  if (error) {
    console.error('[blockBookingDates] insert failed:', error.message)
  }
}

/**
 * Remove all blocked-date rows created for this booking from `calendar_blocked_dates`.
 * Called when a booking is declined, cancelled, or refunded.
 */
export async function unblockBookingDates(
  db:        SupabaseClient<Database>,
  bookingId: string,
): Promise<void> {
  const reason = bookingReason(bookingId)

  const { error, count } = await db
    .from('calendar_blocked_dates')
    .delete({ count: 'exact' })
    .eq('reason', reason)

  if (error) {
    console.error('[unblockBookingDates] delete failed:', error.message)
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
