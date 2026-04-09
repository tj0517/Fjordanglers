import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getGuideBookingDetail, getBookingMessages } from '@/actions/bookings'
import BookingActions from './BookingActions'
import BookingChat from '@/components/booking/BookingChat'

export const revalidate = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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
  try { return JSON.parse(raw) } catch { return {} }
}

// Read-only calendar grid for offer_sent state (guide's sent offer)
function OfferCalendarGrid({ days }: { days: string[] }) {
  if (days.length === 0) return null

  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = new Date().toISOString().slice(0, 10)

  const byMonth = new Map<string, Set<string>>()
  for (const d of days) {
    const key = d.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, new Set())
    byMonth.get(key)!.add(d)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[...byMonth.entries()].map(([monthKey, daySet]) => {
        const [yearStr, monthStr] = monthKey.split('-')
        const year      = parseInt(yearStr, 10)
        const monthIdx  = parseInt(monthStr, 10) - 1
        const monthDate = new Date(year, monthIdx, 1)
        const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        const firstDay  = monthDate.getDay()
        const daysInMo  = new Date(year, monthIdx + 1, 0).getDate()
        const offset    = (firstDay + 6) % 7
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
            <div className="grid grid-cols-7 mb-1">
              {DAY_HEADERS.map((h, i) => (
                <div key={i} className="text-center text-[9px] font-bold f-body py-0.5"
                  style={{ color: 'rgba(10,46,77,0.28)' }}>{h}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (day == null) return <div key={`e${idx}`} />
                const d = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isProposed = daySet.has(d)
                const isPast = d < today
                return (
                  <div key={d}
                    className="aspect-square flex items-center justify-center text-[10px] f-body rounded-lg"
                    style={{
                      background: isProposed ? '#E67E50' : 'transparent',
                      color:      isProposed ? '#fff'    : isPast ? 'rgba(10,46,77,0.18)' : 'rgba(10,46,77,0.55)',
                      fontWeight: isProposed ? '700'     : '400',
                      boxShadow:  isProposed ? '0 1px 4px rgba(230,126,80,0.35)' : 'none',
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

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  reviewing:  'Reviewing',
  offer_sent: 'Offer sent',
  confirmed:  'Confirmed',
  declined:   'Declined',
  cancelled:  'Cancelled',
  completed:  'Completed',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    pending:    { bg: '#FFF7ED', text: '#C05621',  border: 'rgba(230,126,80,0.3)'  },
    reviewing:  { bg: '#FFF7ED', text: '#C05621',  border: 'rgba(230,126,80,0.3)'  },
    offer_sent: { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)'  },
    confirmed:  { bg: '#F0FDF4', text: '#15803D',  border: 'rgba(34,197,94,0.3)'   },
    declined:   { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    cancelled:  { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    completed:  { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)'  },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full f-body"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuideBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch booking + messages + auth in parallel
  const supabase = await createClient()
  const svc      = createServiceClient()

  const [
    result,
    messagesResult,
    { data: { user } },
  ] = await Promise.all([
    getGuideBookingDetail(id),
    getBookingMessages(id),
    supabase.auth.getUser(),
  ])

  if (!result.success) notFound()

  const booking  = result.booking
  const details  = parsedOfferDetails(booking.offer_details)
  const messages = messagesResult.success ? messagesResult.messages : []

  // ── Inquiry earnings display ─────────────────────────────────────────────────
  // Icelandic inquiries start with total_eur = 0 (price set by guide when sending offer).
  // • pending + no offer price  → show "On request" (guide hasn't set price yet)
  // • offer_sent + offer_price  → show projected payout (offer_price_eur × (1 − commission))
  // • confirmed/completed       → show actual guide_payout_eur (set by acceptOffer())
  const isInquiry        = booking.source === 'inquiry'
  const offerPriceEur    = booking.offer_price_eur ?? 0
  const isOfferSent      = booking.status === 'offer_sent'
  const earningsOnRequest = isInquiry && booking.total_eur === 0 && offerPriceEur === 0
  const earningsTotal    = isOfferSent && offerPriceEur > 0 ? offerPriceEur : booking.total_eur
  const earningsPayout   = isOfferSent && offerPriceEur > 0
    ? Math.round(offerPriceEur * (1 - booking.commission_rate) * 100) / 100
    : booking.guide_payout_eur
  const earningsPlatformFee = isOfferSent && offerPriceEur > 0
    ? Math.round(offerPriceEur * booking.commission_rate * 100) / 100
    : booking.platform_fee_eur

  const dates = booking.requested_dates?.length
    ? booking.requested_dates
    : [booking.booking_date]

  // Fetch guide's blocked calendar ranges + guide name
  let blockedRanges: Array<{ date_start: string; date_end: string }> = []
  let guideName = 'Guide'
  let guideUserId = ''

  if (user != null) {
    const { data: guide } = await supabase
      .from('guides')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single()

    guideName   = guide?.full_name ?? 'Guide'
    guideUserId = user.id

    if (guide != null) {
      const today     = new Date().toISOString().slice(0, 10)
      const yearAhead = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

      // Step 1 — experience-specific calendars (same join used in /inquire/page.tsx)
      const experienceId = booking.experience_id
      const { data: expCalendars } = await svc
        .from('calendar_experiences')
        .select('calendar_id')
        .eq('experience_id', experienceId ?? '')

      let calendarIds: string[] = experienceId != null
        ? (expCalendars ?? []).map((c: { calendar_id: string }) => c.calendar_id)
        : []

      // Step 2 — fallback: all guide calendars (when no experience-specific ones found)
      if (calendarIds.length === 0) {
        const { data: allCalendars } = await svc
          .from('guide_calendars')
          .select('id')
          .eq('guide_id', guide.id)
        calendarIds = (allCalendars ?? []).map((c: { id: string }) => c.id)
      }

      if (calendarIds.length > 0) {
        const { data: rows } = await svc
          .from('calendar_blocked_dates')
          .select('date_start, date_end')
          .in('calendar_id', calendarIds)
          .gte('date_end', today)
          .lte('date_start', yearAhead)
        blockedRanges = rows ?? []
      }
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* ── Back link ── */}
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-sm f-body mb-6 transition-opacity hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All bookings
        </Link>

        {/* ── Pending action banner ── */}
        {booking.status === 'pending' && (
          <div
            className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-3"
            style={{
              background: 'rgba(230,126,80,0.08)',
              border:     '1.5px solid rgba(230,126,80,0.3)',
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: '#E67E50' }} />
            <p className="text-sm f-body" style={{ color: '#C05621' }}>
              <span className="font-semibold">Action needed —</span>{' '}
              {booking.angler_full_name ?? 'An angler'} has requested this trip. Accept or decline below.
            </p>
          </div>
        )}

        {/* ── Page heading ── */}
        <div className="flex items-center gap-3 mb-7 flex-wrap">
          <StatusBadge status={booking.status} />
          <h1 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            {booking.experience_title ?? 'Booking request'}
          </h1>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* ── Left: booking info + messages ── */}
          <div className="flex flex-col gap-4">

            {/* Angler card */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider f-body mb-4"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                Angler
              </h2>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold f-body flex-shrink-0"
                  style={{ background: '#0A2E4D' }}
                >
                  {(booking.angler_full_name ?? 'A')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    {booking.angler_full_name ?? 'Unknown angler'}
                  </p>
                  {booking.angler_email != null && (
                    <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      {booking.angler_email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sent offer details (offer_sent) ── */}
            {booking.status === 'offer_sent' && (
              <div
                className="rounded-2xl p-6 flex flex-col gap-5"
                style={{ background: '#FFFFFF', border: '1px solid rgba(59,130,246,0.15)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
              >
                <h2 className="text-xs font-bold uppercase tracking-wider f-body"
                  style={{ color: '#1D4ED8' }}>
                  Your sent offer
                </h2>

                {/* Calendar */}
                <div>
                  <p className="text-xs f-body font-medium mb-2" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Proposed dates ({(booking.offer_days ?? []).length} day{(booking.offer_days ?? []).length !== 1 ? 's' : ''})
                  </p>
                  <OfferCalendarGrid days={booking.offer_days ?? []} />
                </div>

                {/* Price */}
                {booking.offer_price_eur != null && booking.offer_price_eur > 0 && (
                  <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                    <div>
                      <p className="text-xs f-body font-medium" style={{ color: 'rgba(10,46,77,0.45)' }}>Offered trip price</p>
                      <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                      </p>
                    </div>
                    <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                      €{booking.offer_price_eur.toFixed(0)}
                    </p>
                  </div>
                )}

                {/* River / Beat section */}
                {details.riverSection != null && details.riverSection.trim() !== '' && (
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>River / Beat section</p>
                    <p className="text-sm f-body font-semibold flex items-center gap-2" style={{ color: '#0A2E4D' }}>
                      🎣 {details.riverSection}
                    </p>
                  </div>
                )}

                {/* What's included */}
                {details.included != null && details.included.length > 0 && (
                  <div>
                    <p className="text-xs f-body font-medium mb-2" style={{ color: 'rgba(10,46,77,0.45)' }}>What&apos;s included</p>
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
                  <div>
                    <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Meeting point</p>
                    <p className="text-sm f-body font-semibold flex items-start gap-1.5" style={{ color: '#0A2E4D' }}>
                      <span className="flex-shrink-0">📍</span>
                      {details.meetingLocation}
                    </p>
                  </div>
                )}

                {/* Message */}
                {details.message != null && details.message.trim() !== '' && (
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
                    <p className="text-xs f-body font-medium mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>Your message</p>
                    <p className="text-sm f-body leading-relaxed italic" style={{ color: '#374151' }}>
                      &ldquo;{details.message}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Trip details */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wider f-body mb-4"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                {booking.status === 'offer_sent' ? "Angler's request" : 'Trip details'}
              </h2>

              <div className="mb-4">
                <p className="text-xs f-body mb-1.5 font-medium" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  Requested dates
                </p>
                <div className="flex flex-wrap gap-2">
                  {dates.map(d => (
                    <span
                      key={d}
                      className="inline-block text-sm f-body px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
                    >
                      {fmtDate(d)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-6 flex-wrap">
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
                  <p className="text-xs f-body font-medium mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Requested</p>
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    {fmtDate(booking.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Messages / chat ── */}
            {guideUserId !== '' && (
              <BookingChat
                bookingId={booking.id}
                initialMessages={messages}
                currentUserId={guideUserId}
                senderRole="guide"
                myName={guideName}
                otherName={booking.angler_full_name ?? 'Angler'}
                bookingNote={booking.special_requests}
                bookingNoteDate={booking.created_at}
              />
            )}

            {/* Confirmed details — meeting location */}
            {booking.status === 'confirmed' && details.meetingLocation != null && details.meetingLocation.trim() !== '' && (
              <div
                className="rounded-2xl p-6"
                style={{ background: '#F0FDF4', border: '1px solid rgba(34,197,94,0.2)', borderLeft: '3px solid #22C55E' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider f-body mb-2" style={{ color: '#15803D' }}>
                  Meeting point
                </p>
                <p className="text-sm f-body" style={{ color: '#15803D' }}>
                  {details.meetingLocation}
                </p>
                {details.meetingLat != null && (
                  <p className="text-xs f-body mt-1" style={{ color: 'rgba(21,128,61,0.6)' }}>
                    📍 {details.meetingLat.toFixed(5)}, {details.meetingLng?.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            {/* Declined details */}
            {booking.status === 'declined' && (
              <div
                className="rounded-2xl p-6"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderLeft: '3px solid #9CA3AF' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider f-body mb-2" style={{ color: '#6B7280' }}>
                  Declined {booking.declined_at != null ? `on ${fmtDate(booking.declined_at)}` : ''}
                </p>
                {booking.declined_reason != null && booking.declined_reason.trim() !== '' && (
                  <p className="text-sm f-body italic mt-1" style={{ color: '#6B7280' }}>
                    &ldquo;{booking.declined_reason}&rdquo;
                  </p>
                )}
              </div>
            )}

          </div>

          {/* ── Right: earnings + actions ── */}
          <div className="flex flex-col gap-4">

            {/* Earnings box */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider f-body mb-3"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                Your earnings
              </p>
              {earningsOnRequest ? (
                <>
                  <p className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                    On request
                  </p>
                  <p className="text-xs f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Set your price when sending your offer to the angler
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                    {isOfferSent && offerPriceEur > 0 ? '~' : ''}€{earningsPayout.toFixed(2)}
                  </p>
                  <p className="text-xs f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Trip value: €{earningsTotal.toFixed(2)} · your share after platform fee
                    {isOfferSent && offerPriceEur > 0 ? ' (projected)' : ''}
                  </p>
                  <div className="mt-4 pt-4 flex flex-col gap-1.5"
                    style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <div className="flex justify-between text-xs f-body">
                      <span style={{ color: 'rgba(10,46,77,0.45)' }}>Trip total</span>
                      <span style={{ color: '#0A2E4D', fontWeight: 600 }}>€{earningsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs f-body">
                      <span style={{ color: 'rgba(10,46,77,0.45)' }}>
                        Platform fee ({Math.round(booking.commission_rate * 100)}%)
                      </span>
                      <span style={{ color: '#6B7280' }}>−€{earningsPlatformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs f-body pt-1.5 mt-0.5"
                      style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                      <span className="font-semibold" style={{ color: '#0A2E4D' }}>Your payout</span>
                      <span className="font-bold" style={{ color: '#0A2E4D' }}>€{earningsPayout.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Offer sent panel (inquiry flow) */}
            {booking.status === 'offer_sent' && (
              <div
                className="rounded-2xl p-5"
                style={{ background: '#EFF6FF', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider f-body mb-1" style={{ color: '#1D4ED8' }}>
                  Offer sent
                </p>
                <p className="text-xs f-body mb-2" style={{ color: 'rgba(29,78,216,0.7)' }}>
                  {booking.confirmed_at != null ? `Sent on ${fmtDate(booking.confirmed_at)}` : ''}
                </p>
                {booking.offer_price_eur != null && (
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                    Offered price: €{booking.offer_price_eur.toFixed(2)}
                  </p>
                )}
                <p className="text-xs f-body mt-2" style={{ color: 'rgba(29,78,216,0.6)' }}>
                  Waiting for the angler to accept or decline your offer.
                </p>
              </div>
            )}

            {/* Confirmation details (confirmed) */}
            {booking.status === 'confirmed' && (
              <div
                className="rounded-2xl p-5"
                style={{ background: '#F0FDF4', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider f-body mb-1" style={{ color: '#15803D' }}>
                  Confirmed ✓
                </p>
                <p className="text-xs f-body" style={{ color: 'rgba(21,128,61,0.7)' }}>
                  {booking.confirmed_at != null ? `Confirmed on ${fmtDate(booking.confirmed_at)}` : ''}
                </p>
              </div>
            )}

            {/* Pending action panel */}
            {booking.status === 'pending' && (
              <BookingActions
                bookingId={booking.id}
                requestedDates={dates}
                blockedRanges={blockedRanges}
                anglerName={booking.angler_full_name ?? 'Angler'}
                experienceTitle={booking.experience_title ?? 'Your trip'}
                guidePayout={booking.guide_payout_eur}
                totalEur={booking.total_eur}
                guests={booking.guests}
                source={(booking.source as 'direct' | 'inquiry')}
                preferences={booking.preferences}
              />
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
