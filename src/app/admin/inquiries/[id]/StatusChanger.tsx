'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateInquiryStatus } from '@/actions/inquiries'
import {
  STATUSES as MACHINE_STATUSES,
  STATUS_LABELS,
  STATUS_MEANINGS,
  canTransition,
  isInquiryStatus,
  type InquiryStatus,
} from '@/lib/inquiries/state'

// List is driven by the state machine — only STATUS_LABELS / STATUS_MEANINGS are local.
const STATUSES = MACHINE_STATUSES.map(key => ({
  key,
  label:   STATUS_LABELS[key],
  meaning: STATUS_MEANINGS[key],
}))

const LOST_REASON_CODES: { key: string; label: string }[] = [
  { key: 'client_silent',  label: 'Client went silent'       },
  { key: 'no_guide',       label: 'No guide available'       },
  { key: 'guide_slow',     label: 'Guide too slow'           },
  { key: 'price',          label: 'Price too high'           },
  { key: 'changed_plans',  label: 'Client changed plans'     },
  { key: 'went_elsewhere', label: 'Went to another operator' },
  { key: 'other',          label: 'Other'                    },
]

type StatusKey = InquiryStatus

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
  const [lostReasonCode, setLostReasonCode] = useState<string>('')
  const [lostComment, setLostComment]       = useState('')
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
    if (!lostReasonCode) {
      setError('Please select a reason.')
      return
    }
    setError(null)
    setChangingTo('lost')
    start(async () => {
      const res = await updateInquiryStatus(
        inquiryId,
        'lost',
        lostReasonCode,
        lostComment.trim() || null,
      )
      setChangingTo(null)
      if (res.success) {
        setShowLostInput(false)
        setLostReasonCode('')
        setLostComment('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="rounded-[20px] overflow-hidden bg-card border border-border">
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-muted-foreground">
          Deal status
        </p>
        <p className="text-sm font-bold f-body mt-0.5 text-foreground">Set status</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Status pill grid — a status the machine will not accept from here is
            greyed out rather than hidden, so the whole process stays readable. */}
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => {
            const isActive  = currentStatus === s.key
            const isLoading = changingTo === s.key
            const isAllowed = canTransition(currentStatus, s.key)
            const disabled  = pending || (!isActive && !isAllowed)

            return (
              <button
                key={s.key}
                type="button"
                disabled={disabled}
                title={isActive || isAllowed
                  ? s.meaning
                  : `${s.meaning} — not reachable from ${currentStatus}`}
                onClick={() => handleClick(s.key)}
                // Active → use .status-badge data-attribute colours (light-bg palette).
                // Inactive → white/translucent on the dark navy panel.
                data-status={isActive ? s.key : undefined}
                className={cn(
                  'status-badge flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold f-body transition-all',
                  !isActive && 'bg-muted text-muted-foreground border border-border',
                  !isActive && !isAllowed && 'opacity-25',
                  !isActive && isAllowed && pending && 'opacity-50',
                  (isActive || disabled) ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                {isLoading
                  ? <Loader2 size={9} className="animate-spin" />
                  : isActive && <span className="text-[7px]">●</span>
                }
                {s.label}
              </button>
            )
          })}
        </div>

        {!isInquiryStatus(currentStatus) && (
          <p className="text-[10px] f-body text-destructive">
            This inquiry holds the retired status <strong>{currentStatus}</strong>, which has no
            allowed moves. Tell tj — it should have been migrated.
          </p>
        )}

        {/* Lost form */}
        {showLostInput && (
          <div className="space-y-2">
            {/* Required: reason code */}
            <select
              value={lostReasonCode}
              onChange={e => setLostReasonCode(e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-xl text-xs f-body outline-none bg-muted/40 text-foreground border',
                lostReasonCode
                  ? 'border-red-500/50'
                  : 'border-red-500/30 text-muted-foreground',
              )}
            >
              <option value="" disabled>Select reason (required)</option>
              {LOST_REASON_CODES.map(r => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Optional: free-text comment */}
            <input
              type="text"
              value={lostComment}
              onChange={e => setLostComment(e.target.value)}
              placeholder="Comment (optional)"
              className="w-full px-3 py-2 rounded-xl text-xs f-body outline-none placeholder:text-muted-foreground/50 bg-muted/40 border border-red-500/20 text-foreground"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowLostInput(false); setLostReasonCode(''); setLostComment('') }}
                className="flex-1 py-2 rounded-xl text-[10px] font-semibold f-body bg-muted text-muted-foreground border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !lostReasonCode}
                onClick={handleConfirmLost}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold f-body border',
                  lostReasonCode
                    ? 'bg-red-50 text-red-700 border-red-200 cursor-pointer'
                    : 'bg-muted text-muted-foreground/50 border-border cursor-not-allowed',
                )}
              >
                {changingTo === 'lost' && <Loader2 size={9} className="animate-spin" />}
                Mark as Lost
              </button>
            </div>
          </div>
        )}

        {error != null && (
          <p className="text-[10px] f-body text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
