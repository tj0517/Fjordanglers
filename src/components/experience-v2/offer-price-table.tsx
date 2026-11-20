/**
 * S9 "Price" (FA-1.54; "Price and deposit" until FA-1.65, tj 2026-10-23).
 *
 *  • `fixed`  — the days × anglers table, then Total / Deposit / Balance for the same
 *    default configuration the widget opens on. Every number comes from `quote()` in
 *    src/lib/pricing/experience-price.ts, the function the widget calls — there is no second
 *    formula here, so the table and the widget cannot disagree.
 *  • `custom` — the indicative range, then the archetypes with a "from" price. The range
 *    is shown exactly as stored, without the FA fee (tj, 2026-10-07).
 *
 * Refund: only the per-offer `weather_policy_text` is shown. The global FA deposit-refund
 * wording does not exist yet (O-35, tj 2026-10-07, option D; docs/deferred-tasks.md,
 * "blocks FA-1.57"), so this section says nothing about it rather than inventing a policy.
 *
 * No price factors are shown for `custom`: no column stores them (task FA-1.54 notes).
 */

import OfferSection from './offer-section'
import { ON_DARK, SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import { optionPriceText, durationText } from './option-price'
import type { OfferArchetype } from './offer-day'
import { quote, customRange, type PriceRow, type Quote } from '@/lib/pricing/experience-price'
import { formatCents } from '@/lib/format-price'

export type OfferPriceTableProps = {
  offerMode:          'fixed' | 'custom'
  prices:             PriceRow[]
  feePct:             number
  currency:           string
  maxAnglersPerGuide: number
  minDays:            number
  priceFromCents:     number | null
  priceToCents:       number | null
  archetypes:         OfferArchetype[]
  weatherPolicyText:  string | null
}

const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default function OfferPriceTable(props: OfferPriceTableProps) {
  const { offerMode, prices, feePct, currency, maxAnglersPerGuide, minDays, weatherPolicyText } = props

  const base = { prices, feePct, maxAnglersPerGuide }

  // ── fixed: table + the default configuration ──────────────────────────────
  const days    = unique(prices.map(r => r.days))
  const anglers = unique(prices.map(r => r.anglers))

  const cells = days.map(d => anglers.map(a => quote({ days: d, anglers: a, ...base })))
  const tableUsable = offerMode === 'fixed' && cells.some(row => row.some(c => c.priced))

  // The widget opens on `minDays` and two anglers (capped by the group size); so does this.
  const defaultDays    = minDays
  const defaultAnglers = Math.min(2, maxAnglersPerGuide)
  const defaultQuote   = quote({ days: defaultDays, anglers: defaultAnglers, ...base })

  // ── custom: range + archetypes ────────────────────────────────────────────
  const range      = offerMode === 'custom' ? customRange(props.priceFromCents, props.priceToCents, currency) : null
  const archetypes = offerMode === 'custom' ? props.archetypes.filter(a => a.priceFromCents != null) : []

  // The empty-field guard: nothing priced and no weather note, no section.
  if (!tableUsable && range == null && archetypes.length === 0 && weatherPolicyText == null) return null

  return (
    <OfferSection section="S9" anchor="cena" eyebrow="Money" title="Price" accordion={{ defaultOpen: true }}>
      {/* One grain block, rows on hairlines (2026-11 mockup): the table, then the total. */}
      <div className={`${grain.blur} ${grain.nz} flex flex-col rounded-[20px] px-5 py-2 text-white sm:px-9 sm:py-3.5 [&>*:last-child]:!border-b-0`}>
        {tableUsable && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[16px]" data-testid="price-table">
              <thead>
                <tr className="text-left text-[13px]" style={{ color: ON_DARK }}>
                  <th scope="col" className="py-4 font-medium" style={rule}><span className="sr-only">Days</span></th>
                  {anglers.map(a => (
                    <th key={a} scope="col" className="py-4 text-right font-medium" style={rule}>
                      {plural(a, 'angler', 'anglers')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d}>
                    <th scope="row" className="py-[18px] text-left font-medium" style={{ ...rule, color: ON_DARK }}>
                      {plural(d, 'day', 'days')}
                    </th>
                    {anglers.map((a, j) => (
                      <td
                        key={a}
                        className="py-[18px] text-right font-bold tabular-nums"
                        style={rule}
                        data-days={d}
                        data-anglers={a}
                      >
                        {cellText(cells[i]?.[j])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tableUsable && defaultQuote.priced && (
          <div className="py-5 sm:py-6" style={rule}>
            {/* The price only — no deposit / balance split (tj, FA-1.65, 2026-10-23). */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[16px] font-bold">
                Total
                <span className="ml-2 font-medium" style={{ color: ON_DARK }}>
                  {plural(defaultDays, 'day', 'days')}, {plural(defaultAnglers, 'angler', 'anglers')}
                </span>
              </span>
              <span className="f-display text-[26px] font-bold sm:text-[28px]" style={{ color: SALMON_ON_DARK }}>
                {formatCents(defaultQuote.totalCents, defaultQuote.currency)}
              </span>
            </div>
            {defaultQuote.onRequest && (
              <p className="mt-2 text-[13px]" style={{ color: ON_DARK }}>
                Priced for {defaultQuote.pricedAnglers} anglers — your exact price comes back on request.
              </p>
            )}
          </div>
        )}

        {range != null && (
          <div className="py-5 sm:py-6" style={rule}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[16px] font-medium" style={{ color: ON_DARK }}>Indicative rate</span>
              <span className="f-display text-[26px] font-bold sm:text-[28px]" style={{ color: SALMON_ON_DARK }} data-testid="price-range">
                {range.toCents != null
                  ? `${formatCents(range.fromCents, range.currency)}–${formatCents(range.toCents, range.currency)}`
                  : `from ${formatCents(range.fromCents, range.currency)}`}
              </span>
            </div>
            <p className="mt-2 text-[13.5px]" style={{ color: ON_DARK }}>
              The exact price depends on the trip we plan together; your offer states it.
            </p>
          </div>
        )}

        {archetypes.length > 0 && (
          <ul className="m-0 list-none p-0" data-testid="archetype-prices">
            {archetypes.map(a => {
              const length = durationText(a.durationDaysMin, a.durationDaysMax)
              return (
                <li key={a.id} className="flex items-baseline justify-between gap-4 py-[18px] text-[16px]" style={rule}>
                  <span className="font-medium" style={{ color: ON_DARK }}>{a.label}{length != null && <> · {length}</>}</span>
                  <b className="flex-none whitespace-nowrap">{optionPriceText(a.priceFromCents, a.priceToCents, a.currency ?? currency)}</b>
                </li>
              )
            })}
          </ul>
        )}

        {weatherPolicyText != null && (
          <p className="py-5 text-[15px]" style={{ ...rule, color: ON_DARK }} data-testid="weather-policy">
            <b className="text-white">Bad weather:</b> {weatherPolicyText}
          </p>
        )}
      </div>
    </OfferSection>
  )
}

/** The hairline between rows on the grain block; the block drops it on its last child. */
const rule = { borderBottom: '1px solid rgba(255,255,255,.22)' }

/** A priced cell shows the total; a cell the table cannot price exactly says so. */
function cellText(q: Quote | undefined): string {
  if (q == null || !q.priced || q.onRequest) return 'on request'
  return formatCents(q.totalCents, q.currency)
}
