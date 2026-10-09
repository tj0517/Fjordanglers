/**
 * S9 "Price and deposit" (FA-1.54).
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
import { Box, mutedStyle } from './offer-box'
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
    <OfferSection section="S9" anchor="cena" eyebrow="Money" title="Price and deposit" accordion={{ defaultOpen: true }}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        {tableUsable && (
          <Box>
            <table className="w-full border-collapse text-[15px]" data-testid="price-table">
              <thead>
                <tr className="text-left text-[13px]" style={mutedStyle}>
                  <th scope="col" className="border-b py-2 font-normal" style={rule}><span className="sr-only">Days</span></th>
                  {anglers.map(a => (
                    <th key={a} scope="col" className="border-b py-2 font-normal" style={rule}>
                      {plural(a, 'angler', 'anglers')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d}>
                    <th scope="row" className="border-b py-2.5 text-left font-normal" style={ruleSoft}>
                      {plural(d, 'day', 'days')}
                    </th>
                    {anglers.map((a, j) => (
                      <td
                        key={a}
                        className="border-b py-2.5"
                        style={ruleSoft}
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
            <p className="mt-3 text-[13px]" style={mutedStyle}>
              Total price per group, in {currency}: the guide and our fee together.
            </p>
            {currency !== 'EUR' && (
              <p className="mt-2 text-[13px]" style={mutedStyle} data-testid="currency-note">
                Prices are in {currency}. The deposit is charged in EUR through Stripe — your
                offer shows the exact amount.
              </p>
            )}
          </Box>
        )}

        {tableUsable && defaultQuote.priced && (
          <Box>
            <p className="mb-2 text-[13px]" style={mutedStyle}>
              For {plural(defaultDays, 'day', 'days')}, {plural(defaultAnglers, 'angler', 'anglers')}
            </p>
            <Line label="Total" value={formatCents(defaultQuote.totalCents, defaultQuote.currency)} strong />
            <Line
              label="Deposit now"
              note={`${Math.round(feePct * 10_000) / 100}% of the guide price`}
              value={formatCents(defaultQuote.feeCents, defaultQuote.currency)}
            />
            <Line label="Balance to the guide" value={formatCents(defaultQuote.guideCents, defaultQuote.currency)} />
            {defaultQuote.onRequest && (
              <p className="mt-2 text-[13px]" style={mutedStyle}>
                Priced for {defaultQuote.pricedAnglers} anglers — your exact price comes back on request.
              </p>
            )}
          </Box>
        )}

        {range != null && (
          <Box>
            <p className="mb-1 text-[13px]" style={mutedStyle}>Indicative rate</p>
            <p className="text-xl font-semibold" data-testid="price-range">
              {range.toCents != null
                ? `${formatCents(range.fromCents, range.currency)}–${formatCents(range.toCents, range.currency)}`
                : `from ${formatCents(range.fromCents, range.currency)}`}
            </p>
            <p className="mt-2 text-[13px]" style={mutedStyle}>
              The exact price depends on the trip we plan together; your offer states it.
            </p>
          </Box>
        )}

        {archetypes.length > 0 && (
          <Box>
            <p className="mb-2 text-[13px]" style={mutedStyle}>Trip styles</p>
            <ul className="space-y-2 text-[15px]" data-testid="archetype-prices">
              {archetypes.map(a => {
                const length = durationText(a.durationDaysMin, a.durationDaysMax)
                return (
                  <li key={a.id} className="flex items-baseline justify-between gap-3">
                    <span>{a.label}{length != null && <span style={mutedStyle}> · {length}</span>}</span>
                    <b className="flex-none whitespace-nowrap">{optionPriceText(a.priceFromCents, a.priceToCents, a.currency ?? currency)}</b>
                  </li>
                )
              })}
            </ul>
          </Box>
        )}

        {weatherPolicyText != null && (
          <Box className="xl:col-span-2">
            <p className="text-[15px]" data-testid="weather-policy">
              <b>Bad weather:</b> {weatherPolicyText}
            </p>
          </Box>
        )}
      </div>
    </OfferSection>
  )
}

const rule     = { borderColor: 'rgba(10,46,77,0.16)' }
const ruleSoft = { borderColor: 'rgba(10,46,77,0.10)' }

/** A priced cell shows the total; a cell the table cannot price exactly says so. */
function cellText(q: Quote | undefined): string {
  if (q == null || !q.priced || q.onRequest) return 'on request'
  return formatCents(q.totalCents, q.currency)
}

function Line({ label, value, strong = false, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t py-1.5 text-sm first:border-t-0" style={ruleSoft}>
      <span>
        {label}
        {note != null && <span className="mt-0.5 block text-xs" style={mutedStyle}>{note}</span>}
      </span>
      <b className={strong ? 'text-base' : undefined}>{value}</b>
    </div>
  )
}
