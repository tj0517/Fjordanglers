'use client'

/**
 * InquiryDeclineButton — two-step confirm before declining a request.
 * Calls `declineInquiry` server action then redirects to the list.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { declineInquiry } from '@/actions/inquiries'

// ─── Component ────────────────────────────────────────────────────────────────

export default function InquiryDeclineButton({ inquiryId }: { inquiryId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const router = useRouter()

  function handleDecline() {
    setError(null)
    startTransition(async () => {
      const result = await declineInquiry(inquiryId)
      if (result.error != null) {
        setError(result.error)
        setConfirm(false)
      } else {
        router.push('/dashboard/bookings?view=requests')
      }
    })
  }

  // ── First click: show confirm ─────────────────────────────────────────────
  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="w-full py-3 rounded-xl text-sm f-body font-semibold transition-all"
        style={{
          background: 'rgba(239,68,68,0.07)',
          border:     '1px solid rgba(239,68,68,0.18)',
          color:      '#DC2626',
          cursor:     'pointer',
        }}
      >
        Decline request
      </button>
    )
  }

  // ── Confirm step ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2.5">
      <p
        className="text-xs f-body text-center"
        style={{ color: 'rgba(10,46,77,0.5)' }}
      >
        Decline this request? The angler won&apos;t be notified automatically.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => { setConfirm(false); setError(null) }}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-xl text-sm f-body font-semibold transition-all"
          style={{
            background: 'rgba(10,46,77,0.07)',
            color:      '#0A2E4D',
            border:     'none',
            cursor:     isPending ? 'not-allowed' : 'pointer',
            opacity:    isPending ? 0.5 : 1,
          }}
        >
          Keep
        </button>

        <button
          onClick={handleDecline}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-xl text-sm f-body font-semibold transition-all"
          style={{
            background: isPending ? 'rgba(220,38,38,0.55)' : '#DC2626',
            color:      'white',
            border:     'none',
            cursor:     isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Declining…' : 'Yes, decline'}
        </button>
      </div>

      {error != null && (
        <p
          className="text-xs f-body text-center"
          style={{ color: '#DC2626' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
