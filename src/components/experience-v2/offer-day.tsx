'use client'

/**
 * S6 "The day" (FA-1.54).
 *
 *  • `fixed`  — one day as a timeline from `day_schedule`.
 *  • `custom` — the trip has no single day, so the visitor picks an archetype ("Day trip",
 *    "Lodge week"…) and reads its sample itinerary. The cards double as the switcher.
 *
 * Either way the page says the plan is a sample and the weather decides — a visitor who
 * reads a timeline as a promise is a refund request later.
 *
 * Nothing to show = no section: an empty `day_schedule` (fixed) or no archetype (custom)
 * returns null, so there is never a heading over an empty timeline.
 */

import { useState } from 'react'
import OfferSection from './offer-section'
import { Box, mutedStyle } from './offer-box'
import { optionPriceText } from './option-price'
import type { DayStep, ItineraryDay } from '@/lib/experience-v2-content'

export type OfferArchetype = {
  id:              string
  label:           string
  description:     string | null
  priceFromCents:  number | null
  priceToCents:    number | null
  currency:        string | null
  durationDaysMin: number | null
  durationDaysMax: number | null
  sampleItinerary: ItineraryDay[]
}

export type OfferDayProps = {
  offerMode:   'fixed' | 'custom'
  daySchedule: DayStep[]
  archetypes:  OfferArchetype[]
  /** The page's currency, for an archetype that does not carry its own. */
  currency:    string
}

const SAMPLE_PLAN_NOTE =
  'This is a sample plan — your guide picks the water to suit the weather and the state of the river.'

export function durationText(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  const lo = min ?? max
  const hi = max ?? min
  if (lo == null || hi == null) return null
  if (lo === hi) return `${lo} ${lo === 1 ? 'day' : 'days'}`
  return `${lo}–${hi} days`
}

export default function OfferDay({ offerMode, daySchedule, archetypes, currency }: OfferDayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(archetypes[0]?.id ?? null)

  const hasContent = offerMode === 'custom' ? archetypes.length > 0 : daySchedule.length > 0
  // The empty-field guard: nothing to show, no section, no heading.
  if (!hasContent) return null

  const selected = archetypes.find(a => a.id === selectedId) ?? archetypes[0] ?? null

  return (
    <OfferSection section="S6" title="The day" accordion={{ defaultOpen: true }}>
      {offerMode === 'custom' ? (
        <div data-testid="archetypes">
          <div role="tablist" aria-label="Trip styles" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {archetypes.map(a => {
              const active = a.id === selected?.id
              const price  = optionPriceText(a.priceFromCents, a.priceToCents, a.currency ?? currency)
              const length = durationText(a.durationDaysMin, a.durationDaysMax)
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-archetype={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="rounded-xl border-2 bg-white p-3 text-left"
                  style={{ borderColor: active ? 'var(--fa-navy)' : 'rgba(10,46,77,0.16)', minHeight: 44 }}
                >
                  <b className="block text-[15px]">{a.label}</b>
                  {length != null && <span className="block text-[13px]" style={mutedStyle}>{length}</span>}
                  {price != null && <span className="mt-1 block text-sm font-medium">{price}</span>}
                </button>
              )
            })}
          </div>

          {selected != null && (
            <div role="tabpanel" className="mt-4" data-testid="archetype-panel">
              {selected.description != null && <p className="mb-3 text-[15px]">{selected.description}</p>}
              {selected.sampleItinerary.length > 0 && (
                <ol className="space-y-2.5">
                  {selected.sampleItinerary.map(day => (
                    <li key={`${day.day}-${day.title}`}>
                      <Box>
                        <p className="text-[13px]" style={mutedStyle}>Day {day.day}</p>
                        <p className="font-semibold">{day.title}</p>
                        {day.details.length > 0 && (
                          <dl className="mt-1.5 space-y-0.5 text-sm">
                            {day.details.map(d => (
                              <div key={d.label} className="flex gap-2">
                                <dt style={mutedStyle}>{d.label}</dt>
                                <dd>{d.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </Box>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      ) : (
        <ol className="space-y-3" data-testid="timeline">
          {daySchedule.map((step, i) => (
            <li key={`${i}-${step.title}`} className="flex gap-4">
              <b className="w-14 flex-none text-[15px] tabular-nums">{step.time}</b>
              <div className="min-w-0 border-l pl-4" style={{ borderColor: 'rgba(10,46,77,0.2)' }}>
                <p className="text-[15px]">{step.title}</p>
                {step.metaLines.length > 0 && (
                  <p className="text-[13px]" style={mutedStyle}>{step.metaLines.join(' · ')}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-sm" style={mutedStyle}>{SAMPLE_PLAN_NOTE}</p>
    </OfferSection>
  )
}
