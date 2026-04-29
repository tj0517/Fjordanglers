'use client'

/**
 * SendDepositButton — FA clicks this to create a Stripe Checkout session
 * and send the deposit link to the angler.
 *
 * Calls the sendDepositLink Server Action.
 * On success: shows the checkout URL + copy / open buttons.
 */

import { useState, useTransition } from 'react'
import { sendDepositLink } from '@/actions/inquiries'
import { Loader2, Check, Copy, ExternalLink } from 'lucide-react'

export function SendDepositButton({
  inquiryId,
  defaultPercent = 30,
}: {
  inquiryId: string
  defaultPercent?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [depositPercent, setDepositPercent] = useState(defaultPercent)
  const [result, setResult] = useState<{ url: string } | { error: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function handleSend() {
    startTransition(async () => {
      const res = await sendDepositLink(inquiryId, depositPercent)
      if (res.success) {
        setResult({ url: res.checkoutUrl })
      } else {
        setResult({ error: res.error })
      }
    })
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (result != null && 'url' in result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Check size={15} style={{ color: '#6EE7B7', flexShrink: 0 }} />
          <p className="text-sm font-semibold f-body" style={{ color: '#6EE7B7' }}>
            Deposit link sent to angler
          </p>
        </div>

        <div className="px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] f-body mb-1"
            style={{ color: 'rgba(255,255,255,0.3)' }}>Checkout URL</p>
          <p className="text-[11px] f-body break-all" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {result.url}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleCopy((result as { url: string }).url)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <a
            href={(result as { url: string }).url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body transition-all"
            style={{ background: '#E67E50', color: '#fff' }}
          >
            <ExternalLink size={13} />
            Open Stripe
          </a>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (result != null && 'error' in result) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm f-body" style={{ color: '#FCA5A5' }}>{result.error}</p>
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold f-body"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Default: deposit % selector + send button ─────────────────────────────
  return (
    <div className="space-y-3">
      {/* Deposit % selector */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-2 block"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Deposit %
        </label>
        <div className="flex gap-2 flex-wrap">
          {[20, 25, 30, 40, 50].map(pct => (
            <button
              key={pct}
              type="button"
              onClick={() => setDepositPercent(pct)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold f-body transition-all"
              style={{
                background: depositPercent === pct ? '#E67E50'               : 'rgba(255,255,255,0.08)',
                color:      depositPercent === pct ? '#fff'                   : 'rgba(255,255,255,0.5)',
                border:     depositPercent === pct ? '1px solid transparent'  : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold f-body transition-all"
        style={{
          background: isPending ? 'rgba(230,126,80,0.55)' : '#E67E50',
          color:      '#fff',
          cursor:     isPending ? 'not-allowed' : 'pointer',
          boxShadow:  isPending ? 'none' : '0 4px 16px rgba(230,126,80,0.4)',
        }}
      >
        {isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Sending…</>
        ) : (
          `Send ${depositPercent}% Deposit Link →`
        )}
      </button>

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Angler pays via Stripe · FA receives the deposit directly
      </p>
    </div>
  )
}
