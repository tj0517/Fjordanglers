'use client'

/**
 * BookingActions — accept/decline buttons for pending bookings in guide dashboard.
 * Client Component — uses useTransition to call Server Actions with loading state.
 */

import { useTransition, useState } from 'react'
import { acceptBooking, declineBooking } from '@/actions/bookings'

type Props = {
  bookingId: string
  onSuccess?: () => void
}

export default function BookingActions({ bookingId }: Props) {
  const [isPendingAccept, startAccept] = useTransition()
  const [isPendingDecline, startDecline] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  function handleAccept() {
    setError(null)
    startAccept(async () => {
      const result = await acceptBooking(bookingId)
      if (result.error) {
        setError(result.error)
      } else {
        setDone('accepted')
      }
    })
  }

  function handleDecline() {
    setError(null)
    startDecline(async () => {
      const result = await declineBooking(bookingId)
      if (result.error) {
        setError(result.error)
      } else {
        setDone('declined')
      }
    })
  }

  if (done === 'accepted') {
    return (
      <span
        className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
        style={{ background: 'rgba(59,130,246,0.1)', color: '#2563EB' }}
      >
        Accepted ✓
      </span>
    )
  }

  if (done === 'declined') {
    return (
      <span
        className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#B91C1C' }}
      >
        Declined
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* Accept */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPendingAccept || isPendingDecline}
          className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-full f-body transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#16A34A' }}
        >
          {isPendingAccept ? '…' : 'Accept'}
        </button>

        {/* Decline */}
        <button
          type="button"
          onClick={handleDecline}
          disabled={isPendingAccept || isPendingDecline}
          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-full f-body transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80"
          style={{
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#DC2626',
            background: 'transparent',
          }}
        >
          {isPendingDecline ? '…' : 'Decline'}
        </button>
      </div>

      {error != null && (
        <p className="text-[10px] f-body" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}
