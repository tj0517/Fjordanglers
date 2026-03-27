'use client'

import { useState, useTransition } from 'react'
import { syncStripeAccountStatus } from '@/actions/stripe-connect'

export function StripeSyncButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult]          = useState<'ok' | 'err' | null>(null)
  const [msg, setMsg]                = useState<string | null>(null)

  function handleClick() {
    setResult(null)
    setMsg(null)
    startTransition(async () => {
      const res = await syncStripeAccountStatus()
      if ('error' in res) {
        setResult('err')
        setMsg(res.error)
      } else {
        setResult('ok')
        setMsg(res.payoutsEnabled ? 'Payouts enabled ✓' : 'Synced — account still under review')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="self-start inline-flex items-center gap-2 text-xs font-semibold f-body px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
      >
        {isPending ? (
          <>
            <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(10,46,77,0.2)', borderTopColor: '#0A2E4D' }} />
            Syncing…
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            Sync status from Stripe
          </>
        )}
      </button>

      {msg != null && (
        <p
          className="text-xs f-body px-3 py-2 rounded-xl"
          style={{
            background: result === 'ok' ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.07)',
            color:      result === 'ok' ? '#16A34A'               : '#DC2626',
          }}
        >
          {msg}
        </p>
      )}
    </div>
  )
}
