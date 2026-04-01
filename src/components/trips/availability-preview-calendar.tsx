'use client'

/**
 * AvailabilityPreviewCalendar — shown in the trip page main content.
 *
 * • classic / both:   read-only availability preview with green dots
 * • icelandic:        interactive MultiPeriodPicker (range picker)
 *
 * Both widgets sync via INQUIRY_PERIOD_EVENT so the right-panel BookingWidget
 * stays in sync with selections made here.
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AvailConfigRow } from './booking-widget'
import {
  MultiPeriodPicker,
  type Period,
  INQUIRY_PERIOD_EVENT,
  type InquiryPeriodEventDetail,
  encodePeriodsParam,
} from './multi-period-picker'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockedRange  = { date_start: string; date_end: string }

type Props = {
  expId:                string
  availabilityConfig:   AvailConfigRow | null
  blockedDates:         BlockedRange[]
  /** @deprecated booking-based blocks are now in blockedDates via experience_blocked_dates */
  bookedDates?:         string[]
  bookingType:          'classic' | 'icelandic' | 'both'
}

type PreviewStatus = 'available' | 'blocked' | 'booked' | 'unavailable' | 'past'

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getPreviewStatus(
  y: number, m: number, d: number,
  config:   AvailConfigRow | null,
  blocked:  BlockedRange[],
  booked:   Set<string>,
  todayISO: string,
  maxISO:   string,
): PreviewStatus {
  const iso = toISO(y, m, d)

  if (iso < todayISO) return 'past'
  if (iso > maxISO)   return 'unavailable'

  // Guide-blocked ranges
  for (const r of blocked) {
    if (iso >= r.date_start && iso <= r.date_end) return 'blocked'
  }

  // Already booked
  if (booked.has(iso)) return 'booked'

  // Availability config gates
  if (config) {
    const month1 = m + 1
    if (config.available_months.length > 0 && !config.available_months.includes(month1))
      return 'unavailable'
    const weekday = new Date(y, m, d).getDay()
    if (config.available_weekdays.length > 0 && !config.available_weekdays.includes(weekday))
      return 'unavailable'
  }

  return 'available'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AvailabilityPreviewCalendar({
  expId,
  availabilityConfig,
  blockedDates,
  bookedDates,
  bookingType,
}: Props) {
  const now      = new Date()
  const todayY   = now.getFullYear()
  const todayM   = now.getMonth()
  const todayISO = toISO(todayY, todayM, now.getDate())

  const advHours = availabilityConfig?.advance_notice_hours ?? 0
  const minDate  = new Date(now.getTime() + advHours * 3_600_000)
  const minISO   = toISO(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())

  const maxDays  = availabilityConfig?.max_advance_days ?? 180
  const maxDate  = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const maxISO   = toISO(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())

  const [viewY, setViewY] = useState(todayY)
  const [viewM, setViewM] = useState(todayM)

  // ── Icelandic: interactive period picker state ──────────────────────────────
  const [inquiryPeriods, setInquiryPeriods] = useState<Period[]>([])

  // Sync with BookingWidget via custom event
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<InquiryPeriodEventDetail>).detail
      if (detail.source !== 'preview') setInquiryPeriods(detail.periods)
    }
    window.addEventListener(INQUIRY_PERIOD_EVENT, handler)
    return () => window.removeEventListener(INQUIRY_PERIOD_EVENT, handler)
  }, [])

  function handleInquiryPeriodsChange(periods: Period[]) {
    setInquiryPeriods(periods)
    window.dispatchEvent(
      new CustomEvent<InquiryPeriodEventDetail>(INQUIRY_PERIOD_EVENT, {
        detail: { periods, source: 'preview' },
      }),
    )
  }

  const bookedSet   = useMemo(() => new Set(bookedDates), [bookedDates])
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) }
    else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) }
    else setViewM(m => m + 1)
  }

  const canPrev = viewY > todayY || (viewY === todayY && viewM > todayM)
  const canNext = (() => {
    const ny = viewM === 11 ? viewY + 1 : viewY
    const nm = viewM === 11 ? 0 : viewM + 1
    return toISO(ny, nm, 1) <= maxISO
  })()

  // Count available days this month for the sub-heading
  const availableCount = useMemo(() => {
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const s = getPreviewStatus(viewY, viewM, d, availabilityConfig, blockedDates, bookedSet, minISO, maxISO)
      if (s === 'available') count++
    }
    return count
  }, [viewY, viewM, daysInMonth, availabilityConfig, blockedDates, bookedSet, minISO, maxISO])

  // 'classic' and 'both' both route to the direct-booking page.
  // 'icelandic' routes to the inquiry form.
  const inquireHref = bookingType === 'icelandic'
    ? `/trips/${expId}/inquire`
    : `/book/${expId}`

  const ctaLabel = bookingType === 'icelandic'
    ? 'Choose your dates →'
    : 'Book now →'

  // Icelandic CTA href — include selected periods in the URL when picked
  const icelandicInquireHref = inquiryPeriods.length > 0
    ? `/trips/${expId}/inquire?periods=${encodePeriodsParam(inquiryPeriods)}`
    : `/trips/${expId}/inquire`

  return (
    <section className="mb-12">
      {/* Section rule */}
      <div className="w-10 h-px" style={{ background: '#E67E50' }} />

      <p
        className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
        style={{ color: '#E67E50' }}
      >
        {bookingType === 'icelandic' ? 'Select dates' : 'Availability'}
      </p>

      {/* Heading row */}
      <div className="flex items-end justify-between mb-6 gap-4">
        <h2 className="text-[#0A2E4D] text-2xl font-bold f-display">
          {bookingType === 'icelandic' ? 'Pick your travel period' : 'When can you go?'}
        </h2>
        {bookingType !== 'icelandic' && availableCount > 0 && (
          <span className="text-xs f-body flex-shrink-0 mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {availableCount} day{availableCount === 1 ? '' : 's'} open this month
          </span>
        )}
      </div>

      {/* Calendar card */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background:  '#FDFAF7',
          border:      '1px solid rgba(10,46,77,0.08)',
          boxShadow:   '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        <div className="p-5 sm:p-6">

          {bookingType === 'icelandic' ? (
            /* ── Icelandic: interactive period/range picker ─────────────── */
            <MultiPeriodPicker
              periods={inquiryPeriods}
              onChange={handleInquiryPeriodsChange}
              availabilityConfig={availabilityConfig}
              blockedDates={blockedDates}
            />
          ) : (
            /* ── Classic / both: read-only availability preview ─────────── */
            <>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canPrev}
                  aria-label="Previous month"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                >
                  <ChevronLeft size={6} strokeWidth={1.8} style={{ color: '#0A2E4D' }} />
                </button>

                <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                  {MONTH_NAMES[viewM]} {viewY}
                </p>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext}
                  aria-label="Next month"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                >
                  <ChevronRight size={6} strokeWidth={1.8} style={{ color: '#0A2E4D' }} />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAY_LABELS.map(wl => (
                  <p
                    key={wl}
                    className="text-center text-[9px] font-bold f-body tracking-wide uppercase"
                    style={{ color: 'rgba(10,46,77,0.28)' }}
                  >
                    {wl}
                  </p>
                ))}
              </div>

              {/* Day grid — read-only */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: startPad }).map((_, i) => (
                  <div key={`pad${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d      = i + 1
                  const iso    = toISO(viewY, viewM, d)
                  const status = getPreviewStatus(viewY, viewM, d, availabilityConfig, blockedDates, bookedSet, minISO, maxISO)
                  const isToday = iso === todayISO

                  let bg       = 'transparent'
                  let color    = '#0A2E4D'
                  let opacity  = 1
                  let textDeco = 'none'
                  let dotColor: string | null = null
                  let titleTxt = ''

                  switch (status) {
                    case 'past':
                      color = 'rgba(10,46,77,0.2)'; opacity = 0.4
                      break
                    case 'unavailable':
                      color = 'rgba(10,46,77,0.2)'; opacity = 0.35
                      break
                    case 'blocked':
                      bg       = 'rgba(239,68,68,0.07)'
                      color    = 'rgba(239,68,68,0.45)'
                      textDeco = 'line-through'
                      titleTxt = 'Guide is closed on this date'
                      break
                    case 'booked':
                      bg       = 'rgba(10,46,77,0.04)'
                      color    = 'rgba(10,46,77,0.2)'
                      textDeco = 'line-through'
                      titleTxt = 'Already booked'
                      break
                    case 'available':
                      color    = '#0A2E4D'
                      dotColor = '#059669'
                      if (isToday) bg = 'rgba(10,46,77,0.05)'
                      break
                  }

                  return (
                    <div key={d} className="flex flex-col items-center py-px">
                      <div
                        className="w-8 h-8 rounded-full flex flex-col items-center justify-center relative"
                        style={{ background: bg }}
                        title={titleTxt || undefined}
                      >
                        <span
                          className="text-[12px] f-body leading-none"
                          style={{
                            color,
                            opacity,
                            fontWeight: isToday ? 700 : status === 'available' ? 500 : 400,
                            textDecoration: textDeco,
                          }}
                        >
                          {d}
                        </span>

                        {isToday && status === 'available' && (
                          <span
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{ border: '1.5px solid rgba(10,46,77,0.18)' }}
                          />
                        )}

                        {dotColor != null && (
                          <span
                            className="absolute rounded-full"
                            style={{
                              width: 3, height: 3,
                              background: dotColor,
                              bottom: 3,
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                {(([
                  { color: '#059669',               label: 'Available'    },
                  { color: 'rgba(239,68,68,0.4)',   label: 'Closed',        strike: true  },
                  { color: 'rgba(10,46,77,0.18)',   label: 'Booked',        strike: true  },
                  { color: 'rgba(10,46,77,0.18)',   label: 'Not available'                },
                ]) as { color: string; label: string; strike?: true }[]).map(({ color, label, strike }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span
                      className={`text-[10px] f-body ${strike ? 'line-through' : ''}`}
                      style={{ color: 'rgba(10,46,77,0.4)' }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CTA footer banner */}
        <div
          className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4"
          style={{
            background:  'rgba(10,46,77,0.025)',
            borderTop:   '1px solid rgba(10,46,77,0.07)',
          }}
        >
          {bookingType === 'icelandic' ? (
            <>
              <p className="text-xs leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                {inquiryPeriods.length > 0
                  ? 'Dates selected — send your request and the guide will confirm'
                  : 'Pick dates above, then send your inquiry — no payment until confirmed'}
              </p>
              <Link
                href={icelandicInquireHref}
                className="flex-shrink-0 text-xs font-bold uppercase tracking-[0.12em] px-4 py-2 rounded-full f-body transition-opacity hover:opacity-85 active:scale-[0.97]"
                style={{ background: '#0A2E4D', color: 'white' }}
              >
                {inquiryPeriods.length > 0 ? 'Request trip →' : 'Send inquiry →'}
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Preview only — pick your exact dates in the next step
              </p>
              <Link
                href={inquireHref}
                className="flex-shrink-0 text-xs font-bold uppercase tracking-[0.12em] px-4 py-2 rounded-full f-body transition-opacity hover:opacity-85 active:scale-[0.97]"
                style={{ background: '#E67E50', color: 'white' }}
              >
                {ctaLabel}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
