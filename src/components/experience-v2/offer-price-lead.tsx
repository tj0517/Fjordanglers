'use client'

/**
 * The mobile price lead (FA-1.53).
 *
 * On a 390 px screen the wireframe puts the price directly under the rating, before the
 * chips — the full calculator is further down and the bottom bar carries the CTA once the
 * hero is scrolled past. This is that line: the "from" total, what it covers, and the
 * indicative conversion when the visitor has picked another currency.
 *
 * Desktop never renders it; there the same numbers live in the sticky card.
 */

import { fromPrice, customRange, type PriceRow } from '@/lib/pricing/experience-price'
import { formatCents } from '@/lib/format-price'
import { useCurrency } from './currency-context'

export default function OfferPriceLead({
  offerMode,
  prices,
  feePct,
  currency,
  maxAnglersPerGuide,
  priceFromCents,
  priceToCents,
}: {
  offerMode:          'fixed' | 'custom'
  prices:             PriceRow[]
  feePct:             number
  currency:           string
  maxAnglersPerGuide: number
  priceFromCents:     number | null
  priceToCents:       number | null
}) {
  const { indicative } = useCurrency()

  const range = offerMode === 'custom' ? customRange(priceFromCents, priceToCents, currency) : null
  const from  = offerMode === 'fixed' ? fromPrice({ prices, feePct, maxAnglersPerGuide }) : null

  const headline = range != null
    ? (range.toCents != null
        ? `${formatCents(range.fromCents, range.currency)}–${formatCents(range.toCents, range.currency)}`
        : `from ${formatCents(range.fromCents, range.currency)}`)
    : from != null
      ? `from ${formatCents(from.totalCents, from.currency)}`
      : 'Price on request'

  const approx = range != null ? indicative(range.fromCents) : from != null ? indicative(from.totalCents) : null

  // "gear included" is deliberately left to the chip below rather than repeated here.
  const sub = [
    offerMode === 'custom'
      ? 'indicative · the offer is built around your dates'
      : maxAnglersPerGuide === 1 ? '1 angler per guide' : `1–${maxAnglersPerGuide} anglers per guide`,
    approx,
  ].filter((s): s is string => s != null)

  return (
    <div data-testid="offer-price-lead">
      <p className="f-display text-2xl font-bold leading-tight">{headline}</p>
      {sub.length > 0 && (
        <p className="mt-0.5 text-[13px]" style={{ color: 'rgba(10,46,77,0.62)' }}>{sub.join(' · ')}</p>
      )}
    </div>
  )
}
