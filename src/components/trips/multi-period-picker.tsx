'use client'

/**
 * MultiPeriodPicker — shared calendar component used in both:
 *   • Icelandic inquiry form  (/trips/[id]/inquire)
 *   • Classic booking step 1  (/book/[expId])
 *
 * Lets the angler pick:
 *   • Single days     — click any available date  (mode: 'single')
 *   • Date ranges     — click start then end      (mode: 'range')
 *   • Multiple periods of either kind
 *
 * Guide's blocked dates are rendered with strikethrough and are NOT clickable.
 * Past and off-season dates are greyed out and NOT clickable.
 */

import type { AvailConfigRow } from '@/components/trips/booking-widget'

// ─── Types ─────────────────────────────────────────────────────────────────────

// Re-export shared utilities so existing client imports keep working.
export type { Period } from '@/lib/periods'
export { encodePeriodsParam, decodePeriodsParam, periodTotalDays } from '@/lib/periods'
import type { Period } from '@/lib/periods'
import { periodTotalDays } from '@/lib/periods'

/** Blocked date range from guide's calendar. */
export type BlockedRange = { date_start: string; date_end: string }

type DayState =
  | 'unavailable'     // past, off-season, or too far ahead
  | 'blocked'         // guide blocked — visible but NOT clickable
  | 'available'       // open to pick
  | 'selected_single' // single day picked
  | 'selected_start'  // first day of a range
  | 'selected_end'    // last day of a range
  | 'in_range'        // inside a selected range
  | 'pending_start'   // first click in range mode (waiting for end)
  | 'pending_range'   // hover preview inside a pending range

// ─── Shared event for syncing period pickers across components ─────────────────

/** Fired by both AvailabilityPreviewCalendar and BookingWidget when periods change. */
export const INQUIRY_PERIOD_EVENT = 'fa:inquiry-periods'

export type InquiryPeriodEventDetail = {
  periods: Period[]
  /** 'preview' = main content calendar, 'widget' = right panel BookingWidget */
  source: 'preview' | 'widget'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmtPeriod(p: Period): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`
}

/** Expand all periods to a flat sorted array of individual ISO date strings. */
export function expandPeriods(periods: Period[]): string[] {
  const dates: string[] = []
  for (const { from, to } of periods) {
    const cur = new Date(from + 'T00:00:00')
    const end = new Date(to   + 'T00:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
  }
  return dates.sort()
}

// ─── Component ─────────────────────────────────────────────────────────────────

import { useState } from 'react'

export function MultiPeriodPicker({
  periods,
  onChange,
  availabilityConfig,
  blockedDates = [],
  disabled = false,
}: {
  periods:             Period[]
  onChange:            (p: Period[]) => void
  availabilityConfig?: AvailConfigRow | null
  blockedDates?:       BlockedRange[]
  disabled?:           boolean
}) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const advHours = availabilityConfig?.advance_notice_hours ?? 0
  const minDate  = new Date(now.getTime() + advHours * 3_600_000)
  const minISO   = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`

  const maxDays  = availabilityConfig?.max_advance_days ?? 365
  const maxDate  = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const maxISO   = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`

  const [pickMode,    setPickMode]    = useState<'single' | 'range'>('range')
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [hovered,     setHovered]     = useState<string | null>(null)
  const [viewY,       setViewY]       = useState(now.getFullYear())
  const [viewM,       setViewM]       = useState(now.getMonth())

  function switchMode(mode: 'single' | 'range') {
    setPickMode(mode)
    setPendingFrom(null)
    setHovered(null)
  }

  function getDayState(iso: string): DayState {
    for (const p of periods) {
      if (p.from === iso && p.to === iso) return 'selected_single'
      if (p.from === iso)                 return 'selected_start'
      if (p.to   === iso)                 return 'selected_end'
      if (iso > p.from && iso < p.to)     return 'in_range'
    }

    if (pendingFrom != null) {
      if (iso === pendingFrom) return 'pending_start'
      if (hovered != null) {
        const lo = pendingFrom <= hovered ? pendingFrom : hovered
        const hi = pendingFrom <= hovered ? hovered : pendingFrom
        if (iso > lo && iso < hi) return 'pending_range'
      }
    }

    if (iso < minISO || iso > maxISO) return 'unavailable'

    for (const r of blockedDates) {
      if (iso >= r.date_start && iso <= r.date_end) return 'blocked'
    }

    if (availabilityConfig) {
      const [, mStr] = iso.split('-')
      const month1   = parseInt(mStr, 10)
      if (availabilityConfig.available_months.length > 0 &&
          !availabilityConfig.available_months.includes(month1))
        return 'unavailable'
      const wd = new Date(iso + 'T00:00:00').getDay()
      if (availabilityConfig.available_weekdays.length > 0 &&
          !availabilityConfig.available_weekdays.includes(wd))
        return 'unavailable'
    }

    return 'available'
  }

  function handleDayClick(iso: string) {
    if (disabled) return
    const state = getDayState(iso)

    if (state === 'unavailable' || state === 'blocked') return

    if (state === 'pending_start') {
      setPendingFrom(null); setHovered(null); return
    }

    if (
      state === 'selected_single' ||
      state === 'selected_start'  ||
      state === 'selected_end'    ||
      state === 'in_range'
    ) {
      onChange(periods.filter(p => !(iso >= p.from && iso <= p.to)))
      return
    }

    if (pickMode === 'single') {
      const already = periods.findIndex(p => p.from === iso && p.to === iso)
      if (already >= 0) {
        onChange(periods.filter((_, i) => i !== already))
      } else {
        onChange([...periods, { from: iso, to: iso }].sort((a, b) => a.from.localeCompare(b.from)))
      }
      return
    }

    // Range mode
    if (pendingFrom == null) {
      setPendingFrom(iso)
    } else {
      const from = pendingFrom <= iso ? pendingFrom : iso
      const to   = pendingFrom <= iso ? iso : pendingFrom
      onChange([...periods, { from, to }].sort((a, b) => a.from.localeCompare(b.from)))
      setPendingFrom(null); setHovered(null)
    }
  }

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7
  const monthLabel  = new Date(viewY, viewM, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) } else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) } else setViewM(m => m + 1)
  }

  const canPrev = viewY > now.getFullYear() || (viewY === now.getFullYear() && viewM > now.getMonth())
  const canNext = (() => {
    const ny = viewM === 11 ? viewY + 1 : viewY
    const nm = viewM === 11 ? 0 : viewM + 1
    return `${ny}-${String(nm + 1).padStart(2, '0')}-01` <= maxISO
  })()

  const totalDays = periodTotalDays(periods)

  return (
    <div>
      {/* ── Mode toggle ─────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-3">
        {([
          { mode: 'single' as const, label: 'Individual days' },
          { mode: 'range'  as const, label: 'Date range'      },
        ]).map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => switchMode(mode)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
            style={
              pickMode === mode
                ? { background: '#0A2E4D', color: 'white',                  border: '1.5px solid #0A2E4D' }
                : { background: 'transparent', color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.15)' }
            }
          >
            {mode === 'single'
              ? <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" /><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" /></svg>
              : <svg width="14" height="9"  viewBox="0 0 14 9"  fill="none"><rect x="1" y="1" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><rect x="8" y="1" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><line x1="6" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            }
            {label}
          </button>
        ))}
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(10,46,77,0.025)', borderRadius: '16px', padding: '14px 16px 16px', border: '1px solid rgba(10,46,77,0.07)' }}>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button" onClick={goPrev} disabled={!canPrev || disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: (!canPrev || disabled) ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canPrev ? 1 : 0.3 }}
          >‹</button>

          <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{monthLabel}</span>

          <button
            type="button" onClick={goNext} disabled={!canNext || disabled}
            style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(10,46,77,0.07)', border: 'none', cursor: (!canNext || disabled) ? 'not-allowed' : 'pointer', color: '#0A2E4D', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNext ? 1 : 0.3 }}
          >›</button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
            <div key={d} className="text-center py-1"
              style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(10,46,77,0.28)', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)', letterSpacing: '0.04em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d       = i + 1
            const iso     = `${viewY}-${String(viewM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const state   = getDayState(iso)
            const isToday = iso === todayISO
            const clickable = state !== 'unavailable' && state !== 'blocked'

            let bg       = 'transparent'
            let color    = '#0A2E4D'
            let fw       = isToday ? 700 : 400
            let border   = isToday ? '1.5px solid rgba(10,46,77,0.2)' : 'none'
            let opacity  = 1
            let textDeco = 'none'
            let titleTxt = ''

            switch (state) {
              case 'selected_single':
              case 'selected_start':
              case 'selected_end':
                bg = '#E67E50'; color = 'white'; fw = 700; border = 'none'; break
              case 'in_range':
                bg = 'rgba(230,126,80,0.15)'; color = '#8B3800'; fw = 500; border = 'none'; break
              case 'pending_start':
                bg = '#0A2E4D'; color = 'white'; fw = 700; border = 'none'; break
              case 'pending_range':
                bg = 'rgba(10,46,77,0.09)'; color = '#0A2E4D'; fw = 500; border = 'none'; break
              case 'blocked':
                bg = 'rgba(239,68,68,0.06)'; color = 'rgba(239,68,68,0.5)'; opacity = 0.85
                textDeco = 'line-through'; border = 'none'
                titleTxt = 'Guide is unavailable on this date'
                break
              case 'unavailable':
                color = 'rgba(10,46,77,0.2)'; opacity = 0.4; border = 'none'; break
            }

            return (
              <button
                key={iso}
                type="button"
                disabled={disabled || !clickable}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => { if (!disabled && pendingFrom != null) setHovered(iso) }}
                onMouseLeave={() => setHovered(null)}
                title={titleTxt || undefined}
                aria-label={iso}
                style={{
                  background:     bg,
                  color,
                  fontWeight:     fw,
                  borderRadius:   '7px',
                  border,
                  cursor:         (!clickable || disabled) ? 'default' : 'pointer',
                  fontSize:       '13px',
                  fontFamily:     'var(--font-dm-sans, DM Sans, sans-serif)',
                  padding:        '7px 0',
                  width:          '100%',
                  textAlign:      'center',
                  lineHeight:     1,
                  transition:     'background 0.1s',
                  opacity,
                  textDecoration: textDeco,
                }}
              >
                {d}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {(([
            { bg: '#E67E50',                     label: 'Selected'      },
            { bg: 'rgba(230,126,80,0.2)',         label: 'In range'      },
            { bg: 'rgba(239,68,68,0.15)',         label: 'Closed',   strike: true },
            { bg: 'rgba(10,46,77,0.15)',          label: 'Not available' },
          ]) as { bg: string; label: string; strike?: true }[]).map(({ bg, label, strike }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: bg }} />
              <span className={`text-[10px] f-body ${strike ? 'line-through' : ''}`}
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contextual hint ──────────────────────────────────────────── */}
      {pendingFrom != null ? (
        <p className="text-[11px] f-body mt-2 font-medium" style={{ color: '#E67E50' }}>
          {new Date(pendingFrom + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} selected — now click your end date
        </p>
      ) : (
        <p className="text-[11px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {pickMode === 'single'
            ? 'Click any open day. Click again to remove. Add as many separate days as you like.'
            : periods.length > 0
              ? 'Click to add another range, or remove periods below.'
              : 'Click your start date, then click your end date.'}
        </p>
      )}

      {/* ── Selected period chips ────────────────────────────────────── */}
      {periods.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest f-body mb-2"
             style={{ color: 'rgba(10,46,77,0.35)' }}>
            {periods.length} period{periods.length === 1 ? '' : 's'} · {totalDays} day{totalDays === 1 ? '' : 's'} total
          </p>
          <div className="flex flex-wrap gap-1.5">
            {periods.map((p, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1.5 rounded-full"
                style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.12)' }}
              >
                {fmtPeriod(p)}
                <button
                  type="button"
                  onClick={() => onChange(periods.filter((_, i) => i !== idx))}
                  disabled={disabled}
                  aria-label={`Remove ${fmtPeriod(p)}`}
                  style={{ lineHeight: 1, fontSize: '14px', color: 'rgba(10,46,77,0.4)', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  ×
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={() => { onChange([]); setPendingFrom(null); setHovered(null) }}
              disabled={disabled}
              className="text-[11px] f-body px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-70"
              style={{ background: 'transparent', color: 'rgba(10,46,77,0.35)', border: '1px solid rgba(10,46,77,0.1)', cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
