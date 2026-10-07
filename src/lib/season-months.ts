/**
 * `experience_pages.season_months` → the "season Oct–Apr" chip (FA-1.53).
 *
 * The column is a bare set of month numbers, so a southern-hemisphere season arrives
 * wrapped around the end of the year ({10,11,12,1,2,3,4} for New Zealand). Printing
 * "Jan, Feb, Mar, Apr, Oct, Nov, Dec" would be both long and wrong-looking, so the set
 * is read as runs on a circle and printed as ranges.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * A human range for a set of month numbers (1–12), e.g. "Oct–Apr", "Jun–Sep",
 * "Jan–Feb, Jun–Aug" for a split season, "all year" for twelve, null for none.
 * Out-of-range and duplicate values are ignored rather than trusted.
 */
export function seasonLabel(months: readonly number[]): string | null {
  const present = new Set(months.filter(m => Number.isInteger(m) && m >= 1 && m <= 12))
  if (present.size === 0) return null
  if (present.size === 12) return 'all year'

  const prev = (m: number) => (m === 1 ? 12 : m - 1)
  const next = (m: number) => (m === 12 ? 1 : m + 1)

  // A run starts at a month whose predecessor is absent — on a circle, so December
  // leading into January is one run, not two.
  const starts = [...present].filter(m => !present.has(prev(m))).sort((a, b) => a - b)

  const runs = starts.map(start => {
    let end = start
    while (present.has(next(end)) && next(end) !== start) end = next(end)
    return start === end
      ? MONTHS_SHORT[start - 1]!
      : `${MONTHS_SHORT[start - 1]}–${MONTHS_SHORT[end - 1]}`
  })

  return runs.join(', ')
}
