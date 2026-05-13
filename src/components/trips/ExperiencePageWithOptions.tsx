'use client'

/**
 * ExperiencePageWithOptions
 *
 * Client-side state boundary that wraps the interactive two-column layout
 * for experience pages that have trip options.
 *
 * Manages `selectedOptionIdx` state shared between:
 *   - TripOptionsAccordion (left column) — shows per-option content panels
 *   - InquiryWidget (right column) — reacts to the selected option
 *
 * The server renders all page-level sections (intro, quick fit, about, photos,
 * rod setup, season) and passes them as `children`. This component appends the
 * accordion (client-interactive) and the sticky widget.
 *
 * Usage in /experiences/[slug]/page.tsx (server component):
 *
 *   <ExperiencePageWithOptions
 *     options={options}
 *     speciesLibrary={speciesDetails}
 *     tripId={page.trip_id}
 *     tripTitle={page.experience_name}
 *     maxGuests={maxGuests}
 *     blockedRanges={blockedRanges}
 *   >
 *     {serverRenderedLeftColumnSections}
 *   </ExperiencePageWithOptions>
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TripOptionsAccordion, type TripOption } from '@/components/trips/TripOptionsAccordion'
import { InquiryWidget } from '@/components/inquiry/InquiryWidget'
import type { FaqItem } from '@/actions/experience-pages'

interface ExperiencePageWithOptionsProps {
  options:       TripOption[]
  faq?:          FaqItem[]
  tripId:        string | null
  tripTitle:     string
  maxGuests:     number
  blockedRanges: Array<{ date_start: string; date_end: string }>
  children?:     React.ReactNode
}

export function ExperiencePageWithOptions({
  options,
  faq = [],
  tripId,
  tripTitle,
  maxGuests,
  blockedRanges,
  children,
}: ExperiencePageWithOptionsProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)

  const selectedLabel = options.length > 0
    ? (options[selectedIdx]?.label ?? null)
    : null

  return (
    <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 py-12 lg:py-14">

      {/* ── Left column ── */}
      <div className="flex-1 min-w-0">
        {/* Server-rendered page-level sections (intro, quick fit, about, photos, etc.) */}
        {children}

        {/* Client-side accordion for trip options */}
        <TripOptionsAccordion
          options={options}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="mt-10">
            <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>
              FAQ
            </p>
            <div className="space-y-2">
              {faq.map((item, i) => (
                <details key={i} className="group rounded-2xl overflow-hidden"
                  style={{ border: '1.5px solid rgba(10,46,77,0.08)' }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
                    style={{ background: 'rgba(10,46,77,0.02)', listStyle: 'none' }}>
                    <span className="text-sm font-semibold f-body pr-4" style={{ color: '#0A2E4D' }}>
                      {item.question}
                    </span>
                    <ChevronDown size={15} className="flex-shrink-0 transition-transform group-open:rotate-180"
                      style={{ color: 'rgba(10,46,77,0.4)' }} />
                  </summary>
                  <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                    <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
                      {item.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Right column — sticky widget ── */}
      <div className="hidden lg:block lg:w-[360px] flex-shrink-0">
        <div className="sticky top-28">
          {tripId ? (
            <InquiryWidget
              tripId={tripId}
              tripTitle={tripTitle}
              maxGuests={maxGuests}
              blockedRanges={blockedRanges}
              selectedOptionLabel={selectedLabel}
            />
          ) : (
            /* Fallback card when no trip_id */
            <div className="rounded-3xl overflow-hidden"
              style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(10,46,77,0.3)' }}>
              <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Book this experience
                </p>
                <p className="text-lg font-bold f-display leading-snug text-white">{tripTitle}</p>
                {selectedLabel && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(230,126,80,0.22)', border: '1px solid rgba(230,126,80,0.35)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E67E50' }} />
                    <span className="text-xs font-semibold f-body" style={{ color: '#E67E50' }}>{selectedLabel}</span>
                  </div>
                )}
              </div>
              <div className="px-5 py-5">
                <a
                  href={`mailto:contact@fjordanglers.com?subject=Inquiry: ${encodeURIComponent(tripTitle)}${selectedLabel ? ` — ${encodeURIComponent(selectedLabel)}` : ''}`}
                  className="block w-full py-3.5 text-center rounded-xl text-sm font-bold f-body"
                  style={{ background: '#E67E50', color: '#fff', boxShadow: '0 4px 14px rgba(230,126,80,0.4)' }}
                >
                  Contact FjordAnglers →
                </a>
                <p className="text-center text-[11px] f-body mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Free to enquire · reply within 24h
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
