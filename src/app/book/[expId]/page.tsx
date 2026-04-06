import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getExperience } from '@/lib/supabase/queries'
import BookingCheckoutForm from './BookingCheckoutForm'
import BookingDateStep from './BookingDateStep'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import { decodePeriodsParam } from '@/lib/periods'
import { expandBookingDateRange } from '@/lib/booking-blocks'
import { getPaymentModel } from '@/lib/payment-model'
import { calcSubtotalFromOption, type DurationOption } from '@/lib/booking-pricing'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE = 0.05

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Legacy fallback labels — kept for old URLs / backward compat */
const LEGACY_DURATION_LABELS: Record<string, string> = {
  half_day:  'Half day (~4 hrs)',
  full_day:  'Full day (~8 hrs)',
  multi_day: 'Multi-day',
}

type Props = {
  params: Promise<{ expId: string }>
  searchParams: Promise<{
    // legacy single-date flow (kept for backward compat)
    dates?: string
    // new window-based flow
    windowFrom?:   string
    windowTo?:     string
    numDays?:      string
    /** New: guide package label (e.g. "Full day fly fishing · 3 days") */
    pkgLabel?:     string
    /** Legacy: kept for backward compat */
    durationType?: string
    guests?:       string
    // step-1 pre-fill (from sidebar widget, does NOT skip to step 2)
    prefill?:      string
    // force initial tab on step 1: 'direct' | 'request'
    mode?:         string
    // Individual period boundaries — only present when angler picked multiple
    // non-contiguous ranges in request mode (encodePeriodsParam format).
    periods?:      string
  }>
}

export default async function BookPage({ params, searchParams }: Props) {
  const { expId } = await params
  const sp        = await searchParams

  const guests = Math.max(1, parseInt(sp.guests ?? '1', 10))

  // ── Window-based params (new flow) ────────────────────────────────────────
  const windowFrom   = sp.windowFrom ?? null
  const windowTo     = sp.windowTo   ?? null
  const numDays = Math.max(1, parseInt(sp.numDays ?? '1', 10))
  // Prefer new pkgLabel param (set by request mode); fall back to legacy durationType for old URLs
  const rawDurType    = sp.durationType ?? ''
  const legacyLabel   = LEGACY_DURATION_LABELS[rawDurType] ?? 'Full day'
  const durationLabel = sp.pkgLabel ? decodeURIComponent(sp.pkgLabel) : legacyLabel

  // ── Legacy single-date compat ─────────────────────────────────────────────
  const rawDates = sp.dates ?? ''
  const legacyDates = rawDates
    .split(',')
    .map(d => d.trim())
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))

  // ── Step-1 pre-fill (from sidebar widget — does NOT skip to step 2) ─────────
  // Use a separate `prefill` param so the step-1 guard (`dates.length === 0`) isn't tripped.
  const prefillDates = (sp.prefill ?? '')
    .split(',')
    .map(d => d.trim())
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))

  const initialMode = sp.mode === 'request' ? 'request' : prefillDates.length > 0 ? 'direct' : 'direct'

  // Normalise: expand every date in the selected window so `requested_dates`
  // in the DB contains ALL individual days — not just the envelope start/end.
  // This ensures calendar blocking works correctly for the full range.
  //
  // Priority:
  //   1. `periods` param (request mode, non-contiguous selections) → expand each
  //      period individually then merge, preserving gaps between periods.
  //   2. `windowFrom`/`windowTo` (direct multi-day or single contiguous window)
  //      → expand the full range from first to last day.
  //   3. Legacy `dates` param (old single-date flow) → use as-is.
  const decodedPeriods = sp.periods ? decodePeriodsParam(sp.periods) : []

  const dates: string[] = windowFrom != null
    ? decodedPeriods.length > 1
      // Multiple non-contiguous periods: expand each, deduplicate, sort.
      ? [...new Set(
          decodedPeriods.flatMap(p => expandBookingDateRange(p.from, p.to))
        )].sort()
      // Single period or direct multi-day booking: expand the contiguous range.
      : expandBookingDateRange(windowFrom, windowTo ?? windowFrom)
    : legacyDates

  const effectiveNumDays = windowFrom != null ? numDays : legacyDates.length

  // ── Always fetch experience ────────────────────────────────────────────────
  const experience = await getExperience(expId)
  if (!experience) notFound()

  // Guard: guide disabled their calendar → booking not available, send to inquiry
  if (experience.guide.calendar_disabled) {
    redirect(`/trips/${expId}/inquire`)
  }

  // Derive payment model to show correct copy (deposit vs. booking fee)
  const bookPageClient = createServiceClient()
  const { data: guideStripe } = await bookPageClient
    .from('guides')
    .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', experience.guide.id)
    .single()
  const guidePaymentModel = getPaymentModel({
    stripe_account_id:      guideStripe?.stripe_account_id      ?? null,
    stripe_charges_enabled: guideStripe?.stripe_charges_enabled ?? null,
    stripe_payouts_enabled: guideStripe?.stripe_payouts_enabled ?? null,
  })

  const pricePerPerson    = experience.price_per_person_eur ?? 0
  const maxGuests         = experience.max_guests ?? 20
  const coverImage        = experience.images.find(img => img.is_cover) ?? experience.images[0]
  const cancellationPolicy = (experience.guide as unknown as { cancellation_policy: string | null }).cancellation_policy

  const CANCEL_REFUND: Record<string, { days: number; label: string; color: string; bg: string; border: string }> = {
    flexible: { days: 7,  label: 'Flexible',  color: '#16A34A', bg: 'rgba(22,163,74,0.06)',  border: 'rgba(22,163,74,0.16)'  },
    moderate: { days: 14, label: 'Moderate',  color: '#D97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.18)'  },
    strict:   { days: 30, label: 'Strict',    color: '#DC2626', bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.16)'  },
  }
  const cancelCfg = cancellationPolicy ? (CANCEL_REFUND[cancellationPolicy] ?? null) : null

  // ── Nav bar (shared across both steps) ────────────────────────────────────
  const navBar = (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
      style={{
        background:      'rgba(243,237,228,0.92)',
        backdropFilter:  'blur(12px)',
        borderBottom:    '1px solid rgba(10,46,77,0.06)',
      }}
    >
      <Link href={`/trips/${expId}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#0A2E4D" strokeWidth="1.6">
          <polyline points="12,5 7,10 12,15" />
        </svg>
      </Link>
      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
        {dates.length === 0 ? 'Choose dates' : 'Your details'}
      </p>
      <div className="w-5" />
    </div>
  )

  // ── STEP 1: No window selected yet — show date + duration picker ─────────
  if (windowFrom == null && dates.length === 0) {
    // Fetch availability data (public — use service client)
    const serviceClient = createServiceClient()

    // Always read blocked dates from calendar_blocked_dates
    const { data: calExpRow } = await serviceClient
      .from('calendar_experiences')
      .select('calendar_id')
      .eq('experience_id', expId)
      .maybeSingle()

    const [availConfigRes, blockedDatesRes] = await Promise.all([
      serviceClient
        .from('experience_availability_config')
        .select('available_months, available_weekdays, advance_notice_hours, max_advance_days, slots_per_day, start_time')
        .eq('experience_id', expId)
        .maybeSingle(),
      calExpRow != null
        ? serviceClient
            .from('calendar_blocked_dates')
            .select('date_start, date_end')
            .eq('calendar_id', calExpRow.calendar_id)
        : Promise.resolve({ data: [] as Array<{ date_start: string; date_end: string }> }),
    ])

    const availabilityConfig = (availConfigRes.data ?? null) as AvailConfigRow | null
    const blockedDates       = (blockedDatesRes.data ?? []) as { date_start: string; date_end: string }[]

    return (
      <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
        {navBar}

        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Experience mini-card */}
          <div
            className="flex items-center gap-4 p-4 mb-8 overflow-hidden"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.08)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            {coverImage && (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src={coverImage.url}
                  alt={experience.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {experience.guide.full_name}
              </p>
              <p className="text-sm font-bold f-display truncate" style={{ color: '#0A2E4D' }}>
                {experience.title}
              </p>
              {experience.location_city != null && (
                <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
                  📍 {experience.location_city}, {experience.location_country}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-right ml-auto">
              <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>From</p>
              <p className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{pricePerPerson}
                <span className="text-xs font-normal ml-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>/pp</span>
              </p>
            </div>
          </div>

          {/* Step 1: Date + group picker */}
          <BookingDateStep
            expId={expId}
            pricePerPerson={pricePerPerson}
            maxGuests={maxGuests}
            initialGuests={guests}
            availabilityConfig={availabilityConfig}
            blockedDates={blockedDates}
            rawDurationOptions={experience.duration_options}
            initialMode={initialMode}
            initialDates={prefillDates}
          />
        </div>
      </div>
    )
  }

  // ── STEP 2: Dates selected — show contact form ─────────────────────────────

  // Auth — optional. Unauthenticated users see the inline login/register form.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let defaultName  = ''
  let defaultEmail = user?.email ?? ''

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    if (profile?.full_name) defaultName = profile.full_name
  }

  // Price calculation — uses the selected duration option's pricing type when available.
  // Falls back to base per-person rate for old/unmatched labels.
  const SERVICE_FEE_CAP_EUR = 50

  const rawOpts    = experience.duration_options as DurationOption[] | null
  const matchedOpt = durationLabel
    ? rawOpts?.find(o => o.label === durationLabel) ?? null
    : null

  const subtotal = matchedOpt
    ? calcSubtotalFromOption(matchedOpt, guests, effectiveNumDays)
    : Math.round(pricePerPerson * guests * effectiveNumDays * 100) / 100

  const serviceFee = Math.min(Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
  const totalEur   = Math.round((subtotal + serviceFee) * 100) / 100

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      {navBar}

      <div className="max-w-5xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-10">

        {/* ── LEFT: Experience summary ──────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Experience card */}
          <div
            className="overflow-hidden"
            style={{
              background:   '#FDFAF7',
              borderRadius: '24px',
              border:       '1px solid rgba(10,46,77,0.08)',
              boxShadow:    '0 2px 16px rgba(10,46,77,0.06)',
            }}
          >
            {coverImage && (
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={coverImage.url}
                  alt={experience.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <p className="text-xs f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {experience.guide.full_name}
              </p>
              <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug mb-1">
                {experience.title}
              </h1>
              {experience.location_city != null && (
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  📍 {experience.location_city}, {experience.location_country}
                </p>
              )}
            </div>
          </div>

          {/* Trip details */}
          <div
            className="p-6"
            style={{
              background:   '#FDFAF7',
              borderRadius: '24px',
              border:       '1px solid rgba(10,46,77,0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
                 style={{ color: 'rgba(10,46,77,0.4)' }}>
                Your Trip
              </p>
              {/* Change dates link — goes back to step 1 */}
              <Link
                href={`/book/${expId}?guests=${guests}`}
                className="text-[10px] font-semibold f-body transition-opacity hover:opacity-70"
                style={{ color: '#E67E50' }}
              >
                ← Change
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {/* Dates */}
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(230,126,80,0.1)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#E67E50" strokeWidth="1.5">
                    <rect x="1" y="2" width="12" height="11" rx="2" />
                    <line x1="1" y1="6" x2="13" y2="6" />
                    <line x1="4" y1="0.5" x2="4" y2="3.5" />
                    <line x1="10" y1="0.5" x2="10" y2="3.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] f-body mb-1"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Availability window
                  </p>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {windowFrom != null
                        ? windowFrom === windowTo || windowTo == null
                          ? new Date(`${windowFrom}T12:00:00`).toLocaleDateString('en-GB', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })
                          : `${new Date(`${windowFrom}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(`${windowTo}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : dates.map(d => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')
                      }
                    </p>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {durationLabel} · guide confirms exact dates
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />

              {/* Guests */}
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(10,46,77,0.05)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                       stroke="#0A2E4D" strokeWidth="1.5" strokeOpacity="0.5">
                    <circle cx="7" cy="4.5" r="2.5" />
                    <path d="M1.5 12.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] f-body mb-0.5"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>Anglers</p>
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    {guests} {guests === 1 ? 'angler' : 'anglers'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div
            className="p-6"
            style={{
              background:   '#FDFAF7',
              borderRadius: '24px',
              border:       '1px solid rgba(10,46,77,0.08)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
               style={{ color: 'rgba(10,46,77,0.4)' }}>
              Price Breakdown
            </p>

            <div className="flex flex-col gap-2.5">
              <PriceLine
                label={`€${pricePerPerson} × ${guests} ${guests === 1 ? 'angler' : 'anglers'} × ${effectiveNumDays} ${effectiveNumDays === 1 ? 'day' : 'days'}`}
                value={`€${subtotal}`}
              />
              <PriceLine
                label="Service fee"
                value={`€${serviceFee}`}
                muted
                tooltip={`A ${serviceFee >= 50 ? '€50 (capped)' : '5%'} platform fee that covers booking support, secure payments, and access to vetted guides. Never charged to the guide.`}
              />
              <div className="my-1" style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }} />
              <PriceLine label="Total" value={`€${totalEur}`} bold />
              <div className="my-1" style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }} />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold f-display" style={{ color: '#E67E50' }}>
                    Due today
                  </p>
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    {'Booking fee via Stripe after guide confirmation'}
                  </p>
                </div>
                <p className="text-2xl font-bold f-display" style={{ color: '#E67E50' }}>€0</p>
              </div>
            </div>
          </div>

          {/* Trust block */}
          <div
            className="p-5"
            style={{
              background:   'rgba(230,126,80,0.06)',
              borderRadius: '20px',
              border:       '1px solid rgba(230,126,80,0.14)',
            }}
          >
            {[
              { icon: '🛡️', text: 'No payment now — guide reviews your request first' },
              { icon: '⏰', text: 'Guide confirms within 24 hours' },
              { icon: '🔒', text: guidePaymentModel === 'manual'
                  ? 'Booking fee charged via Stripe after confirmation — pay the rest directly to your guide'
                  : 'Booking fee charged via Stripe after confirmation — guide payment via Stripe separately' },
            ].map(item => (
              <div key={item.text} className="flex items-start gap-3 mb-2.5 last:mb-0">
                <span className="text-base leading-none mt-0.5">{item.icon}</span>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* Cancellation policy banner */}
          {cancelCfg != null && (
            <div
              className="px-5 py-4 flex items-start gap-3"
              style={{
                background:   cancelCfg.bg,
                borderRadius: '20px',
                border:       `1px solid ${cancelCfg.border}`,
              }}
            >
              <span className="text-base leading-none mt-0.5">↩️</span>
              <div>
                <p className="text-xs font-semibold f-body mb-0.5" style={{ color: cancelCfg.color }}>
                  {cancelCfg.label} cancellation policy
                </p>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  Full booking fee refund if you cancel <strong>{cancelCfg.days}+ days</strong> before your trip.
                  After that, the booking fee is non-refundable.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Angler contact form ────────────────────────────────────── */}
        <div>
          <div
            className="p-8"
            style={{
              background:   '#FDFAF7',
              borderRadius: '28px',
              border:       '1px solid rgba(10,46,77,0.08)',
              boxShadow:    '0 4px 24px rgba(10,46,77,0.07)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>
              Step 2 of 2
            </p>
            <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-2">
              Your Details
            </h2>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {guests} {guests === 1 ? 'angler' : 'anglers'} ·{' '}
              {durationLabel}
              {dates.length > 1 && ` · ${dates.length} days`}
            </p>

            <BookingCheckoutForm
              expId={expId}
              dates={dates}
              guests={guests}
              numDays={effectiveNumDays}
              durationOptionLabel={durationLabel}
              defaultName={defaultName}
              defaultEmail={defaultEmail}
              isLoggedIn={user != null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function PriceLine({
  label,
  value,
  bold = false,
  muted = false,
  tooltip,
}: {
  label:    string
  value:    string
  bold?:    boolean
  muted?:   boolean
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className="text-sm f-body flex items-center gap-1.5"
        style={{ color: muted ? 'rgba(10,46,77,0.45)' : 'rgba(10,46,77,0.6)' }}
      >
        {label}
        {tooltip != null && (
          <span
            className="group relative inline-flex items-center"
            tabIndex={0}
          >
            {/* ⓘ circle */}
            <svg
              width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ color: 'rgba(10,46,77,0.28)', cursor: 'default', flexShrink: 0 }}
            >
              <circle cx="6.5" cy="6.5" r="5.75" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6.5 5.8v3.4M6.5 4.1v.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {/* Tooltip bubble */}
            <span
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl px-3 py-2.5 text-[11px] f-body leading-relaxed opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10"
              style={{
                background:  '#07192A',
                color:       'rgba(255,255,255,0.82)',
                boxShadow:   '0 8px 24px rgba(7,17,28,0.28)',
                whiteSpace:  'normal',
              }}
            >
              {tooltip}
              {/* Arrow */}
              <span
                className="absolute top-full left-1/2 -translate-x-1/2"
                style={{
                  width: 0, height: 0,
                  borderLeft:  '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop:   '5px solid #07192A',
                }}
              />
            </span>
          </span>
        )}
      </span>
      <span
        className="text-sm f-body"
        style={{
          color:      bold ? '#0A2E4D' : muted ? 'rgba(10,46,77,0.45)' : 'rgba(10,46,77,0.7)',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}
