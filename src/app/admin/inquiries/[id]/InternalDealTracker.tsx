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
    <div className="rounded-[20px] overflow-hidden bg-primary/40 border border-white/[6%]">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[6%]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-white/25">
            Internal only · no email
          </p>
          <p className="text-sm font-bold f-body mt-0.5 text-white">Deal tracker</p>
        </div>

        {/* EUR / USD toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/[12%]">
          {(['EUR', 'USD'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold f-body transition-all cursor-pointer',
                currency === c ? 'bg-white/15 text-white' : 'bg-transparent text-white/35',
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <Check size={12} className="text-emerald-300" />
            <p className="text-xs f-body font-semibold text-emerald-300">Saved</p>
          </div>
        )}

        {/* Deal total */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-white/35">
            Deal total ({currency})
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[6%] border border-white/10">
            <span className="text-sm font-bold f-body text-white/[28%]">{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="1200.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-25 text-white"
            />
          </div>
        </div>

        {/* Our commission */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 flex items-center gap-2 text-white/35">
            Our commission ({currency})
            {commissionPct != null && (
              <span className="font-bold text-accent">{commissionPct}%</span>
            )}
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[6%] border border-white/10">
            <span className="text-sm font-bold f-body text-white/[28%]">{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={commission}
              onChange={e => setCommission(e.target.value)}
              placeholder="120.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-25 text-accent"
            />
          </div>
        </div>

        {/* Net to guide (calculated) */}
        {netGuide != null && netGuide >= 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[4%] border border-white/[7%]">
            <span className="text-[10px] f-body uppercase tracking-[0.12em] text-white/[28%]">
              Guide gets
            </span>
            <span className="text-xs font-bold f-body text-white/55">
              {currencySymbol}{netGuide.toFixed(2)}
            </span>
          </div>
        )}

        {/* Internal notes */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-white/35">
            Internal notes <span className="font-normal opacity-55">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Negotiated down from €1400, guide confirmed availability…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-none placeholder:opacity-25 bg-white/[6%] border border-white/10 text-white"
          />
        </div>

        {error != null && (
          <p className="text-[10px] f-body text-red-300">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all bg-white/[8%] border border-white/10 text-white/70 disabled:text-white/30 disabled:cursor-not-allowed"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Saving…' : 'Save internally (no email)'}
        </button>

      </div>
    </div>
  )
}
