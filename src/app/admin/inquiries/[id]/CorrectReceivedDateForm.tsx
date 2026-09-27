'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { useLockedAction } from '@/components/admin/use-locked-action'
import { correctReceivedDateAction } from '@/actions/inquiries'

interface Props {
  inquiryId: string
  /** Shown only when the card detected a gap — created_at reads later than the
   *  first message (FA-1.05 audit: 7 rows like this). */
  show: boolean
}

const PRIMARY = 'h-9 px-4 rounded-xl text-xs font-bold f-body bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
const SECONDARY = 'h-9 px-3.5 rounded-xl text-xs font-semibold f-body border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT = 'h-9 px-3 rounded-xl text-xs f-body outline-none bg-muted/40 border border-input text-foreground disabled:opacity-50'

/** "Correct received date" — FA-1.38. The record was typed in after the angler's first
 *  message; this moves `created_at` to the real, earlier date. One-way toward the truth
 *  — the action itself refuses anything not strictly earlier than the current value. */
export function CorrectReceivedDateForm({ inquiryId, show }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [receivedOn, setReceivedOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, run] = useLockedAction()

  if (!show || done) {
    return done ? (
      <p className="text-[11px] f-body text-emerald-700 flex items-center gap-1">
        <Check size={10} /> Received date corrected
      </p>
    ) : null
  }

  function handleSubmit() {
    if (receivedOn === '') {
      setError('Pick a date')
      return
    }
    setError(null)
    run(async () => {
      const res = await correctReceivedDateAction(inquiryId, { receivedOn })
      if (res.success) {
        setDone(true)
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] f-body text-accent underline underline-offset-2">
        This looks later than the first message — correct the received date?
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="correct-received-date-form">
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={receivedOn}
          max={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })}
          onChange={e => setReceivedOn(e.target.value)}
          className={INPUT}
          disabled={isPending}
        />
        <button type="button" onClick={handleSubmit} disabled={isPending} className={PRIMARY}>
          {isPending ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={isPending} className={SECONDARY}>
          Cancel
        </button>
      </div>
      {error != null && <p className="text-[11px] f-body text-destructive">{error}</p>}
    </div>
  )
}
