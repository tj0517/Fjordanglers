'use client'

/**
 * PayDepositBanner — shown on the angler booking detail page when
 * the booking is 'accepted' (guide confirmed) but booking fee not yet paid.
 *
 * stripe_connect: booking fee paid now via Stripe; guide payment via Stripe separately.
 * manual:         booking fee paid now via Stripe; guide's net paid directly.
 */

import { useState, useTransition } from 'react'
import { renewDepositCheckout } from '@/actions/bookings'
import { CheckCircle, Lock } from 'lucide-react'
import type { PaymentModel } from '@/lib/payment-model'

interface PayDepositBannerProps {
  bookingId:           string
  /** Pre-fetched checkout URL — null if session expired/missing */
  initialCheckoutUrl:  string | null
  /** Actual amount charged now via Stripe (deposit_eur from DB) */
  depositEur:          number
  /** Remaining amount — 60% balance (stripe_connect) or guide direct (manual) */
  balanceEur:          number
  paymentModel:        PaymentModel
}

export default function PayDepositBanner({
  bookingId,
  initialCheckoutUrl,
  depositEur,
  balanceEur,
  paymentModel,
}: PayDepositBannerProps) {
  const [url, setUrl]      = useState<string | null>(initialCheckoutUrl)
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function handleRenew() {
    setError(null)
    start(async () => {
      const result = await renewDepositCheckout(bookingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setUrl(result.url)
      window.location.href = result.url
    })
  }

  const isManual = paymentModel === 'manual'

  const title = 'Your guide accepted — pay booking fee to confirm'

  const subtitle = isManual
    ? `Pay <strong>€${depositEur}</strong> booking fee now via Stripe. You\'ll pay the guide <strong>€${balanceEur}</strong> directly on the day.`
    : `Pay <strong>€${depositEur}</strong> booking fee now via Stripe. You\'ll pay the guide <strong>€${balanceEur}</strong> via Stripe separately.`

  const ctaLabel = `Pay €${depositEur} booking fee — secure by Stripe`

  return (
    <div
      className="p-5 flex flex-col gap-4"
      style={{
        background:   'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.03) 100%)',
        borderRadius: '20px',
        border:       '1.5px solid rgba(37,99,235,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(37,99,235,0.1)' }}
        >
          <CheckCircle size={16} strokeWidth={1.5} style={{ color: '#2563EB' }} />
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#1D4ED8' }}>
            {title}
          </p>
          <p
            className="text-xs f-body mt-0.5"
            style={{ color: 'rgba(29,78,216,0.65)' }}
            dangerouslySetInnerHTML={{ __html: subtitle }}
          />
        </div>
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

      {/* CTA */}
      {url != null ? (
        <a
          href={url}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-full f-body transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98]"
          style={{ background: '#2563EB', color: '#fff' }}
        >
          <Lock size={14} strokeWidth={1.5} />
          {ctaLabel}
        </a>
      ) : (
        <button
          onClick={handleRenew}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-full f-body transition-all disabled:opacity-50"
          style={{ background: '#2563EB', color: '#fff' }}
        >
          {isPending ? (
            <>
              <span
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
              />
              Preparing payment…
            </>
          ) : (
            <>
              <Lock size={14} strokeWidth={1.5} />
              {ctaLabel}
            </>
          )}
        </button>
      )}

      <p className="text-[10px] f-body text-center" style={{ color: 'rgba(29,78,216,0.45)' }}>
        Card details handled by Stripe · FjordAnglers does not store payment data
      </p>
    </div>
  )
}
