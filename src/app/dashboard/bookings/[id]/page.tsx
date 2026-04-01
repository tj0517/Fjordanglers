import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import RespondBookingWidget from './RespondBookingWidget'
import MarkBalancePaidButton from '@/components/dashboard/mark-balance-paid-button'
import { CountryFlag } from '@/components/ui/country-flag'
import type { Database } from '@/lib/supabase/database.types'
import { ChevronLeft, Check, Mail, Phone, MessageSquare } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  pending:        { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'      },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer sent'     },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Offer accepted' },
  accepted:       { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'       },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'      },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'      },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'      },
  refunded:       { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'       },
  declined:       { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'       },
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

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()
  if (!guide) redirect('/dashboard/bookings')

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, experience:experiences(id, title, price_per_person_eur, experience_images(url, is_cover, sort_order))')
    .eq('id', id)
    .eq('guide_id', guide.id)
    .single()
  if (!booking) notFound()

  const serviceClient = createServiceClient()

  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  // Fetch calendar data only when needed for the respond form
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

  const durationLabel =
    booking.duration_option ??
    (requestedDates != null && requestedDates.length > 1
      ? `${requestedDates.length} day${requestedDates.length !== 1 ? 's' : ''}`
      : '1 day')

  const depositEur = booking.deposit_eur ?? Math.round(booking.total_eur * 0.4)
  const balanceEur = Math.round(booking.total_eur - depositEur)

  const confirmedDate = ['accepted', 'confirmed', 'completed'].includes(booking.status)
    ? new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const bookingRef     = id.slice(-8).toUpperCase()
  const cashBalanceDue =
    booking.status === 'confirmed' &&
    booking.balance_payment_method === 'cash' &&
    booking.balance_paid_at == null

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-6 transition-colors hover:text-[#E67E50]"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <ChevronLeft size={12} strokeWidth={1.8} />
        All Bookings
      </Link>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            {exp?.title ?? 'Fishing trip'}
          </h1>
          <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
            #{bookingRef} · Booked {createdFormatted}
          </p>
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body mt-1 flex-shrink-0"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

        {/* ══ LEFT — booking details (stacked cards) ═════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* ── Trip details ──────────────────────────────────────────────── */}
          <SectionCard title="Trip Details">

            {/* Confirmed / accepted date badge */}
            {confirmedDate != null && (
              <div>
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-semibold f-body px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(74,222,128,0.12)',
                    color: '#16A34A',
                    border: '1px solid rgba(74,222,128,0.25)',
                  }}
                >
                  <Check size={10} strokeWidth={1.6} />
                  Trip starts: {confirmedDate}
                </div>
              </div>
            )}

            {/* Multi-day angler-requested dates */}
            {hasMultiDates && (
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-1.5 f-body"
                  style={{ color: 'rgba(10,46,77,0.35)' }}
                >
                  Angler requested
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {requestedDates!.map(d => (
                    <span
                      key={d}
                      className="text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                      style={{
                        background: 'rgba(10,46,77,0.06)',
                        color: 'rgba(10,46,77,0.6)',
                        border: '1px solid rgba(10,46,77,0.1)',
                      }}
                    >
                      {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Single date (only when not confirmed and not multi-day) */}
            {!hasMultiDates && confirmedDate == null && (
              <InfoRow
                label="Date"
                value={new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              />
            )}

            <InfoRow
              label="Anglers"
              value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`}
            />
            <InfoRow label="Duration" value={durationLabel} />
          </SectionCard>

          {/* ── Payment ───────────────────────────────────────────────────── */}
          <SectionCard title="Payment">
            <InfoRow label="Total"       value={`€${booking.total_eur}`} />
            <InfoRow label="Your payout" value={`€${booking.guide_payout_eur}`} highlight />

            {/* Deposit / balance split tracker */}
            <div
              className="flex items-center gap-4 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
            >
              {/* Deposit */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background:
                      booking.status === 'confirmed' || booking.status === 'completed'
                        ? '#16A34A'
                        : 'rgba(10,46,77,0.2)',
                  }}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Deposit (40%)
                  </p>
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>€{depositEur}</p>
                </div>
                {(booking.status === 'confirmed' || booking.status === 'completed') && (
                  <span className="text-[10px] font-bold f-body ml-auto" style={{ color: '#16A34A' }}>Paid ✓</span>
                )}
              </div>

              <div style={{ width: 1, height: 32, background: 'rgba(10,46,77,0.08)' }} />

              {/* Balance */}
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: booking.balance_paid_at != null ? '#16A34A' : 'rgba(10,46,77,0.2)' }}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Balance (60%)
                  </p>
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>€{balanceEur}</p>
                </div>
                {booking.balance_paid_at != null && (
                  <span className="text-[10px] font-bold f-body ml-auto" style={{ color: '#16A34A' }}>Paid ✓</span>
                )}
                {booking.status === 'confirmed' && booking.balance_paid_at == null && (
                  <span className="text-[10px] f-body ml-auto" style={{ color: 'rgba(10,46,77,0.4)' }}>Due before trip</span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Angler ────────────────────────────────────────────────────── */}
          <SectionCard title="Angler">
            <div className="flex items-center gap-3">
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

            {(booking.angler_email != null || booking.angler_phone != null) && (
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(10,46,77,0.08)' }}
              >
                {booking.angler_email != null && (
                  <a
                    href={`mailto:${booking.angler_email}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70 min-w-0 overflow-hidden"
                    style={{ color: '#E67E50' }}
                  >
                    <Mail size={12} strokeWidth={1.4} className="flex-shrink-0" />
                    <span className="truncate">{booking.angler_email}</span>
                  </a>
                )}
                {booking.angler_phone != null && (
                  <a
                    href={`tel:${booking.angler_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                    style={{
                      color: '#0A2E4D',
                      borderLeft: booking.angler_email != null ? '1px solid rgba(10,46,77,0.08)' : 'none',
                    }}
                  >
                    <Phone size={12} strokeWidth={1.4} />
                    {booking.angler_phone}
                  </a>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── Special requests (conditional) ────────────────────────────── */}
          {booking.special_requests != null && (
            <SectionCard title="Special Requests">
              <p
                className="text-sm f-body whitespace-pre-wrap leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.65)' }}
              >
                {booking.special_requests}
              </p>
            </SectionCard>
          )}

          {/* ── Link to inquiry detail (inquiry-sourced bookings) ─────────── */}
          {booking.source === 'inquiry' && (
            <Link
              href={`/dashboard/inquiries/${booking.id}`}
              className="inline-flex items-center gap-1.5 text-xs f-body font-medium px-1 transition-colors hover:text-[#E67E50]"
              style={{ color: 'rgba(10,46,77,0.45)' }}
            >
              <MessageSquare size={12} strokeWidth={1.5} />
              View inquiry detail →
            </Link>
          )}
        </div>

        {/* ══ RIGHT — chat + action widget (sticky) ══════════════════════════ */}
        <div className="xl:sticky xl:top-6 flex flex-col gap-4">

          <BookingChat
            bookingId={id}
            currentUserId={user.id}
            myName={guide.full_name ?? 'Guide'}
            partnerName={booking.angler_full_name ?? 'Angler'}
            initialMessages={initialMessages}
          />

          {/* Pending → respond modal trigger */}
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

          {booking.status === 'accepted' && (
            <ActionStatusCard
              color="blue"
              title="Accepted — awaiting deposit"
              body="The angler will pay the 40% deposit to confirm the trip. You'll be notified when payment arrives."
            />
          )}

          {cashBalanceDue && (
            <div
              className="p-5 rounded-2xl"
              style={{
                background: '#FDFAF7',
                border:     '1px solid rgba(10,46,77,0.08)',
                boxShadow:  '0 2px 8px rgba(10,46,77,0.05)',
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                Cash balance due
              </p>
              <MarkBalancePaidButton bookingId={id} balanceAmount={balanceEur} />
            </div>
          )}

          {booking.status === 'confirmed' && !cashBalanceDue && (
            <ActionStatusCard
              color="green"
              title="Trip confirmed"
              body={
                booking.balance_paid_at != null
                  ? 'All payments received. Good luck on the water!'
                  : 'Deposit received. Balance due before the trip.'
              }
            />
          )}

          {booking.status === 'completed' && (
            <ActionStatusCard
              color="green"
              title="Trip completed"
              body="Payout processed. Check your Earnings dashboard for details."
            />
          )}

          {booking.status === 'declined' && (
            <ActionStatusCard
              color="red"
              title="Booking declined"
              body={booking.declined_reason ?? undefined}
            />
          )}

          {booking.status === 'cancelled' && (
            <ActionStatusCard
              color="red"
              title="Booking cancelled"
              body={booking.declined_reason ?? undefined}
            />
          )}

          {booking.status === 'refunded' && (
            <ActionStatusCard
              color="red"
              title="Payment refunded"
              body="The booking was cancelled and the angler has been refunded."
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(10,46,77,0.08)',
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label:      string
  value:      string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', width: 130 }}>
        {label}
      </dt>
      <dd
        className="text-sm f-body text-right"
        style={{ color: highlight ? '#E67E50' : '#0A2E4D', fontWeight: highlight ? 700 : 500 }}
      >
        {value}
      </dd>
    </div>
  )
}

type StatusColor = 'blue' | 'green' | 'orange' | 'red'

const STATUS_COLORS: Record<StatusColor, { bg: string; border: string; titleColor: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  titleColor: '#2563EB' },
  green:  { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.22)', titleColor: '#16A34A' },
  orange: { bg: 'rgba(230,126,80,0.08)',  border: 'rgba(230,126,80,0.22)', titleColor: '#C4622A' },
  red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.18)',  titleColor: '#DC2626' },
}

function ActionStatusCard({
  color,
  title,
  body,
}: {
  color: StatusColor
  title: string
  body?: string
}) {
  const c = STATUS_COLORS[color]
  return (
    <div
      className="px-5 py-4 rounded-2xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <p className="text-sm font-semibold f-body" style={{ color: c.titleColor }}>
        {title}
      </p>
      {body != null && body.length > 0 && (
        <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
          {body}
        </p>
      )}
    </div>
  )
}
