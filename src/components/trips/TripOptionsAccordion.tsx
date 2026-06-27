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
import type { SpecialAttraction, ContentBlock, SpeciesDetailItem, Boat } from '@/actions/experience-pages'
import { SeasonCalendarGrid } from '@/components/trips/SeasonCalendarGrid'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripOption {
  id:                        string
  sort_order:                number
  label:                     string
  price_from:                number
  price_type:                string
  content_blocks:            ContentBlock[]
  catches_text:              string | null
  target_species:            string[]
  boats:                     Boat[]
  season_months:             number[]
  peak_months:               number[]
  special_attractions:       SpecialAttraction[]
  meeting_point_name:        string | null
  meeting_point_description: string | null
  location_lat:              number | null
  location_lng:              number | null
  what_to_bring:             string[]
  includes:                  string[]
  excludes:                  string[]
}

function formatPrice(priceFrom: number, priceType: string): string {
  if (priceType === 'request') return 'Price on request'
  if (priceType === 'flat') return `from €${priceFrom} for the group`
  return `from €${priceFrom} / person`
}

interface TripOptionsAccordionProps {
  options:        TripOption[]
  selectedIdx:    number
  onSelect:       (idx: number) => void
  speciesDetails?: SpeciesDetailItem[]
}

// ─── Per-option content panel ─────────────────────────────────────────────────

export function OptionPanel({ option, speciesDetails = [], priceOverride }: { option: TripOption; speciesDetails?: SpeciesDetailItem[]; priceOverride?: string }) {
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
          {block.image_url ? (
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[280px] aspect-[4/3]">
                <Image src={block.image_url} alt={block.headline || `Photo ${i + 1}`} fill className="object-cover" sizes="(min-width: 640px) 280px, 100vw" />
              </div>
              {block.text && (
                <div className="flex-1 min-w-0">
                  <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                    {block.text}
                  </p>
                </div>
              )}
            </div>
          ) : block.text && (
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
              {filteredSpecies.map((fish, idx) => {
                const fishPhotos = fish.image_urls?.length ? fish.image_urls : (fish.image_url ? [fish.image_url] : [])
                return (
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
                    {fishPhotos[0] && (
                      <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[320px] aspect-[4/3]">
                        <Image src={fishPhotos[0]} alt={fish.name} fill className="object-cover" sizes="(min-width: 640px) 320px, 100vw" />
                      </div>
                    )}
                  </div>
                  {fishPhotos.length > 1 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {fishPhotos.slice(1, 4).map((url, pi) => (
                        <div key={pi} className="relative aspect-[4/3] rounded-xl overflow-hidden">
                          <Image src={url} alt={`${fish.name} photo ${pi + 2}`} fill className="object-cover" sizes="(min-width: 640px) 200px, 30vw" />
                        </div>
                      ))}
                    </div>
                  )}
                  {fish.season_months.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>Season</p>
                      <SeasonCalendarGrid seasonMonths={fish.season_months} peakMonths={fish.peak_months} clickable />
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Season ── */}
      {option.season_months.length > 0 && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>Season</p>
          <SeasonCalendarGrid seasonMonths={option.season_months} peakMonths={option.peak_months} clickable />
        </section>
      )}

      {/* ── Boat ── */}
      {option.boats.length > 0 && (
        <section>
          <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>The boat</p>
          <div className="space-y-10">
            {option.boats.map((boat, idx) => (
              <div key={idx}>
                {boat.heading && (
                  <h4 className="text-xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>{boat.heading}</h4>
                )}
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  {boat.description && (
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg f-body leading-relaxed text-justify" style={{ color: 'rgba(10,46,77,0.72)' }}>
                        {boat.description}
                      </p>
                    </div>
                  )}
                  {boat.image_url && (
                    <div className="relative rounded-2xl overflow-hidden flex-shrink-0 w-full sm:w-[320px] aspect-[4/3]">
                      <Image src={boat.image_url} alt={boat.heading || `Boat ${idx + 1}`} fill className="object-cover" sizes="(min-width: 640px) 320px, 100vw" />
                    </div>
                  )}
                </div>
              </div>
            ))}
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
            {priceOverride ?? formatPrice(option.price_from, option.price_type)}
          </p>
          {option.price_type !== 'request' && (
            <p className="text-sm f-body mt-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
              {option.price_type === 'flat' ? 'Flat rate for the group · includes guide service' : 'Per person · includes guide service'}
            </p>
          )}
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
              {formatPrice(option.price_from, option.price_type)}
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
            <div
              key={option.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                border:     isSelected ? '2px solid #E67E50' : '1.5px solid rgba(10,46,77,0.12)',
                background: isSelected ? 'rgba(230,126,80,0.06)' : '#fff',
                boxShadow:  isSelected ? '0 2px 14px rgba(230,126,80,0.18)' : '0 1px 4px rgba(10,46,77,0.05)',
              }}
            >
              {/* ── Select row ── */}
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                style={{ cursor: 'pointer', background: 'transparent' }}
              >
                {/* Radio indicator */}
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                  style={{
                    border:     isSelected ? 'none' : '2px solid rgba(10,46,77,0.22)',
                    background: isSelected ? '#E67E50' : 'transparent',
                    boxShadow:  isSelected ? '0 0 0 3px rgba(230,126,80,0.18)' : 'none',
                  }}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full" style={{ background: '#fff' }} />
                  )}
                </div>

                {/* Label */}
                <span
                  className="flex-1 text-base font-bold f-display"
                  style={{ color: isSelected ? '#0A2E4D' : 'rgba(10,46,77,0.65)' }}
                >
                  {option.label}
                </span>

                {/* Price */}
                <span className="font-bold f-display text-sm flex-shrink-0" style={{ color: '#E67E50' }}>
                  {formatPrice(option.price_from, option.price_type)}
                </span>
              </button>

              {/* ── Details link ── */}
              <div
                className="px-5 pb-3.5"
                style={{ borderTop: '1px solid rgba(10,46,77,0.06)', paddingTop: '10px' }}
              >
                <button
                  type="button"
                  onClick={() => { onSelect(idx); setOpenIdx(idx) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold f-body transition-opacity hover:opacity-70"
                  style={{ color: isSelected ? '#E67E50' : 'rgba(10,46,77,0.38)', cursor: 'pointer', background: 'none' }}
                >
                  View full details
                  <ArrowRight size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>
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
