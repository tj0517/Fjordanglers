'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveInternalDeal } from '@/actions/inquiries'

interface Props {
  inquiryId:          string
  initialTotal:       number | null
  initialCommission:  number | null
  initialNotes:       string | null
  initialCurrency?:   'EUR' | 'USD'
}

export function InternalDealTracker({
  inquiryId,
  initialTotal,
  initialCommission,
  initialNotes,
  initialCurrency = 'EUR',
}: Props) {
  const router           = useRouter()
  const [pending, start]  = useTransition()
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [total,      setTotal]      = useState(initialTotal?.toFixed(2)      ?? '')
  const [commission, setCommission] = useState(initialCommission?.toFixed(2) ?? '')
  const [notes,      setNotes]      = useState(initialNotes ?? '')
  const [currency,   setCurrency]   = useState<'EUR' | 'USD'>(initialCurrency)

  const currencySymbol = currency === 'USD' ? '$' : '€'

  const parsedTotal      = parseFloat(total)
  const parsedCommission = parseFloat(commission)

  const commissionPct =
    Number.isFinite(parsedTotal) && Number.isFinite(parsedCommission) && parsedTotal > 0
      ? ((parsedCommission / parsedTotal) * 100).toFixed(1)
      : null

  const netGuide =
    Number.isFinite(parsedTotal) && Number.isFinite(parsedCommission)
      ? parsedTotal - parsedCommission
      : null

  function handleSave() {
    setError(null)
    start(async () => {
      const res = await saveInternalDeal(inquiryId, {
        dealTotalEur:  Number.isFinite(parsedTotal)      ? parsedTotal      : null,
        commissionEur: Number.isFinite(parsedCommission) ? parsedCommission : null,
        internalNotes: notes.trim() || null,
        dealCurrency:  currency,
      })
      if (res.success) {
        setFlash(true)
        setTimeout(() => setFlash(false), 3000)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="rounded-[20px] overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-border">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-muted-foreground">
            Internal only · no email
          </p>
          <p className="text-sm font-bold f-body mt-0.5 text-foreground">Deal tracker</p>
        </div>

        {/* EUR / USD toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(['EUR', 'USD'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold f-body transition-all cursor-pointer',
                currency === c ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Flash */}
        {flash && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <Check size={12} className="text-emerald-700" />
            <p className="text-xs f-body font-semibold text-emerald-700">Saved</p>
          </div>
        )}

        {/* Deal total */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-muted-foreground">
            Deal total ({currency})
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-input">
            <span className="text-sm font-bold f-body text-muted-foreground">{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="1200.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:text-muted-foreground/50 text-foreground"
            />
          </div>
        </div>

        {/* Our commission */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 flex items-center gap-2 text-muted-foreground">
            Our commission ({currency})
            {commissionPct != null && (
              <span className="font-bold text-accent">{commissionPct}%</span>
            )}
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-input">
            <span className="text-sm font-bold f-body text-muted-foreground">{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={commission}
              onChange={e => setCommission(e.target.value)}
              placeholder="120.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:text-muted-foreground/50 text-accent"
            />
          </div>
        </div>

        {/* Net to guide (calculated) */}
        {netGuide != null && netGuide >= 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] f-body uppercase tracking-[0.12em] text-muted-foreground">
              Guide gets
            </span>
            <span className="text-xs font-bold f-body text-foreground">
              {currencySymbol}{netGuide.toFixed(2)}
            </span>
          </div>
        )}

        {/* Internal notes */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-muted-foreground">
            Internal notes <span className="font-normal opacity-55">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Negotiated down from €1400, guide confirmed availability…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-none placeholder:text-muted-foreground/50 bg-muted/40 border border-input text-foreground"
          />
        </div>

        {error != null && (
          <p className="text-[10px] f-body text-destructive">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all bg-muted border border-border text-foreground/70 disabled:text-muted-foreground/50 disabled:cursor-not-allowed"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Saving…' : 'Save internally (no email)'}
        </button>

      </div>
    </div>
  )
}
