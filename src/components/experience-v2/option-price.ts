import { formatCents } from '@/lib/format-price'

/**
 * How an option's stored price reads on the page (FA-1.54): "from X" when only the lower
 * end is stored, "X–Y" when both are, nothing when there is no price.
 *
 * Shown exactly as stored, with no FA fee added — the same rule as the `custom` range
 * (FA-1.53, tj 2026-10-07): these figures are not validated yet. "from" is deliberate: if
 * the stored number is a lower bound, reading it as exact would promise too little.
 */
export function optionPriceText(
  fromCents: number | null,
  toCents:   number | null,
  currency:  string,
): string | null {
  if (fromCents == null) return null
  if (toCents != null && toCents !== fromCents) {
    return `${formatCents(fromCents, currency)}–${formatCents(toCents, currency)}`
  }
  return `from ${formatCents(fromCents, currency)}`
}

/** "1 day", "7 days", "3–5 days" — whichever ends of the stored range exist. */
export function durationText(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  const lo = min ?? max
  const hi = max ?? min
  if (lo == null || hi == null) return null
  if (lo === hi) return `${lo} ${lo === 1 ? 'day' : 'days'}`
  return `${lo}–${hi} days`
}

// This file is deliberately plain TypeScript, with no 'use client': S9 is a server component
// and calls these, and a function exported from a client module cannot be called from the
// server (Next fails the render at request time, which no jsdom test would see).
