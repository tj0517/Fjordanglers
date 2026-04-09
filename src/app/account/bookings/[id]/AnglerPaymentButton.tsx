'use client'

/**
 * AnglerPaymentButton — "Pay booking fee" fallback button.
 *
 * Shown on the confirmed booking detail page when:
 *   - status === 'confirmed'
 *   - balance_paid_at === null  (fee not yet paid)
 *   - platform_fee_eur + service_fee_eur > 0
 *
 * Calls createBookingFeeCheckout() and redirects to Stripe Checkout.
 * Used when the angler dismissed/cancelled the Stripe window that opened
 * automatically after accepting the guide's offer.
 */

import { useState, useTransition } from 'react'
import { Loader2, CreditCard, AlertCircle } from 'lucide-react'
import { createBookingFeeCheckout } from '@/actions/bookings'

interface Props {
  bookingId: string
  bookingFeeEur: number
}

export default function AnglerPaymentButton({ bookingId, bookingFeeEur }: Props) {
  const [isPending, start] = useTransition()
  const [error, setError]  = useState<string | null>(null)

  function handlePay() {
    setError(null)
    start(async () => {
      const result = await createBookingFeeCheckout(bookingId)
      if (!result.success) {
        setError(result.error)
        return
      }
      window.location.href = result.checkoutUrl
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handlePay}
        className="w-full py-3.5 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: '#0A2E4D',
          color:      '#FFFFFF',
          boxShadow:  '0 4px 14px rgba(10,46,77,0.25)',
        }}
      >
        {isPending
          ? <Loader2 size={16} className="animate-spin" />
          : <CreditCard size={16} />
        }
        {isPending ? 'Redirecting to payment…' : `Pay booking fee — €${bookingFeeEur.toFixed(2)}`}
      </button>

      {error != null && (
        <div
          className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs f-body"
          style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}
        >
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  )
}
