/**
 * Availability window for guide-calendar queries.
 *
 * One clock read, in the data layer. Callers used to compute `today` and
 * `yearAhead` from two separate reads of the clock, which can disagree across a
 * midnight boundary, and which made async Server Components call an impure
 * global (`Date.now`) during render — `react-hooks/purity`. Both concerns are
 * solved by reading the clock once, here, instead of in a component body.
 *
 * Dates are returned as `YYYY-MM-DD` in UTC, matching `guide_unavailable_dates.date`.
 */
export function availabilityWindow(daysAhead = 366): { from: string; to: string } {
  const now = Date.now()
  return {
    from: new Date(now).toISOString().slice(0, 10),
    to:   new Date(now + daysAhead * 86_400_000).toISOString().slice(0, 10),
  }
}

/** FA-1.08 red proof — deliberately unused export, must turn the `knip` job red. */
export function redProofUnusedExport(): string {
  return 'this export has no importer'
}
