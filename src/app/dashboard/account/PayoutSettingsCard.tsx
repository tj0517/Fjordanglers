'use client'

/**
 * PayoutSettingsCard — Stripe Connect payout configuration for guides.
 */

import { StripeConnectButton } from './StripeConnectButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type StripeStatusInfo = {
  label: string
  dot:   string
  glow:  boolean
}

type Props = {
  hasStripeAccount:       boolean
  stripePayoutsLive:      boolean | null
  stripeStatus:           StripeStatusInfo
  /** Formatted human-readable requirement labels, pre-computed server-side */
  requirementLabels:      string[]
  hasPendingVerification: boolean
  stripeRefresh:          boolean
  payoutCurrencyLabel:    string
  payoutScheduleLabel:    string
  helpWidget?:            React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PayoutSettingsCard({
  hasStripeAccount,
  stripePayoutsLive,
  stripeStatus,
  requirementLabels,
  hasPendingVerification,
  stripeRefresh,
  payoutCurrencyLabel,
  payoutScheduleLabel,
  helpWidget,
}: Props) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div
        className="px-6 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Payouts — Stripe Connect
        </p>
        {helpWidget}
      </div>

      <div className="flex flex-col">

        {/* Status row */}
        <Row label="Stripe Connect">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: stripeStatus.dot,
                boxShadow:  stripeStatus.glow ? `0 0 6px ${stripeStatus.dot}` : 'none',
              }}
            />
            <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
              {stripeStatus.label}
            </span>
          </div>
        </Row>

        {/* Form incomplete — show what's still missing */}
        {hasStripeAccount && !stripePayoutsLive && requirementLabels.length > 0 && (
          <>
            <Row label="Missing info">
              <div className="flex flex-col items-end gap-1">
                {requirementLabels.map(label => (
                  <span
                    key={label}
                    className="text-xs f-body px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Row>
            <Row label="Action">
              <StripeConnectButton label={stripeRefresh ? 'Renew & complete setup' : 'Complete setup'} />
            </Row>
          </>
        )}

        {/* Form complete — Stripe is reviewing */}
        {hasStripeAccount && !stripePayoutsLive && requirementLabels.length === 0 && (
          <Row label="Next step">
            <span className="text-sm f-body text-right" style={{ color: 'rgba(10,46,77,0.55)' }}>
              {hasPendingVerification
                ? 'Stripe is verifying your details — usually 1–2 business days'
                : 'Stripe is reviewing your account — usually 1–2 business days'}
            </span>
          </Row>
        )}

        {/* Payout currency + schedule (only once connected) */}
        {hasStripeAccount && (
          <>
            <Row label="Payout currency">
              <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                {payoutCurrencyLabel}
              </span>
            </Row>
            <Row label="Payout schedule">
              <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                {payoutScheduleLabel}
              </span>
            </Row>
          </>
        )}

        {/* No account yet — connect CTA */}
        {!hasStripeAccount && (
          <div className="px-6 pt-4 pb-6 flex flex-col gap-5">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Set up your Stripe account to receive weekly payouts from FjordAnglers.
              You&apos;ll be taken to Stripe&apos;s secure onboarding — it takes about 5 minutes.
              Your name, email and country will be pre-filled automatically.
            </p>
            <StripeConnectButton />
            <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.4)' }}>
              By continuing, you agree to{' '}
              <a
                href="https://stripe.com/legal/connect-account"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'rgba(10,46,77,0.6)' }}
              >
                Stripe&apos;s Connected Account Agreement
              </a>.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Local sub-component ──────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-6 px-6 py-4"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
    >
      <span
        className="text-sm f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-3 justify-end">
        {children}
      </div>
    </div>
  )
}
