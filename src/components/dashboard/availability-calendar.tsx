'use client'

import { useState, useTransition, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { setAvailability, setOpenSeason } from '@/actions/availability'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function firstDayOffset(y: number, m: number): number {
  return (new Date(y, m - 1, 1).getDay() + 6) % 7
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}
function todayISO(): string {
  const d = new Date()
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
function datesFromRange(from: string, to: string): string[] {
  const dates: string[] = []
  const end = new Date(to   + 'T12:00:00')
  const cur = new Date(from + 'T12:00:00')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** ISO dates that are BLOCKED (unavailable). Default state = available. */
  initialDates: string[]
}

export function AvailabilityCalendar({ initialDates }: Props) {
  const today = useMemo(todayISO, [])
  const now   = new Date()

  // Calendar state
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [blocked,   setBlocked]   = useState<Set<string>>(() => new Set(initialDates))
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [multiMode, setMultiMode] = useState(false)
  const [pending, start]          = useTransition()
  const [error, setError]         = useState<string | null>(null)

  // Range block form state
  const [rangeFrom,  setRangeFrom]  = useState('')
  const [rangeTo,    setRangeTo]    = useState('')
  const [rangeState, setRangeState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [rangeError, setRangeError] = useState('')

  // ── Month nav ───────────────────────────────────────────────────────────────
  function prevMonth() {
    setSelected(new Set())
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    setSelected(new Set())
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  // ── Single-click toggle ─────────────────────────────────────────────────────
  function handleDayClick(iso: string) {
    if (iso < today) return
    if (multiMode) {
      setSelected(prev => {
        const next = new Set(prev)
        next.has(iso) ? next.delete(iso) : next.add(iso)
        return next
      })
      return
    }
    const wasBlocked = blocked.has(iso)
    const snapshot   = new Set(blocked)
    const next       = new Set(blocked)
    wasBlocked ? next.delete(iso) : next.add(iso)
    setBlocked(next)
    setError(null)
    start(async () => {
      const res = await setAvailability([iso], !wasBlocked)
      if (!res.success) { setBlocked(snapshot); setError(res.error) }
    })
  }

  // ── Bulk apply ──────────────────────────────────────────────────────────────
  function applyBulk(makeBlocked: boolean) {
    const days = Array.from(selected)
    if (days.length === 0) return
    const snapshot = new Set(blocked)
    const next = new Set(blocked)
    if (makeBlocked) days.forEach(d => next.add(d))
    else days.forEach(d => next.delete(d))
    setBlocked(next)
    setSelected(new Set())
    setError(null)
    start(async () => {
      const res = await setAvailability(days, makeBlocked)
      if (!res.success) { setBlocked(snapshot); setError(res.error) }
    })
  }

  // ── Set open season: block everything outside [from, to] ───────────────────
  function openRange() {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return

    setRangeState('loading')
    setRangeError('')
    const snapshot = new Set(blocked)

    // Optimistic update: rebuild blocked set as everything outside the range
    const twoYearsOut = new Date()
    twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2)
    const maxDate = twoYearsOut.toISOString().slice(0, 10)

    function addDays(iso: string, n: number): string {
      const d = new Date(iso + 'T12:00:00')
      d.setDate(d.getDate() + n)
      return d.toISOString().slice(0, 10)
    }

    const next = new Set<string>()
    if (rangeFrom > today) datesFromRange(today, addDays(rangeFrom, -1)).forEach(d => next.add(d))
    if (rangeTo < maxDate)  datesFromRange(addDays(rangeTo, 1), maxDate).forEach(d => next.add(d))
    setBlocked(next)

    start(async () => {
      const res = await setOpenSeason(rangeFrom, rangeTo)
      if (!res.success) {
        setBlocked(snapshot)
        setRangeError(res.error)
        setRangeState('error')
      } else {
        setRangeState('done')
        setTimeout(() => { setRangeState('idle'); setRangeFrom(''); setRangeTo('') }, 2000)
      }
    })
  }

  // ── Calendar cells ──────────────────────────────────────────────────────────
  const numDays = daysInMonth(viewYear, viewMonth)
  const offset  = firstDayOffset(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ]

  const blockedThisMonth = useMemo(() => {
    let n = 0
    for (let d = 1; d <= numDays; d++) {
      const iso = isoDate(viewYear, viewMonth, d)
      if (iso >= today && blocked.has(iso)) n++
    }
    return n
  }, [blocked, viewYear, viewMonth, numDays, today])

  const canOpen = rangeFrom && rangeTo && rangeFrom <= rangeTo

  return (
    <div>

      {/* ── Open season banner ──────────────────────────────────────────────── */}
      <div
        className="mb-6 px-5 py-4 rounded-[18px] flex flex-col sm:flex-row sm:items-center gap-3"
        style={{
          background: '#0A2E4D',
          boxShadow:  '0 2px 12px rgba(10,46,77,0.18)',
        }}
      >
        <div className="flex-shrink-0">
          <p className="text-sm font-bold f-display" style={{ color: '#FFFFFF' }}>
            Open season
          </p>
          <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Mark dates as available
          </p>
        </div>

        <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] font-bold f-body uppercase tracking-[0.1em] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
              From
            </label>
            <input
              type="date"
              value={rangeFrom}
              min={today}
              onChange={e => setRangeFrom(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm f-body outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color:      rangeFrom ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                border:     '1px solid rgba(255,255,255,0.15)',
                colorScheme: 'dark',
              }}
            />
          </div>

          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] font-bold f-body uppercase tracking-[0.1em] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
              To
            </label>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom || today}
              onChange={e => setRangeTo(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm f-body outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color:      rangeTo ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                border:     '1px solid rgba(255,255,255,0.15)',
                colorScheme: 'dark',
              }}
            />
          </div>

          <button
            type="button"
            onClick={openRange}
            disabled={!canOpen || rangeState === 'loading' || rangeState === 'done'}
            className="flex-shrink-0 px-5 py-2 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: rangeState === 'done'
                ? 'rgba(255,255,255,0.12)'
                : canOpen
                ? '#E67E50'
                : 'rgba(255,255,255,0.08)',
              color: rangeState === 'done'
                ? 'rgba(255,255,255,0.5)'
                : canOpen
                ? '#FFFFFF'
                : 'rgba(255,255,255,0.25)',
              cursor: !canOpen || rangeState === 'loading' || rangeState === 'done' ? 'default' : 'pointer',
              boxShadow: canOpen && rangeState === 'idle' ? '0 2px 10px rgba(230,126,80,0.4)' : 'none',
            }}
          >
            {rangeState === 'done' ? '✓ Opened' : rangeState === 'loading' ? '…' : 'Open'}
          </button>
        </div>

        {rangeState === 'error' && rangeError && (
          <p className="text-xs f-body w-full" style={{ color: '#FCA5A5' }}>{rangeError}</p>
        )}
      </div>

      {/* ── Full-size calendar ──────────────────────────────────────────────── */}
      <div
        className="rounded-[24px] overflow-hidden"
        style={{
          background: '#FDFAF7',
          border:     '1px solid rgba(10,46,77,0.08)',
          boxShadow:  '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        {/* Month nav */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
        >
          <button
            type="button"
            onClick={prevMonth}
            disabled={pending}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.05)' }}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>

          <div className="text-center">
            <p className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
              {MONTHS[viewMonth - 1]} {viewYear}
            </p>
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {blockedThisMonth > 0
                ? `${blockedThisMonth} day${blockedThisMonth !== 1 ? 's' : ''} blocked`
                : 'All days available'}
            </p>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            disabled={pending}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.05)' }}
            aria-label="Next month"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 px-4 pt-4 pb-2">
          {DOW_HEADERS.map(h => (
            <div key={h} className="flex items-center justify-center">
              <span
                className="text-[10px] font-bold f-body uppercase tracking-[0.12em]"
                style={{ color: 'rgba(10,46,77,0.3)' }}
              >
                {h}
              </span>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-4">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />
            const iso       = isoDate(viewYear, viewMonth, day)
            const isPast    = iso < today
            const isBlocked = blocked.has(iso)
            const isSel     = selected.has(iso)

            return (
              <button
                key={iso}
                type="button"
                disabled={isPast || pending}
                onClick={() => handleDayClick(iso)}
                className="h-12 w-full flex items-center justify-center rounded-xl text-[15px] f-body transition-all"
                style={{
                  background: isSel
                    ? 'rgba(230,126,80,0.15)'
                    : isBlocked && !isPast
                    ? 'rgba(10,46,77,0.07)'
                    : 'transparent',
                  color: isPast
                    ? 'rgba(10,46,77,0.13)'
                    : isSel
                    ? '#C05C28'
                    : isBlocked
                    ? 'rgba(10,46,77,0.28)'
                    : 'rgba(10,46,77,0.72)',
                  border: isSel
                    ? '1.5px solid rgba(230,126,80,0.35)'
                    : isBlocked && !isPast
                    ? '1.5px solid rgba(10,46,77,0.1)'
                    : '1.5px solid transparent',
                  textDecoration: isBlocked && !isPast ? 'line-through' : 'none',
                  cursor:     isPast ? 'default' : 'pointer',
                  fontWeight: isBlocked && !isPast ? 400 : 500,
                  opacity:    isPast ? 0.35 : 1,
                }}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
        >
          <button
            type="button"
            onClick={() => { setMultiMode(m => !m); setSelected(new Set()) }}
            className="flex items-center gap-1.5 text-xs f-body font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: multiMode ? 'rgba(10,46,77,0.09)' : 'rgba(10,46,77,0.04)',
              color:      multiMode ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
              border:     multiMode ? '1px solid rgba(10,46,77,0.18)' : '1px solid transparent',
            }}
          >
            <span style={{ fontSize: 10 }}>{multiMode ? '✓' : '☐'}</span>
            Multi-select
          </button>

          {pending && (
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Saving…
            </span>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs f-body font-semibold w-full mb-1" style={{ color: '#0A2E4D' }}>
              {selected.size} day{selected.size !== 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => applyBulk(true)}
              disabled={pending}
              className="flex-1 py-2 rounded-xl text-xs font-bold f-body"
              style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.6)', border: '1px solid rgba(10,46,77,0.12)' }}
            >
              Block selected
            </button>
            <button
              type="button"
              onClick={() => applyBulk(false)}
              disabled={pending}
              className="flex-1 py-2 rounded-xl text-xs font-bold f-body"
              style={{ background: 'rgba(230,126,80,0.12)', color: '#C05C28', border: '1px solid rgba(230,126,80,0.25)' }}
            >
              Unblock selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs f-body px-1"
              style={{ color: 'rgba(10,46,77,0.32)' }}
            >
              Clear
            </button>
          </div>
        )}

        {error != null && (
          <div className="px-5 pb-3">
            <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-lg" style={{
            background: 'transparent',
            border: '1.5px solid rgba(10,46,77,0.12)',
          }} />
          <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Available (default)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-lg" style={{
            background: 'rgba(10,46,77,0.07)',
            border: '1.5px solid rgba(10,46,77,0.1)',
          }} />
          <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Blocked</span>
        </div>
      </div>

    </div>
  )
}
