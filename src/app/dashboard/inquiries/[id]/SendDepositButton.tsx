'use client'

/**
 * SendDepositButton — FA clicks this to create a Stripe Checkout session
 * and send the deposit link to the angler.
 *
 * Calls the sendDepositLink Server Action.
 * On success: shows the checkout URL and copies it to clipboard.
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

  // ── Success state ──────────────────────────────────────────────────────
  if (result != null && 'url' in result) {
    return (
      <div className="space-y-3">
        {/* Success badge */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Check size={16} style={{ color: '#065F46', flexShrink: 0 }} />
          <p className="text-sm font-semibold f-body" style={{ color: '#065F46' }}>
            Deposit link sent to angler via email
          </p>
        </div>

        {/* URL display */}
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-1"
            style={{ color: 'rgba(10,46,77,0.4)' }}>Checkout URL</p>
          <p className="text-xs f-body break-all" style={{ color: '#0A2E4D' }}>{result.url}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleCopy((result as { url: string }).url)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body transition-all"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a
            href={(result as { url: string }).url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body transition-all"
            style={{ background: '#E67E50', color: '#fff' }}
          >
            <ExternalLink size={14} />
            Open Stripe
          </a>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (result != null && 'error' in result) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm f-body" style={{ color: '#991B1B' }}>{result.error}</p>
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="w-full py-2 rounded-xl text-sm font-semibold f-body"
          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.6)' }}
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Default: send button ──────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Deposit % selector */}
      <div>
        <label className="text-xs font-bold uppercase tracking-[0.12em] f-body mb-2 block"
          style={{ color: 'rgba(10,46,77,0.5)' }}>
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
                background: depositPercent === pct ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
                color:      depositPercent === pct ? '#fff'    : 'rgba(10,46,77,0.6)',
                border:     depositPercent === pct ? 'none'    : '1px solid rgba(10,46,77,0.1)',
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
          background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
          color:      '#fff',
          cursor:     isPending ? 'not-allowed' : 'pointer',
          boxShadow:  isPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
        }}
      >
        {isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Sending…</>
        ) : (
          `Send ${depositPercent}% Deposit Link →`
        )}
      </button>

      <p className="text-[11px] f-body text-center" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Angler pays via Stripe. FA receives the deposit directly.
      </p>
    </div>
  )
}
