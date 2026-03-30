/**
 * Shared period utilities — safe to import from both Server and Client Components.
 */

export type Period = { from: string; to: string }

/** Encode periods array to URL param: "2026-04-01..2026-04-05,2026-04-08" */
export function encodePeriodsParam(periods: Period[]): string {
  return periods
    .map(p => (p.from === p.to ? p.from : `${p.from}..${p.to}`))
    .join(',')
}

/** Decode URL param back to periods array. */
export function decodePeriodsParam(str: string): Period[] {
  return str
    .split(',')
    .filter(Boolean)
    .map(s => {
      const parts = s.split('..')
      const from  = parts[0]?.trim() ?? ''
      const to    = parts[1]?.trim() ?? from
      return { from, to }
    })
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to))
}

export function periodTotalDays(periods: Period[]): number {
  return periods.reduce((sum, p) => {
    return sum + Math.round(
      (new Date(p.to + 'T00:00:00').getTime() - new Date(p.from + 'T00:00:00').getTime()) / 86_400_000
    ) + 1
  }, 0)
}
