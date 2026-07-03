'use client'

/**
 * ExperienceTabLayout
 *
 * Sticky viewport-height card with tab nav:
 *   - Tab nav is a static header anchored to the top of the card
 *   - Content area scrolls inside the card (overflow-y: auto, styled scrollbar)
 *   - Switching tabs resets inner scroll to top
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { InquiryWidget } from '@/components/inquiry/InquiryWidget'
import { OptionPanel } from '@/components/trips/TripOptionsAccordion'
import type { TripOption } from '@/components/trips/TripOptionsAccordion'
import type { FaqItem, SpeciesDetailItem } from '@/actions/experience-pages'

const STICKY_TOP = 112 // matches lg:top-28 = 7rem = 112px

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptionTabConfig {
  tabLabel?:      string
  introText?:     string
  priceOverride?: string
}

interface ExperienceTabLayoutProps {
  options:           TripOption[]
  optionConfigs?:    (OptionTabConfig | undefined)[]
  faq?:              FaqItem[]
  speciesDetails?:   SpeciesDetailItem[]
  tripId:            string | null
  experiencePageId?: string
  tripTitle:         string
  maxGuests:         number
  blockedDates?:   string[]
  priceFrom?:        number | null
  priceType?:        string | null
  children?:         React.ReactNode
}

const TAB_HASHES = ['day-trip', 'multi-day']

// ─── Component ────────────────────────────────────────────────────────────────

export function ExperienceTabLayout({
  options,
  optionConfigs = [],
  faq = [],
  speciesDetails = [],
  tripId,
  experiencePageId,
  tripTitle,
  maxGuests,
  blockedDates = [],
  priceFrom,
  priceType,
  children,
}: ExperienceTabLayoutProps) {
  const [activeTab,      setActiveTab]      = useState(0)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const cardRef    = useRef<HTMLDivElement>(null)
  const isStuckRef = useRef(false)

  // Scroll capture: redirect wheel events into inner content when card is pinned.
  useEffect(() => {
    function onScroll() {
      if (!cardRef.current) return
      const top = cardRef.current.getBoundingClientRect().top
      isStuckRef.current = top >= STICKY_TOP - 2 && top <= STICKY_TOP + 2
    }

    function onWheel(e: WheelEvent) {
      if (!isStuckRef.current) return
      const content = contentRef.current
      if (!content) return

      let delta = e.deltaY
      if (e.deltaMode === 1) delta *= 20
      if (e.deltaMode === 2) delta *= content.clientHeight

      const { scrollTop, scrollHeight, clientHeight } = content
      const atTop    = scrollTop <= 0
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1

      if (atTop && delta < 0) return
      if (atBottom && delta > 0) return

      e.preventDefault()
      content.scrollTop += delta
    }

    window.addEventListener('scroll', onScroll,  { passive: true })
    window.addEventListener('wheel',  onWheel,   { passive: false })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel',  onWheel)
    }
  }, [])

  useEffect(() => {
    function readHash(): number {
      const hash = window.location.hash.slice(1)
      if (hash === 'day-trip'  && options.length > 0) return 1
      if (hash === 'multi-day' && options.length > 1) return 2
      return 0
    }
    setActiveTab(readHash())

    function onPopState() {
      setActiveTab(readHash())
      if (contentRef.current) contentRef.current.scrollTop = 0
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length])

  function switchTab(idx: number): void {
    setActiveTab(idx)
    const hash = idx > 0 ? TAB_HASHES[idx - 1] : undefined
    window.history.replaceState(
      null, '',
      hash != null
        ? `${window.location.pathname}#${hash}`
        : window.location.pathname,
    )
    if (contentRef.current) contentRef.current.scrollTop = 0
    setShowScrollHint(true)
  }

  function handleContentScroll() {
    if (!contentRef.current) return
    setShowScrollHint(contentRef.current.scrollTop < 20)
  }

  const tabs = [
    { idx: 0, label: 'Overview' },
    ...options.slice(0, 2).map((opt, i) => ({
      idx:   i + 1,
      label: optionConfigs[i]?.tabLabel ?? opt.label,
    })),
  ]

  const activeOption    = activeTab > 0 ? options[activeTab - 1] : null
  const selectedLabel   = activeOption?.label ?? null
  const activePriceFrom = activeOption
    ? (activeOption.price_type === 'request' ? null : activeOption.price_from)
    : (priceFrom ?? null)
  const activePriceType = activeOption?.price_type ?? priceType ?? null

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 py-4">

      {/* ── Left: sticky card panel ── */}
      <div
        ref={cardRef}
        className="flex-1 min-w-0 rounded-2xl overflow-hidden lg:sticky lg:top-28 lg:flex lg:flex-col lg:h-[calc(100vh_-_128px)] relative"
        style={{
          background: '#FDFAF7',
          border:     '1px solid rgba(10,46,77,0.07)',
          boxShadow:  '0 2px 20px rgba(10,46,77,0.07)',
        }}
      >
        {/* ── Tab nav — static header, never scrolls ── */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 py-3"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}
        >
          <div
            style={{
              overflowX:               'auto',
              scrollbarWidth:          'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}
          >
            <div className="flex">
              <div
                className="inline-flex gap-1 p-1.5 rounded-2xl flex-shrink-0"
                style={{ background: 'rgba(10,46,77,0.07)' }}
              >
                {tabs.map(tab => (
                  <button
                    key={tab.idx}
                    type="button"
                    onClick={() => switchTab(tab.idx)}
                    className="px-4 sm:px-5 py-2 rounded-xl f-body text-sm font-bold whitespace-nowrap transition-all duration-150"
                    style={{
                      background:    activeTab === tab.idx ? '#0A2E4D' : 'transparent',
                      color:         activeTab === tab.idx ? '#fff'    : 'rgba(10,46,77,0.5)',
                      boxShadow:     activeTab === tab.idx ? '0 2px 10px rgba(10,46,77,0.22)' : 'none',
                      border:        'none',
                      cursor:        'pointer',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content — scrolls inside the card ── */}
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          className="lg:flex-1 overflow-y-auto styled-scroll"
        >

          {/* Tab 0 — Overview */}
          {activeTab === 0 && (
            <div className="px-6 sm:px-8 py-8">
              {children}

              {faq.length > 0 && (
                <section className="mt-10">
                  <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-5 f-body" style={{ color: '#E67E50' }}>
                    FAQ
                  </p>
                  <div className="space-y-2">
                    {faq.map((item, i) => (
                      <details
                        key={i}
                        className="group rounded-2xl overflow-hidden"
                        style={{ border: '1.5px solid rgba(10,46,77,0.08)' }}
                      >
                        <summary
                          className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
                          style={{ background: 'rgba(10,46,77,0.02)', listStyle: 'none' }}
                        >
                          <span className="text-sm font-semibold f-body pr-4" style={{ color: '#0A2E4D' }}>
                            {item.question}
                          </span>
                          <ChevronDown
                            size={15}
                            className="flex-shrink-0 transition-transform group-open:rotate-180"
                            style={{ color: 'rgba(10,46,77,0.4)' }}
                          />
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
          )}

          {/* Tabs 1 + 2 — option panels */}
          {activeTab > 0 && options[activeTab - 1] != null && (() => {
            const opt    = options[activeTab - 1]!
            const config = optionConfigs[activeTab - 1]
            return (
              <>
                {config?.introText && (
                  <div className="px-6 sm:px-8 pt-8 pb-0">
                    <p
                      className="text-base sm:text-lg f-body leading-relaxed"
                      style={{ color: 'rgba(10,46,77,0.6)', fontStyle: 'italic' }}
                    >
                      {config.introText}
                    </p>
                  </div>
                )}
                <OptionPanel
                  option={opt}
                  speciesDetails={speciesDetails}
                  priceOverride={config?.priceOverride}
                />
              </>
            )
          })()}

        </div>{/* /content */}

        {/* ── Scroll hint — desktop only, fades out once user scrolls ── */}
        <div
          className="hidden lg:flex pointer-events-none absolute bottom-0 left-0 right-0 items-end justify-center pb-3"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(253,250,247,0.92) 60%)',
            height: '64px',
            transition: 'opacity 0.4s ease',
            opacity: showScrollHint ? 1 : 0,
          }}
        >
          <div className="anim-scroll flex flex-col items-center gap-0.5">
            <ChevronDown size={16} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.35)' }} />
            <ChevronDown size={16} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.18)', marginTop: '-8px' }} />
          </div>
        </div>

      </div>{/* /card panel */}

      {/* ── Right: sticky inquiry widget ── */}
      <div className="hidden lg:block lg:w-[360px] flex-shrink-0">
        <div className="sticky top-28">
          <InquiryWidget
            tripId={tripId ?? undefined}
            experiencePageId={tripId ? undefined : experiencePageId}
            tripTitle={tripTitle}
            maxGuests={maxGuests}
            blockedDates={blockedDates}
            selectedOptionLabel={selectedLabel}
            priceFrom={activePriceFrom}
            priceType={activePriceType}
          />
        </div>
      </div>

    </div>
  )
}
