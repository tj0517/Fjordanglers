'use client'

import { useState, useTransition } from 'react'
import { adminSetGuideStatus, adminSyncStripeStatus } from '@/actions/admin'

type GuideStatus = 'active' | 'pending' | 'suspended' | 'verified'

interface Props {
  guideId: string
  currentStatus: GuideStatus
  stripeAccountId: string | null
  stripePayoutsEnabled: boolean
  stripeChargesEnabled: boolean
}

export function AdminGuideActions({
  guideId,
  currentStatus,
  stripeAccountId,
  stripePayoutsEnabled: initialPayouts,
  stripeChargesEnabled: initialCharges,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [syncMsg, setSyncMsg]        = useState<string | null>(null)
  const [payoutsEnabled, setPayoutsEnabled] = useState(initialPayouts)
  const [chargesEnabled, setChargesEnabled] = useState(initialCharges)

  function setStatus(status: 'active' | 'suspended' | 'pending') {
    setError(null)
    startTransition(async () => {
      const res = await adminSetGuideStatus(guideId, status)
      if ('error' in res) setError(res.error)
    })
  }

  function syncStripe() {
    setError(null)
    setSyncMsg(null)
    startTransition(async () => {
      const res = await adminSyncStripeStatus(guideId)
      if ('error' in res) {
        setError(res.error)
      } else {
        setPayoutsEnabled(res.payoutsEnabled)
        setChargesEnabled(res.chargesEnabled)
        setSyncMsg(
          res.payoutsEnabled
            ? 'Synced — payouts enabled ✓'
            : 'Synced — account still under review',
        )
      }
    })
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', fontWeight: 600, padding: '7px 14px',
    borderRadius: '10px', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
    opacity: isPending ? 0.55 : 1, transition: 'all 0.15s',
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Account status actions ────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Account status
        </p>
        <div className="flex flex-wrap gap-2">
          {currentStatus !== 'active' && currentStatus !== 'verified' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setStatus('active')}
              className="f-body"
              style={{ ...btnBase, background: 'rgba(74,222,128,0.12)', color: '#16A34A' }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <polyline points="1.5,5.5 4,8 9.5,2.5" />
              </svg>
              Accept account
            </button>
          )}
          {currentStatus !== 'suspended' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setStatus('suspended')}
              className="f-body"
              style={{ ...btnBase, background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="5.5" cy="5.5" r="4.5" />
                <line x1="3.5" y1="5.5" x2="7.5" y2="5.5" />
              </svg>
              Suspend
            </button>
          )}
          {currentStatus === 'suspended' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setStatus('pending')}
              className="f-body"
              style={{ ...btnBase, background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.6)' }}
            >
              Reset to pending
            </button>
          )}
        </div>
      </div>

      {/* ── Stripe ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Stripe Connect
        </p>

        {stripeAccountId != null ? (
          <div className="flex flex-col gap-2">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              <span
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{
                  background: payoutsEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(217,119,6,0.1)',
                  color:      payoutsEnabled ? '#16A34A'               : '#B45309',
                }}
              >
                Payouts {payoutsEnabled ? 'enabled' : 'pending'}
              </span>
              <span
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{
                  background: chargesEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(10,46,77,0.06)',
                  color:      chargesEnabled ? '#16A34A'               : 'rgba(10,46,77,0.45)',
                }}
              >
                Charges {chargesEnabled ? 'enabled' : 'disabled'}
              </span>
            </div>

            {/* Account ID */}
            <p className="text-[11px] f-body font-mono" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {stripeAccountId}
            </p>

            {/* Sync button */}
            <button
              type="button"
              disabled={isPending}
              onClick={syncStripe}
              className="self-start f-body"
              style={{ ...btnBase, background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
            >
              {isPending ? (
                <>
                  <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(10,46,77,0.15)', borderTopColor: '#0A2E4D' }} />
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                  Sync from Stripe
                </>
              )}
            </button>

            {syncMsg != null && (
              <p className="text-[11px] f-body" style={{ color: '#16A34A' }}>{syncMsg}</p>
            )}
          </div>
        ) : (
          <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            No Stripe account linked
          </p>
        )}
      </div>

      {/* Error */}
      {error != null && (
        <p
          className="text-xs f-body px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
