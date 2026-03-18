'use client'

/**
 * CalendarModeToggle — lets a guide choose between:
 *   • per_listing — each trip has its own independent availability calendar
 *   • shared      — one calendar for all trips; every block applies everywhere
 *
 * Calls the `updateCalendarMode` Server Action on change and refreshes the page
 * so CalendarGrid re-renders with the new mode.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCalendarMode } from '@/actions/calendar'

export type CalendarMode = 'per_listing' | 'shared'

interface Props {
  current: CalendarMode
  tripCount: number
}

const OPTIONS: Array<{
  value: CalendarMode
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: 'shared',
    label: 'Per guide',
    description: 'One calendar for you as a guide — blocking a date makes all your trips unavailable.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="6" r="3" />
        <path d="M3 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
  {
    value: 'per_listing',
    label: 'Per trip',
    description: 'Each trip has its own separate calendar. Useful if your trips run independently.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="7" height="12" rx="1.5" />
        <rect x="10" y="3" width="7" height="12" rx="1.5" />
        <line x1="3" y1="7" x2="6" y2="7" />
        <line x1="3" y1="10" x2="6" y2="10" />
        <line x1="12" y1="7" x2="15" y2="7" />
        <line x1="12" y1="10" x2="15" y2="10" />
      </svg>
    ),
  },
]

export default function CalendarModeToggle({ current, tripCount }: Props) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<CalendarMode>(current)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSelect(mode: CalendarMode) {
    if (mode === optimistic || isPending) return
    setSaveError(null)
    setOptimistic(mode)
    startTransition(async () => {
      const result = await updateCalendarMode(mode)
      if ('error' in result) {
        setSaveError(result.error)
        setOptimistic(current) // revert
        return
      }
      router.refresh()
    })
  }

  return (
    <div
      className="rounded-2xl px-5 py-4 mb-8"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      {/* Row: label + save indicator */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-0.5"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Availability mode
          </p>
          <p className="text-sm font-semibold f-display" style={{ color: '#0A2E4D' }}>
            Calendar per guide or per trip?
          </p>
        </div>
        {isPending && (
          <span className="text-[10px] f-body flex items-center gap-1.5"
                style={{ color: 'rgba(10,46,77,0.38)' }}>
            <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none"
                 stroke="currentColor" strokeWidth="1.5">
              <circle cx="5.5" cy="5.5" r="4" strokeDasharray="20" strokeDashoffset="5" />
            </svg>
            Saving…
          </span>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = optimistic === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={isPending}
              aria-pressed={isActive}
              className="text-left rounded-xl p-4 transition-all"
              style={{
                background:  isActive ? 'rgba(230,126,80,0.07)' : 'rgba(10,46,77,0.03)',
                border:      isActive
                  ? '1.5px solid rgba(230,126,80,0.35)'
                  : '1.5px solid rgba(10,46,77,0.08)',
                cursor:      isPending ? 'not-allowed' : 'pointer',
                opacity:     isPending && !isActive ? 0.6 : 1,
              }}
            >
              {/* Icon + label row */}
              <div className="flex items-center gap-2.5 mb-2">
                <span style={{ color: isActive ? '#E67E50' : 'rgba(10,46,77,0.4)' }}>
                  {opt.icon}
                </span>
                <span
                  className="text-sm font-semibold f-body"
                  style={{ color: isActive ? '#0A2E4D' : 'rgba(10,46,77,0.55)' }}
                >
                  {opt.label}
                </span>
                {/* Active dot */}
                {isActive && (
                  <span
                    className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: '#E67E50', boxShadow: '0 0 5px rgba(230,126,80,0.5)' }}
                  />
                )}
              </div>
              <p
                className="text-xs f-body leading-relaxed"
                style={{ color: isActive ? 'rgba(10,46,77,0.6)' : 'rgba(10,46,77,0.4)' }}
              >
                {opt.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Info banner */}
      <div
        className="mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(27,79,114,0.05)', border: '1px solid rgba(27,79,114,0.1)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#1B4F72"
             strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
          <circle cx="7" cy="7" r="6" />
          <line x1="7" y1="5" x2="7" y2="7.5" />
          <circle cx="7" cy="9.5" r="0.6" fill="#1B4F72" />
        </svg>
        <p className="text-xs f-body leading-relaxed" style={{ color: '#1B4F72' }}>
          {optimistic === 'shared'
            ? <>Blocking a date makes <strong>all {tripCount} trip{tripCount !== 1 ? 's' : ''}</strong> unavailable at once — one calendar for you as a guide.</>
            : <>Each trip has its own calendar. Blocking "Trip A" doesn&apos;t affect "Trip B" — useful for multi-guide setups.</>
          }
        </p>
      </div>

      {/* Error */}
      {saveError != null && (
        <p className="mt-2 text-xs f-body" style={{ color: '#DC2626' }}>{saveError}</p>
      )}
    </div>
  )
}
