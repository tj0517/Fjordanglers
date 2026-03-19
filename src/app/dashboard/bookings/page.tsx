import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import BookingActions from '@/components/dashboard/booking-actions'
import { CountryFlag } from '@/components/ui/country-flag'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

type BookingRow = Database['public']['Tables']['bookings']['Row'] & {
  experience: { title: string } | null
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed' },
  pending:    { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled' },
  completed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed' },
  refunded:   { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded' },
  // Added with Wave 4A enum extension
  accepted:   { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted' },
  declined:   { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined' },
}


// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (user == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">Bookings</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          Please{' '}
          <Link href="/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to view your bookings.
        </p>
      </div>
    )
  }

  // ── Guide lookup ────────────────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">Bookings</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          No guide profile found.{' '}
          <Link href="/guides/apply" className="text-[#E67E50] underline underline-offset-2">Apply to become a guide →</Link>
        </p>
      </div>
    )
  }

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('*, experience:experiences(title)')
    .eq('guide_id', guide.id)
    .order('booking_date', { ascending: false })

  const bookings = (rawBookings ?? []) as unknown as BookingRow[]

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalBookings   = bookings.length
  const pendingCount    = bookings.filter(b => b.status === 'pending').length
  const confirmedCount  = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length
  const totalRevenue    = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.guide_payout_eur, 0)

  const STATS = [
    { label: 'Total bookings',  value: totalBookings,               sub: 'all time' },
    { label: 'Pending review',  value: pendingCount,                sub: 'awaiting confirmation' },
    { label: 'Confirmed',       value: confirmedCount,              sub: 'confirmed & completed' },
    { label: 'Total earned',    value: `€${Math.round(totalRevenue).toLocaleString()}`, sub: 'guide payout' },
  ]

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">Bookings</h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">All booking requests for your trips.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map(stat => (
          <div
            key={stat.label}
            className="px-6 py-5"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
              {stat.label}
            </p>
            <p className="text-[#0A2E4D] text-2xl font-bold f-display">{stat.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Bookings table */}
      {bookings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center"
          style={{
            background: '#FDFAF7',
            borderRadius: '24px',
            border: '2px dashed rgba(10,46,77,0.12)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(230,126,80,0.1)' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#E67E50" strokeWidth="1.5">
              <rect x="3" y="4" width="16" height="14" rx="2" />
              <line x1="3" y1="9" x2="19" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="14" y1="2" x2="14" y2="6" />
            </svg>
          </div>
          <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">No bookings yet</h3>
          <p className="text-[#0A2E4D]/45 text-sm f-body">
            When anglers book your trips they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#FDFAF7',
            borderRadius: '24px',
            border: '1px solid rgba(10,46,77,0.07)',
            boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            className="grid px-7 py-3"
            style={{
              gridTemplateColumns: '2fr 1.5fr 100px 70px 90px 90px 110px 130px',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              gap: '12px',
            }}
          >
            {['Angler', 'Trip', 'Date', 'Guests', 'Total', 'Payout', 'Status', 'Actions'].map(col => (
              <p
                key={col}
                className="text-[10px] uppercase tracking-[0.18em] f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                {col}
              </p>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {bookings.map((booking) => {
              const s = STATUS_STYLES[booking.status]
              const expTitle = booking.experience?.title ?? '—'
              const dateFormatted = new Date(booking.booking_date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })

              return (
                <div
                  key={booking.id}
                  className="grid items-center px-7 py-4"
                  style={{
                    gridTemplateColumns: '2fr 1.5fr 100px 70px 90px 90px 110px 130px',
                    gap: '12px',
                  }}
                >
                  {/* Angler */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CountryFlag country={booking.angler_country} size={16} />
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">
                        {booking.angler_full_name ?? 'Guest'}
                      </p>
                    </div>
                    {booking.angler_country != null && (
                      <p className="text-[#0A2E4D]/38 text-xs f-body mt-0.5">{booking.angler_country}</p>
                    )}
                  </div>

                  {/* Experience */}
                  <p className="text-[#0A2E4D]/70 text-sm f-body truncate">{expTitle}</p>

                  {/* Date */}
                  <p className="text-[#0A2E4D] text-sm f-body">{dateFormatted}</p>

                  {/* Guests */}
                  <p className="text-[#0A2E4D] text-sm font-medium f-body">
                    {booking.guests} {booking.guests === 1 ? 'pax' : 'pax'}
                  </p>

                  {/* Total */}
                  <p className="text-[#0A2E4D] text-sm font-bold f-display">€{booking.total_eur}</p>

                  {/* Payout */}
                  <p className="text-[#16A34A] text-sm font-bold f-display">€{booking.guide_payout_eur}</p>

                  {/* Status */}
                  <span
                    className="inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>

                  {/* Actions — accept/decline for pending bookings */}
                  <div>
                    {booking.status === 'pending' ? (
                      <BookingActions bookingId={booking.id} />
                    ) : (
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.25)' }}>
                        —
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
