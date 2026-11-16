/** Date labels for the request page. Dates are calendar days (YYYY-MM-DD), read in UTC so no zone shifts them. */

const DAY_MS = 86_400_000

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function dayLabel(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function shortLabel(iso: string): string {
  return utc(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}

/** "12 Jun – 15 Jun 2027 · 4 days" for consecutive days, otherwise each day listed. */
export function datesLabel(dates: readonly string[]): string {
  if (dates.length === 0) return 'No dates yet — flexible'
  if (dates.length === 1) return dayLabel(dates[0])
  const sorted = [...dates].sort()
  const consecutive = sorted.every((d, i) => i === 0 || utc(d).getTime() - utc(sorted[i - 1]).getTime() === DAY_MS)
  const last = sorted[sorted.length - 1]
  const year = utc(last).getUTCFullYear()
  if (consecutive) return `${shortLabel(sorted[0])} – ${shortLabel(last)} ${year} · ${sorted.length} days`
  return sorted.map(dayLabel).join(', ')
}
