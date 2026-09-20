// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
//
// ISO weeks (Monday–Sunday) and calendar months in Europe/Warsaw.
// Pure functions, no dependencies: Intl.DateTimeFormat gives the Warsaw calendar
// date of an instant; everything after that is plain UTC date arithmetic on
// year/month/day, so DST never leaks into the week maths.

const WARSAW = 'Europe/Warsaw'
const DAY_MS = 86_400_000

const warsawFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WARSAW,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export type Ymd = { year: number; month: number; day: number }
export type WeekRange = { key: string; start: string; end: string }

const pad2 = (n: number): string => String(n).padStart(2, '0')

function formatYmd({ year, month, day }: Ymd): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function parseYmd(ymd: string): Ymd {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (m === null) throw new RangeError(`Invalid YYYY-MM-DD date: "${ymd}"`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

/** UTC midnight (ms) of a calendar date — the only Date we ever do arithmetic on. */
function utcMs({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day)
}

function ymdFromUtcMs(ms: number): Ymd {
  const d = new Date(ms)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Calendar date in Warsaw of an instant (ISO string with Z/offset, or Date). */
export function warsawYmd(input: string | Date): Ymd {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: "${String(input)}"`)
  }
  const parts = warsawFormatter.formatToParts(date)
  const pick = (type: 'year' | 'month' | 'day'): number => {
    const part = parts.find(p => p.type === type)
    if (part === undefined) throw new RangeError(`Intl returned no ${type} for "${String(input)}"`)
    return Number(part.value)
  }
  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

/** Warsaw calendar date of an instant as 'YYYY-MM-DD'. */
export function warsawDateString(input: string | Date): string {
  return formatYmd(warsawYmd(input))
}

/** Monday = 0 … Sunday = 6. */
function isoWeekday(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7
}

function isoWeekOfYmd(ymd: Ymd): { isoYear: number; week: number } {
  const ms = utcMs(ymd)
  // The Thursday of the same ISO week decides the ISO week-year.
  const thursday = ms + (3 - isoWeekday(ms)) * DAY_MS
  const isoYear = new Date(thursday).getUTCFullYear()
  const dayOfYear = Math.round((thursday - Date.UTC(isoYear, 0, 1)) / DAY_MS) // 0-based
  return { isoYear, week: Math.floor(dayOfYear / 7) + 1 }
}

function weekKeyOfYmd(ymd: Ymd): string {
  const { isoYear, week } = isoWeekOfYmd(ymd)
  return `${isoYear}-W${pad2(week)}`
}

function weekStartOfYmd(ymd: Ymd): Ymd {
  const ms = utcMs(ymd)
  return ymdFromUtcMs(ms - isoWeekday(ms) * DAY_MS)
}

/** ISO week key of an instant in Warsaw, e.g. '2026-W53' (ISO week-year, not calendar year). */
export function isoWeekKey(input: string | Date): string {
  return weekKeyOfYmd(warsawYmd(input))
}

/** Monday ('YYYY-MM-DD') of the Warsaw ISO week containing the instant. */
export function isoWeekStart(input: string | Date): string {
  return formatYmd(weekStartOfYmd(warsawYmd(input)))
}

/** ISO week key of a plain 'YYYY-MM-DD' date column — no timezone shifting. */
export function isoWeekKeyOfDate(ymd: string): string {
  return weekKeyOfYmd(parseYmd(ymd))
}

/** Last n ISO weeks, newest first; index 0 is the current Warsaw week. */
export function lastWeeks(now: Date, n: number): WeekRange[] {
  const currentStartMs = utcMs(weekStartOfYmd(warsawYmd(now)))
  const weeks: WeekRange[] = []
  for (let i = 0; i < n; i++) {
    const startYmd = ymdFromUtcMs(currentStartMs - i * 7 * DAY_MS)
    const endYmd = ymdFromUtcMs(utcMs(startYmd) + 6 * DAY_MS)
    weeks.push({
      key: weekKeyOfYmd(startYmd),
      start: formatYmd(startYmd),
      end: formatYmd(endYmd),
    })
  }
  return weeks
}

/** Calendar month of an instant in Warsaw, 'YYYY-MM'. */
export function monthKey(input: string | Date): string {
  const { year, month } = warsawYmd(input)
  return `${year}-${pad2(month)}`
}

/** 'YYYY-MM' → previous month; January rolls back to December of the previous year. */
export function previousMonthKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (m === null) throw new RangeError(`Invalid YYYY-MM key: "${key}"`)
  const year = Number(m[1])
  const month = Number(m[2])
  return month === 1 ? `${year - 1}-12` : `${year}-${pad2(month - 1)}`
}
