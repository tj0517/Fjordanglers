'use client'

import { useState, useTransition } from 'react'
import { updateGuideProfile } from '@/actions/dashboard'

export function MarketingConsentToggle({ current }: { current: boolean }) {
  const [enabled, setEnabled]        = useState(current)
  const [saved, setSaved]            = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    setSaved(false)
    setError(null)

    startTransition(async () => {
      const result = await updateGuideProfile({ photo_marketing_consent: next })
      if (!result.success) {
        setEnabled(!next) // revert
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-start gap-4 text-left w-full disabled:opacity-60"
      >
        {/* Toggle pill */}
        <div
          className="flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200 relative"
          style={{ background: enabled ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
            style={{ left: enabled ? '22px' : '2px' }}
          />
        </div>
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
            {enabled ? 'Allowed — photos may be used in marketing' : 'Not allowed — photos stay on profile only'}
          </p>
          <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {enabled
              ? 'Your photos may appear on our website, Instagram and in ads. Attribution: © your name, via FjordAnglers.'
              : 'Your photos will only be shown within your guide profile and trip listings.'}
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
