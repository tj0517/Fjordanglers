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
