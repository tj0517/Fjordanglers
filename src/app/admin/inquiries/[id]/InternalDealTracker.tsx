'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
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
    <div
      className="rounded-[20px] overflow-hidden"
      style={{ background: 'rgba(10,46,77,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Internal only · no email</p>
          <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>Deal tracker</p>
        </div>

        {/* EUR / USD toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
          {(['EUR', 'USD'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className="px-2.5 py-1 text-[10px] font-bold f-body transition-all"
              style={{
                background: currency === c ? 'rgba(255,255,255,0.15)' : 'transparent',
                color:      currency === c ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                cursor:     'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Flash */}
        {flash && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={12} style={{ color: '#6EE7B7' }} />
            <p className="text-xs f-body font-semibold" style={{ color: '#6EE7B7' }}>Saved</p>
          </div>
        )}

        {/* Deal total */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Deal total ({currency})
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-sm font-bold f-body" style={{ color: 'rgba(255,255,255,0.28)' }}>{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="1200.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-25"
              style={{ color: '#FFFFFF' }}
            />
          </div>
        </div>

        {/* Our commission */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 flex items-center gap-2"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Our commission ({currency})
            {commissionPct != null && (
              <span className="font-bold" style={{ color: '#E67E50' }}>{commissionPct}%</span>
            )}
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-sm font-bold f-body" style={{ color: 'rgba(255,255,255,0.28)' }}>{currencySymbol}</span>
            <input
              type="number" min="0" step="0.01"
              value={commission}
              onChange={e => setCommission(e.target.value)}
              placeholder="120.00"
              className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-25"
              style={{ color: '#E67E50' }}
            />
          </div>
        </div>

        {/* Net to guide (calculated) */}
        {netGuide != null && netGuide >= 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[10px] f-body uppercase tracking-[0.12em]"
              style={{ color: 'rgba(255,255,255,0.28)' }}>Guide gets</span>
            <span className="text-xs font-bold f-body" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {currencySymbol}{netGuide.toFixed(2)}
            </span>
          </div>
        )}

        {/* Internal notes */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Internal notes <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Negotiated down from €1400, guide confirmed availability…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-none placeholder:opacity-25"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border:     '1px solid rgba(255,255,255,0.1)',
              color:      '#FFFFFF',
            }}
          />
        </div>

        {error != null && (
          <p className="text-[10px] f-body" style={{ color: '#FCA5A5' }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color:      pending ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
            border:     '1px solid rgba(255,255,255,0.1)',
            cursor:     pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Saving…' : 'Save internally (no email)'}
        </button>

      </div>
    </div>
  )
}
