'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { updateInquiryStatus } from '@/actions/inquiries'

// All statuses FA can set manually
const STATUSES = [
  { key: 'pending_fa_review', label: 'Pending',       color: '#92400E', bg: 'rgba(251,191,36,0.2)',  border: 'rgba(251,191,36,0.45)' },
  { key: 'in_negotiation',    label: 'Negotiating',   color: '#5B21B6', bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.4)'  },
  { key: 'deposit_sent',      label: 'Deposit Sent',  color: '#1E40AF', bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.35)' },
  { key: 'deposit_paid',      label: 'Confirmed',     color: '#065F46', bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.35)' },
  { key: 'completed',         label: 'Completed',     color: '#D1D5DB', bg: 'rgba(107,114,128,0.18)',border: 'rgba(107,114,128,0.35)' },
  { key: 'lost',              label: 'Lost',          color: '#FCA5A5', bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.35)'  },
  { key: 'cancelled',         label: 'Cancelled',     color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)'  },
] as const

type StatusKey = typeof STATUSES[number]['key']

export function StatusChanger({
  inquiryId,
  currentStatus,
}: {
  inquiryId: string
  currentStatus: string
}) {
  const router           = useRouter()
  const [pending, start]  = useTransition()
  const [changingTo, setChangingTo] = useState<StatusKey | null>(null)
  const [showLostInput, setShowLostInput] = useState(false)
  const [lostReason, setLostReason]       = useState('')
  const [error, setError]                 = useState<string | null>(null)

  function handleClick(key: StatusKey) {
    if (key === currentStatus) return
    if (key === 'lost') {
      setShowLostInput(true)
      return
    }
    setShowLostInput(false)
    setError(null)
    setChangingTo(key)
    start(async () => {
      const res = await updateInquiryStatus(inquiryId, key)
      setChangingTo(null)
      if (res.success) router.refresh()
      else setError(res.error)
    })
  }

  function handleConfirmLost() {
    setError(null)
    setChangingTo('lost')
    start(async () => {
      const res = await updateInquiryStatus(inquiryId, 'lost', lostReason.trim() || null)
      setChangingTo(null)
      if (res.success) {
        setShowLostInput(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div
      className="rounded-[20px] overflow-hidden"
      style={{ background: 'rgba(10,46,77,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
          style={{ color: 'rgba(255,255,255,0.28)' }}>Deal status</p>
        <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>Set status</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Status pill grid */}
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => {
            const isActive  = currentStatus === s.key
            const isLoading = changingTo === s.key

            return (
              <button
                key={s.key}
                type="button"
                disabled={pending}
                onClick={() => handleClick(s.key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold f-body transition-all"
                style={{
                  background: isActive ? s.bg : 'rgba(255,255,255,0.05)',
                  color:      isActive ? s.color : 'rgba(255,255,255,0.4)',
                  border:     isActive ? `1px solid ${s.border}` : '1px solid rgba(255,255,255,0.08)',
                  cursor:     isActive || pending ? 'default' : 'pointer',
                  opacity:    pending && !isActive && !isLoading ? 0.5 : 1,
                }}
              >
                {isLoading
                  ? <Loader2 size={9} className="animate-spin" />
                  : isActive && <span style={{ fontSize: '7px' }}>●</span>
                }
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Lost reason input */}
        {showLostInput && (
          <div className="space-y-2">
            <input
              type="text"
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              placeholder="Why was this lost? (optional)"
              autoFocus
              className="w-full px-3 py-2 rounded-xl text-xs f-body outline-none placeholder:opacity-30"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border:     '1px solid rgba(239,68,68,0.3)',
                color:      '#FFFFFF',
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowLostInput(false); setLostReason('') }}
                className="flex-1 py-2 rounded-xl text-[10px] font-semibold f-body"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color:      'rgba(255,255,255,0.4)',
                  border:     '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirmLost}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold f-body"
                style={{
                  background: 'rgba(239,68,68,0.22)',
                  color:      '#FCA5A5',
                  border:     '1px solid rgba(239,68,68,0.35)',
                }}
              >
                {changingTo === 'lost' && <Loader2 size={9} className="animate-spin" />}
                Mark as Lost
              </button>
            </div>
          </div>
        )}

        {error != null && (
          <p className="text-[10px] f-body" style={{ color: '#FCA5A5' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
