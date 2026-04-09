'use client'

/**
 * AnglerOfferActions — Accept / Decline buttons shown when a guide has
 * proposed new dates / a price (status: offer_sent).
 *
 * Accept  → acceptOffer()   → status: confirmed + calendar blocked
 * Decline → two-step confirm → declineOffer() → status: declined
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { acceptOffer, declineOffer } from '@/actions/bookings'

interface Props {
  bookingId: string
  guideName: string
}

type View = 'buttons' | 'declining'

export default function AnglerOfferActions({ bookingId, guideName }: Props) {
  const router              = useRouter()
  const [isPending, start]  = useTransition()
  const [view, setView]     = useState<View>('buttons')
  const [reason, setReason] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [active, setActive] = useState<'accept' | 'decline' | null>(null)

  // ── Accept ──────────────────────────────────────────────────────────────────

  function handleAccept() {
    setError(null)
    setActive('accept')
    start(async () => {
      const result = await acceptOffer(bookingId)
      if (!result.success) {
        setError(result.error)
        setActive(null)
        return
      }
      // If a booking fee checkout was created, redirect straight to Stripe.
      // Otherwise just refresh the page (no price set → nothing to pay now).
      if (result.checkoutUrl != null) {
        window.location.href = result.checkoutUrl
      } else {
        router.refresh()
      }
    })
  }

  // ── Decline — step 2: confirmed with optional reason ────────────────────────

  function handleDeclineConfirm() {
    setError(null)
    setActive('decline')
    start(async () => {
      const result = await declineOffer(bookingId, reason.trim() || undefined)
      if (!result.success) {
        setError(result.error)
        setActive(null)
        return
      }
      router.refresh()
    })
  }

  // ── Decline expand ───────────────────────────────────────────────────────────

  if (view === 'declining') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="decline-reason"
            className="text-xs f-body font-medium mb-1.5 block"
            style={{ color: 'rgba(146,64,14,0.65)' }}
          >
            Reason for declining (optional)
          </label>
          <textarea
            id="decline-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={isPending}
            placeholder={`Let ${guideName} know why…`}
            rows={2}
            className="w-full text-sm f-body rounded-xl px-3.5 py-2.5 resize-none outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border:     `1.5px solid ${isPending ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.3)'}`,
              color:      '#374151',
            }}
          />
        </div>

        {error != null && (
          <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleDeclineConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#DC2626', color: '#fff' }}
          >
            {isPending && active === 'decline'
              ? <Loader2 size={15} className="animate-spin" />
              : <XCircle size={15} />
            }
            Confirm decline
          </button>
          <button
            type="button"
            onClick={() => { setView('buttons'); setError(null) }}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-70 disabled:opacity-50"
            style={{ background: 'rgba(146,64,14,0.1)', color: '#92400E' }}
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  // ── Default: two primary CTAs ────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2.5">
      {error != null && (
        <div
          className="rounded-xl px-4 py-3 text-sm f-body"
          style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}
        >
          {error}
        </div>
      )}

      {/* Accept */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleAccept}
        className="w-full py-3.5 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{
          background: '#22C55E',
          color:      '#fff',
          boxShadow:  '0 4px 14px rgba(34,197,94,0.3)',
          opacity:    isPending && active !== 'accept' ? 0.45 : isPending ? 0.75 : 1,
        }}
      >
        {isPending && active === 'accept'
          ? <Loader2 size={16} className="animate-spin" />
          : <CheckCircle size={16} />
        }
        {isPending && active === 'accept' ? 'Accepting…' : 'Accept guide\'s offer'}
      </button>

      {/* Decline — opens confirm step */}
      <button
        type="button"
        disabled={isPending}
        onClick={() => setView('declining')}
        className="w-full py-3 rounded-2xl text-sm font-semibold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
        style={{
          background: 'rgba(220,38,38,0.07)',
          color:      '#DC2626',
          border:     '1.5px solid rgba(220,38,38,0.2)',
          opacity:    isPending ? 0.45 : 1,
        }}
      >
        <XCircle size={14} />
        Decline — keep looking
      </button>

      <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
        Declining will end this booking request.
        You can search for other trips with {guideName}.
      </p>
    </div>
  )
}
