'use client'

/**
 * MarkBalancePaidButton — shown on guide booking detail when:
 *   booking.status === 'confirmed'
 *   && balance_payment_method === 'cash'
 *   && balance_paid_at == null
 *
 * Guide clicks this to confirm they received the cash balance from the angler.
 * Calls markBalancePaid() → updates status to 'completed', sets balance_paid_at.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markBalancePaid } from '@/actions/bookings'
import { CheckCircle, Check, Loader2 } from 'lucide-react'

interface Props {
  bookingId: string
  balanceAmount: number
}

export default function MarkBalancePaidButton({ bookingId, balanceAmount }: Props) {
  const [error, setError]        = useState<string | null>(null)
  const [done, setDone]          = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleMark() {
    setError(null)
    startTransition(async () => {
      const result = await markBalancePaid(bookingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(true)
      router.refresh()
    })
  }

  if (done) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-2xl"
        style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
      >
        <CheckCircle size={16} strokeWidth={1.5} style={{ color: '#16A34A' }} />
        <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
          Balance received — booking completed
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
            Cash balance — €{balanceAmount}
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Confirm you&apos;ve received the remaining cash payment from the angler.
          </p>
        </div>
        <button
          type="button"
          onClick={handleMark}
          disabled={isPending}
          className="flex-shrink-0 flex items-center gap-2 text-sm font-bold f-body px-4 py-2.5 rounded-full transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(74,222,128,0.15)', color: '#16A34A', border: '1px solid rgba(74,222,128,0.4)' }}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={13} strokeWidth={2} style={{ color: '#16A34A' }} />
              Saving…
            </>
          ) : (
            <>
              <Check size={13} strokeWidth={1.5} />
              Mark balance received
            </>
          )}
        </button>
      </div>

      {error != null && (
        <p
          className="text-xs f-body px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
