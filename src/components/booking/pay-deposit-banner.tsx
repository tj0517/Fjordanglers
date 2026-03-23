'use client'

/**
 * PayDepositBanner — shown on the angler booking detail page when
 * the booking is 'accepted' (guide confirmed) but deposit not yet paid.
 *
 * Production path:  initialCheckoutUrl present → direct Stripe link.
 * Expired path:     url = null, testMode = false → renewDepositCheckout().
 * Test / mock path: testMode = true → YES / NO buttons (no Stripe).
 */

import { useState, useTransition } from 'react'
import { renewDepositCheckout, mockConfirmDeposit } from '@/actions/bookings'

interface PayDepositBannerProps {
  bookingId: string
  /** Pre-fetched checkout URL — null if the session was expired/missing */
  initialCheckoutUrl: string | null
  /** Full booking total in EUR — used to calculate the 30% deposit display */
  totalEur: number
  /**
   * When true, shows a mock YES / NO panel instead of Stripe.
   * Use this while guide has no Stripe account connected.
   */
  testMode?: boolean
}

export default function PayDepositBanner({
  bookingId,
  initialCheckoutUrl,
  totalEur,
  testMode = false,
}: PayDepositBannerProps) {
  const [url, setUrl]      = useState<string | null>(initialCheckoutUrl)
  const [error, setError]  = useState<string | null>(null)
  const [done, setDone]    = useState<'confirmed' | 'cancelled' | null>(null)
  const [isPending, start] = useTransition()

  const depositAmount = Math.round(totalEur * 0.3)
  const balanceAmount = Math.round(totalEur - depositAmount)

  // ── Stripe expired-session renew ──────────────────────────────────────────
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

  // ── Mock: confirm ─────────────────────────────────────────────────────────
  function handleMockConfirm() {
    setError(null)
    start(async () => {
      const result = await mockConfirmDeposit(bookingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone('confirmed')
      // Full reload so the page re-fetches confirmed status
      window.location.reload()
    })
  }

  // ── Mock: cancel ──────────────────────────────────────────────────────────
  function handleMockCancel() {
    setDone('cancelled')
  }

  // ── Cancelled mock state ──────────────────────────────────────────────────
  if (done === 'cancelled') {
    return (
      <div
        className="p-4 flex items-center gap-3"
        style={{
          background:   'rgba(239,68,68,0.06)',
          borderRadius: '16px',
          border:       '1px solid rgba(239,68,68,0.18)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#DC2626" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M10 6l-4 4M6 6l4 4" strokeLinecap="round" />
        </svg>
        <p className="text-sm f-body" style={{ color: '#DC2626' }}>
          Payment cancelled — your booking request is still pending.
        </p>
      </div>
    )
  }

  // ── TEST MODE: YES / NO mock panel ────────────────────────────────────────
  if (testMode) {
    return (
      <div
        className="p-5 flex flex-col gap-4"
        style={{
          background:   'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(234,179,8,0.04) 100%)',
          borderRadius: '20px',
          border:       '1.5px solid rgba(234,179,8,0.35)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-base"
            style={{ background: 'rgba(234,179,8,0.12)' }}
          >
            🧪
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold f-body" style={{ color: '#92400e' }}>
                Test Payment Panel
              </p>
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body"
                style={{ background: 'rgba(234,179,8,0.2)', color: '#92400e' }}
              >
                No Stripe
              </span>
            </div>
            <p className="text-xs f-body" style={{ color: 'rgba(146,64,14,0.7)' }}>
              Guide accepted your request. Simulate paying the{' '}
              <strong>€{depositAmount}</strong> deposit (30%).
              Balance of <strong>€{balanceAmount}</strong> due before the trip.
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

        {/* YES / NO buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleMockConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 px-5 rounded-2xl f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#16A34A', color: '#fff' }}
          >
            {isPending ? (
              <>
                <span
                  className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
                Confirming…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2.5 7l3.5 3.5 5.5-6" />
                </svg>
                Yes — Simulate Payment
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleMockCancel}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-3 px-5 rounded-2xl f-body transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              border:     '1.5px solid rgba(220,38,38,0.3)',
              color:      '#DC2626',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 3L3 9M3 3l6 6" />
            </svg>
            No — Cancel
          </button>
        </div>

        <p className="text-[10px] f-body text-center" style={{ color: 'rgba(146,64,14,0.45)' }}>
          Test mode only — real payments will use Stripe when connected
        </p>
      </div>
    )
  }

  // ── Production path: Stripe Checkout URL ─────────────────────────────────
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
