/**
 * FA-M.06 — how long FA waits before a guide who has not opened a request counts as "hasn't opened".
 *
 * In season guides are on the water, not ignoring FA: 12 h. Outside season (or when we do not know
 * the season, or the angler gave no dates) 24 h. O-53 → (c), tj 2026-11-10.
 *
 * "In season" = at least one of the inquiry's requested dates falls in a month listed in the
 * `season_months` of the guide's experience pages. Dates are calendar dates ("2027-01-14"), so the
 * month is read from the string — no time zone involved. Pure: no clock, no database.
 */

export const IN_SEASON_HOURS  = 12
export const OFF_SEASON_HOURS = 24

function monthOf(isoDate: string): number | null {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(isoDate)
  if (m == null) return null
  const month = Number(m[1])
  return month >= 1 && month <= 12 ? month : null
}

/**
 * @param requestedDates the inquiry's `requested_dates` (empty = flexible / unknown)
 * @param seasonMonths   month numbers 1–12 from the guide's experience pages, any number of pages merged
 */
export function reminderThresholdHours(
  requestedDates: readonly string[],
  seasonMonths: readonly number[],
): number {
  const season = new Set(seasonMonths.filter(m => Number.isInteger(m) && m >= 1 && m <= 12))
  if (season.size === 0) return OFF_SEASON_HOURS
  const inSeason = requestedDates.some(d => {
    const month = monthOf(d)
    return month != null && season.has(month)
  })
  return inSeason ? IN_SEASON_HOURS : OFF_SEASON_HOURS
}
