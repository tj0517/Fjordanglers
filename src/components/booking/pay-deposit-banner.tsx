'use client'

/**
 * PayDepositBanner — shown on the angler booking detail page when
 * the booking is 'accepted' (guide confirmed) but payment not yet made.
 *
 * Happy path:  server passes a valid Stripe Checkout URL → plain <a> link.
 * Expired path: server passes null → button calls renewDepositCheckout()
 *               server action, then redirects to the fresh checkout URL.
 */

import { useState, useTransition } from 'react'
import { renewDepositCheckout } from '@/actions/bookings'

interface PayDepositBannerProps {
  bookingId: string
  /** Pre-fetched checkout URL — null if the session was expired/missing */
  initialCheckoutUrl: string | null
  /** Full booking total in EUR — used to calculate the 30% deposit display */
  totalEur: number
}

export default function PayDepositBanner({
  bookingId,
  initialCheckoutUrl,
  totalEur,
}: PayDepositBannerProps) {
  const [url, setUrl]       = useState<string | null>(initialCheckoutUrl)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  const depositAmount = Math.round(totalEur * 0.3)
  const balanceAmount = Math.round(totalEur - depositAmount)

  function handleRenew() {
    setError(null)
    start(async () => {
      const result = await renewDepositCheckout(bookingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setUrl(result.url)
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(37,99,235,0.1)' }}
        >
          {/* Checkmark circle */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M5.5 8l2 2 3-3" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#1D4ED8' }}>
            Your guide accepted — pay deposit to confirm
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(29,78,216,0.65)' }}>
            30% deposit of <strong>€{depositAmount}</strong> secures your booking.
            Balance of <strong>€{balanceAmount}</strong> is due before the trip.
          </p>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error != null && (
        <p
          className="text-xs f-body px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}
        >
          {error}
        </p>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      {url != null ? (
        <a
          href={url}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-full f-body transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98]"
          style={{ background: '#2563EB', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="4.5" width="12" height="8" rx="1.5" />
            <path d="M4 4.5V3.5a3 3 0 016 0v1" />
          </svg>
          Pay €{depositAmount} deposit — secure by Stripe
        </a>
      ) : (
        <button
          onClick={handleRenew}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-full f-body transition-all disabled:opacity-50"
          style={{ background: '#2563EB', color: '#fff' }}
        >
          {isPending ? (
            <>
              <span
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
              />
              Preparing payment…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="4.5" width="12" height="8" rx="1.5" />
                <path d="M4 4.5V3.5a3 3 0 016 0v1" />
              </svg>
              Pay €{depositAmount} deposit — secure by Stripe
            </>
          )}
        </button>
      )}

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(29,78,216,0.45)' }}>
        Card details handled by Stripe · FjordAnglers does not store payment data
      </p>
    </div>
  )
}
