'use client'

import { useTransition, useState } from 'react'
import { acceptBookingOffer } from '@/actions/bookings'
import { Loader2 } from 'lucide-react'

export default function AcceptOfferButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptBookingOffer(bookingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        // Manual payment model — booking confirmed without Stripe
        window.location.href = `/account/trips/${bookingId}?status=accepted`
      }
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
            <Loader2 width={16} height={16} className="animate-spin" />
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
