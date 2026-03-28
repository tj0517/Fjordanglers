/**
 * PayPalOnboardingSection — Server Component.
 * Shown instead of the Stripe "Payouts" + "Connect bank account" sections
 * for guides whose country uses PayPal (e.g. Iceland).
 */

import { PayPalConnectButton } from './PayPalConnectButton'

type Props = {
  onboardingStatus: 'pending' | 'active' | 'suspended' | null
  merchantId: string | null
  paypalDone?: boolean
}

export function PayPalOnboardingSection({ onboardingStatus, merchantId, paypalDone }: Props) {
  const isActive    = onboardingStatus === 'active' && merchantId != null
  const isPending   = onboardingStatus === 'pending'
  const isSuspended = onboardingStatus === 'suspended'

  const statusConfig = isActive
    ? { label: 'Active — payments enabled', dot: '#4ADE80', glow: true  }
    : isPending || merchantId != null
    ? { label: 'Under review',              dot: '#E67E50', glow: false }
    : { label: 'Not connected',             dot: 'rgba(10,46,77,0.2)', glow: false }

  return (
    <>
      {/* ── Payout status row ───────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-6 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
      >
        <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}>
          PayPal Connect
        </span>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: statusConfig.dot,
              boxShadow:  statusConfig.glow ? `0 0 6px ${statusConfig.dot}` : 'none',
            }}
          />
          <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Under review */}
      {isPending && !isActive && (
        <div
          className="flex items-center justify-between gap-6 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
        >
          <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}>
            Status
          </span>
          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            PayPal is reviewing your account — usually 1–2 business days
          </span>
        </div>
      )}

      {/* Suspended */}
      {isSuspended && (
        <div
          className="flex items-center justify-between gap-6 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
        >
          <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}>
            Status
          </span>
          <span className="text-sm f-body" style={{ color: '#DC2626' }}>
            Account suspended — contact support@fjordanglers.com
          </span>
        </div>
      )}

      {/* Not connected — show connect button section */}
      {!isActive && !isSuspended && (
        <div
          className="rounded-2xl overflow-hidden mt-5"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          <div
            className="px-6 py-3"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>
              Connect PayPal account
            </p>
          </div>
          <div className="px-6 pt-4 pb-6 flex flex-col gap-5">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Set up your PayPal Business account to receive payouts from FjordAnglers.
              You&apos;ll be taken to PayPal&apos;s secure onboarding — it takes about 5 minutes.
            </p>
            <PayPalConnectButton label={isPending ? 'Resume PayPal setup' : 'Connect with PayPal'} />
            <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.4)' }}>
              By continuing, you agree to{' '}
              <a
                href="https://www.paypal.com/webapps/mpp/ua/useragreement-full"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'rgba(10,46,77,0.6)' }}
              >
                PayPal&apos;s User Agreement
              </a>.
            </p>
          </div>
        </div>
      )}

      {/* Return from PayPal onboarding — submitted */}
      {paypalDone && !isActive && (
        <div
          className="rounded-2xl px-6 py-4 flex items-start gap-3 mt-5"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(74,222,128,0.15)' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
              <polyline points="2,6.5 5.5,10 11,3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold f-body" style={{ color: '#16A34A' }}>
              Setup submitted!
            </p>
            <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(22,163,74,0.8)' }}>
              PayPal is reviewing your account — this usually takes 1–2 business days.
              You&apos;ll be notified when payments are enabled.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
