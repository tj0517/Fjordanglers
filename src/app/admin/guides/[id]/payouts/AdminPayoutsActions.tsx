'use client'

import { useState, useTransition } from 'react'
import { adminSendPayout, adminRefundBooking } from '@/actions/admin'

interface Props {
  bookingId: string
  payoutStatus: string
  bookingStatus: string
  hasStripeAccount: boolean
}

export function AdminPayoutsActions({
  bookingId,
  payoutStatus,
  bookingStatus,
  hasStripeAccount,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [done, setDone]              = useState<string | null>(null)

  const alreadySent     = payoutStatus === 'sent'
  const alreadyReturned = payoutStatus === 'returned'

  const canSend   = !alreadySent && !alreadyReturned && ['confirmed', 'completed'].includes(bookingStatus) && hasStripeAccount
  const canRefund = !alreadyReturned && !alreadySent && ['confirmed', 'completed', 'accepted'].includes(bookingStatus)

  function sendPayout() {
    setError(null)
    setDone(null)
    startTransition(async () => {
      const res = await adminSendPayout(bookingId)
      if ('error' in res) {
        setError(res.error)
      } else {
        setDone('sent')
      }
    })
  }

  function refundBooking() {
    if (!confirm('Refund this booking? This will issue a Stripe refund to the angler and cannot be undone.')) return
    setError(null)
    setDone(null)
    startTransition(async () => {
      const res = await adminRefundBooking(bookingId)
      if ('error' in res) {
        setError(res.error)
      } else {
        setDone('returned')
      }
    })
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    fontSize: '11px', fontWeight: 600, padding: '5px 12px',
    borderRadius: '8px', border: 'none', cursor: 'pointer',
    transition: 'all 0.15s',
  }

  // Once an action succeeds, show the final state pill inline
  const finalStatus = done ?? payoutStatus

  if (finalStatus === 'sent') {
    return (
      <span
        className="text-[10px] font-bold px-2.5 py-1 rounded-full f-body"
        style={{ background: 'rgba(74,222,128,0.12)', color: '#16A34A' }}
      >
        Payout sent ✓
      </span>
    )
  }

  if (finalStatus === 'returned') {
    return (
      <span
        className="text-[10px] font-bold px-2.5 py-1 rounded-full f-body"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
      >
        Refunded ✓
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {canSend && (
          <button
            type="button"
            disabled={isPending}
            onClick={sendPayout}
            className="f-body"
            style={{
              ...btnBase,
              background: isPending ? 'rgba(74,222,128,0.08)' : 'rgba(74,222,128,0.12)',
              color: '#16A34A',
              opacity: isPending ? 0.6 : 1,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? (
              <>
                <span className="w-2.5 h-2.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(22,163,74,0.2)', borderTopColor: '#16A34A' }} />
                Sending…
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Send payout
              </>
            )}
          </button>
        )}

        {!canSend && !alreadySent && !alreadyReturned && (
          <span
            className="text-[10px] px-2.5 py-1 rounded-full f-body"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.4)' }}
          >
            {!hasStripeAccount ? 'No Stripe' : 'Pending payment'}
          </span>
        )}

        {canRefund && (
          <button
            type="button"
            disabled={isPending}
            onClick={refundBooking}
            className="f-body"
            style={{
              ...btnBase,
              background: 'rgba(239,68,68,0.07)',
              color: '#DC2626',
              opacity: isPending ? 0.6 : 1,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Refund
          </button>
        )}
      </div>

      {error != null && (
        <p
          className="text-[10px] f-body text-right max-w-[180px]"
          style={{ color: '#DC2626' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
