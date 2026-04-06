import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe/client'
import { PasswordResetButton } from './AccountActions'
import { AcceptedPaymentMethodsForm } from './AcceptedPaymentMethodsForm'
import { MarketingConsentToggle } from './MarketingConsentToggle'
import { HideListingToggle } from './HideListingToggle'
import { PayoutSettingsCard } from './PayoutSettingsCard'
import { HelpWidget } from '@/components/ui/help-widget'
import { getPaymentModel } from '@/lib/payment-model'
import { decryptField } from '@/lib/field-encryption'
import { Lock, Check } from 'lucide-react'

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
    .select('id, full_name, pricing_model, country, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, status, accepted_payment_methods, photo_marketing_consent, is_hidden, created_at, iban, iban_holder_name, iban_bic, iban_bank_name')
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

  // ── Stripe account settings — payout schedule, currency, requirements ────
  let payoutScheduleLabel   = '—'
  let payoutCurrencyLabel   = 'EUR (€)'
  let stripeCurrentlyDue:   string[] = []
  let stripePending:         string[] = []
  let stripePayoutsLive     = guide.stripe_payouts_enabled

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

      // Auto-sync: if Stripe says payouts enabled but our DB is stale, update it
      // so guides don't need to wait for a webhook or an admin click.
      if (stripeAccount.payouts_enabled && !stripePayoutsLive) {
        stripePayoutsLive = true
        const service = createServiceClient()
        const { error: syncErr } = await service.from('guides').update({
          stripe_payouts_enabled: true,
          stripe_charges_enabled: stripeAccount.charges_enabled ?? false,
        }).eq('id', guide.id)
        if (syncErr) console.error('[account/page] auto-sync Stripe status error:', syncErr)
      }

      // Requirements — used to distinguish "form incomplete" from "under review"
      stripeCurrentlyDue = (stripeAccount.requirements?.currently_due ?? []) as string[]
      stripePending      = (stripeAccount.requirements?.pending_verification ?? []) as string[]
    } catch {
      // Non-fatal — fall back to DB values and empty requirements
    }
  }

  const email       = user.email ?? '—'
  const provider    = user.app_metadata?.provider ?? 'email'
  const isGoogle    = provider === 'google'
  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const hasStripeAccount = guide.stripe_account_id != null

  // Payment model — derived from Stripe status, never stored
  const paymentModel = getPaymentModel({
    stripe_account_id:      guide.stripe_account_id,
    stripe_charges_enabled: guide.stripe_charges_enabled,
    stripe_payouts_enabled: guide.stripe_payouts_enabled,
  })
  const isManualModel = paymentModel === 'manual'

  const stripeStatus = stripePayoutsLive
    ? { label: 'Active — payouts enabled',   dot: '#4ADE80', glow: true  }
    : hasStripeAccount
    ? { label: 'Under review',               dot: '#E67E50', glow: false }
    : { label: 'Not connected',              dot: 'rgba(10,46,77,0.2)', glow: false }

  const isCommission = guide.pricing_model === 'commission'

  // Pre-format Stripe requirement labels so PayoutSettingsCard (Client Component) gets plain data
  const requirementLabels   = formatStripeRequirements(stripeCurrentlyDue)
  const hasPendingVerification = stripePending.length > 0

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
        <Card title="Sign-in" help={
          <HelpWidget title="Sign-in" items={[
            { icon: '📧', title: 'Email', text: 'Your login email — contact support if you need to change it.' },
            { icon: '🔒', title: 'Password', text: 'Click "Reset password" to get a reset link sent to your email. For Google sign-in, manage your password via Google.' },
          ]} />
        }>
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
                  <Lock size={10} strokeWidth={1.5} />
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

        {/* ── Payouts — unified Stripe Connect / IBAN card ─────────────────── */}
        <PayoutSettingsCard
          defaultTab={isManualModel ? 'iban' : 'stripe'}
          hasStripeAccount={hasStripeAccount}
          stripePayoutsLive={stripePayoutsLive}
          stripeStatus={stripeStatus}
          requirementLabels={requirementLabels}
          hasPendingVerification={hasPendingVerification}
          stripeRefresh={stripeRefresh}
          payoutCurrencyLabel={payoutCurrencyLabel}
          payoutScheduleLabel={payoutScheduleLabel}
          ibanData={{
            iban:             decryptField(guide.iban),
            iban_holder_name: decryptField(guide.iban_holder_name),
            iban_bic:         decryptField(guide.iban_bic),
            iban_bank_name:   decryptField(guide.iban_bank_name),
          }}
          helpWidget={
            <HelpWidget
              title="Payouts"
              description="Choose how you receive guide earnings — via Stripe Connect or direct bank transfer."
              items={[
                { icon: '🏦', title: 'Stripe Connect', text: 'FjordAnglers uses Stripe to pay guides. Once active, earnings from confirmed bookings are transferred weekly.' },
                { icon: '📅', title: 'Payout schedule', text: 'Payouts are sent weekly (every Monday) for completed bookings from the previous week.' },
                { icon: '🏧', title: 'Bank transfer (IBAN)', text: 'Without Stripe Connect, anglers pay your fee directly to your bank account. FjordAnglers collects only the platform fee online.' },
              ]}
            />
          }
        />

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
              <Check size={13} strokeWidth={2} style={{ color: '#16A34A' }} />
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
        <Card title="Your plan" help={
          <HelpWidget title="Your plan" items={[
            { icon: '💰', title: 'Commission', text: 'FjordAnglers charges a percentage of each confirmed booking total (excluding the 5% service fee). Founding Guides get a lower rate for 24 months.' },
            { icon: '⭐', title: 'Founding Guide', text: 'Guides who joined within the first 24 months get an 8% commission rate instead of the standard 10%, locked for their first 24 months.' },
            { icon: '✅', title: 'Account status', text: 'Active: your profile is live and visible to anglers. Pending: under review by FjordAnglers. Suspended: contact support.' },
          ]} />
        }>
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

        {/* ── Accepted payment methods — shown for all guides ───────────────── */}
        <Card title="Accepted payment methods" help={
          <HelpWidget title="Accepted payment methods" items={[
            { icon: '💵', title: 'Cash', text: 'Collected in person on the day of the trip. You manually mark it as received in the booking details.' },
            { icon: '💳', title: 'Online (Stripe)', text: 'Secure card payment via Stripe. Funds arrive in your Stripe account on the weekly payout schedule.' },
          ]} />
        }>
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              {isManualModel ? (
                <>
                  Anglers pay a <strong style={{ color: '#0A2E4D' }}>deposit</strong> online when the guide confirms.
                  Choose how anglers pay the <strong style={{ color: '#0A2E4D' }}>rest</strong> directly to you.
                </>
              ) : (
                <>
                  Anglers always pay a <strong style={{ color: '#0A2E4D' }}>40% deposit</strong> online at the time of booking.
                  Choose how you want to collect the <strong style={{ color: '#0A2E4D' }}>remaining 60%</strong> before the trip.
                </>
              )}
            </p>
          </div>
          <AcceptedPaymentMethodsForm
            current={(guide.accepted_payment_methods ?? ['cash', 'online']) as ('cash' | 'online')[]}
          />
        </Card>

        {/* ── Photo & marketing consent ─────────────────────────────────────── */}
        <Card title="Photo & marketing consent" help={
          <HelpWidget title="Photo & marketing consent" items={[
            { icon: '📸', title: 'What this covers', text: 'Photos and videos from your trips (shared by you or your anglers) used on the FjordAnglers website, Instagram, and ads.' },
            { icon: '✍️', title: 'Credit', text: 'Your name is always credited as the guide when FjordAnglers uses your content.' },
            { icon: '🔄', title: 'Can be changed', text: 'You can turn this on or off at any time from this settings page.' },
          ]} />
        }>
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Allow FjordAnglers to use your photos for platform promotion (website, Instagram, ads).
              Your name will always be credited as the owner.
            </p>
          </div>
          <MarketingConsentToggle current={guide.photo_marketing_consent ?? false} />
        </Card>

        {/* ── Listing visibility ────────────────────────────────────────────── */}
        <Card title="Listing visibility" help={
          <HelpWidget title="Listing visibility" items={[
            { icon: '👁️', title: 'Visible', text: 'Your profile and trips appear in search results. Anglers can find and book you.' },
            { icon: '🙈', title: 'Hidden', text: 'Your profile and all trips are removed from public listings. Existing bookings are not affected.' },
            { icon: '🔄', title: 'Can be changed', text: 'Toggle visibility at any time from this page.' },
          ]} />
        }>
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Control whether your profile and trips appear in public listings and search results.
            </p>
          </div>
          <HideListingToggle current={guide.is_hidden ?? true} />
        </Card>

      </div>
    </div>
  )
}

// ─── Stripe requirement field → human-readable label ─────────────────────────

const STRIPE_FIELD_LABELS: Record<string, string> = {
  'individual.first_name':                       'First name',
  'individual.last_name':                        'Last name',
  'individual.dob.day':                          'Date of birth',
  'individual.dob.month':                        'Date of birth',
  'individual.dob.year':                         'Date of birth',
  'individual.address.line1':                    'Street address',
  'individual.address.city':                     'City',
  'individual.address.postal_code':              'Postal code',
  'individual.address.state':                    'State / region',
  'individual.address.country':                  'Country',
  'individual.id_number':                        'National ID / Tax ID',
  'individual.ssn_last_4':                       'Last 4 of SSN',
  'individual.verification.document':            'Government-issued ID',
  'individual.verification.additional_document': 'Proof of address',
  'individual.email':                            'Email address',
  'individual.phone':                            'Phone number',
  'external_account':                            'Bank account (IBAN)',
  'tos_acceptance.date':                         'Terms of service',
  'tos_acceptance.ip':                           'Terms of service',
  'business_profile.product_description':        'Business description',
  'business_profile.support_phone':              'Support phone',
  'business_profile.url':                        'Business website',
  'business_profile.mcc':                        'Business category',
}

function formatStripeRequirements(fields: string[]): string[] {
  const seen = new Set<string>()
  for (const field of fields) {
    seen.add(STRIPE_FIELD_LABELS[field] ?? field)
  }
  return Array.from(seen)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, help, children }: { title: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <div
        className="px-6 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          {title}
        </p>
        {help}
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
