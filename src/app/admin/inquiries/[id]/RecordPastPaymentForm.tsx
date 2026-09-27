'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { useLockedAction } from '@/components/admin/use-locked-action'
import { recordPastPaymentAction } from '@/actions/inquiries'

interface Props {
  inquiryId:     string
  depositPaidAt: string | null
}

const CURRENCIES = ['EUR', 'USD', 'ISK', 'NZD'] as const

const PRIMARY = 'h-11 px-5 rounded-xl text-sm font-bold f-body bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
const SECONDARY = 'h-10 px-4 rounded-xl text-sm font-semibold f-body border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT = 'h-11 px-3.5 rounded-xl text-sm f-body outline-none bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 w-full'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold f-body text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/** "Record past payment" — FA-1.37. Covers a booking that already happened (any date
 *  and channel — bank transfer, cash, or Stripe outside this app) and future payments
 *  outside Stripe. Only shown while the deposit has not already been recorded. */
export function RecordPastPaymentForm({ inquiryId, depositPaidAt }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [paidOn, setPaidOn] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('EUR')
  const [tripCompleted, setTripCompleted] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, run] = useLockedAction()

  if (depositPaidAt != null) return null

  function handleSubmit() {
    const amountCents = Math.round(parseFloat(amountInput) * 100)
    if (paidOn === '') {
      setError('Pick a date')
      return
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Enter a positive amount')
      return
    }
    setError(null)
    run(async () => {
      const res = await recordPastPaymentAction(inquiryId, {
        paidOn,
        amountCents,
        currency,
        finalStatus: tripCompleted ? 'completed' : 'paid',
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
        <p className="text-xs font-semibold f-body text-emerald-700">Payment recorded</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY}>
        Record past payment
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5 flex flex-col gap-4" data-testid="record-past-payment-form">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">
        Record past payment
      </p>
      <p className="text-xs f-body text-muted-foreground max-w-[440px]">
        For a booking that already happened, or one paid outside Stripe. Sets the deposit
        columns with the rate frozen at the payment date, and moves the status straight to
        paid or completed.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid on">
          <input
            type="date"
            value={paidOn}
            max={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })}
            onChange={e => setPaidOn(e.target.value)}
            className={INPUT}
            disabled={isPending}
          />
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
            className={INPUT}
            disabled={isPending}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Amount">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amountInput}
          onChange={e => setAmountInput(e.target.value)}
          placeholder="0.00"
          className={INPUT}
          disabled={isPending}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm f-body text-foreground">
        <input
          type="checkbox"
          checked={tripCompleted}
          onChange={e => setTripCompleted(e.target.checked)}
          disabled={isPending}
        />
        Trip already completed
      </label>

      <Field label="Note (optional)">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className={`${INPUT} h-auto py-2.5 resize-none`}
          disabled={isPending}
        />
      </Field>

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
