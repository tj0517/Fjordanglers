'use client'

import { useState, useTransition } from 'react'
import { updateGuideProfile } from '@/actions/dashboard'

export function HideListingToggle({ current }: { current: boolean }) {
  // current = is_hidden value from DB; true means hidden, false means visible
  const [isHidden, setIsHidden]      = useState(current)
  const [saved, setSaved]            = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !isHidden
    setIsHidden(next)
    setSaved(false)
    setError(null)

    startTransition(async () => {
      const result = await updateGuideProfile({ is_hidden: next })
      if (!result.success) {
        setIsHidden(!next) // revert
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  const isVisible = !isHidden

  return (
    <div className="px-6 py-4 flex flex-col gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={isVisible}
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-start gap-4 text-left w-full disabled:opacity-60"
      >
        {/* Toggle pill */}
        <div
          className="flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200 relative"
          style={{ background: isVisible ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
            style={{ left: isVisible ? '22px' : '2px' }}
          />
        </div>
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
            {isVisible ? 'Visible — your profile is public' : 'Hidden — your profile is not listed'}
          </p>
          <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {isVisible
              ? 'Anglers can find your profile and trips in search results.'
              : 'Your profile and trips are hidden from all public listings. Existing bookings are not affected.'}
          </p>
        </div>
      </button>

      {saved && (
        <p className="text-xs f-body font-medium" style={{ color: '#16A34A' }}>✓ Saved</p>
      )}
      {error != null && (
        <p className="text-xs f-body px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}
