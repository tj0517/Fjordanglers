'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptBookingOffer, declineBookingOffer } from '@/actions/bookings'
import { Loader2 } from 'lucide-react'

export default function OfferActions({ bookingId }: { bookingId: string }) {
  const router                              = useRouter()
  const [isPending, startTransition]        = useTransition()
  const [error, setError]                   = useState<string | null>(null)
  const [confirmingDecline, setConfirming]  = useState(false)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptBookingOffer(bookingId)
      if ('error' in result) { setError(result.error); return }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        window.location.href = `/account/trips/${bookingId}?status=accepted`
      }
    })
  }

  function handleDecline() {
    setError(null)
    startTransition(async () => {
      const result = await declineBookingOffer(bookingId)
      if (result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  // ── Confirm step ─────────────────────────────────────────────────────────

  if (confirmingDecline) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="px-4 py-3.5 rounded-2xl text-center"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}
        >
          <p className="text-sm font-semibold f-body mb-0.5" style={{ color: '#DC2626' }}>
            Pass on this offer?
          </p>
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            You won&apos;t be charged anything. You can request a new trip anytime.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isPending}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold f-body transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
            style={{ background: '#DC2626', color: '#fff' }}
          >
            {isPending
              ? <Loader2 size={16} className="animate-spin" />
              : 'Yes, pass on it'}
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); setError(null) }}
            disabled={isPending}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold f-body transition-all hover:opacity-75 disabled:opacity-40"
            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.65)' }}
          >
            Keep offer
          </button>
        </div>
        {error != null && (
          <p className="text-xs f-body text-center" style={{ color: '#DC2626' }}>{error}</p>
        )}
      </div>
    )
  }

  // ── Default ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="w-full py-4 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#E67E50' }}
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Redirecting…</>
        ) : (
          'Accept Offer & Pay deposit →'
        )}
      </button>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="w-full py-3 rounded-2xl text-sm font-medium f-body transition-all hover:opacity-80 disabled:opacity-40"
        style={{
          background:  'transparent',
          border:      '1px solid rgba(10,46,77,0.1)',
          color:       'rgba(10,46,77,0.45)',
        }}
      >
        Pass on this offer
      </button>

      {error != null && (
        <p className="text-xs f-body text-center" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
