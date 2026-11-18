/**
 * ICS → busy days (FA-M.09). Pure: text in, sorted `YYYY-MM-DD` dates out. No titles, locations
 * or descriptions leave this module — FA reads busy / free only.
 *
 * Rules (tj 2026-11-17):
 *   * an all-day event is always a busy day — also when marked "free" (TRANSP:TRANSPARENT), because
 *     calendars create all-day events as "free" by default and guides block trip days that way (b);
 *   * a timed event marked "free" is skipped; a cancelled event (STATUS:CANCELLED) is skipped;
 *   * a timed event makes every day it touches busy, in the guide's time zone (an event ending at
 *     exactly midnight does not make the next day busy);
 *   * multi-day and recurring events (RRULE / RDATE / EXDATE, moved or changed occurrences) are
 *     expanded; only days inside [from, to] are returned;
 *   * the guide's zone (D3 a): their country's zone, else the calendar's own X-WR-TIMEZONE, else UTC.
 *     A time with a TZID is read in that zone; a "floating" time (no zone) in the guide's zone.
 *
 * `ical.js` parses and expands recurrences; zone arithmetic is done here with the IANA database
 * built into Node (Intl), because `ical.js` treats a TZID without an embedded VTIMEZONE as floating.
 */

import ICAL from 'ical.js'
import { COUNTRIES, COUNTRY_TIMEZONE } from '@/lib/countries'

/** Upper bounds so a hostile or broken calendar cannot keep the sync busy. */
const MAX_EVENTS = 20_000
const MAX_OCCURRENCES_PER_EVENT = 20_000
const MAX_OCCURRENCES_TOTAL = 200_000

export class NotACalendarError extends Error {
  constructor() {
    super('not an iCalendar file')
    this.name = 'NotACalendarError'
  }
}

export interface BusyDaysInput {
  ics: string
  /** `guides.country`; null / '' / unknown → next step of the zone chain. */
  guideCountry: string | null
  /**
   * First and last day, inclusive (`YYYY-MM-DD`). Omitted → today in the guide's zone through
   * 12 months ahead (the sync horizon), computed once the zone is known.
   */
  from?: string
  to?: string
  /** "Now" for the default horizon; tests pin it. */
  now?: Date
}

export interface BusyDaysResult {
  /** Sorted, distinct, inside the horizon. */
  dates: string[]
  /** The zone the days were computed in. */
  zone: string
}

// ─── zones ───────────────────────────────────────────────────────────────────

function isIanaZone(name: string | null | undefined): name is string {
  if (name == null || name === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}

function countryZone(country: string | null): string | null {
  if (country == null) return null
  const match = COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim())
  return match != null ? COUNTRY_TIMEZONE[match] : null
}

/** D3 (a): country zone → the calendar's X-WR-TIMEZONE → UTC. */
export function resolveGuideZone(country: string | null, calendarZone: string | null): string {
  return countryZone(country) ?? (isIanaZone(calendarZone) ? calendarZone : 'UTC')
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(zone)
  if (f == null) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsFormatters.set(zone, f)
  }
  return f
}

/** Offset of `zone` from UTC at instant `ms`, in ms. */
function zoneOffset(ms: number, zone: string): number {
  const p: Record<string, number> = {}
  for (const part of partsFormatter(zone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** The instant of a wall-clock time in `zone` (DST gaps resolve forward, overlaps to the first). */
function wallToInstant(t: ICAL.Time, zone: string): number {
  const guess = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  const first = guess - zoneOffset(guess, zone)
  const second = guess - zoneOffset(first, zone)
  return Math.min(first, second)
}

/** `YYYY-MM-DD` of an instant in `zone`. */
export function localDate(ms: number, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(ms))
}

// ─── dates ───────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function wallDate(t: ICAL.Time): string {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`
}

/** The sync horizon in a zone: today there → the day before the same date next year (12 months). */
export function horizonInZone(zone: string, now: Date = new Date()): { from: string; to: string } {
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
  const end = new Date(`${from}T00:00:00Z`)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  end.setUTCDate(end.getUTCDate() - 1)
  return { from, to: end.toISOString().slice(0, 10) }
}

export function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Every day from `first` to `last`, inclusive, clipped to [from, to]. */
export function addDays(out: Set<string>, first: string, last: string, from: string, to: string): void {
  let day = first < from ? from : first
  const end = last > to ? to : last
  while (day <= end) {
    out.add(day)
    day = nextDay(day)
  }
}

// ─── events ──────────────────────────────────────────────────────────────────

interface ZoneContext {
  guideZone: string
  /** Embedded VTIMEZONE definitions, for TZIDs that are not IANA names. */
  embedded: Map<string, ICAL.Timezone>
}

/** The instant of a date-time value of `prop`, read in its TZID, UTC, or the guide's zone. */
function instantOf(t: ICAL.Time, prop: ICAL.Property | null, ctx: ZoneContext): number {
  if (t.zone?.tzid === 'UTC') return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  const tzid = prop?.getParameter('tzid')
  const tzidName = typeof tzid === 'string' ? tzid : null
  if (isIanaZone(tzidName)) return wallToInstant(t, tzidName)
  const embedded = tzidName != null ? ctx.embedded.get(tzidName) : undefined
  if (embedded != null) {
    const zoned = ICAL.Time.fromData(
      { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second, isDate: false },
      embedded,
    )
    return zoned.toUnixTime() * 1000
  }
  return wallToInstant(t, ctx.guideZone)
}

function isCancelled(component: ICAL.Component): boolean {
  return String(component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'
}

function isMarkedFree(component: ICAL.Component): boolean {
  return String(component.getFirstPropertyValue('transp') ?? '').toUpperCase() === 'TRANSPARENT'
}

/** Busy days of one occurrence, added to `out`. */
function addOccurrence(
  out: Set<string>,
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  ctx: ZoneContext,
  from: string,
  to: string,
): void {
  const component = item.component
  if (isCancelled(component)) return

  if (start.isDate) {
    // All-day: always busy (tj b). End is exclusive; a missing or non-later end means one day.
    const first = wallDate(start)
    const endExclusive = end.isDate ? wallDate(end) : nextDay(first)
    const last = endExclusive > first ? new Date(Date.parse(`${endExclusive}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : first
    addDays(out, first, last, from, to)
    return
  }

  if (isMarkedFree(component)) return

  const startProp = component.getFirstProperty('dtstart')
  const endProp = component.getFirstProperty('dtend') ?? startProp
  const startMs = instantOf(start, startProp, ctx)
  const endMs = instantOf(end, endProp, ctx)
  const first = localDate(startMs, ctx.guideZone)
  const last = endMs > startMs ? localDate(endMs - 1, ctx.guideZone) : first
  addDays(out, first, last, from, to)
}

/** Busy days between `from` and `to` (inclusive) for one calendar. Throws NotACalendarError. */
export function busyDaysFromIcs(input: BusyDaysInput): BusyDaysResult {
  if (!/BEGIN:VCALENDAR/i.test(input.ics)) throw new NotACalendarError()
  let root: ICAL.Component
  try {
    root = new ICAL.Component(ICAL.parse(input.ics))
  } catch {
    throw new NotACalendarError()
  }
  if (root.name !== 'vcalendar') throw new NotACalendarError()

  const calendarZone = root.getFirstPropertyValue('x-wr-timezone')
  const guideZone = resolveGuideZone(input.guideCountry, typeof calendarZone === 'string' ? calendarZone : null)

  const embedded = new Map<string, ICAL.Timezone>()
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    const tzid = vtz.getFirstPropertyValue('tzid')
    if (typeof tzid === 'string' && !isIanaZone(tzid)) embedded.set(tzid, new ICAL.Timezone(vtz))
  }
  const ctx: ZoneContext = { guideZone, embedded }
  const horizon = input.from != null && input.to != null
    ? { from: input.from, to: input.to }
    : horizonInZone(guideZone, input.now)

  const vevents = root.getAllSubcomponents('vevent').slice(0, MAX_EVENTS)
  // Changed / moved occurrences (RECURRENCE-ID) belong to their series' master.
  const masters = new Map<string, ICAL.Event>()
  const standalone: ICAL.Event[] = []
  const exceptions: ICAL.Event[] = []
  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)
    if (vevent.hasProperty('recurrence-id')) exceptions.push(event)
    else if (event.uid != null && event.uid !== '' && !masters.has(event.uid)) masters.set(event.uid, event)
    else standalone.push(event)
  }
  for (const ex of exceptions) {
    const master = ex.uid != null ? masters.get(ex.uid) : undefined
    if (master != null) master.relateException(ex)
    else standalone.push(ex)
  }

  const out = new Set<string>()
  // Stop expanding a series once its occurrences start after the horizon (one day of slack for zones).
  const stopAfter = nextDay(horizon.to)
  let total = 0

  for (const event of [...masters.values(), ...standalone]) {
    if (!event.isRecurring()) {
      if (event.startDate == null) continue
      addOccurrence(out, event, event.startDate, event.endDate ?? event.startDate, ctx, horizon.from, horizon.to)
      continue
    }
    const it = event.iterator()
    let count = 0
    for (let next = it.next(); next != null; next = it.next()) {
      if (++count > MAX_OCCURRENCES_PER_EVENT || ++total > MAX_OCCURRENCES_TOTAL) break
      if (wallDate(next) > stopAfter) break
      const details = event.getOccurrenceDetails(next)
      addOccurrence(out, details.item, details.startDate, details.endDate, ctx, horizon.from, horizon.to)
    }
  }

  return { dates: [...out].sort(), zone: guideZone }
}
