'use client'

/**
 * SeasonShortcuts — one-click blocking of predefined Scandinavian fishing seasons.
 *
 * Each preset maps to a fixed date range within the selected year.
 * Year picker lets guides set up next season in advance.
 * Requires activeCalendarId — no-ops when null (All Trips read-only view).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { blockDates } from '@/actions/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  experienceIds:    string[]
  initialYear:      number
  /** Active calendar — blocks written here. Null = read-only, no blocking. */
  activeCalendarId?: string | null
}

type SeasonPreset = {
  id:        string
  label:     string
  icon:      string
  dateRange: string
  color:     string
  bg:        string
  startMD:   [number, number]  // [month, day]
  endMD:     [number, number]
  reason:    string
}

type SeasonState = 'idle' | 'loading' | 'done' | 'error'

// ─── Season definitions ───────────────────────────────────────────────────────

const SEASONS: SeasonPreset[] = [
  {
    id:        'ice',
    label:     'Ice Fishing',
    icon:      '❄️',
    dateRange: 'Jan 1 – Mar 31',
    color:     '#2563EB',
    bg:        'rgba(37,99,235,0.07)',
    startMD:   [1, 1],
    endMD:     [3, 31],
    reason:    'Ice fishing season',
  },
  {
    id:        'spring',
    label:     'Spring Opening',
    icon:      '🌿',
    dateRange: 'Apr 15 – May 31',
    color:     '#16A34A',
    bg:        'rgba(22,163,74,0.07)',
    startMD:   [4, 15],
    endMD:     [5, 31],
    reason:    'Spring opening season',
  },
  {
    id:        'main',
    label:     'Main Season',
    icon:      '🎣',
    dateRange: 'Jun 1 – Sep 30',
    color:     '#E67E50',
    bg:        'rgba(230,126,80,0.09)',
    startMD:   [6, 1],
    endMD:     [9, 30],
    reason:    'Main salmon & trout season',
  },
  {
    id:        'autumn',
    label:     'Sea Trout',
    icon:      '🍂',
    dateRange: 'Oct 1 – Nov 15',
    color:     '#B45309',
    bg:        'rgba(180,83,9,0.07)',
    startMD:   [10, 1],
    endMD:     [11, 15],
    reason:    'Autumn sea trout season',
  },
  {
    id:        'winter',
    label:     'Winter Break',
    icon:      '🌨️',
    dateRange: 'Nov 16 – Dec 31',
    color:     '#64748B',
    bg:        'rgba(100,116,139,0.07)',
    startMD:   [11, 16],
    endMD:     [12, 31],
    reason:    'Winter closure',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SeasonShortcuts({ experienceIds, initialYear, activeCalendarId = null }: Props) {
  const router = useRouter()
  const [year, setYear]     = useState(initialYear)
  const [states, setStates] = useState<Record<string, SeasonState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  function setSeasonState(id: string, s: SeasonState) {
    setStates(prev => ({ ...prev, [id]: s }))
  }

  function changeYear(delta: number) {
    setYear(y => y + delta)
    setStates({})   // reset all applied states when year changes
    setErrors({})
  }

  async function applyBlock(season: SeasonPreset) {
    // Guard: need either a calendarId (calendar mode) or at least one experience (per-listing mode)
    const canBlock = activeCalendarId != null || experienceIds.length > 0
    if (!canBlock) return

    const current = states[season.id] ?? 'idle'
    if (current === 'loading' || current === 'done') return

    setSeasonState(season.id, 'loading')
    setErrors(prev => ({ ...prev, [season.id]: '' }))

    const dateStart = toDateStr(year, season.startMD[0], season.startMD[1])
    const dateEnd   = toDateStr(year, season.endMD[0],   season.endMD[1])

    if (activeCalendarId == null) return
    const result = await blockDates(
      { calendarId: activeCalendarId, dateStart, dateEnd, reason: season.reason }
    )

    if ('error' in result) {
      setSeasonState(season.id, 'error')
      setErrors(prev => ({ ...prev, [season.id]: result.error }))
    } else {
      setSeasonState(season.id, 'done')
      router.refresh()
      // Auto-reset after 3 s so button can be re-used
      setTimeout(() => setSeasonState(season.id, 'idle'), 3000)
    }
  }

  return (
    <div
      className="mb-6 px-6 py-5"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(10,46,77,0.07)',
        boxShadow:    '0 2px 12px rgba(10,46,77,0.04)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            Season Shortcuts
          </h2>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
            Block an entire fishing season across all your trips in one click.
          </p>
        </div>

        {/* Year picker */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => changeYear(-1)}
            aria-label="Previous year"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all f-body text-base font-bold"
            style={{ color: 'rgba(10,46,77,0.5)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,46,77,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ‹
          </button>
          <span
            className="text-sm font-bold f-display text-center tabular-nums"
            style={{ color: '#0A2E4D', minWidth: '40px' }}
          >
            {year}
          </span>
          <button
            onClick={() => changeYear(+1)}
            aria-label="Next year"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all f-body text-base font-bold"
            style={{ color: 'rgba(10,46,77,0.5)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,46,77,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ›
          </button>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {activeCalendarId == null && experienceIds.length === 0 ? (
        <p
          className="text-xs f-body text-center py-5"
          style={{ color: 'rgba(10,46,77,0.35)' }}
        >
          Add a trip first to use season shortcuts.
        </p>
      ) : (
        /* ── Season cards ───────────────────────────────────────────────── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SEASONS.map(season => {
            const state     = states[season.id] ?? 'idle'
            const errMsg    = errors[season.id]
            const isDone    = state === 'done'
            const isLoading = state === 'loading'
            const isError   = state === 'error'

            return (
              <div
                key={season.id}
                className="flex flex-col gap-3 px-4 py-4 rounded-2xl"
                style={{
                  background: isDone
                    ? 'rgba(22,163,74,0.07)'
                    : season.bg,
                  border: `1px solid ${
                    isDone    ? 'rgba(22,163,74,0.18)'
                    : isError ? 'rgba(220,38,38,0.2)'
                    : 'rgba(10,46,77,0.07)'
                  }`,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Icon */}
                <span className="text-2xl leading-none select-none">{season.icon}</span>

                {/* Info */}
                <div className="flex-1">
                  <p
                    className="text-xs font-bold f-body leading-tight"
                    style={{ color: isDone ? '#16A34A' : '#0A2E4D' }}
                  >
                    {season.label}
                  </p>
                  <p
                    className="text-[10px] f-body mt-0.5 leading-tight"
                    style={{ color: 'rgba(10,46,77,0.45)' }}
                  >
                    {season.dateRange}
                  </p>
                  <p
                    className="text-[10px] f-body"
                    style={{ color: 'rgba(10,46,77,0.3)' }}
                  >
                    {year}
                  </p>
                  {isError && errMsg != null && errMsg.length > 0 && (
                    <p className="text-[9px] f-body mt-1 leading-tight" style={{ color: '#DC2626' }}>
                      {errMsg}
                    </p>
                  )}
                </div>

                {/* Block button */}
                <button
                  onClick={() => applyBlock(season)}
                  disabled={isLoading || isDone}
                  className="w-full text-[10px] font-bold uppercase tracking-[0.1em] py-1.5 rounded-xl transition-all f-body"
                  style={{
                    background: isDone
                      ? 'rgba(22,163,74,0.12)'
                      : isLoading
                      ? 'rgba(10,46,77,0.05)'
                      : season.bg,
                    color: isDone
                      ? '#16A34A'
                      : isLoading
                      ? 'rgba(10,46,77,0.28)'
                      : season.color,
                    border: `1px solid ${
                      isDone    ? 'rgba(22,163,74,0.2)'
                      : isLoading? 'rgba(10,46,77,0.06)'
                      : `${season.color}30`
                    }`,
                    cursor:  isLoading || isDone ? 'default' : 'pointer',
                  }}
                >
                  {isDone ? '✓ Blocked' : isLoading ? '…' : 'Block'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
