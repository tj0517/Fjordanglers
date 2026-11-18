/**
 * Google Calendar events → busy days (FA-M.10). Pure: event times in, sorted `YYYY-MM-DD` dates out.
 *
 * Google is asked for start, end and busy/free only (`GOOGLE_EVENT_FIELDS` in ./google.ts — scope
 * `calendar.events.freebusy`, tj STOP 1 2026-11-18); there is nothing else here to leak. The rules are
 * the Apple rules of FA-M.09 (./ics.ts), so a guide's days do not depend on which calendar they use:
 *   * an all-day event (`start.date`) is always a busy day — also when marked "Available"
 *     (`transparency: transparent`, Google's default for all-day events);
 *   * a timed event marked "Available" is skipped; a cancelled one is skipped;
 *   * a timed event makes every day it touches busy, in the guide's zone (ending at exactly midnight
 *     does not make the next day busy);
 *   * the guide's zone (D3 a): their country's zone, else the calendar's own zone, else UTC.
 * Recurring events arrive expanded (`singleEvents=true`), so there is nothing to expand here.
 */

import { addDays, horizonInZone, localDate, nextDay, resolveGuideZone } from './ics'

export interface GoogleEventTime {
  /** All-day: `YYYY-MM-DD`. */
  date?: string
  /** Timed: RFC 3339 with an offset. */
  dateTime?: string
}

export interface GoogleEvent {
  start?: GoogleEventTime
  end?: GoogleEventTime
  transparency?: string
  status?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** The sync horizon (12 months from today in the guide's zone) and the instants to ask Google for. */
export function googleWindow(guideCountry: string | null, calendarZone: string | null, now: Date) {
  const zone = resolveGuideZone(guideCountry, calendarZone)
  const { from, to } = horizonInZone(zone, now)
  // One day of slack on each side covers every zone; days outside [from, to] are dropped below.
  return {
    zone, from, to,
    timeMin: `${previousDay(from)}T00:00:00Z`,
    timeMax: `${nextDay(nextDay(to))}T00:00:00Z`,
  }
}

export interface GoogleBusyDaysInput {
  events: readonly GoogleEvent[]
  guideCountry: string | null
  /** The calendar's own zone, as Google reports it. */
  calendarZone: string | null
  now: Date
}

export function busyDaysFromGoogleEvents(input: GoogleBusyDaysInput): { dates: string[]; zone: string } {
  const { zone, from, to } = googleWindow(input.guideCountry, input.calendarZone, input.now)
  const out = new Set<string>()

  for (const event of input.events) {
    if (event.status === 'cancelled') continue
    const start = event.start
    const end = event.end
    if (start == null) continue

    if (start.date != null) {
      // All-day: always busy (FA-M.09 rule b). End is exclusive; a missing or non-later end means one day.
      if (!DATE_RE.test(start.date)) continue
      const endExclusive = end?.date != null && DATE_RE.test(end.date) ? end.date : nextDay(start.date)
      const last = endExclusive > start.date ? previousDay(endExclusive) : start.date
      addDays(out, start.date, last, from, to)
      continue
    }

    if (event.transparency === 'transparent') continue
    if (start.dateTime == null) continue
    const startMs = Date.parse(start.dateTime)
    const endMs = end?.dateTime != null ? Date.parse(end.dateTime) : startMs
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue
    const first = localDate(startMs, zone)
    const last = endMs > startMs ? localDate(endMs - 1, zone) : first
    addDays(out, first, last, from, to)
  }

  return { dates: [...out].sort(), zone }
}
