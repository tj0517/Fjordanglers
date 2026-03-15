'use client'

import { useTransition, useState } from 'react'
import { acceptOffer } from '@/actions/inquiries'

export default function AcceptOfferButton({ inquiryId }: { inquiryId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptOffer(inquiryId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      window.location.href = result.checkoutUrl
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="w-full py-4 rounded-2xl text-white font-semibold text-sm tracking-wide f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#E67E50' }}
      >
        {isPending ? (
          <>
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
              <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
            </svg>
            Redirecting…
          </>
        ) : (
          'Accept Offer & Pay →'
        )}
      </button>

      {error != null && (
        <p
          className="text-xs f-body text-center"
          style={{ color: '#DC2626' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
