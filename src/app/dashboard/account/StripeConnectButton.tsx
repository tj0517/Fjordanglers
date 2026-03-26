'use client'

import { useState, useTransition } from 'react'
import { startStripeOnboarding } from '@/actions/stripe-connect'

export function StripeConnectButton({ label = 'Connect with Stripe' }: { label?: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await startStripeOnboarding()
      if ('url' in result) {
        window.location.href = result.url
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 text-sm font-bold f-body px-5 py-2.5 rounded-xl transition-all"
        style={{
          background: isPending ? 'rgba(10,46,77,0.1)' : '#0A2E4D',
          color:      isPending ? 'rgba(10,46,77,0.4)' : '#fff',
          cursor:     isPending ? 'not-allowed'         : 'pointer',
          opacity:    isPending ? 0.75 : 1,
        }}
      >
        {isPending ? (
          'Opening Stripe…'
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="20" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            {label}
          </>
        )}
      </button>

      {error != null && (
        <p
          className="text-sm f-body mt-3 px-4 py-3 rounded-xl leading-relaxed"
          role="alert"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#DC2626',
            border:     '1px solid rgba(239,68,68,0.15)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
