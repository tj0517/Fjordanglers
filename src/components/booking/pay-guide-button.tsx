'use client'

/**
 * PayGuideButton — calls createGuideAmountCheckout() server action
 * and redirects to Stripe Checkout for the guide amount payment.
 *
 * Shown on angler's booking page when:
 *   - booking.status === 'confirmed'
 *   - paymentModel === 'stripe_connect'
 *   - guide_amount_paid_at is null
 *   - no pre-created guide_stripe_checkout_id (or it expired)
 */

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { createGuideAmountCheckout } from '@/actions/bookings'

interface Props {
  bookingId:      string
  guideAmountEur: number
}

export default function PayGuideButton({ bookingId, guideAmountEur }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await createGuideAmountCheckout(bookingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      // Redirect to Stripe Checkout
      window.location.href = result.url
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex-shrink-0 flex items-center gap-1.5 text-sm font-bold f-body px-4 py-2.5 rounded-full transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: '#2563EB', color: '#fff' }}
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Preparing…
          </>
        ) : (
          <>Pay €{guideAmountEur} →</>
        )}
      </button>
      {error != null && (
        <p className="text-[11px] f-body" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}
