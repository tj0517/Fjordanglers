'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { useLockedAction } from '@/components/admin/use-locked-action'
import { recordPastLossAction } from '@/actions/inquiries'
import { LOST_REASON_CODE_KEYS, LOST_REASON_LABELS, type LostReasonCode } from '@/lib/inquiries/state'

interface Props {
  inquiryId:      string
  currentStatus:  string
  depositPaidAt:  string | null
}

const PRIMARY = 'h-11 px-5 rounded-xl text-sm font-bold f-body bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
const SECONDARY = 'h-10 px-4 rounded-xl text-sm font-semibold f-body border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT = 'h-11 px-3.5 rounded-xl text-sm f-body outline-none bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 w-full'

/** "Mark lost in the past" — FA-1.38. For a deal that was already lost before anyone
 *  clicked the status pill today; leaves the loss on its real date instead of today's.
 *  Hidden once the inquiry is already lost or has a deposit recorded. */
export function RecordPastLossForm({ inquiryId, currentStatus, depositPaidAt }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lostOn, setLostOn] = useState('')
  const [lostReasonCode, setLostReasonCode] = useState<LostReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, run] = useLockedAction()

  if (currentStatus === 'lost' || depositPaidAt != null) return null

  function handleSubmit() {
    if (lostOn === '') {
      setError('Pick a date')
      return
    }
    if (lostReasonCode === '') {
      setError('Select a reason')
      return
    }
    setError(null)
    const reasonCode = lostReasonCode
    run(async () => {
      const res = await recordPastLossAction(inquiryId, {
        lostOn,
        lostReasonCode: reasonCode,
        note: note.trim() === '' ? null : note.trim(),
      })
      if (res.success) {
        setDone(true)
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
        <Check size={12} className="text-emerald-700" />
        <p className="text-xs font-semibold f-body text-emerald-700">Loss recorded</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY}>
        Mark lost in the past
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5 flex flex-col gap-4" data-testid="record-past-loss-form">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">
        Mark lost in the past
      </p>
      <p className="text-xs f-body text-muted-foreground max-w-[440px]">
        Jumps straight to Lost with the real date it happened — for a deal you forgot to
        close out at the time.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold f-body text-muted-foreground">Lost on</span>
        <input
          type="date"
          value={lostOn}
          max={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })}
          onChange={e => setLostOn(e.target.value)}
          className={INPUT}
          disabled={isPending}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold f-body text-muted-foreground">Reason</span>
        <select
          value={lostReasonCode}
          onChange={e => setLostReasonCode(e.target.value as LostReasonCode | '')}
          className={INPUT}
          disabled={isPending}
        >
          <option value="" disabled>Select reason (required)</option>
          {LOST_REASON_CODE_KEYS.map(key => (
            <option key={key} value={key}>{LOST_REASON_LABELS[key]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold f-body text-muted-foreground">Note (optional)</span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className={`${INPUT} h-auto py-2.5 resize-none`}
          disabled={isPending}
        />
      </label>

      {error != null && <p className="text-xs f-body text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={handleSubmit} disabled={isPending} className={PRIMARY}>
          {isPending ? <Loader2 size={12} className="animate-spin inline mr-1.5" /> : null}
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={isPending} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </section>
  )
}
