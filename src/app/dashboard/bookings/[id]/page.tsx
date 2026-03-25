import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import RespondBookingWidget from './RespondBookingWidget'
import MarkBalancePaidButton from '@/components/dashboard/mark-balance-paid-button'
import { CountryFlag } from '@/components/ui/country-flag'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  pending:    { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'    },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
  completed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  refunded:   { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'   },
  accepted:   { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  declined:   { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'   },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuideBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/bookings/${id}`)

  // Guide identity
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (!guide) redirect('/dashboard/bookings')

  // Booking — must belong to this guide
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, experience:experiences(id, title, price_per_person_eur, experience_images(url, is_cover, sort_order))')
    .eq('id', id)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) notFound()

  const serviceClient = createServiceClient()

  // Initial messages
  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  // For pending bookings — fetch calendar data for the respond form
  let guideWeeklySchedules: { period_from: string; period_to: string; blocked_weekdays: number[] }[] = []
  let experienceBlockedDates: { date_start: string; date_end: string }[] = []

  if (booking.status === 'pending') {
    const { data: schedules } = await serviceClient
      .from('guide_weekly_schedules')
      .select('period_from, period_to, blocked_weekdays')
      .eq('guide_id', guide.id)
    guideWeeklySchedules = schedules ?? []

    if (booking.experience_id != null) {
      const { data: blocked } = await serviceClient
        .from('experience_blocked_dates')
        .select('date_start, date_end')
        .eq('experience_id', booking.experience_id)
      experienceBlockedDates = blocked ?? []
    }
  }

  type ExpShape = {
    id: string
    title: string
    price_per_person_eur: number | null
    experience_images: { url: string; is_cover: boolean; sort_order: number }[]
  } | null
  const exp = booking.experience as unknown as ExpShape

  const s = STATUS_STYLES[booking.status]

  const requestedDates = (booking.requested_dates as string[] | null) ?? null
  const hasMultiDates  = requestedDates != null && requestedDates.length > 1

  // Derive duration label
  const durationLabel =
    booking.duration_option ??
    (requestedDates != null && requestedDates.length > 1
      ? `${requestedDates.length} day${requestedDates.length !== 1 ? 's' : ''}`
      : '1 day')

  // Financials
  const depositEur  = booking.deposit_eur  ?? Math.round(booking.total_eur * 0.3)
  const balanceEur  = Math.round(booking.total_eur - depositEur)

  // Confirmed trip date (set by guide on accept)
  const confirmedDate = ['accepted', 'confirmed', 'completed'].includes(booking.status)
    ? new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const bookingRef = id.slice(-8).toUpperCase()

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[960px]">

      {/* ── Back nav ────────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-7 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="7,2 3,6 7,10" />
          <line x1="3" y1="6" x2="11" y2="6" />
        </svg>
        All Bookings
      </Link>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── LEFT: Booking details ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* ── Main info card ─────────────────────────────────────────────── */}
          <div
            className="p-6"
            style={{
              background:   '#FDFAF7',
              borderRadius: '24px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            {/* ── Header row ──────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] f-body"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>
                    #{bookingRef}
                  </p>
                  <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 10 }}>·</span>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    {createdFormatted}
                  </p>
                </div>
                <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug truncate">
                  {exp?.title ?? 'Fishing trip'}
                </h1>

                {/* ── Dates section ────────────────────────────────────────── */}
                <div className="mt-2">
                  {/* Confirmed trip date (after guide accepts) */}
                  {confirmedDate != null && (
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="flex items-center gap-1.5 text-xs font-semibold f-body px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(74,222,128,0.12)', color: '#16A34A', border: '1px solid rgba(74,222,128,0.25)' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                        </svg>
                        Trip starts: {confirmedDate}
                      </div>
                    </div>
                  )}

                  {/* Requested date chips */}
                  {hasMultiDates ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] mb-1.5 f-body"
                         style={{ color: 'rgba(10,46,77,0.35)' }}>
                        Angler requested
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {requestedDates!.map(d => (
                          <span
                            key={d}
                            className="text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.6)', border: '1px solid rgba(10,46,77,0.1)' }}
                          >
                            {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    confirmedDate == null && (
                      <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                        {new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    )
                  )}
                </div>
              </div>

              <span
                className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
            </div>

            {/* ── Stats grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <InfoCard
                label="Anglers"
                value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`}
              />
              <InfoCard
                label="Duration"
                value={durationLabel}
              />
              <InfoCard
                label="Total"
                value={`€${booking.total_eur}`}
              />
              <InfoCard
                label="Your payout"
                value={`€${booking.guide_payout_eur}`}
                accent
              />
            </div>

            {/* ── Deposit / balance split ──────────────────────────────────── */}
            <div
              className="flex items-center gap-4 px-4 py-3 rounded-2xl mb-5"
              style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: booking.status === 'confirmed' || booking.status === 'completed' ? '#16A34A' : 'rgba(10,46,77,0.2)' }}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Deposit (30%)
                  </p>
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                    €{depositEur}
                  </p>
                </div>
                {(booking.status === 'confirmed' || booking.status === 'completed') && (
                  <span className="text-[10px] font-bold f-body ml-auto" style={{ color: '#16A34A' }}>Paid ✓</span>
                )}
              </div>
              <div style={{ width: 1, height: 32, background: 'rgba(10,46,77,0.08)' }} />
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: booking.balance_paid_at != null ? '#16A34A' : 'rgba(10,46,77,0.2)' }}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Balance (70%)
                  </p>
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                    €{balanceEur}
                  </p>
                </div>
                {booking.balance_paid_at != null && (
                  <span className="text-[10px] font-bold f-body ml-auto" style={{ color: '#16A34A' }}>Paid ✓</span>
                )}
                {booking.status === 'confirmed' && booking.balance_paid_at == null && (
                  <span className="text-[10px] f-body ml-auto" style={{ color: 'rgba(10,46,77,0.4)' }}>Due before trip</span>
                )}
              </div>
            </div>

            {/* ── Angler card ──────────────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
            >
              <div className="flex items-center gap-3 p-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: '#0A2E4D' }}
                >
                  {(booking.angler_full_name ?? 'A')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CountryFlag country={booking.angler_country} size={14} />
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {booking.angler_full_name ?? 'Angler'}
                    </p>
                  </div>
                  {booking.angler_country != null && (
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      {booking.angler_country}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact row */}
              {(booking.angler_email != null || booking.angler_phone != null) && (
                <div
                  className="flex"
                  style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
                >
                  {booking.angler_email != null && (
                    <a
                      href={`mailto:${booking.angler_email}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                      style={{ color: '#E67E50' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="2.5" width="10" height="7" rx="1" />
                        <path d="M1 4l5 3.5L11 4" />
                      </svg>
                      {booking.angler_email}
                    </a>
                  )}
                  {booking.angler_phone != null && (
                    <a
                      href={`tel:${booking.angler_phone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                      style={{ color: '#0A2E4D', borderLeft: booking.angler_email ? '1px solid rgba(10,46,77,0.06)' : 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.5 8.5L9 10S4 9 2 4L3.5 1.5l2 2L4.5 5s1.5 2 2.5 2.5l1.5-1 2 2z" />
                      </svg>
                      {booking.angler_phone}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* ── Special requests ─────────────────────────────────────────── */}
            {booking.special_requests != null && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                <p className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Special requests
                </p>
                <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
                  {booking.special_requests}
                </p>
              </div>
            )}

            {/* ── Link to original inquiry ──────────────────────────────────── */}
            {booking.inquiry_id != null && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                <Link
                  href={`/dashboard/inquiries/${booking.inquiry_id}`}
                  className="inline-flex items-center gap-1.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 2H2a1 1 0 00-1 1v6a1 1 0 001 1h2.5l1.5 1.5 1.5-1.5H10a1 1 0 001-1V3a1 1 0 00-1-1z" />
                  </svg>
                  View original inquiry →
                </Link>
              </div>
            )}

            {/* ── Mark cash balance received ────────────────────────────────── */}
            {booking.status === 'confirmed' &&
             booking.balance_payment_method === 'cash' &&
             booking.balance_paid_at == null && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                <MarkBalancePaidButton
                  bookingId={id}
                  balanceAmount={balanceEur}
                />
              </div>
            )}
          </div>

          {/* ── Respond widget (pending only) — opens full-page overlay on click ── */}
          {booking.status === 'pending' && (
            <RespondBookingWidget
              bookingId={id}
              anglerName={booking.angler_full_name ?? 'Angler'}
              anglerEmail={booking.angler_email ?? ''}
              anglerCountry={booking.angler_country ?? null}
              experienceTitle={exp?.title ?? 'Fishing trip'}
              experienceId={exp?.id ?? null}
              coverUrl={null}
              windowFrom={booking.booking_date}
              anglerRequestedDates={requestedDates ?? undefined}
              durationOption={booking.duration_option}
              guests={booking.guests}
              totalEur={booking.total_eur}
              depositEur={booking.deposit_eur}
              pricePerPersonEur={exp?.price_per_person_eur ?? null}
              specialRequests={booking.special_requests}
              guideWeeklySchedules={guideWeeklySchedules}
              blockedDates={experienceBlockedDates}
            />
          )}

        </div>

        {/* ── RIGHT: Chat ────────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <BookingChat
            bookingId={id}
            currentUserId={user.id}
            myName={guide.full_name ?? 'Guide'}
            partnerName={booking.angler_full_name ?? 'Angler'}
            initialMessages={initialMessages}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function InfoCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className="px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] mb-1 f-body"
         style={{ color: 'rgba(10,46,77,0.38)' }}>
        {label}
      </p>
      <p className="text-base font-bold f-display"
         style={{ color: accent ? '#16A34A' : '#0A2E4D' }}>
        {value}
      </p>
    </div>
  )
}
