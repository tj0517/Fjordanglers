'use client'

/**
 * PayBalanceBanner — shown on the angler booking detail page when
 * the booking is 'confirmed' and balance hasn't been paid yet.
 *
 * stripe path: button → createBalanceCheckout() → redirect to Stripe Checkout
 * cash   path: info card only — guide collects directly on the day
 */

import { useState, useTransition } from 'react'
import { createBalanceCheckout } from '@/actions/bookings'
import { Banknote, Lock } from 'lucide-react'

interface PayBalanceBannerProps {
  bookingId:     string
  /** Remaining balance amount (total_eur - deposit_eur) */
  balanceEur:    number
  paymentMethod: 'stripe' | 'cash'
  guideName:     string
}

export default function PayBalanceBanner({
  bookingId,
  balanceEur,
  paymentMethod,
  guideName,
}: PayBalanceBannerProps) {
  // ── Cash path — guide collects directly ───────────────────────────────────
  if (paymentMethod === 'cash') {
    return (
      <div
        className="p-5 flex items-start gap-3"
        style={{
          background:   'linear-gradient(135deg, rgba(10,46,77,0.05) 0%, rgba(10,46,77,0.02) 100%)',
          borderRadius: '20px',
          border:       '1.5px solid rgba(10,46,77,0.12)',
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(10,46,77,0.07)' }}
        >
          <Banknote size={16} strokeWidth={1.5} style={{ color: '#0A2E4D', opacity: 0.6 }} />
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
            Pay <strong>€{balanceEur}</strong> directly to {guideName}
          </p>
          <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Your guide collects the remaining balance directly — cash, bank transfer, or other
            method agreed with the guide. No further action needed here.
          </p>
        </div>
      </div>
    )
  }

  // ── Stripe path — button → Checkout ───────────────────────────────────────
  return <StripeBalanceBanner bookingId={bookingId} balanceEur={balanceEur} />
}

// ─── Stripe sub-component ─────────────────────────────────────────────────────

function StripeBalanceBanner({
  bookingId,
  balanceEur,
}: {
  bookingId: string
  balanceEur: number
}) {
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function handlePay() {
    setError(null)
    start(async () => {
      const result = await createBalanceCheckout(bookingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      window.location.href = result.url
    })
  }

  return (
    <div
      className="p-5 flex flex-col gap-4"
      style={{
        background:   'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.03) 100%)',
        borderRadius: '20px',
        border:       '1.5px solid rgba(37,99,235,0.2)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(37,99,235,0.1)' }}
        >
          <Lock size={16} strokeWidth={1.5} style={{ color: '#2563EB' }} />
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#1D4ED8' }}>
            Pay remaining balance — <strong>€{balanceEur}</strong>
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(29,78,216,0.65)' }}>
            This completes your booking. Pay securely by card via Stripe.
          </p>
        </div>
      </div>

      {error != null && (
        <p
          className="text-xs f-body px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}
        >
          {error}
        </p>
      )}

      <button
        onClick={handlePay}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-full f-body transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#2563EB', color: '#fff' }}
      >
        {isPending ? (
          <>
            <span
              className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
            />
            Redirecting to payment…
          </>
        ) : (
          <>
            <Lock size={14} strokeWidth={1.5} />
            Pay €{balanceEur} balance — secure by Stripe
          </>
        )}
      </button>

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(29,78,216,0.45)' }}>
        Card details handled by Stripe · FjordAnglers does not store payment data
      </p>
    </div>
  )
}
