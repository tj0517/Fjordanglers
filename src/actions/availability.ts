'use server'

import { revalidatePath } from 'next/cache'
import { requireGuide } from '@/lib/auth/guards'
import { availabilityWindow } from '@/lib/availability-window'
import { createServiceClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { success: false; error: string }
type OpenSeasonResult = { success: true; blockedDates: string[] } | { success: false; error: string }

/**
 * FA-M.09 (tj D2 a): a busy day carries its source — `manual` (written here) or `calendar` (written
 * only by the calendar sync). These actions touch `manual` rows only. A day busy in the guide's
 * connected calendar cannot be unblocked here (tj D2 follow-up b): the action refuses and says why.
 */
const CALENDAR_BUSY_ONE =
  'This day is busy in your connected calendar, so it stays blocked. Free it in your calendar — FjordAnglers picks that up at the next sync.'
const calendarBusyMany = (n: number) =>
  `${n} of these days are busy in your connected calendar, so nothing was unblocked. Free them in your calendar, or unselect them and try again.`

function genDatesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (cur <= endD) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Set open season: block everything outside [from, to], unblock inside.
 * Replaces the guide's manual blocks from today forward; calendar-busy days stay. Returns the
 * guide's busy days as they now are, so the page shows the truth instead of its guess (tj 2026-11-17).
 */
export async function setOpenSeason(from: string, to: string): Promise<OpenSeasonResult> {
  const { guide } = await requireGuide()

  const svc = createServiceClient()

  const today = new Date().toISOString().slice(0, 10)
  const twoYearsOut = new Date()
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2)
  const maxDate = twoYearsOut.toISOString().slice(0, 10)

  // Delete the guide's manual blocks from today forward (calendar rows belong to the sync)
  const { error: delError } = await svc
    .from('guide_unavailable_dates')
    .delete()
    .eq('guide_id', guide.id)
    .eq('source', 'manual')
    .gte('date', today)
  if (delError != null) return { success: false, error: delError.message }

  // Block everything outside [from, to]
  const toBlock: string[] = []
  if (from > today) toBlock.push(...genDatesInRange(today, addDays(from, -1)))
  if (to < maxDate)  toBlock.push(...genDatesInRange(addDays(to, 1), maxDate))

  if (toBlock.length > 0) {
    const { error: insError } = await svc
      .from('guide_unavailable_dates')
      .upsert(
        toBlock.map(d => ({ guide_id: guide.id, date: d, source: 'manual' })),
        { onConflict: 'guide_id,date,source', ignoreDuplicates: true },
      )
    if (insError != null) return { success: false, error: insError.message }
  }

  const window = availabilityWindow()
  const { data: rows, error: readError } = await svc
    .from('guide_unavailable_dates')
    .select('date')
    .eq('guide_id', guide.id)
    .gte('date', window.from)
    .lte('date', window.to)
  if (readError != null) return { success: false, error: readError.message }

  revalidatePath('/dashboard/calendar')
  return { success: true, blockedDates: [...new Set((rows ?? []).map(r => r.date))].sort() }
}

/**
 * Mark dates as unavailable/blocked (insert) or remove block (delete).
 * Dates are ISO strings: 'YYYY-MM-DD'.
 * Default state is available — only blocked dates are stored.
 */
export async function setAvailability(
  dates: string[],
  blocked: boolean,
): Promise<ActionResult> {
  if (dates.length === 0) return { success: true }

  const { guide } = await requireGuide()

  const svc = createServiceClient()

  if (blocked) {
    const { error } = await svc
      .from('guide_unavailable_dates')
      .upsert(
        dates.map(d => ({ guide_id: guide.id, date: d, source: 'manual' })),
        { onConflict: 'guide_id,date,source', ignoreDuplicates: true },
      )
    if (error != null) return { success: false, error: error.message }
  } else {
    const { data: calendarBusy, error: readError } = await svc
      .from('guide_unavailable_dates')
      .select('date')
      .eq('guide_id', guide.id)
      .eq('source', 'calendar')
      .in('date', dates)
    if (readError != null) return { success: false, error: readError.message }
    const busy = calendarBusy ?? []
    if (busy.length > 0) {
      return { success: false, error: dates.length === 1 ? CALENDAR_BUSY_ONE : calendarBusyMany(busy.length) }
    }

    const { error } = await svc
      .from('guide_unavailable_dates')
      .delete()
      .eq('guide_id', guide.id)
      .eq('source', 'manual')
      .in('date', dates)
    if (error != null) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/calendar')
  return { success: true }
}
