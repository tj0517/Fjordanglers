'use client'

/**
 * AcceptedPaymentMethodsForm — guide chooses which payment methods they accept.
 * Multi-select: Cash and/or Online payment (Stripe).
 * Shown publicly on the guide profile and trip pages.
 * Displayed inside the "Accepted payment methods" card on /dashboard/account.
 */

import { useState, useTransition } from 'react'
import { updateAcceptedPaymentMethods } from '@/actions/bookings'
import { HelpWidget } from '@/components/ui/help-widget'

type Method = 'cash' | 'online'

interface Props {
  current: Method[]
}

const OPTIONS: { value: Method; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'cash',
    label: 'Cash',
    description: 'Collected in person on the day of the trip.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    value: 'online',
    label: 'Online payment',
    description: 'Secure card payment via Stripe before the trip.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
]

export function AcceptedPaymentMethodsForm({ current }: Props) {
  const [selected, setSelected]      = useState<Method[]>(current.length > 0 ? current : ['cash', 'online'])
  const [saved, setSaved]            = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(method: Method) {
    setSelected(prev => {
      if (prev.includes(method)) {
        // Keep at least one selected
        if (prev.length === 1) return prev
        return prev.filter(m => m !== method)
      }
      return [...prev, method]
    })
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    if (selected.length === 0) {
      setError('Select at least one accepted payment method.')
      return
    }
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateAcceptedPaymentMethods(selected)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  const cardBase = {
    background:   '#FDFAF7',
    border:       '1.5px solid rgba(10,46,77,0.15)',
    borderRadius: '12px',
  } as const

  const cardActive = {
    ...cardBase,
    borderColor: '#0A2E4D',
    background:  'rgba(10,46,77,0.04)',
  } as const

  return (
    <div className="px-6 py-4 flex flex-col gap-4">

      {/* Help */}
      <div className="flex items-center gap-2">
        <HelpWidget
          title="Accepted payment methods"
          description="Choose which payment methods you accept from anglers. Shown publicly on your profile."
          items={[
            { icon: '💵', title: 'Cash', text: 'Angler pays you in cash on arrival. No card processing fees. You record receipt manually in your dashboard.' },
            { icon: '💳', title: 'Online payment', text: 'Angler pays securely by card via Stripe. Funds transferred to your bank account on the weekly payout schedule.' },
            { icon: '✅', title: 'Both options', text: 'Recommended — gives anglers flexibility. Most European anglers prefer card payment for long-distance bookings.' },
          ]}
        />
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => {
          const isActive = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              aria-pressed={isActive}
              className="flex items-start gap-3 p-4 text-left transition-all"
              style={isActive ? cardActive : cardBase}
            >
              {/* Checkbox */}
              <div
                className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={{
                  borderWidth:  '2px',
                  borderStyle:  'solid',
                  borderColor:  isActive ? '#0A2E4D' : 'rgba(10,46,77,0.25)',
                  borderRadius: '4px',
                  background:   isActive ? '#0A2E4D' : 'transparent',
                }}
              >
                {isActive && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Icon */}
              <span
                className="flex-shrink-0 mt-0.5"
                style={{ color: isActive ? '#0A2E4D' : 'rgba(10,46,77,0.4)' }}
              >
                {opt.icon}
              </span>

              {/* Text */}
              <div>
                <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                  {opt.label}
                </p>
                <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {opt.description}
                </p>
              </div>
            </button>
          )
        })}
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
          Shown to anglers on your profile and trip pages
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
