'use client'

/**
 * PayBalanceBanner — shown on the angler booking detail page when
 * the booking is 'confirmed' and the balance hasn't been paid yet.
 *
 * stripe path: button → createBalanceCheckout() → redirect to Stripe
 * cash   path: info card with amount to pay on the day
 */

import { useState, useTransition } from 'react'
import { createBalanceCheckout } from '@/actions/bookings'

interface PayBalanceBannerProps {
  bookingId:     string
  totalEur:      number
  paymentMethod: 'stripe' | 'cash'
  guideName:     string
}

export default function PayBalanceBanner({
  bookingId,
  totalEur,
  paymentMethod,
  guideName,
}: PayBalanceBannerProps) {
  const balanceAmount = Math.round(totalEur * 0.7)

  // ── Cash path — simple info card, no button ────────────────────────────────
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0A2E4D" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6">
            <rect x="1" y="4" width="14" height="9" rx="1.5" />
            <circle cx="8" cy="8.5" r="2" />
            <line x1="4" y1="4" x2="4" y2="2.5" />
            <line x1="12" y1="4" x2="12" y2="2.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
            Pay <strong>€{balanceAmount}</strong> cash to {guideName}
          </p>
          <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Your guide collects the remaining balance on the day of the trip.
            No further action needed from you.
          </p>
        </div>
      </div>
    )
  }

  // ── Stripe path — button → Checkout ───────────────────────────────────────
  return <StripeBalanceBanner bookingId={bookingId} balanceAmount={balanceAmount} />
}

// ── Stripe sub-component (needs hooks — separate from cash to keep that path pure) ──

function StripeBalanceBanner({
  bookingId,
  balanceAmount,
}: {
  bookingId:     string
  balanceAmount: number
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
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(37,99,235,0.1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="4.5" width="14" height="9" rx="1.5" />
            <path d="M4 4.5V3.5a4 4 0 018 0v1" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#1D4ED8' }}>
            Pay remaining balance — <strong>€{balanceAmount}</strong>
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(29,78,216,0.65)' }}>
            This completes your booking. Pay securely by card via Stripe.
          </p>
        </div>
      </div>

      {/* Error */}
      {error != null && (
        <p
          className="text-xs f-body px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}
        >
          {error}
        </p>
      )}

      {/* CTA */}
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="4.5" width="12" height="8" rx="1.5" />
              <path d="M4 4.5V3.5a3 3 0 016 0v1" />
            </svg>
            Pay €{balanceAmount} balance — secure by Stripe
          </>
        )}
      </button>

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(29,78,216,0.45)' }}>
        Card details handled by Stripe · FjordAnglers does not store payment data
      </p>
    </div>
  )
}
