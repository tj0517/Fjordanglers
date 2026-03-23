import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getExperience } from '@/lib/supabase/queries'
import BookingCheckoutForm from './BookingCheckoutForm'
import BookingDateStep from './BookingDateStep'
import type { AvailConfigRow } from '@/components/trips/booking-widget'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE = 0.05

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ expId: string }>
  searchParams: Promise<{ dates?: string; guests?: string }>
}

export default async function BookPage({ params, searchParams }: Props) {
  const { expId } = await params
  const sp        = await searchParams

  const rawDates = sp.dates ?? ''
  const dates = rawDates
    .split(',')
    .map(d => d.trim())
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))

  const guests = Math.max(1, parseInt(sp.guests ?? '1', 10))

  // ── Always fetch experience ────────────────────────────────────────────────
  const experience = await getExperience(expId)
  if (!experience) notFound()

  // Guard: guide disabled their calendar → booking not available, send to inquiry
  if (experience.guide.calendar_disabled) {
    redirect(`/trips/${expId}/inquire`)
  }

  const pricePerPerson = experience.price_per_person_eur ?? 0
  const maxGuests      = experience.max_guests ?? 20
  const coverImage     = experience.images.find(img => img.is_cover) ?? experience.images[0]

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

  // ── STEP 1: No dates yet — show date + group picker ───────────────────────
  if (dates.length === 0) {
    // Fetch availability data (public — use service client)
    const serviceClient = createServiceClient()
    const [availConfigRes, blockedDatesRes] = await Promise.all([
      serviceClient
        .from('experience_availability_config')
        .select('available_months, available_weekdays, advance_notice_hours, max_advance_days, slots_per_day, start_time')
        .eq('experience_id', expId)
        .maybeSingle(),
      serviceClient
        .from('experience_blocked_dates')
        .select('date_start, date_end')
        .eq('experience_id', expId),
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
          />
        </div>
      </div>
    )
  }

  // ── STEP 2: Dates selected — show contact form ─────────────────────────────

  // Auth — pre-fill if logged in
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

  // Price calculation
  const subtotal   = Math.round(pricePerPerson * guests * dates.length * 100) / 100
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
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
                ← Change dates
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
                    {dates.length === 1 ? 'Date' : `Dates (${dates.length} days)`}
                  </p>
                  <div className="flex flex-col gap-1">
                    {/* Show first + last date range if > 2 dates (compact display) */}
                    {dates.length <= 3 ? (
                      dates.map(iso => (
                        <p key={iso} className="text-sm font-semibold f-body"
                           style={{ color: '#0A2E4D' }}>
                          {new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </p>
                      ))
                    ) : (
                      <>
                        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                          {new Date(`${dates[0]}T12:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'long',
                          })}
                          {' — '}
                          {new Date(`${dates[dates.length - 1]}T12:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                          {dates.length} consecutive days
                        </p>
                      </>
                    )}
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
                label={`€${pricePerPerson} × ${guests} ${guests === 1 ? 'angler' : 'anglers'} × ${dates.length} ${dates.length === 1 ? 'day' : 'days'}`}
                value={`€${subtotal}`}
              />
              <PriceLine label="Service fee (5%)" value={`€${serviceFee}`} muted />

              <div className="my-1" style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }} />
              <PriceLine label="Total" value={`€${totalEur}`} bold />
              <div className="my-1" style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }} />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold f-display" style={{ color: '#E67E50' }}>
                    Due today
                  </p>
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    30% deposit via Stripe after guide confirmation
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
              { icon: '🛡️', text: 'No payment required to send a request' },
              { icon: '⏰', text: 'Guide confirms within 24 hours' },
              { icon: '🔒', text: '30% deposit via Stripe after confirmation — balance before the trip' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 mb-2.5 last:mb-0">
                <span className="text-base leading-none">{item.icon}</span>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
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
              {dates.length} {dates.length === 1 ? 'day' : 'days'} selected
            </p>

            <BookingCheckoutForm
              expId={expId}
              dates={dates}
              guests={guests}
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
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-sm f-body"
        style={{ color: muted ? 'rgba(10,46,77,0.38)' : 'rgba(10,46,77,0.6)' }}
      >
        {label}
      </span>
      <span
        className="text-sm f-body"
        style={{
          color:      bold ? '#0A2E4D' : muted ? 'rgba(10,46,77,0.38)' : 'rgba(10,46,77,0.7)',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}
