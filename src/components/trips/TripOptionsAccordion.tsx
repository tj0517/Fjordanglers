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
import { useEffect, useState } from 'react'
import { MapPin, Check, X as XIcon, ArrowRight } from 'lucide-react'
import type { SpecialAttraction, ContentBlock, SpeciesDetailItem } from '@/actions/experience-pages'
import { SeasonCalendarGrid } from '@/components/trips/SeasonCalendarGrid'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripOption {
  id:                        string
  sort_order:                number
  label:                     string
  price_from:                number
  content_blocks:            ContentBlock[]
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
  selectedIdx:    number
  onSelect:       (idx: number) => void
  speciesDetails?: SpeciesDetailItem[]
}

// ─── Per-option content panel ─────────────────────────────────────────────────

function OptionPanel({ option, speciesDetails = [] }: { option: TripOption; speciesDetails?: SpeciesDetailItem[] }) {
  const filteredSpecies = speciesDetails.filter(s => option.target_species.includes(s.name))

  return (
    <div className="space-y-10 px-6 py-8">

      {/* ── Content blocks ── */}
      {option.content_blocks.length > 0 && option.content_blocks.map((block, i) => (
        <section key={i}>
          {block.headline && (
            <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
              {block.headline}
            </h4>
          )}
          {block.text && (
            <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
              {block.text}
            </p>
          )}
        </section>
      ))}


      {/* ── What you can catch ── */}
      {(option.catches_text || filteredSpecies.length > 0) && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>What you can catch</p>
          {option.catches_text && (
            <p className="text-base sm:text-lg f-body leading-relaxed text-justify mb-8" style={{ color: 'rgba(10,46,77,0.72)' }}>
              {option.catches_text}
            </p>
          )}
          {filteredSpecies.length > 0 && (
            <div className="space-y-10">
              {filteredSpecies.map((fish, idx) => (
                <div key={fish.name}>
                  <div className={`flex flex-col sm:flex-row${idx % 2 === 1 ? '-reverse' : ''} gap-6 items-start`}>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>{fish.name}</h4>
                      {fish.description && (
                        <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                          {fish.description}
                        </p>
                      )}
                    </div>
                    {fish.image_url && (
                      <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[320px] aspect-[4/3]">
                        <Image src={fish.image_url} alt={fish.name} fill className="object-cover" sizes="(min-width: 640px) 320px, 100vw" />
                      </div>
                    )}
                  </div>
                  {fish.season_months.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Season</p>
                      <SeasonCalendarGrid seasonMonths={fish.season_months} peakMonths={fish.peak_months} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
          <ul className="space-y-2">
            {option.what_to_bring.map(item => (
              <li key={item} className="flex items-center gap-2.5 text-base f-body font-medium" style={{ color: '#0A2E4D' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
                {item}
              </li>
            ))}
          </ul>
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

// ─── Popup modal ──────────────────────────────────────────────────────────────

function OptionModal({
  option,
  speciesDetails,
  onClose,
}: {
  option: TripOption
  speciesDetails?: SpeciesDetailItem[]
  onClose: () => void
}) {
  // Lock body scroll & close on Escape
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(4,10,20,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="styled-scroll relative w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto"
        style={{
          background: '#fff',
          borderRadius: '24px',
          boxShadow: '0 -4px 60px rgba(4,10,20,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(10,46,77,0.12)' }} />
        </div>

        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-6 py-4"
          style={{ background: '#fff', borderBottom: '1px solid rgba(10,46,77,0.07)', zIndex: 1 }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] f-body mb-0.5" style={{ color: '#E67E50' }}>
              Trip option
            </p>
            <h3 className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
              {option.label}
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold f-display" style={{ color: '#E67E50', fontSize: '16px' }}>
              from €{option.price_from}
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[rgba(10,46,77,0.06)]"
              style={{ border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D', background: 'none', cursor: 'pointer' }}
              aria-label="Close"
            >
              <XIcon size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content */}
        <OptionPanel option={option} speciesDetails={speciesDetails} />
      </div>
    </div>
  )
}

// ─── Trip option cards + popup ─────────────────────────────────────────────────

export function TripOptionsAccordion({ options, selectedIdx, onSelect, speciesDetails }: TripOptionsAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  if (options.length === 0) return null

  const openOption = openIdx !== null ? options[openIdx] : null

  return (
    <section className="mb-4">
      <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-2 f-body" style={{ color: '#E67E50' }}>
        Trip options
      </p>
      <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Choose the option that fits your group
      </p>

      <div className="space-y-3">
        {options.map((option, idx) => {
          const isSelected = selectedIdx === idx
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => { onSelect(idx); setOpenIdx(idx) }}
              className="w-full flex items-center justify-between px-6 py-4 text-left rounded-2xl transition-all hover:shadow-sm"
              style={{
                border:     isSelected ? '2px solid rgba(230,126,80,0.45)' : '1.5px solid rgba(10,46,77,0.1)',
                background: isSelected ? 'rgba(230,126,80,0.04)' : 'rgba(10,46,77,0.015)',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                  style={{ background: isSelected ? '#E67E50' : 'rgba(10,46,77,0.18)' }}
                />
                <span
                  className="text-base font-bold f-display"
                  style={{ color: isSelected ? '#0A2E4D' : 'rgba(10,46,77,0.7)' }}
                >
                  {option.label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-bold f-display text-sm" style={{ color: '#E67E50' }}>
                  from €{option.price_from}
                </span>
                <ArrowRight size={15} style={{ color: isSelected ? '#E67E50' : 'rgba(10,46,77,0.3)' }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal */}
      {openOption != null && (
        <OptionModal
          option={openOption}
          speciesDetails={speciesDetails}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
  )
}
