import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import BookingActions from '@/components/dashboard/booking-actions'
import { CountryFlag } from '@/components/ui/country-flag'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed' },
  pending:    { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'   },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled' },
  completed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed' },
  refunded:   { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'  },
  accepted:   { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'  },
  declined:   { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'  },
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
    .select('*, experience:experiences(id, title)')
    .eq('id', id)
    .eq('guide_id', guide.id)
    .single()

  if (!booking) notFound()

  // Initial messages (service client — bypasses RLS for safety)
  const serviceClient = createServiceClient()
  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  const exp = booking.experience as unknown as { id: string; title: string } | null
  const s   = STATUS_STYLES[booking.status]

  const dateFormatted = new Date(booking.booking_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

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

          {/* Main info card */}
          <div
            className="p-6"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <p
                  className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Booking · {createdFormatted}
                </p>
                <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug truncate">
                  {exp?.title ?? 'Fishing trip'}
                </h1>
                <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {dateFormatted}
                </p>
              </div>
              <span
                className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <InfoCard label="Guests"     value={`${booking.guests} pax`} />
              <InfoCard label="Total"      value={`€${booking.total_eur}`} />
              <InfoCard label="Your payout" value={`€${booking.guide_payout_eur}`} accent />
              <InfoCard label="Commission" value={`${Math.round(booking.commission_rate * 100)}%`} />
            </div>

            {/* Angler card */}
            <div
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}
            >
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
              {booking.angler_email != null && (
                <a
                  href={`mailto:${booking.angler_email}`}
                  className="flex-shrink-0 text-xs f-body font-medium transition-opacity hover:opacity-70"
                  style={{ color: '#E67E50' }}
                >
                  Email ↗
                </a>
              )}
            </div>

            {/* Special requests */}
            {booking.special_requests != null && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                <p
                  className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Special requests
                </p>
                <p
                  className="text-sm f-body leading-relaxed"
                  style={{ color: 'rgba(10,46,77,0.65)' }}
                >
                  {booking.special_requests}
                </p>
              </div>
            )}

            {/* Link to original inquiry (custom trips only) */}
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

            {/* Accept / Decline */}
            {booking.status === 'pending' && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                <BookingActions bookingId={id} />
              </div>
            )}
          </div>

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
      <p
        className="text-[10px] uppercase tracking-[0.15em] mb-1 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        {label}
      </p>
      <p
        className="text-base font-bold f-display"
        style={{ color: accent ? '#16A34A' : '#0A2E4D' }}
      >
        {value}
      </p>
    </div>
  )
}
