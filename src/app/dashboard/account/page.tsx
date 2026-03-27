import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe/client'
import { PasswordResetButton } from './AccountActions'
import { StripeConnectButton } from './StripeConnectButton'
import { AcceptedPaymentMethodsForm } from './AcceptedPaymentMethodsForm'
import { MarketingConsentToggle } from './MarketingConsentToggle'

export const revalidate = 0

export const metadata = { title: 'Account — FjordAnglers Dashboard' }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_done?: string; stripe_refresh?: string }>
}) {
  const params        = await searchParams
  const stripeDone    = params.stripe_done    === '1'
  const stripeRefresh = params.stripe_refresh === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, pricing_model, country, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, status, accepted_payment_methods, photo_marketing_consent, created_at')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // ── Commission rate — Founding Guide gets 8% for first 24 months ──────────
  const FOUNDING_RATE    = 0.08
  const STANDARD_RATE    = env.PLATFORM_COMMISSION_RATE
  const monthsSinceJoin  = (Date.now() - new Date(guide.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  const isFoundingGuide  = monthsSinceJoin <= 24
  const commissionRate   = guide.pricing_model === 'commission'
    ? (isFoundingGuide ? FOUNDING_RATE : STANDARD_RATE)
    : null

  const commissionLabel  = commissionRate != null
    ? `${Math.round(commissionRate * 100)}% per confirmed booking${isFoundingGuide ? ' (Founding Guide rate)' : ''}`
    : '—'

  // ── Stripe account settings (payout schedule + currency) ─────────────────
  let payoutScheduleLabel = '—'
  let payoutCurrencyLabel = 'EUR (€)'

  if (guide.stripe_account_id) {
    try {
      const stripeAccount = await stripe.accounts.retrieve(guide.stripe_account_id)
      const schedule = stripeAccount.settings?.payouts?.schedule
      const currency = stripeAccount.default_currency?.toUpperCase() ?? 'EUR'

      payoutCurrencyLabel = currency === 'EUR' ? 'EUR (€)'
        : currency === 'GBP' ? 'GBP (£)'
        : currency === 'SEK' ? 'SEK (kr)'
        : currency === 'NOK' ? 'NOK (kr)'
        : currency

      if (schedule?.interval === 'weekly' && schedule.weekly_anchor) {
        const day = schedule.weekly_anchor.charAt(0).toUpperCase() + schedule.weekly_anchor.slice(1)
        payoutScheduleLabel = `Weekly — every ${day}`
      } else if (schedule?.interval === 'daily') {
        payoutScheduleLabel = 'Daily'
      } else if (schedule?.interval === 'monthly') {
        payoutScheduleLabel = `Monthly — day ${schedule.monthly_anchor ?? 1}`
      } else if (schedule?.interval === 'manual') {
        payoutScheduleLabel = 'Manual'
      }
    } catch {
      // Non-fatal — fall back to defaults
    }
  }

  const email       = user.email ?? '—'
  const provider    = user.app_metadata?.provider ?? 'email'
  const isGoogle    = provider === 'google'
  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Stripe status — for Custom Connect (transfers-only accounts):
  //    charges_enabled is always false (we don't request card_payments).
  //    payouts_enabled becomes true once Stripe verifies the account.
  const hasStripeAccount  = guide.stripe_account_id != null
  const stripePayoutsLive = guide.stripe_payouts_enabled

  const stripeStatus = stripePayoutsLive
    ? { label: 'Active — payouts enabled',   dot: '#4ADE80', glow: true  }
    : hasStripeAccount
    ? { label: 'Under review',               dot: '#E67E50', glow: false }
    : { label: 'Not connected',              dot: 'rgba(10,46,77,0.2)', glow: false }

  const isCommission = guide.pricing_model === 'commission'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Account
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Login credentials, payouts and subscription
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Sign-in ──────────────────────────────────────────────────────── */}
        <Card title="Sign-in">
          <Row label="Email">
            <span className="text-sm f-body font-medium" style={{ color: '#0A2E4D' }}>{email}</span>
          </Row>
          <Row label="Sign-in method">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold f-body px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              {isGoogle ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                    <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/>
                    <path d="M4.5 10.48A4.8 4.8 0 014.5 7.5V5.43H1.83a8 8 0 000 7.12l2.67-2.07z" fill="#FBBC05"/>
                    <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35L14.6 2.75A8 8 0 001.83 5.43L4.5 7.5c.66-1.97 2.48-3.92 4.48-3.92z" fill="#EA4335"/>
                  </svg>
                  Google
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="5" width="10" height="6.5" rx="1.2" />
                    <path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" />
                  </svg>
                  Email & password
                </>
              )}
            </span>
          </Row>
          <Row label="Member since">
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{memberSince}</span>
          </Row>
          {!isGoogle && (
            <Row label="Password">
              <PasswordResetButton email={email} />
            </Row>
          )}
        </Card>

        {/* ── Payouts ──────────────────────────────────────────────────────── */}
        <Card title="Payouts">
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

          {/* Under review — show status + option to resume/complete setup */}
          {hasStripeAccount && !stripePayoutsLive && (
            <>
              <Row label="Status">
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  {stripeRefresh
                    ? 'Your session expired — click below to continue setup'
                    : 'Stripe is reviewing your account — usually 1–2 business days'}
                </span>
              </Row>
              <Row label="Action">
                <StripeConnectButton label="Resume setup" />
              </Row>
            </>
          )}

          {hasStripeAccount && (
            <>
              <Row label="Payout currency">
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{payoutCurrencyLabel}</span>
              </Row>
              <Row label="Payout schedule">
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{payoutScheduleLabel}</span>
              </Row>
            </>
          )}
        </Card>

        {/* ── Bank account setup — only shown before first connection ──────── */}
        {!hasStripeAccount && (
          <Card title="Connect bank account">
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
          </Card>
        )}

        {/* ── Return from Stripe — setup submitted ─────────────────────────── */}
        {stripeDone && stripePayoutsLive === false && (
          <div
            className="rounded-2xl px-6 py-4 flex items-start gap-3"
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
                Stripe is reviewing your account — this usually takes 1–2 business days.
                You&apos;ll be notified when payouts are enabled.
              </p>
            </div>
          </div>
        )}

        {/* ── Plan ─────────────────────────────────────────────────────────── */}
        <Card title="Your plan">
          <Row label="Plan">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                {isCommission ? 'Bookable Plan' : 'Listing Plan'}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full f-body"
                style={{
                  background: isCommission ? 'rgba(230,126,80,0.1)' : 'rgba(27,79,114,0.1)',
                  color:      isCommission ? '#E67E50'              : '#1B4F72',
                }}
              >
                {isCommission ? 'Full bookings' : 'Listing only'}
              </span>
            </div>
          </Row>
          <Row label="Commission rate">
            <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
              {commissionLabel}
            </span>
          </Row>
          <Row label="Account status">
            <span
              className="text-xs font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
              style={{
                background: (guide.status === 'active' || guide.status === 'verified')
                  ? 'rgba(74,222,128,0.1)'
                  : guide.status === 'pending'
                  ? 'rgba(217,119,6,0.1)'
                  : 'rgba(239,68,68,0.1)',
                color: (guide.status === 'active' || guide.status === 'verified') ? '#16A34A'
                     : guide.status === 'pending' ? '#B45309'
                     : '#DC2626',
              }}
            >
              {(guide.status === 'active' || guide.status === 'verified') ? 'Active'
               : guide.status === 'pending' ? 'Pending review'
               : 'Suspended'}
            </span>
          </Row>
        </Card>

        {/* ── Accepted payment methods ──────────────────────────────────────── */}
        <Card title="Accepted payment methods">
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Choose which payment methods you accept from anglers.
              This is shown on your public profile and trip pages so anglers know before they book.
            </p>
          </div>
          <AcceptedPaymentMethodsForm
            current={(guide.accepted_payment_methods ?? ['cash', 'online']) as ('cash' | 'online')[]}
          />
        </Card>

        {/* ── Photo & marketing consent ─────────────────────────────────────── */}
        <Card title="Photo & marketing consent">
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Allow FjordAnglers to use your photos for platform promotion (website, Instagram, ads).
              Your name will always be credited as the owner.
            </p>
          </div>
          <MarketingConsentToggle current={guide.photo_marketing_consent ?? false} />
        </Card>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <div
        className="px-6 py-3"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          {title}
        </p>
      </div>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-6 px-6 py-4"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}
    >
      <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: '120px' }}>
        {label}
      </span>
      <div className="flex items-center gap-3 justify-end">
        {children}
      </div>
    </div>
  )
}
