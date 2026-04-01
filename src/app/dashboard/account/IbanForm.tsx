'use client'

/**
 * IbanForm — guide saves IBAN details for the manual payment model.
 *
 * Shown in /dashboard/account when the guide doesn't have Stripe Connect active.
 * Anglers are shown this IBAN after booking confirmation to pay the guide's net
 * amount directly (the platform fee is collected via Stripe Direct Charge separately).
 */

import { useState, useTransition } from 'react'
import { updateGuideIban } from '@/actions/bookings'
import { Check, Loader2 } from 'lucide-react'

type Props = {
  current: {
    iban:             string | null
    iban_holder_name: string | null
    iban_bic:         string | null
    iban_bank_name:   string | null
  }
}

export function IbanForm({ current }: Props) {
  const [iban,       setIban]       = useState(current.iban             ?? '')
  const [holderName, setHolderName] = useState(current.iban_holder_name ?? '')
  const [bic,        setBic]        = useState(current.iban_bic         ?? '')
  const [bankName,   setBankName]   = useState(current.iban_bank_name   ?? '')

  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await updateGuideIban({
        iban:             iban       || null,
        iban_holder_name: holderName || null,
        iban_bic:         bic        || null,
        iban_bank_name:   bankName   || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    background:   '#F3EDE4',
    border:       '1.5px solid rgba(10,46,77,0.12)',
    borderRadius: '12px',
    padding:      '10px 14px',
    fontSize:     '13px',
    color:        '#0A2E4D',
    outline:      'none',
    transition:   'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display:       'block',
    fontSize:      '10px',
    fontWeight:    700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    color:         'rgba(10,46,77,0.4)',
    marginBottom:  '5px',
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

      {/* Info banner */}
      <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
        Anglers pay the rest directly to your bank account after booking.
        FjordAnglers will show them these details alongside their booking confirmation.
      </p>

      {/* IBAN + Holder name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="f-body" style={labelStyle}>IBAN</label>
          <input
            type="text"
            value={iban}
            onChange={e => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="PL61109010140000071219812874"
            maxLength={34}
            className="f-body"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="f-body" style={labelStyle}>Account holder name</label>
          <input
            type="text"
            value={holderName}
            onChange={e => setHolderName(e.target.value)}
            placeholder="Jan Kowalski"
            maxLength={100}
            className="f-body"
            style={inputStyle}
          />
        </div>
      </div>

      {/* BIC + Bank name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="f-body" style={labelStyle}>BIC / SWIFT</label>
          <input
            type="text"
            value={bic}
            onChange={e => setBic(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="WBKPPLPP"
            maxLength={11}
            className="f-body"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="f-body" style={labelStyle}>
            Bank name{' '}
            <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            placeholder="Santander Bank"
            maxLength={100}
            className="f-body"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Error */}
      {error != null && (
        <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"
          style={{ background: '#0A2E4D', color: 'white' }}
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Save bank details
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-xs f-body" style={{ color: '#16A34A' }}>
            <Check size={12} strokeWidth={2.5} />
            Saved
          </div>
        )}
      </div>
    </form>
  )
}
