'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleCalendarDisabled } from '@/actions/calendar'

export function CalendarDisabledToggle({
  currentlyDisabled,
}: {
  currentlyDisabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localDisabled, setLocalDisabled] = useState(currentlyDisabled)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    const next = !localDisabled
    setLocalDisabled(next)
    setError(null)

    const result = await toggleCalendarDisabled(next)
    if ('error' in result) {
      setLocalDisabled(!next) // revert
      setError(result.error)
      return
    }
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => void handleToggle()}
        disabled={isPending}
        className="flex items-center gap-2.5 text-sm font-semibold f-body px-4 py-2.5 rounded-xl transition-all"
        style={{
          background:  localDisabled ? 'rgba(99,102,241,0.1)' : 'rgba(10,46,77,0.06)',
          color:       localDisabled ? '#4F46E5'               : '#0A2E4D',
          border:      `1px solid ${localDisabled ? 'rgba(99,102,241,0.22)' : 'rgba(10,46,77,0.1)'}`,
          cursor:      isPending ? 'not-allowed' : 'pointer',
          opacity:     isPending ? 0.6 : 1,
          whiteSpace:  'nowrap',
        }}
      >
        {isPending ? (
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 11 11" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5.5 1.5 A4 4 0 0 1 9.5 5.5" />
          </svg>
        ) : localDisabled ? (
          /* Toggle-on icon */
          <svg width="14" height="14" viewBox="0 0 20 12" fill="none">
            <rect width="20" height="12" rx="6" fill="#4F46E5"/>
            <circle cx="14" cy="6" r="4" fill="white"/>
          </svg>
        ) : (
          /* Toggle-off icon */
          <svg width="14" height="14" viewBox="0 0 20 12" fill="none">
            <rect width="20" height="12" rx="6" fill="rgba(10,46,77,0.2)"/>
            <circle cx="6" cy="6" r="4" fill="white"/>
          </svg>
        )}
        {localDisabled ? 'Calendar disabled' : 'Disable calendar'}
      </button>
      {error != null && (
        <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
