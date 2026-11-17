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
import { CREAM, LINE, NAVY, ON_DARK_SOFT, SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import { optionPriceText, durationText } from './option-price'
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
  'Please note: This is a sample itinerary. The exact schedule will be customized to suit your preferences, the weather, and the state of the water.'

export default function OfferDay({ offerMode, daySchedule, archetypes, currency }: OfferDayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(archetypes[0]?.id ?? null)

  const hasContent = offerMode === 'custom' ? archetypes.length > 0 : daySchedule.length > 0
  // The empty-field guard: nothing to show, no section, no heading.
  if (!hasContent) return null

  const selected = archetypes.find(a => a.id === selectedId) ?? archetypes[0] ?? null

  return (
    <OfferSection section="S6" eyebrow="On the water" title="The day" accordion={{ defaultOpen: true }}>
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
                  className="rounded-[14px] p-4 text-left transition-colors"
                  style={{ background: CREAM, border: `1.5px solid ${active ? NAVY : LINE}`, minHeight: 44 }}
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
        <ol className={`${grain.blur} ${grain.canyon} m-0 flex list-none flex-col rounded-[20px] px-5 py-2 sm:px-9 sm:py-3.5`} data-testid="timeline">
          {daySchedule.map((step, i) => (
            <li
              key={`${i}-${step.title}`}
              className="flex flex-col gap-1.5 py-5 sm:flex-row sm:gap-7 sm:py-6"
              style={i < daySchedule.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,.22)' } : undefined}
            >
              <b className="flex-none pt-[3px] text-[13px] font-bold uppercase tracking-[0.06em] tabular-nums sm:w-28" style={{ color: SALMON_ON_DARK }}>{step.time}</b>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[16.5px] font-semibold text-white" style={{ fontWeight: 700 }}>{step.title}</p>
                {step.description != null && (
                  <p className="whitespace-pre-line text-[15px] leading-[1.55]" style={{ color: ON_DARK_SOFT }}>
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3.5 text-[13.5px] leading-relaxed" style={mutedStyle}>{SAMPLE_PLAN_NOTE}</p>
    </OfferSection>
  )
}
