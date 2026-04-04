'use client'

/**
 * ShareIbanButton — guide shares their IBAN / SEPA QR code with the angler.
 *
 * When clicked:
 *   1. Calls shareIbanWithAngler() server action → sets iban_shared_at on booking
 *   2. Angler's booking page now shows IBAN + SEPA QR code
 *
 * Shown on guide's booking detail page when:
 *   - booking.status === 'confirmed'
 *   - paymentModel === 'manual'
 *   - guide has IBAN saved (guide.iban != null)
 *   - iban_shared_at is null (not yet shared)
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Loader2, CheckCircle } from 'lucide-react'
import { shareIbanWithAngler } from '@/actions/bookings'

interface Props {
  bookingId:   string
  anglerName:  string
}

export default function ShareIbanButton({ bookingId, anglerName }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [done, setDone]              = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleShare() {
    setError(null)
    startTransition(async () => {
      const result = await shareIbanWithAngler(bookingId)
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
        <CheckCircle size={15} strokeWidth={1.5} style={{ color: '#16A34A' }} />
        <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
          Bank details shared with {anglerName}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
            Share bank transfer details
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Share your IBAN & SEPA QR code so {anglerName} can pay you directly.
          </p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          disabled={isPending}
          className="flex-shrink-0 flex items-center gap-2 text-sm font-bold f-body px-4 py-2.5 rounded-full transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={13} strokeWidth={2} />
              Sharing…
            </>
          ) : (
            <>
              <QrCode size={13} strokeWidth={1.5} />
              Share QR code
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
