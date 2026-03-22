'use client'

/**
 * BalanceMethodForm — lets the guide choose how anglers pay the remaining 70% balance.
 * Uses updateBalancePaymentMethod() server action.
 * Displayed inside the "Balance payment" card on /dashboard/account.
 */

import { useState, useTransition } from 'react'
import { updateBalancePaymentMethod } from '@/actions/bookings'

interface Props {
  current: 'stripe' | 'cash'
}

export function BalanceMethodForm({ current }: Props) {
  const [selected, setSelected]   = useState<'stripe' | 'cash'>(current)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(method: 'stripe' | 'cash') {
    if (method === selected) return
    setSelected(method)
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    if (selected === current && saved) return
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateBalancePaymentMethod(selected)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  const inputStyle = {
    background: '#FDFAF7',
    border: '1.5px solid rgba(10,46,77,0.15)',
    borderRadius: '12px',
    color: '#0A2E4D',
  } as const

  const activeInputStyle = {
    ...inputStyle,
    borderColor: '#0A2E4D',
    background: 'rgba(10,46,77,0.04)',
  } as const

  return (
    <div className="px-6 py-4 flex flex-col gap-4">

      {/* Options */}
      <div className="flex flex-col gap-2">
        {/* Cash */}
        <button
          type="button"
          onClick={() => handleChange('cash')}
          className="flex items-start gap-3 p-4 text-left transition-all"
          style={selected === 'cash' ? activeInputStyle : inputStyle}
        >
          <div
            className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
            style={{
              borderColor: selected === 'cash' ? '#0A2E4D' : 'rgba(10,46,77,0.25)',
              background:  selected === 'cash' ? '#0A2E4D' : 'transparent',
            }}
          >
            {selected === 'cash' && (
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FDFAF7' }} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
              Cash on the day
            </p>
            <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Angler pays you the remaining 70% in cash on arrival.
              You mark it as received in your dashboard.
            </p>
          </div>
        </button>

        {/* Stripe */}
        <button
          type="button"
          onClick={() => handleChange('stripe')}
          className="flex items-start gap-3 p-4 text-left transition-all"
          style={selected === 'stripe' ? activeInputStyle : inputStyle}
        >
          <div
            className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
            style={{
              borderColor: selected === 'stripe' ? '#0A2E4D' : 'rgba(10,46,77,0.25)',
              background:  selected === 'stripe' ? '#0A2E4D' : 'transparent',
            }}
          >
            {selected === 'stripe' && (
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FDFAF7' }} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
              Online card payment (Stripe)
            </p>
            <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Angler pays the remaining 70% securely by card before the trip.
              Full amount transferred to your Stripe account, no platform fee.
            </p>
          </div>
        </button>
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

      {/* Save row */}
      <div className="flex items-center justify-between">
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Applied to all future accepted bookings
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs f-body font-medium" style={{ color: '#16A34A' }}>
              ✓ Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-sm font-bold f-body px-4 py-2 rounded-full transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#0A2E4D', color: '#F8FAFB' }}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
                Saving…
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
