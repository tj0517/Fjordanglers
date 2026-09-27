'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { useLockedAction } from '@/components/admin/use-locked-action'
import { recordPastOfferAction } from '@/actions/inquiries'

interface Props {
  inquiryId:    string
  offerSentAt:  string | null
}

const PRIMARY = 'h-11 px-5 rounded-xl text-sm font-bold f-body bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
const SECONDARY = 'h-10 px-4 rounded-xl text-sm font-semibold f-body border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT = 'h-11 px-3.5 rounded-xl text-sm f-body outline-none bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 w-full'

/** "Record past offer date" — FA-1.38. Covers the 24 offers sent by hand outside the
 *  app, where nothing ever set `offer_sent_at`. Only shown while it is still unset. */
export function RecordPastOfferForm({ inquiryId, offerSentAt }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sentOn, setSentOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, run] = useLockedAction()

  if (offerSentAt != null) return null

  function handleSubmit() {
    if (sentOn === '') {
      setError('Pick a date')
      return
    }
    setError(null)
    run(async () => {
      const res = await recordPastOfferAction(inquiryId, { sentOn })
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
        <p className="text-xs font-semibold f-body text-emerald-700">Offer date recorded</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY}>
        Record past offer date
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5 flex flex-col gap-4" data-testid="record-past-offer-form">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">
        Record past offer date
      </p>
      <p className="text-xs f-body text-muted-foreground max-w-[440px]">
        For an offer that was sent by hand outside the app. Leaves a real
        &quot;offer presented&quot; event with the actual date.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold f-body text-muted-foreground">Sent on</span>
        <input
          type="date"
          value={sentOn}
          max={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })}
          onChange={e => setSentOn(e.target.value)}
          className={INPUT}
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
