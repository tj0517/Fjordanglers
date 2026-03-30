'use client'

/**
 * PayBalanceBanner — shown on the angler booking detail page when
 * the booking is 'confirmed' and the balance hasn't been paid yet.
 *
 * stripe path: button → createBalanceCheckout() → redirect to Stripe
 * cash   path: info card with amount to pay on the day
 * test   path: testMode=true → YES / NO mock buttons (no Stripe)
 */

import { useState, useTransition } from 'react'
import { createBalanceCheckout, mockCompleteBalance } from '@/actions/bookings'
import { Banknote, XCircle, Check, X, Lock } from 'lucide-react'

interface PayBalanceBannerProps {
  bookingId:     string
  totalEur:      number
  paymentMethod: 'stripe' | 'cash'
  guideName:     string
  /**
   * When true, shows a mock YES / NO panel instead of Stripe.
   * Use this while guide has no Stripe account connected.
   */
  testMode?: boolean
}

export default function PayBalanceBanner({
  bookingId,
  totalEur,
  paymentMethod,
  guideName,
  testMode = false,
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
          <Banknote size={16} strokeWidth={1.5} style={{ color: '#0A2E4D', opacity: 0.6 }} />
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

  // ── Test mode — mock YES / NO panel ───────────────────────────────────────
  if (testMode) {
    return <MockBalanceBanner bookingId={bookingId} balanceAmount={balanceAmount} />
  }

  // ── Stripe path — button → Checkout ───────────────────────────────────────
  return <StripeBalanceBanner bookingId={bookingId} balanceAmount={balanceAmount} />
}

// ─── Mock sub-component ───────────────────────────────────────────────────────

function MockBalanceBanner({
  bookingId,
  balanceAmount,
}: {
  bookingId:     string
  balanceAmount: number
}) {
  const [error, setError]  = useState<string | null>(null)
  const [done, setDone]    = useState<'completed' | 'cancelled' | null>(null)
  const [isPending, start] = useTransition()

  function handleMockComplete() {
    setError(null)
    start(async () => {
      const result = await mockCompleteBalance(bookingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone('completed')
      window.location.reload()
    })
  }

  function handleMockCancel() {
    setDone('cancelled')
  }

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
        <XCircle size={16} strokeWidth={1.5} style={{ color: '#DC2626' }} />
        <p className="text-sm f-body" style={{ color: '#DC2626' }}>
          Payment skipped — you can pay later.
        </p>
      </div>
    )
  }

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
            Simulate paying the remaining <strong>€{balanceAmount}</strong> balance (70%).
            This will mark your trip as completed.
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
          onClick={handleMockComplete}
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
              Completing…
            </>
          ) : (
            <>
              <Check size={14} strokeWidth={2} />
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
          <X size={12} strokeWidth={1.8} />
          No — Skip
        </button>
      </div>

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(146,64,14,0.45)' }}>
        Test mode only — real payments will use Stripe when connected
      </p>
    </div>
  )
}

// ─── Stripe sub-component ─────────────────────────────────────────────────────

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
          <Lock size={16} strokeWidth={1.5} style={{ color: '#2563EB' }} />
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
            <Lock size={14} strokeWidth={1.5} />
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
