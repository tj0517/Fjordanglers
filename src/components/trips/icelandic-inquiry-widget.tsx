'use client'

/**
 * IcelandicInquiryWidget — right-column enquiry entry for booking_type='icelandic'.
 *
 * Unified calendar — one mode, periods and single days coexist:
 *   - pendingFrom=null + click free date        → starts new selection
 *   - pendingFrom=null + click period start/end → removes that period
 *   - pendingFrom=null + click inner date       → no-op (inner not interactive for removal)
 *   - pendingFrom set  + click same date        → confirms single-day period (if no overlap)
 *   - pendingFrom set  + click other date       → adds range period (if no overlap)
 *   - Overlapping selections are silently blocked; red hover preview signals conflict
 *
 * CTA links to: /trips/[expId]/inquire?periods=from..to,...&guests=N
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Minus } from 'lucide-react'
import { useIcelandicBooking } from '@/contexts/icelandic-context'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = {
  key:  string
  from: string   // YYYY-MM-DD
  to:   string   // YYYY-MM-DD
}

export interface IcelandicInquiryWidgetProps {
  experience: {
    id:         string
    title:      string
    max_guests: number
  }
  /** @deprecated blockedRanges is now provided by IcelandicBookingProvider via context */
  blockedRanges?: Array<{ date_start: string; date_end: string }>
  guideName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  // Use local date components — toISOString() would return UTC which shifts
  // the date backwards in UTC+ timezones.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

export function fmtPeriod(p: Period): string {
  return p.from === p.to
    ? fmtDate(p.from)
    : `${fmtDateShort(p.from)} – ${fmtDate(p.to)}`
}

export function buildBlockedSet(ranges: Array<{ date_start: string; date_end: string }>): Set<string> {
  const set = new Set<string>()
  for (const r of ranges) {
    // Use noon (T12:00:00) so DST transitions and UTC± offsets never shift
    // the date to the previous or next day. Then read back LOCAL components
    // (never toISOString() — that would convert to UTC and shift by offset).
    const end = new Date(r.date_end   + 'T12:00:00')
    let   cur = new Date(r.date_start + 'T12:00:00')
    let safety = 0
    while (cur <= end && safety < 365) {
      set.add(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      )
      cur.setDate(cur.getDate() + 1)
      safety++
    }
  }
  return set
}

function serializePeriods(periods: Period[]): string {
  return periods.map(p => `${p.from}..${p.to}`).join(',')
}

/** True if [aFrom..aTo] and [bFrom..bTo] share at least one day. */
export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo
}

// ─── MonthNav ─────────────────────────────────────────────────────────────────

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function MonthNav({ monthName, onPrev, onNext }: {
  monthName: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button type="button" onClick={onPrev}
        className="w-7 h-7 flex items-center justify-center rounded-lg"
        style={{ color: 'rgba(10,46,77,0.4)' }} aria-label="Previous month">
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</span>
      <button type="button" onClick={onNext}
        className="w-7 h-7 flex items-center justify-center rounded-lg"
        style={{ color: 'rgba(10,46,77,0.4)', transform: 'rotate(180deg)' }} aria-label="Next month">
        <ChevronLeft size={14} />
      </button>
    </div>
  )
}

// ─── UnifiedCalendar ──────────────────────────────────────────────────────────

export interface UnifiedCalendarProps {
  blockedSet:  Set<string>
  periods:     Period[]
  pendingFrom: string | null
  hoverDate:   string | null
  onDayClick:  (iso: string) => void
  onDayHover:  (iso: string | null) => void
  onClearAll:  () => void
}

export function UnifiedCalendar({
  blockedSet, periods, pendingFrom, hoverDate, onDayClick, onDayHover, onClearAll,
}: UnifiedCalendarProps) {
  const today = isoToday()
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthName   = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offset      = (firstDay + 6) % 7   // Mon=0

  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Preview range endpoints while pendingFrom is active and user is hovering
  const [pStart, pEnd] = useMemo((): [string | null, string | null] => {
    if (pendingFrom == null || hoverDate == null) return [null, null]
    return pendingFrom <= hoverDate
      ? [pendingFrom, hoverDate]
      : [hoverDate,   pendingFrom]
  }, [pendingFrom, hoverDate])

  // Does the preview range conflict with any existing period?
  const previewConflict = pStart != null && pEnd != null
    && periods.some(p => rangesOverlap(pStart, pEnd, p.from, p.to))

  // Contextual instruction text
  const instruction = pendingFrom != null
    ? `From ${fmtDateShort(pendingFrom)} — click an end date, or click the same date for a single day`
    : periods.length === 0
      ? 'Click any date to start. Click the same date twice for a single day, or click a second date to add a range.'
      : 'Add more periods, or click the start / end of a period to remove it.'

  return (
    <div>
      {/* ── Instruction banner ── */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl mb-3"
        style={{
          background: pendingFrom != null ? 'rgba(230,126,80,0.10)' : 'rgba(10,46,77,0.05)',
          border: pendingFrom != null ? '1px solid rgba(230,126,80,0.22)' : '1px solid rgba(10,46,77,0.08)',
        }}>
        <span className="text-sm flex-shrink-0 mt-px leading-none">
          {pendingFrom != null ? '📍' : periods.length === 0 ? '💡' : '✏️'}
        </span>
        <p className="text-[11px] f-body leading-snug" style={{ color: pendingFrom != null ? '#C05E33' : 'rgba(10,46,77,0.6)' }}>
          {instruction}
        </p>
      </div>

      <MonthNav monthName={monthName} onPrev={prevMonth} onNext={nextMonth} />

      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold f-body py-0.5"
            style={{ color: 'rgba(10,46,77,0.28)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} />

          const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast     = d < today
          const isBlocked  = blockedSet.has(d)
          const isDisabled = isPast || isBlocked

          // Confirmed period classification
          const isStart = periods.some(p => p.from === d)
          const isEnd   = periods.some(p => p.to   === d)
          const isInner = periods.some(p => d > p.from && d < p.to)
          const isEdge  = isStart || isEnd

          const isPendingFrom = pendingFrom === d

          // Preview classification (only when hovering and not already confirmed)
          const isPreviewEdge = !isEdge && pStart != null && (d === pStart || d === pEnd)
          const isInPreview   = !isEdge && !isInner
            && pStart != null && pEnd != null && d > pStart && d < pEnd

          // ── Styles ─────────────────────────────────────────────────────────
          let bg             = 'rgba(22,163,74,0.13)'   // available green
          let color          = 'rgba(10,46,77,0.75)'
          let fw             = '600'
          let opacity        = 1
          let radius         = '7px'
          let shadow         = 'none'
          let textDecoration = 'none'
          const cursor       = isDisabled ? 'not-allowed' : 'pointer'

          if (isPast)               { bg = 'transparent'; color = '#0A2E4D'; fw = '400'; opacity = 0.22 }
          if (isBlocked && !isPast) {
            bg = 'rgba(10,46,77,0.06)'; color = 'rgba(10,46,77,0.28)'; fw = '400'
            textDecoration = 'line-through'
          }

          // Confirmed inner — soft fill, still readable
          if (isInner) {
            bg = 'rgba(230,126,80,0.14)'; color = '#C05E33'; fw = '500'
          }

          // Confirmed edge — solid rounded square; overlaps inner intentionally
          if (isEdge) {
            bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'
            shadow = '0 2px 8px rgba(230,126,80,0.4)'
          }

          // Preview (hover feedback) — only when not already confirmed
          if (isInPreview) {
            bg    = previewConflict ? 'rgba(239,68,68,0.07)' : 'rgba(230,126,80,0.12)'
            color = previewConflict ? 'rgba(239,68,68,0.55)' : '#E67E50'
            fw    = '500'
          }
          if (isPreviewEdge) {
            bg     = previewConflict ? 'rgba(239,68,68,0.22)' : 'rgba(230,126,80,0.45)'
            color  = previewConflict ? 'rgba(200,30,30,0.9)'  : '#fff'
            fw     = '700'; radius = '8px'
            shadow = previewConflict ? 'none' : '0 2px 6px rgba(230,126,80,0.22)'
          }

          // Pending-from anchor — always solid orange, overrides everything
          if (isPendingFrom) {
            bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'
            shadow = '0 3px 10px rgba(230,126,80,0.38)'
          }

          return (
            <button key={d} type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onDayClick(d)}
              onMouseEnter={() => !isDisabled && onDayHover(d)}
              onMouseLeave={() => onDayHover(null)}
              className={`aspect-square flex items-center justify-center text-[11px] f-body transition-all${isPendingFrom && hoverDate == null ? ' animate-pulse' : ''}`}
              style={{ background: bg, color, fontWeight: fw, opacity, borderRadius: radius, boxShadow: shadow, cursor, textDecoration }}
              aria-label={`${day} ${monthName}${isBlocked ? ' (unavailable)' : ''}${isEdge || isInner ? ' — selected' : ''}`}
              aria-pressed={isEdge || isInner || isPendingFrom}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Footer: clear all (only when something is selected and no pending) */}
      {periods.length > 0 && pendingFrom == null && (
        <div className="flex justify-end mt-2 pt-2"
          style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
          <button type="button" onClick={onClearAll}
            className="text-[10px] f-body font-semibold"
            style={{ color: 'rgba(10,46,77,0.38)' }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

// ─── IcelandicInquiryWidget ───────────────────────────────────────────────────

export function IcelandicInquiryWidget({
  experience,
  guideName,
}: IcelandicInquiryWidgetProps) {
  // ── Shared state from context ──────────────────────────────────────────
  const {
    periods, pendingFrom, hoverDate,
    guests, durationDays, blockedSet, maxGuests: _maxGuests,
    handleDayClick, setHoverDate, setGuests, clearAll,
  } = useIcelandicBooking()

  // ── Calendar popup ─────────────────────────────────────────────────────
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  function closeCalendar() { setCalendarOpen(false) }

  useEffect(() => {
    if (!calendarOpen) return
    function handle(e: MouseEvent) {
      if (!calendarRef.current?.contains(e.target as Node)) closeCalendar()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [calendarOpen])

  // ── Computed ───────────────────────────────────────────────────────────
  const hasSelection = periods.length > 0 || pendingFrom != null
  const canContinue  = periods.length > 0
  const periodsParam = encodeURIComponent(serializePeriods(periods))
  const inquireHref  = `/trips/${experience.id}/inquire?periods=${periodsParam}&guests=${guests}&duration=${durationDays}`

  const dateTriggerLabel = (() => {
    if (pendingFrom != null)  return `From ${fmtDateShort(pendingFrom)} — pick end date`
    if (periods.length === 0) return 'Select availability'
    if (periods.length === 1) return fmtPeriod(periods[0])
    return `${periods.length} periods selected`
  })()

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl overflow-visible" style={card}>

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 f-body"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          Price on request
        </p>
        <p className="text-sm font-semibold f-body" style={{ color: '#FFFFFF' }}>
          Send an enquiry to {guideName}
        </p>
      </div>

      <div className="px-5 pt-4 pb-5">

        {/* ── 1. Availability dropdown ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 f-body"
            style={{ color: 'rgba(255,255,255,0.42)' }}>Availability</p>

          <div ref={calendarRef} style={{ position: 'relative' }}>
            {/* Trigger button */}
            <button
              type="button"
              onClick={() => setCalendarOpen(o => !o)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all f-body"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: calendarOpen
                  ? '1.5px solid #E67E50'
                  : hasSelection
                    ? '1.5px solid rgba(230,126,80,0.5)'
                    : '1.5px solid rgba(255,255,255,0.12)',
                boxShadow: calendarOpen ? '0 0 0 3px rgba(230,126,80,0.15)' : 'none',
              }}
              aria-expanded={calendarOpen}
            >
              <span className="text-sm f-body truncate mr-2"
                style={{
                  color:      hasSelection ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                  fontWeight: hasSelection ? '600' : '400',
                }}>
                {dateTriggerLabel}
              </span>
              <ChevronDown size={14} style={{
                color: 'rgba(255,255,255,0.4)',
                flexShrink: 0,
                transform: calendarOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }} />
            </button>

            {/* Dropdown — white card below trigger */}
            {calendarOpen && (
              <div className="absolute left-0 right-0 z-50 mt-1 p-3 rounded-2xl"
                style={{
                  background: '#fff',
                  border:     '1.5px solid rgba(10,46,77,0.09)',
                  boxShadow:  '0 8px 28px rgba(10,46,77,0.13)',
                }}>
                <UnifiedCalendar
                  blockedSet={blockedSet}
                  periods={periods}
                  pendingFrom={pendingFrom}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                  onClearAll={clearAll}
                />
              </div>
            )}
          </div>
        </div>

        {/* divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />

        {/* ── 2. Anglers stepper ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 f-body"
            style={{ color: 'rgba(255,255,255,0.42)' }}>Anglers</p>
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
            <button type="button"
              onClick={() => setGuests(guests - 1)}
              disabled={guests <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{
                background: guests <= 1 ? 'transparent' : 'rgba(255,255,255,0.1)',
                color:      guests <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
                cursor:     guests <= 1 ? 'not-allowed' : 'pointer',
              }} aria-label="Remove angler">
              <Minus size={13} />
            </button>
            <span className="text-sm font-bold f-body" style={{ color: '#FFFFFF' }}>
              {guests} {guests === 1 ? 'angler' : 'anglers'}
            </span>
            <button type="button"
              onClick={() => setGuests(guests + 1)}
              disabled={guests >= experience.max_guests}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{
                background: guests >= experience.max_guests ? 'transparent' : 'rgba(255,255,255,0.1)',
                color:      guests >= experience.max_guests ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
                cursor:     guests >= experience.max_guests ? 'not-allowed' : 'pointer',
              }} aria-label="Add angler">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />

        {/* ── 3. CTA ── */}
        <div className="rounded-xl p-3.5"
          style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>Price</span>
            <span className="text-sm font-bold f-body" style={{ color: '#E67E50' }}>On request</span>
          </div>

          {canContinue ? (
            <a href={inquireHref}
              className="block w-full py-3 rounded-xl text-sm font-bold text-white f-body text-center transition-all"
              style={{
                background:     '#E67E50',
                boxShadow:      '0 4px 14px rgba(230,126,80,0.35)',
                textDecoration: 'none',
              }}>
              Continue to enquiry →
            </a>
          ) : (
            <div className="w-full py-3 rounded-xl text-sm font-bold text-center f-body"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color:      'rgba(255,255,255,0.28)',
                cursor:     'not-allowed',
              }}>
              Select availability to continue
            </div>
          )}
        </div>

        {/* Trust signals */}
        <div className="space-y-1.5 pt-4">
          {[
            'No payment taken now',
            'Guide responds with a personalised offer',
            'You confirm only after agreeing on details',
          ].map(t => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ background: 'rgba(230,126,80,0.6)' }} />
              <span className="text-[11px] f-body"
                style={{ color: 'rgba(255,255,255,0.35)' }}>{t}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

// ─── IcelandicAvailabilitySection ─────────────────────────────────────────────
// Full-width inline two-month calendar for the left content column on /trips/[id].
// Shows current + next month side by side (responsive: stacked on mobile).
// State is shared via IcelandicBookingContext.

export function IcelandicAvailabilitySection() {
  const today = isoToday()
  const {
    periods, pendingFrom, hoverDate, durationDays,
    handleDayClick, setHoverDate, clearAll, blockedSet, setDurationDays,
  } = useIcelandicBooking()

  // Navigation state — left month; right = left + 1
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  function prevNav() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextNav() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Right (second) month
  const rightMonth = viewMonth === 11 ? 0         : viewMonth + 1
  const rightYear  = viewMonth === 11 ? viewYear + 1 : viewYear

  // Preview range endpoints while dragging selection
  const [pStart, pEnd] = useMemo((): [string | null, string | null] => {
    if (pendingFrom == null || hoverDate == null) return [null, null]
    return pendingFrom <= hoverDate
      ? [pendingFrom, hoverDate]
      : [hoverDate,   pendingFrom]
  }, [pendingFrom, hoverDate])

  const previewConflict = pStart != null && pEnd != null
    && periods.some(p => rangesOverlap(pStart, pEnd, p.from, p.to))

  // Month labels
  const leftMonthName  = new Date(viewYear,  viewMonth,  1).toLocaleDateString('en-GB', { month: 'long' })
  const rightMonthName = new Date(rightYear, rightMonth, 1).toLocaleDateString('en-GB', { month: 'long' })
  const navTitle = viewYear === rightYear
    ? `${leftMonthName} – ${rightMonthName} ${viewYear}`
    : `${leftMonthName} ${viewYear} – ${rightMonthName} ${rightYear}`

  // Renders a single month grid (reuses the same logic as UnifiedCalendar's grid)
  function renderMonthGrid(year: number, month: number) {
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const offset      = (firstDay + 6) % 7
    const cells: Array<number | null> = [
      ...Array<null>(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]

    return (
      <>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((h, i) => (
            <div key={i} className="text-center text-[10px] font-bold f-body py-0.5"
              style={{ color: 'rgba(10,46,77,0.28)' }}>
              {h}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, idx) => {
            if (day == null) return <div key={`e-${idx}`} />

            const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isPast     = d < today
            const isBlocked  = blockedSet.has(d)
            const isDisabled = isPast || isBlocked

            const isStart = periods.some(p => p.from === d)
            const isEnd   = periods.some(p => p.to   === d)
            const isInner = periods.some(p => d > p.from && d < p.to)
            const isEdge  = isStart || isEnd

            const isPendingFrom = pendingFrom === d
            const isPreviewEdge = !isEdge && pStart != null && (d === pStart || d === pEnd)
            const isInPreview   = !isEdge && !isInner
              && pStart != null && pEnd != null && d > pStart && d < pEnd

            let bg = 'rgba(22,163,74,0.13)', color = 'rgba(10,46,77,0.75)', fw = '600'
            let opacity = 1
            let radius = '7px', shadow = 'none', textDecoration = 'none'
            const cursor = isDisabled ? 'not-allowed' : 'pointer'

            if (isPast) { bg = 'transparent'; color = '#0A2E4D'; fw = '400'; opacity = 0.22 }
            if (isBlocked && !isPast) {
              bg = 'rgba(10,46,77,0.06)'; color = 'rgba(10,46,77,0.28)'; fw = '400'
              textDecoration = 'line-through'
            }
            if (isInner)  { bg = 'rgba(230,126,80,0.14)'; color = '#C05E33'; fw = '500' }
            if (isEdge)   { bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'; shadow = '0 2px 8px rgba(230,126,80,0.4)' }
            if (isInPreview) {
              bg    = previewConflict ? 'rgba(239,68,68,0.07)' : 'rgba(230,126,80,0.12)'
              color = previewConflict ? 'rgba(239,68,68,0.55)' : '#E67E50'; fw = '500'
            }
            if (isPreviewEdge) {
              bg    = previewConflict ? 'rgba(239,68,68,0.22)' : 'rgba(230,126,80,0.45)'
              color = previewConflict ? 'rgba(200,30,30,0.9)'  : '#fff'; fw = '700'
              radius = '8px'; shadow = previewConflict ? 'none' : '0 2px 6px rgba(230,126,80,0.22)'
            }
            if (isPendingFrom) {
              bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'
              shadow = '0 3px 10px rgba(230,126,80,0.38)'
            }

            return (
              <button
                key={d}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && handleDayClick(d)}
                onMouseEnter={() => !isDisabled && setHoverDate(d)}
                onMouseLeave={() => setHoverDate(null)}
                className={`aspect-square flex items-center justify-center text-[11px] f-body transition-all${isPendingFrom && hoverDate == null ? ' animate-pulse' : ''}`}
                style={{ background: bg, color, fontWeight: fw, opacity, borderRadius: radius, boxShadow: shadow, cursor, textDecoration }}
                aria-label={`${day} ${leftMonthName}`}
                aria-pressed={isEdge || isInner || isPendingFrom}
              >
                {day}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <section className="mb-12">
      {/* Rule */}
      <div className="h-px mb-4" style={{ background: 'linear-gradient(to right, #E67E50, rgba(230,126,80,0.12))' }} />

      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>
            Availability
          </p>
          <h2 className="text-[#0A2E4D] text-2xl font-bold f-display">
            Select your dates
          </h2>
        </div>
        {periods.length > 0 && (
          <button type="button" onClick={clearAll}
            className="text-xs f-body font-semibold transition-colors pb-0.5"
            style={{ color: '#E67E50' }}
          >
            Clear {periods.length} period{periods.length !== 1 ? 's' : ''} →
          </button>
        )}
      </div>

      <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Click a date to start — click the same date twice for a single day, or a different date for a range.
        Your selection syncs with the enquiry panel.
      </p>

      {/* Always-visible instruction banner — never unmounts so there is no layout shift */}
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-xl mb-4"
        style={{
          background: pendingFrom != null ? 'rgba(230,126,80,0.10)' : 'rgba(10,46,77,0.04)',
          border:     pendingFrom != null ? '1px solid rgba(230,126,80,0.22)' : '1px solid rgba(10,46,77,0.07)',
        }}
      >
        <span className="text-sm flex-shrink-0 mt-px leading-none">
          {pendingFrom != null ? '📍' : '💡'}
        </span>
        <p className="text-[11px] f-body leading-snug"
          style={{ color: pendingFrom != null ? '#C05E33' : 'rgba(10,46,77,0.5)' }}>
          {pendingFrom != null
            ? `From ${fmtDateShort(pendingFrom)} — click an end date, or the same date for a single day`
            : 'Click any date to start. Click the same date twice for a single day, or a second date for a range.'}
        </p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevNav}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }}
          aria-label="Previous months"
        >
          <ChevronLeft size={15} />
        </button>
        <p className="text-sm font-bold f-body text-center" style={{ color: '#0A2E4D' }}>
          {navTitle}
        </p>
        <button
          type="button"
          onClick={nextNav}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }}
          aria-label="Next months"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Two separate month cards — side by side on sm+, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left month */}
        <div className="p-5 rounded-2xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.04)' }}>
          <p className="text-xs font-bold f-body mb-2 text-center" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {leftMonthName} {viewYear}
          </p>
          {renderMonthGrid(viewYear, viewMonth)}
        </div>

        {/* Right month */}
        <div className="p-5 rounded-2xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.04)' }}>
          <p className="text-xs font-bold f-body mb-2 text-center" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {rightMonthName} {rightYear}
          </p>
          {renderMonthGrid(rightYear, rightMonth)}
        </div>
      </div>

      {/* Duration stepper */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-3"
          style={{ color: 'rgba(10,46,77,0.4)' }}>
          How many days are you looking for?
        </p>
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.09)', boxShadow: '0 1px 4px rgba(10,46,77,0.04)' }}>
          <button
            type="button"
            onClick={() => setDurationDays(durationDays - 1)}
            disabled={durationDays <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
            style={{
              background: durationDays <= 1 ? 'transparent' : 'rgba(10,46,77,0.07)',
              color:      durationDays <= 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
              cursor:     durationDays <= 1 ? 'not-allowed' : 'pointer',
            }}
            aria-label="Fewer days"
          >
            <Minus size={15} />
          </button>
          <div className="text-center">
            <span className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
              {durationDays}
            </span>
            <span className="text-sm f-body ml-2" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {durationDays === 1 ? 'day' : 'days'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDurationDays(durationDays + 1)}
            disabled={durationDays >= 30}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
            style={{
              background: durationDays >= 30 ? 'transparent' : 'rgba(10,46,77,0.07)',
              color:      durationDays >= 30 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
              cursor:     durationDays >= 30 ? 'not-allowed' : 'pointer',
            }}
            aria-label="More days"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Clear all footer */}
      {periods.length > 0 && pendingFrom == null && (
        <div className="flex justify-end mt-3">
          <button type="button" onClick={clearAll}
            className="text-[10px] f-body font-semibold"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(22,163,74,0.35)' }} />
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: '#E67E50' }} />
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(10,46,77,0.08)', border: '1px solid rgba(10,46,77,0.1)' }} />
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Unavailable</span>
        </div>
      </div>
    </section>
  )
}

// ─── MobileIcelandicBar ───────────────────────────────────────────────────────

export function MobileIcelandicBar({ experienceId }: { experienceId: string }) {
  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4"
      style={{
        background:     'rgba(10,46,77,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop:      '1px solid rgba(255,255,255,0.08)',
        paddingTop:     '10px',
        paddingBottom:  'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <a
        href={`/trips/${experienceId}/inquire`}
        className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-bold text-white f-body"
        style={{ background: '#E67E50', boxShadow: '0 4px 14px rgba(230,126,80,0.28)' }}
      >
        Request to Book →
      </a>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#0A2E4D',
  border:     '1px solid rgba(255,255,255,0.08)',
  boxShadow:  '0 8px 32px rgba(10,46,77,0.3)',
}
