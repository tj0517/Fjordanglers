import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ expId: string }>
  searchParams: Promise<{ bookingId?: string }>
}

export default async function BookingConfirmationPage({ params, searchParams }: Props) {
  const { expId } = await params
  const { bookingId } = await searchParams

  if (!bookingId) notFound()

  // Fetch booking + experience data
  const db = createServiceClient()
  const { data: booking } = await db
    .from('bookings')
    .select(
      'id, status, booking_date, guests, total_eur, deposit_eur, guide_payout_eur, experiences(title, id), guides(full_name)',
    )
    .eq('id', bookingId)
    .single()

  if (!booking) notFound()

  const experience = booking.experiences as unknown as { title: string; id: string } | null
  const guide = booking.guides as unknown as { full_name: string } | null

  const bookingDateFormatted = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString(
    'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  )

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: '#F3EDE4' }}
    >
      <div
        className="w-full max-w-lg p-10 text-center"
        style={{
          background: '#FDFAF7',
          borderRadius: '32px',
          border: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 8px 48px rgba(10,46,77,0.1)',
        }}
      >
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(74,222,128,0.12)' }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="18" r="16" />
            <polyline points="11,18 16,23 25,13" />
          </svg>
        </div>

        <h1
          className="text-[#0A2E4D] text-3xl font-bold f-display mb-3"
          style={{ lineHeight: 1.2 }}
        >
          Request Sent!
        </h1>
        <p className="f-body text-base mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
          Your booking request has been sent to{' '}
          <span className="font-semibold" style={{ color: '#0A2E4D' }}>
            {guide?.full_name ?? 'your guide'}
          </span>
          . They will confirm within 24 hours.
        </p>

        {/* Booking summary */}
        <div
          className="p-5 mb-8 text-left"
          style={{
            background: 'rgba(10,46,77,0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(10,46,77,0.07)',
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Booking Summary
          </p>

          <dl className="flex flex-col gap-2.5">
            {experience?.title && (
              <Row label="Trip" value={experience.title} />
            )}
            <Row label="Date" value={bookingDateFormatted} />
            <Row
              label="Guests"
              value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`}
            />
            <Row label="Total trip cost" value={`€${booking.total_eur}`} />
            {booking.deposit_eur != null && (
              <Row label="Deposit paid (30%)" value={`€${booking.deposit_eur}`} highlight />
            )}
            {booking.deposit_eur != null && (
              <Row
                label="Balance due (70%)"
                value={`€${Math.round((booking.total_eur - booking.deposit_eur) * 100) / 100}`}
                muted
              />
            )}
          </dl>
        </div>

        {/* Trust signals */}
        <div className="mb-8 flex flex-col gap-2.5">
          {[
            '🛡️  No further charge until the guide confirms.',
            '⏰  Guides respond within 24 hours.',
            '📧  Confirmation email sent to your inbox.',
          ].map(text => (
            <p key={text} className="text-xs f-body text-left" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {text}
            </p>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            href="/account/bookings"
            className="block w-full py-3.5 rounded-2xl text-white font-semibold text-sm tracking-wide f-body transition-all hover:brightness-110"
            style={{ background: '#0A2E4D' }}
          >
            View My Bookings
          </Link>
          <Link
            href="/trips"
            className="block w-full py-3.5 rounded-2xl text-sm font-semibold f-body transition-all hover:opacity-80"
            style={{
              border: '1.5px solid rgba(10,46,77,0.15)',
              color: 'rgba(10,46,77,0.7)',
              background: 'transparent',
            }}
          >
            Browse More Experiences
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
        {label}
      </dt>
      <dd
        className="text-sm font-semibold f-body"
        style={{
          color: highlight ? '#E67E50' : muted ? 'rgba(10,46,77,0.45)' : '#0A2E4D',
        }}
      >
        {value}
      </dd>
    </div>
  )
}
