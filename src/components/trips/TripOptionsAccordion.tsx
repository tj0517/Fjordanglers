'use client'

/**
 * TripOptionsAccordion
 *
 * Renders per-variant trip options as an expandable accordion on the
 * /experiences/[slug] public page.
 *
 * - Each option has its own: catches, species (from shared library), boat,
 *   special attractions, location, what to bring, includes/excludes, price.
 * - Species details (description, image, season) come from the shared
 *   speciesLibrary (experience_pages.species_details). Options only store
 *   target_species[] names, which are used to filter the library — no duplication.
 * - First option is open by default.
 * - onSelect callback notifies parent (ExperiencePageWithOptions) of the
 *   currently open option so the InquiryWidget can react.
 */

import Image from 'next/image'
import { MapPin, Check, X as XIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { FISH_IMG } from '@/lib/fish'
import type { SpeciesDetailItem, SpecialAttraction } from '@/actions/experience-pages'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripOption {
  id:                        string
  sort_order:                number
  label:                     string
  price_from:                number
  catches_text:              string | null
  target_species:            string[]
  boat_description:          string | null
  boat_image_url:            string | null
  special_attractions:       SpecialAttraction[]
  meeting_point_name:        string | null
  meeting_point_description: string | null
  location_lat:              number | null
  location_lng:              number | null
  what_to_bring:             string[]
  includes:                  string[]
  excludes:                  string[]
}

interface TripOptionsAccordionProps {
  options:        TripOption[]
  speciesLibrary: SpeciesDetailItem[]
  selectedIdx:    number
  onSelect:       (idx: number) => void
}

// ─── Season calendar (per-fish) ───────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function SeasonCalendarGrid({ seasonMonths, peakMonths }: { seasonMonths: number[]; peakMonths: number[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {MONTH_SHORT.map((label, i) => {
          const m      = i + 1
          const isPeak = peakMonths.includes(m)
          const isOpen = seasonMonths.includes(m)
          let bg: string, textColor: string, dotBg: string, statusText: string
          if (isPeak) {
            bg = '#E67E50'; textColor = '#fff'; dotBg = 'rgba(255,255,255,0.7)'; statusText = 'Peak'
          } else if (isOpen) {
            bg = 'rgba(230,126,80,0.08)'; textColor = 'rgba(10,46,77,0.65)'; dotBg = 'rgba(230,126,80,0.5)'; statusText = 'Open'
          } else {
            bg = 'rgba(10,46,77,0.035)'; textColor = 'rgba(10,46,77,0.2)'; dotBg = 'rgba(10,46,77,0.1)'; statusText = '—'
          }
          return (
            <div key={label} className="flex flex-col items-center justify-between rounded-2xl py-4 px-1"
              style={{ background: bg, minHeight: '88px' }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide f-body" style={{ color: textColor }}>{label}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: dotBg }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] f-body text-center" style={{ color: textColor }}>{statusText}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Per-option content panel ─────────────────────────────────────────────────

function OptionPanel({ option, speciesLibrary }: { option: TripOption; speciesLibrary: SpeciesDetailItem[] }) {
  // Filter species library to only those in this option's target_species
  const optionSpecies = speciesLibrary.filter(s => option.target_species.includes(s.name))
  const simpleFishOnly = option.target_species.length > 0 && optionSpecies.length === 0

  return (
    <div className="space-y-10 px-6 py-8">

      {/* ── What you can catch ── */}
      {(option.target_species.length > 0 || option.catches_text) && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>
            What you can catch
          </p>

          {option.catches_text && (
            <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-8" style={{ color: 'rgba(10,46,77,0.7)' }}>
              {option.catches_text}
            </p>
          )}

          {optionSpecies.length > 0 ? (
            <div className="space-y-12">
              {optionSpecies.map((fish, idx) => {
                const isEven    = idx % 2 === 0
                const fishImg   = fish.image_url || FISH_IMG[fish.name as keyof typeof FISH_IMG] || null
                const hasDetail = fish.description || fishImg
                const hasSeason = fish.season_months.length > 0
                return (
                  <div key={fish.name} className="space-y-6">
                    {hasDetail ? (
                      <div className={`flex flex-col sm:flex-row gap-6 items-start ${isEven ? '' : 'sm:flex-row-reverse'}`}>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{fish.name}</h4>
                          {fish.description && (
                            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                              {fish.description}
                            </p>
                          )}
                        </div>
                        {fishImg && (
                          <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[280px] aspect-[4/3]">
                            <Image src={fishImg} alt={fish.name} fill className="object-cover" sizes="(min-width: 640px) 280px, 100vw" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <h4 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>{fish.name}</h4>
                    )}
                    {hasSeason && (
                      <div style={{ borderLeft: '2px solid rgba(230,126,80,0.25)', paddingLeft: '16px' }}>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold f-body mb-3" style={{ color: '#E67E50' }}>
                          Season for {fish.name}
                        </p>
                        <SeasonCalendarGrid seasonMonths={fish.season_months} peakMonths={fish.peak_months} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : simpleFishOnly ? (
            <div className="flex flex-wrap gap-2">
              {option.target_species.map(s => {
                const img = FISH_IMG[s as keyof typeof FISH_IMG]
                return (
                  <div key={s} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                    {img && (
                      <div className="relative w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden">
                        <Image src={img} alt={s} fill className="object-contain" />
                      </div>
                    )}
                    <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{s}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      )}

      {/* ── Boat ── */}
      {(option.boat_description || option.boat_image_url) && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>The boat</p>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {option.boat_description && (
              <div className="flex-1 min-w-0">
                <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                  {option.boat_description}
                </p>
              </div>
            )}
            {option.boat_image_url && (
              <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[320px] aspect-[4/3]">
                <Image src={option.boat_image_url} alt="The boat" fill className="object-cover" sizes="(min-width: 640px) 320px, 100vw" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Special attractions ── */}
      {option.special_attractions.length > 0 && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>Special attractions</p>
          <div className="space-y-10">
            {option.special_attractions.filter(a => a.text || a.image_url).map((attr, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row-reverse gap-6 items-start">
                {attr.text && (
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                      {attr.text}
                    </p>
                  </div>
                )}
                {attr.image_url && (
                  <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[320px] aspect-[4/3]">
                    <Image src={attr.image_url} alt={`Special attraction ${idx + 1}`} fill className="object-cover" sizes="(min-width: 640px) 320px, 100vw" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Location ── */}
      {(option.meeting_point_name || option.meeting_point_description) && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>Location</p>
          {option.meeting_point_name && (
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={15} strokeWidth={1.5} style={{ color: '#E67E50', flexShrink: 0 }} />
              <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{option.meeting_point_name}</p>
            </div>
          )}
          {option.meeting_point_description && (
            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {option.meeting_point_description}
            </p>
          )}
        </section>
      )}

      {/* ── What to bring ── */}
      {option.what_to_bring.length > 0 && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>What to bring</p>
          <div className="flex flex-wrap gap-2">
            {option.what_to_bring.map(item => (
              <span key={item} className="text-xs font-semibold px-3 py-1.5 rounded-full f-body"
                style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}>
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── What's included ── */}
      {(option.includes.length > 0 || option.excludes.length > 0) && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>{"What's included"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {option.includes.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Included</p>
                <ul className="space-y-2">
                  {option.includes.map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(74,222,128,0.15)' }}>
                        <Check size={10} strokeWidth={2.5} style={{ color: '#16A34A' }} />
                      </div>
                      <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.75)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {option.excludes.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Not included</p>
                <ul className="space-y-2">
                  {option.excludes.map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(239,68,68,0.08)' }}>
                        <XIcon size={10} strokeWidth={2.5} style={{ color: '#DC2626' }} />
                      </div>
                      <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Price ── */}
      <section>
        <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>Price</p>
        <div className="px-6 py-5 rounded-2xl" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <p className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            from €{option.price_from}
          </p>
          <p className="text-sm f-body mt-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Per person · includes guide service
          </p>
        </div>
      </section>

    </div>
  )
}

// ─── Accordion ────────────────────────────────────────────────────────────────

export function TripOptionsAccordion({ options, speciesLibrary, selectedIdx, onSelect }: TripOptionsAccordionProps) {
  if (options.length === 0) return null

  return (
    <section className="mb-4">
      {/* Section header */}
      <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-2 f-body" style={{ color: '#E67E50' }}>
        Trip options
      </p>
      <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Choose the option that fits your group
      </p>

      <div className="space-y-3">
        {options.map((option, idx) => {
          const isOpen = selectedIdx === idx
          return (
            <div
              key={option.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                border:     isOpen ? '2px solid rgba(230,126,80,0.4)' : '1.5px solid rgba(10,46,77,0.1)',
                boxShadow:  isOpen ? '0 4px 24px rgba(230,126,80,0.08)' : 'none',
              }}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
                style={{ background: isOpen ? 'rgba(230,126,80,0.04)' : 'rgba(10,46,77,0.015)' }}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  {/* Orange indicator when selected */}
                  <div className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                    style={{ background: isOpen ? '#E67E50' : 'rgba(10,46,77,0.18)' }} />

                  <div>
                    <span className="text-base font-bold f-display"
                      style={{ color: isOpen ? '#0A2E4D' : 'rgba(10,46,77,0.7)' }}>
                      {option.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-bold f-display text-sm" style={{ color: '#E67E50' }}>
                    from €{option.price_from}
                  </span>
                  {isOpen
                    ? <ChevronUp size={16} style={{ color: '#E67E50' }} />
                    : <ChevronDown size={16} style={{ color: 'rgba(10,46,77,0.35)' }} />}
                </div>
              </button>

              {/* Expandable content */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <OptionPanel option={option} speciesLibrary={speciesLibrary} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
