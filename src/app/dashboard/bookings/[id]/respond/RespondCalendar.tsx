'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeeklySchedule = {
  period_from:      string
  period_to:        string
  blocked_weekdays: number[]
}

export type BlockedRange = {
  date_start: string
  date_end:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES    = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function isGuideBlocked(iso: string, schedules: WeeklySchedule[]): boolean {
  const jsDay = new Date(iso + 'T12:00:00').getDay()
  const wd    = jsDay === 0 ? 6 : jsDay - 1
  for (const s of schedules) {
    if (iso >= s.period_from && iso <= s.period_to && s.blocked_weekdays.includes(wd)) return true
  }
  return false
}

export function isExpBlocked(iso: string, ranges: BlockedRange[]): boolean {
  return ranges.some(r => iso >= r.date_start && iso <= r.date_end)
}

export function fmtDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

export function fmtShort(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ─── RespondCalendar ──────────────────────────────────────────────────────────
// calMode='single': guide picks one date
// calMode='range':  guide picks start → end (contiguous range)
// calMode='multi':  guide toggles individual days (non-contiguous ok)

export default function RespondCalendar({
  calMode,
  anglerWindowFrom,
  anglerDates,
  weeklySchedules,
  blockedDates,
  // single / range
  selectedFrom = null,
  selectedTo   = null,
  onChange,
  // multi
  selectedDays  = [],
  onMultiChange,
  disabled,
  rangeLabel,
}: {
  calMode:          'single' | 'range' | 'multi'
  /** First/primary angler date — used for calendar month initialisation */
  anglerWindowFrom: string
  /** All dates the angler selected — highlighted blue on the calendar */
  anglerDates?:     string[]
  weeklySchedules:  WeeklySchedule[]
  blockedDates:     BlockedRange[]
  selectedFrom?:    string | null
  selectedTo?:      string | null
  onChange?:        (from: string | null, to: string | null) => void
  selectedDays?:    string[]
  onMultiChange?:   (days: string[]) => void
  disabled:         boolean
  rangeLabel?:      string
}) {
  const now      = new Date()
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Set of all angler-requested dates for O(1) lookup
  const anglerDatesSet = useMemo(
    () => new Set(anglerDates && anglerDates.length > 0 ? anglerDates : [anglerWindowFrom]),
    [anglerDates, anglerWindowFrom],
  )

  const anglerDate = new Date(anglerWindowFrom + 'T12:00:00')
  const aY = anglerDate.getFullYear()
  const aM = anglerDate.getMonth()
  const afterToday = aY > now.getFullYear() || (aY === now.getFullYear() && aM >= now.getMonth())

  const [viewY,   setViewY]   = useState(afterToday ? aY : now.getFullYear())
  const [viewM,   setViewM]   = useState(afterToday ? aM : now.getMonth())
  const [hovered, setHovered] = useState<string | null>(null)

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7
  const canPrev     = viewY > now.getFullYear() || (viewY === now.getFullYear() && viewM > now.getMonth())

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) } else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) } else setViewM(m => m + 1)
  }

  function handleDayClick(iso: string) {
    if (disabled || iso < todayISO || isExpBlocked(iso, blockedDates)) return
    if (calMode === 'multi') {
      const next = selectedDays.includes(iso)
        ? selectedDays.filter(d => d !== iso)
        : [...selectedDays, iso].sort()
      onMultiChange?.(next)
    } else if (calMode === 'single') {
      onChange?.(iso === selectedFrom ? null : iso, null)
    } else {
      // range
      if (selectedFrom === null) {
        onChange?.(iso, null)
      } else if (selectedTo === null) {
        const [s, e] = iso < selectedFrom ? [iso, selectedFrom] : [selectedFrom, iso]
        onChange?.(s, e)
      } else {
        onChange?.(iso, null)
      }
    }
  }

  function handleClear() {
    if (calMode === 'multi') onMultiChange?.([])
    else onChange?.(null, null)
  }

  const selectedSummary = useMemo(() => {
    if (calMode === 'multi') {
      if (selectedDays.length === 0) return null
      if (selectedDays.length === 1) return fmtDate(selectedDays[0])
      if (selectedDays.length <= 3) return selectedDays.map(d => fmtShort(d)).join(', ')
      return `${selectedDays.length} days selected`
    }
    if (selectedFrom == null) return null
    if (calMode === 'single') return fmtDate(selectedFrom)
    if (selectedTo == null) return `${fmtDate(selectedFrom)} → pick end…`
    return selectedFrom === selectedTo ? fmtDate(selectedFrom) : `${fmtDate(selectedFrom)} – ${fmtDate(selectedTo)}`
  }, [calMode, selectedFrom, selectedTo, selectedDays])

  const legendOrangeLabel =
    calMode === 'single' ? 'Confirmed date' :
    calMode === 'multi'  ? (rangeLabel ?? 'Selected days') :
    (rangeLabel ?? 'Your available dates')

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: '#FDFAF7', border: '1.5px solid rgba(10,46,77,0.12)' }}>
      <div className="px-4 pt-4 pb-3">

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={goPrev} disabled={!canPrev || disabled}
            aria-label="Previous month"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}>
            <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
              <path d="M4 1L1 4.5 4 8" stroke="#0A2E4D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            {MONTH_NAMES[viewM]} {viewY}
          </span>
          <button type="button" onClick={goNext} disabled={disabled}
            aria-label="Next month"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}>
            <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
              <path d="M1 1L4 4.5 1 8" stroke="#0A2E4D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map(wl => (
            <p key={wl} className="text-center text-[9px] font-bold f-body tracking-wide uppercase"
               style={{ color: 'rgba(10,46,77,0.28)' }}>{wl}</p>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d   = i + 1
            const iso = toISO(viewY, viewM, d)

            const isPast    = iso < todayISO
            const isAngWin  = anglerDatesSet.has(iso)
            const isGBlk    = !isPast && isGuideBlocked(iso, weeklySchedules)
            const isEBlk    = !isPast && isExpBlocked(iso, blockedDates)
            const isToday   = iso === todayISO
            const clickable = !isPast && !isEBlk

            // ── Multi mode ────────────────────────────────────────────────────
            if (calMode === 'multi') {
              const isSel = selectedDays.includes(iso)
              return (
                <div key={d} className="h-9 flex items-center justify-center">
                  <button
                    type="button"
                    disabled={!clickable || disabled}
                    onClick={() => handleDayClick(iso)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: isSel ? '#E67E50'
                        : isToday && !isPast ? 'rgba(10,46,77,0.07)'
                        : isAngWin ? 'rgba(59,130,246,0.22)'
                        : undefined,
                      cursor: (clickable && !disabled) ? 'pointer' : 'default',
                    }}
                    title={
                      isEBlk   ? 'Experience unavailable on this date' :
                      isGBlk   ? 'Your off-day — you can still select' :
                      isAngWin ? "Angler's requested start date" :
                      undefined
                    }
                  >
                    <span className="text-[12px] f-body leading-none select-none" style={{
                      color:          isSel ? 'white' : isPast || isEBlk ? 'rgba(10,46,77,0.18)' : isGBlk ? 'rgba(239,68,68,0.55)' : '#0A2E4D',
                      fontWeight:     isSel ? 700 : isToday || (isAngWin && !isGBlk) ? 700 : 400,
                      textDecoration: isGBlk && !isSel ? 'line-through' : 'none',
                      opacity:        (isPast || isEBlk) && !isSel ? 0.4 : 1,
                    }}>
                      {d}
                    </span>
                  </button>
                </div>
              )
            }

            // ── Single / Range mode ───────────────────────────────────────────
            const effEnd = calMode === 'range'
              ? (selectedTo ?? (selectedFrom != null ? hovered : null))
              : null

            let isSelSingle = false, isSelStart = false, isSelEnd = false
            let isSelBoth   = false, isSelRange = false

            if (calMode === 'single' && selectedFrom === iso) {
              isSelSingle = true
            } else if (calMode === 'range' && selectedFrom != null) {
              const s = effEnd != null && effEnd < selectedFrom ? effEnd : selectedFrom
              const e = effEnd != null && effEnd < selectedFrom ? selectedFrom : (effEnd ?? selectedFrom)
              if      (iso === s && iso === e) isSelBoth  = true
              else if (iso === s)              isSelStart = true
              else if (iso === e)              isSelEnd   = true
              else if (iso > s && iso < e)     isSelRange = true
            }

            const isSelected = isSelSingle || isSelStart || isSelEnd || isSelBoth

            let outerBg = 'transparent'
            if      (isSelRange)                  outerBg = 'rgba(230,126,80,0.1)'
            else if (isSelStart)                  outerBg = 'linear-gradient(to right, transparent 50%, rgba(230,126,80,0.1) 50%)'
            else if (isSelEnd)                    outerBg = 'linear-gradient(to left,  transparent 50%, rgba(230,126,80,0.1) 50%)'
            else if (isAngWin && !isSelected)     outerBg = 'rgba(59,130,246,0.12)'

            let innerBg: string | undefined
            if      (isSelected)          innerBg = '#E67E50'
            else if (isToday && !isPast)  innerBg = 'rgba(10,46,77,0.07)'
            else if (isAngWin)            innerBg = 'rgba(59,130,246,0.22)'

            let textColor  = '#0A2E4D'
            let textWeight = isToday ? 700 : 400
            let textDeco   = 'none'
            let textOpac   = 1

            if (isPast || isEBlk)                   { textColor = 'rgba(10,46,77,0.18)'; textOpac = 0.4 }
            if (isSelected)                          { textColor = 'white'; textWeight = 700 }
            if (isGBlk && !isSelected)               { textColor = 'rgba(239,68,68,0.55)'; textDeco = 'line-through' }
            if (isAngWin && !isSelected && !isGBlk)  textWeight = 700

            return (
              <div key={d} className="h-9 flex items-center justify-center"
                   style={{ background: outerBg }}>
                <button
                  type="button"
                  disabled={!clickable || disabled}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => { if (calMode === 'range' && !disabled) setHovered(iso) }}
                  onMouseLeave={() => { if (calMode === 'range' && !disabled) setHovered(null) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: innerBg, cursor: (clickable && !disabled) ? 'pointer' : 'default' }}
                  title={
                    isEBlk   ? 'Experience unavailable on this date' :
                    isGBlk   ? 'Your off-day — you can still select' :
                    isAngWin ? "Angler's requested start date" :
                    undefined
                  }
                >
                  <span className="text-[12px] f-body leading-none select-none"
                    style={{ color: textColor, fontWeight: textWeight, textDecoration: textDeco, opacity: textOpac }}>
                    {d}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Hints */}
        {calMode === 'range' && selectedFrom != null && selectedTo == null && (
          <p className="text-[10px] f-body text-center mt-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Now click the end date
          </p>
        )}
        {calMode === 'multi' && selectedDays.length === 0 && (
          <p className="text-[10px] f-body text-center mt-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Click days to select — click again to deselect
          </p>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 pt-3"
             style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
          {([
            { color: 'rgba(59,130,246,0.6)', label: "Angler's dates" },
            { color: '#E67E50',              label: legendOrangeLabel },
            { color: 'rgba(239,68,68,0.45)', label: 'Your off-day', strike: true },
            { color: 'rgba(10,46,77,0.18)',  label: 'Unavailable' },
          ] as { color: string; label: string; strike?: true }[]).map(({ color, label, strike }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className={`text-[10px] f-body ${strike === true ? 'line-through' : ''}`}
                    style={{ color: 'rgba(10,46,77,0.4)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection summary footer */}
      {selectedSummary != null && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-2"
             style={{ background: 'rgba(230,126,80,0.06)', borderTop: '1px solid rgba(230,126,80,0.12)' }}>
          <span className="text-xs f-body font-medium truncate" style={{ color: '#0A2E4D' }}>
            {calMode === 'multi' && selectedDays.length > 0
              ? `${selectedDays.length} day${selectedDays.length !== 1 ? 's' : ''} selected`
              : selectedSummary}
          </span>
          <button type="button" onClick={handleClear} disabled={disabled}
            className="text-[10px] f-body flex-shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(10,46,77,0.45)' }}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
