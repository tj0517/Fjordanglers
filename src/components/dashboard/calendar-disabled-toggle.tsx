'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toggleCalendarDisabled } from '@/actions/calendar'
import { Loader2 } from 'lucide-react'

export function CalendarDisabledToggle({
  currentlyDisabled,
}: {
  currentlyDisabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localDisabled, setLocalDisabled] = useState(currentlyDisabled)
  const [error, setError] = useState<string | null>(null)

  // Sync local state when the server-rendered prop changes (e.g. after router.refresh()
  // or when the parent re-renders with a fresh DB value from the Server Component).
  useEffect(() => {
    setLocalDisabled(currentlyDisabled)
  }, [currentlyDisabled])

  async function handleToggle() {
    const next = !localDisabled
    setLocalDisabled(next)
    setError(null)

    const result = await toggleCalendarDisabled(next)
    if ('error' in result) {
      setLocalDisabled(!next) // revert optimistic update
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
          <Loader2 className="animate-spin" size={13} />
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
