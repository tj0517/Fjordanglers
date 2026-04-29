import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAnglerBookingDetail, getBookingMessages } from '@/actions/bookings'
import { createClient } from '@/lib/supabase/server'
import BookingChat from '@/components/booking/BookingChat'
import AnglerOfferActions from './AnglerOfferActions'

export const revalidate = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parsedOfferDetails(raw: string | null): {
  message?: string | null
  meetingLocation?: string | null
  meetingLat?: number | null
  meetingLng?: number | null
  riverSection?: string | null
  included?: string[]
} {
  if (raw == null) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function MeetingMap({ lat, lng }: { lat: number; lng: number }) {
  const bbox = `${(lng - 0.015).toFixed(5)},${(lat - 0.01).toFixed(5)},${(lng + 0.015).toFixed(5)},${(lat + 0.01).toFixed(5)}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(10,46,77,0.1)' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: 200, border: 0, display: 'block' }}
        title="Meeting point map"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}

// ─── OfferCalendarGrid ────────────────────────────────────────────────────────
// Read-only calendar map: month grids with the guide's proposed dates
// highlighted as solid orange pills.  Server component — no state needed.

function OfferCalendarGrid({ days, theme = 'orange' }: { days: string[]; theme?: 'orange' | 'green' }) {
  if (days.length === 0) return null
  const highlightBg     = theme === 'green' ? '#22C55E'                       : '#E67E50'
  const highlightShadow = theme === 'green' ? '0 1px 4px rgba(34,197,94,0.35)' : '0 1px 4px rgba(230,126,80,0.35)'

  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Group proposed days by YYYY-MM
  const byMonth = new Map<string, Set<string>>()
  for (const d of days) {
    const key = d.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, new Set())
    byMonth.get(key)!.add(d)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[...byMonth.entries()].map(([monthKey, daySet]) => {
        const [yearStr, monthStr] = monthKey.split('-')
        const year       = parseInt(yearStr, 10)
        const monthIdx   = parseInt(monthStr, 10) - 1   // 0-based
        const monthDate  = new Date(year, monthIdx, 1)
        const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        const firstDay   = monthDate.getDay()
        const daysInMo   = new Date(year, monthIdx + 1, 0).getDate()
        const offset     = (firstDay + 6) % 7            // Mon = 0
        const cells: Array<number | null> = [
          ...Array<null>(offset).fill(null),
          ...Array.from({ length: daysInMo }, (_, i) => i + 1),
        ]

        return (
          <div key={monthKey} className="p-4 rounded-2xl"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 1px 6px rgba(10,46,77,0.04)' }}>
            <p className="text-xs font-bold f-body mb-2 text-center" style={{ color: '#0A2E4D' }}>
              {monthLabel}
            </p>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_HEADERS.map((h, i) => (
                <div key={i} className="text-center text-[9px] font-bold f-body py-0.5"
                  style={{ color: 'rgba(10,46,77,0.28)' }}>{h}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (day == null) return <div key={`e${idx}`} />
                const d          = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isProposed = daySet.has(d)
                const isPast     = d < today
                return (
                  <div key={d}
                    className="aspect-square flex items-center justify-center text-[10px] f-body rounded-lg"
                    style={{
                      background: isProposed ? highlightBg : 'transparent',
                      color:      isProposed ? '#fff'      : isPast ? 'rgba(10,46,77,0.18)' : 'rgba(10,46,77,0.55)',
                      fontWeight: isProposed ? '700'       : '400',
                      boxShadow:  isProposed ? highlightShadow : 'none',
                    }}>
                    {day}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Status labels / badge ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:      'Awaiting confirmation',
  offer_sent:   'New dates proposed',
  confirmed:    'Confirmed',
  declined:     'Not confirmed',
  cancelled:    'Cancelled',
  completed:    'Completed',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    pending:    { bg: '#FFF7ED', text: '#C05621',  border: 'rgba(230,126,80,0.3)'  },
    offer_sent: { bg: '#FFFBEB', text: '#92400E',  border: 'rgba(234,179,8,0.35)'  },
    confirmed:  { bg: '#F0FDF4', text: '#15803D',  border: 'rgba(34,197,94,0.3)'   },
    declined:   { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    cancelled:  { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    completed:  { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)'  },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span
      className="inline-flex items-center text-sm font-semibold px-3.5 py-1.5 rounded-full f-body"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const [
    result,
    messagesResult,
    { data: { user } },
  ] = await Promise.all([
    getAnglerBookingDetail(id),
    getBookingMessages(id),
    supabase.auth.getUser(),
  ])

  if (!result.success) notFound()

  const booking  = result.booking
  const details  = parsedOfferDetails(booking.offer_details)
  const messages = messagesResult.success ? messagesResult.messages : []

  const isOfferSent = booking.status === 'offer_sent'
  const isConfirmed = booking.status === 'confirmed' || booking.status === 'completed'

  // Payment fee banner
  const bookingFeeEur = Math.round((booking.platform_fee_eur + booking.service_fee_eur) * 100) / 100
  const feePaid       = isConfirmed && booking.balance_paid_at != null
  const dates = isConfirmed && booking.confirmed_days?.length
    ? booking.confirmed_days
    : booking.requested_dates?.length
      ? booking.requested_dates
      : [booking.booking_date]

  const guideInitial = booking.guide_name?.[0]?.toUpperCase() ?? 'G'
  const heroImage    = booking.experience_images?.[0] ?? null
  const locationStr  = [booking.experience_location_city, booking.experience_location_country]
    .filter(Boolean).join(', ')

  return (
    <div className="w-full min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Back link ── */}
        <Link
          href="/account/bookings"
          className="inline-flex items-center gap-1.5 text-sm f-body mb-6 transition-opacity hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          My Bookings
        </Link>

        {/* ── Status badge ── */}
        <div className="mb-4">
          <StatusBadge status={booking.status} />
        </div>

        {/* ── Trip hero card ── */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 2px 12px rgba(10,46,77,0.06)' }}
        >
          {heroImage != null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={booking.experience_title ?? 'Trip photo'}
              className="w-full object-cover"
              style={{ height: 200 }}
            />
          )}
          <div className="px-5 py-4">
            <h1 className="text-xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>
              {booking.experience_title ?? 'Fishing experience'}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {locationStr !== '' && (
                <span className="flex items-center gap-1 text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {locationStr}
                </span>
              )}
              {booking.experience_difficulty != null && (
                <span className="text-xs f-body font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}>
                  {booking.experience_difficulty}
                </span>
              )}
            </div>
            {booking.experience_fish_types != null && booking.experience_fish_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {booking.experience_fish_types.map(fish => (
                  <span key={fish} className="text-xs f-body font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(230,126,80,0.08)', color: '#C05621', border: '1px solid rgba(230,126,80,0.15)' }}>
                    🎣 {fish}
                  </span>
                ))}
              </div>
            )}
            {booking.experience_id != null && (
              <div className="mt-3">
                <Link
                  href={`/trips/${booking.experience_id}`}
                  className="text-xs f-body font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#E67E50' }}
                >
                  View trip details →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">

          {/* ── Status-specific banners ── */}
          {booking.status === 'offer_sent' && (
            <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
              style={{ background: '#FFFBEB', border: '1.5px solid rgba(234,179,8,0.3)', boxShadow: '0 2px 12px rgba(234,179,8,0.08)' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                style={{ background: '#D97706' }} />
              <div>
                <p className="text-sm font-semibold f-body" style={{ color: '#92400E' }}>
                  {booking.guide_name ?? 'Your guide'} sent you an offer
                </p>
                <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(146,64,14,0.65)' }}>
                  Review the proposed dates and price below, then accept or decline.
                </p>
              </div>
            </div>
          )}

          {booking.status === 'pending' && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#FFF7ED', border: '1px solid rgba(230,126,80,0.25)', borderLeft: '3px solid #E67E50' }}
            >
              <p className="text-sm font-semibold f-body mb-1" style={{ color: '#C05621' }}>
                Waiting for guide confirmation
              </p>
              <p className="text-sm f-body" style={{ color: 'rgba(194,86,33,0.75)' }}>
                The guide will review your request and respond within 48 hours.
                You&apos;ll receive an email as soon as they respond.
              </p>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#F0FDF4', border: '1px solid rgba(34,197,94,0.2)', borderLeft: '3px solid #22C55E' }}
            >
              {/* Confirmed header */}
              <div className="p-5 flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div>
                  <p className="text-sm font-bold f-body" style={{ color: '#15803D' }}>
                    Your trip is confirmed!
                  </p>
                  {booking.confirmed_at != null && (
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(21,128,61,0.6)' }}>
                      Confirmed on {fmtDate(booking.confirmed_at)} · All details below
                    </p>
                  )}
                </div>
              </div>

              {/* Payment fee banner — only for inquiries with a set price */}
              {feePaid && (
                <div
                  className="mx-5 mb-5 rounded-xl px-4 py-3 flex items-center gap-2.5"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p className="text-sm f-body font-semibold" style={{ color: '#15803D' }}>
                    Booking fee paid — €{bookingFeeEur.toFixed(2)}
                  </p>
                </div>
              )}

            </div>
          )}

          {booking.status === 'declined' && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderLeft: '3px solid #9CA3AF' }}
            >
              <p className="text-sm font-semibold f-body mb-1" style={{ color: '#374151' }}>
                This booking was not confirmed
                {booking.declined_at != null && (
                  <span className="font-normal ml-1.5" style={{ color: '#9CA3AF' }}>
                    on {fmtDate(booking.declined_at)}
                  </span>
                )}
              </p>
              {booking.declined_reason != null && booking.declined_reason.trim() !== '' && (
                <p className="text-sm f-body mt-1 italic" style={{ color: '#6B7280' }}>
                  &ldquo;{booking.declined_reason}&rdquo;
                </p>
              )}
              <div className="mt-4">
                <Link
                  href="/trips"
                  className="inline-flex items-center gap-1.5 text-sm f-body font-semibold transition-opacity hover:opacity-80"
                  style={{ color: '#E67E50' }}
                >
                  Search for other guides →
                </Link>
              </div>
            </div>
          )}

          {/* ── Guide info ── */}
          <div
            className="rounded-2xl p-6"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider f-body mb-4" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Guide
            </h2>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold f-body flex-shrink-0"
                style={{ background: '#0A2E4D' }}
              >
                {guideInitial}
              </div>
              <div>
                <p className="text-base font-semibold f-body" style={{ color: '#0A2E4D' }}>
                  {booking.guide_name ?? 'Your guide'}
                </p>
                {booking.guide_id != null && (
                  <Link
                    href={`/guides/${booking.guide_id}`}
                    className="text-xs f-body transition-opacity hover:opacity-70"
                    style={{ color: '#E67E50' }}
                  >
                    View profile →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Trip details / Booking summary (status-aware) ── */}
          <div
            className="rounded-2xl p-6"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider f-body mb-5" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {isConfirmed ? 'Trip details' : isOfferSent ? "Guide's offer" : 'Booking summary'}
            </h2>

            {/* ── CONFIRMED VIEW — guide's confirmed data ── */}
            {isConfirmed ? (
              <div className="flex flex-col gap-5">

                {/* Calendar grid — confirmed days in green */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Confirmed dates &nbsp;·&nbsp; {dates.length} day{dates.length !== 1 ? 's' : ''}
                  </p>
                  <OfferCalendarGrid days={dates} theme="green" />
                </div>

                {/* River / Beat section */}
                {details.riverSection != null && details.riverSection.trim() !== '' && (
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-1.5"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      River / Beat section
                    </p>
                    <p className="text-sm f-body font-semibold flex items-center gap-2" style={{ color: '#0A2E4D' }}>
                      🎣 {details.riverSection}
                    </p>
                  </div>
                )}

                {/* What's included */}
                {details.included != null && details.included.length > 0 && (
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-2"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      What&apos;s included
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {details.included.map(item => (
                        <span key={item} className="text-xs f-body font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(34,197,94,0.08)', color: '#15803D', border: '1px solid rgba(34,197,94,0.18)' }}>
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meeting point */}
                {details.meetingLocation != null && details.meetingLocation.trim() !== '' && (
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-1.5"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Meeting point
                    </p>
                    <p className="text-sm f-body font-semibold flex items-start gap-2 mb-2" style={{ color: '#0A2E4D' }}>
                      <span className="flex-shrink-0">📍</span>
                      {details.meetingLocation}
                    </p>
                    {(booking.offer_meeting_lat != null && booking.offer_meeting_lng != null) && (
                      <MeetingMap lat={booking.offer_meeting_lat} lng={booking.offer_meeting_lng} />
                    )}
                  </div>
                )}

                {/* Guide's message */}
                {details.message != null && details.message.trim() !== '' && (
                  <div
                    className="rounded-xl px-4 py-3.5"
                    style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-2"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Message from {booking.guide_name ?? 'your guide'}
                    </p>
                    <p className="text-sm f-body leading-relaxed italic" style={{ color: '#374151' }}>
                      &ldquo;{details.message}&rdquo;
                    </p>
                  </div>
                )}

                {/* Guests + Price */}
                <div
                  className="grid grid-cols-2 gap-4 pt-4"
                  style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
                >
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Anglers</p>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Total price</p>
                    <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>
                      {booking.total_eur > 0 ? `€${booking.total_eur.toFixed(2)}` : 'Agreed with guide'}
                    </p>
                  </div>
                </div>

              </div>

            ) : isOfferSent ? (

              /* ── OFFER VIEW — guide's proposed dates as visual calendar ── */
              <div className="flex flex-col gap-5">

                {/* Visual calendar map */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-3"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Proposed dates &nbsp;·&nbsp; {(booking.offer_days ?? []).length} day{(booking.offer_days ?? []).length !== 1 ? 's' : ''}
                  </p>
                  <OfferCalendarGrid days={booking.offer_days ?? []} />
                </div>

                {/* Price */}
                {booking.offer_price_eur != null && booking.offer_price_eur > 0 && (
                  <div className="flex items-center justify-between px-5 py-4 rounded-2xl"
                    style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                    <div>
                      <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Trip price</p>
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                      </p>
                    </div>
                    <p className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                      €{booking.offer_price_eur.toFixed(0)}
                    </p>
                  </div>
                )}

                {/* River / Beat section */}
                {details.riverSection != null && details.riverSection.trim() !== '' && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-1.5"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      River / Beat section
                    </p>
                    <p className="text-sm f-body font-semibold flex items-center gap-2" style={{ color: '#0A2E4D' }}>
                      🎣 {details.riverSection}
                    </p>
                  </div>
                )}

                {/* What's included */}
                {details.included != null && details.included.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-2"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      What&apos;s included
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {details.included.map(item => (
                        <span key={item} className="text-xs f-body font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'rgba(230,126,80,0.07)', color: '#C05621', border: '1px solid rgba(230,126,80,0.18)' }}>
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guide message */}
                {details.message != null && details.message.trim() !== '' && (
                  <div className="rounded-2xl px-4 py-4"
                    style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-2"
                      style={{ color: 'rgba(10,46,77,0.38)' }}>
                      Message from {booking.guide_name ?? 'guide'}
                    </p>
                    <p className="text-sm f-body leading-relaxed" style={{ color: '#374151' }}>
                      &ldquo;{details.message}&rdquo;
                    </p>
                  </div>
                )}

                {/* Meeting point */}
                {details.meetingLocation != null && details.meetingLocation.trim() !== '' && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] f-body mb-2 flex items-center gap-1.5"
                      style={{ color: 'rgba(10,46,77,0.4)' }}>
                      <span>📍</span> Meeting point
                    </p>
                    <p className="text-sm f-body font-semibold mb-2" style={{ color: '#0A2E4D' }}>
                      {details.meetingLocation}
                    </p>
                    {booking.offer_meeting_lat != null && booking.offer_meeting_lng != null && (
                      <MeetingMap lat={booking.offer_meeting_lat} lng={booking.offer_meeting_lng} />
                    )}
                  </div>
                )}

                {/* Accept / Decline CTAs */}
                {user != null && (
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <AnglerOfferActions
                      bookingId={booking.id}
                      guideName={booking.guide_name ?? 'your guide'}
                    />
                  </div>
                )}
              </div>

            ) : (

              /* ── PENDING / DECLINED VIEW — original request ── */
              <>
                {/* Requested dates */}
                <div className="mb-4">
                  <p className="text-xs f-body font-medium mb-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Requested dates
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dates.map(d => (
                      <span
                        key={d}
                        className="inline-block text-sm f-body px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(10,46,77,0.05)', color: '#0A2E4D' }}
                      >
                        {fmtDate(d)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Grid: guests, package, price */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Guests</p>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                    </p>
                  </div>
                  {booking.duration_option != null && (
                    <div>
                      <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Package</p>
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        {booking.duration_option}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Price</p>
                    <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>
                      {booking.total_eur > 0 ? `€${booking.total_eur.toFixed(2)}` : 'On request'}
                    </p>
                  </div>
                </div>

                {/* Special requests */}
                {booking.special_requests != null && booking.special_requests.trim() !== '' && (
                  <div
                    className="mt-4 pt-4 rounded-lg p-3"
                    style={{ borderTop: '1px solid rgba(10,46,77,0.07)', background: 'rgba(10,46,77,0.03)' }}
                  >
                    <p className="text-xs font-semibold f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Your notes to guide
                    </p>
                    <p className="text-sm f-body italic leading-relaxed" style={{ color: '#374151' }}>
                      &ldquo;{booking.special_requests}&rdquo;
                    </p>
                  </div>
                )}

                {/* Submitted date */}
                <p className="text-xs f-body mt-4" style={{ color: 'rgba(10,46,77,0.35)' }}>
                  Request submitted on {fmtDate(booking.created_at)}
                </p>
              </>
            )}
          </div>

          {/* ── Messages / chat ── */}
          {user != null && (
            <BookingChat
              bookingId={booking.id}
              initialMessages={messages}
              currentUserId={user.id}
              senderRole="angler"
              myName="You"
              otherName={booking.guide_name ?? 'Guide'}
              bookingNote={booking.special_requests}
              bookingNoteDate={booking.created_at}
            />
          )}

        </div>
      </div>
    </div>
  )
}
