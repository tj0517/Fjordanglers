import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAnglerBookings } from '@/actions/bookings'
import type { AnglerBookingListItem } from '@/actions/bookings'

export const revalidate = 0
export const metadata = { title: 'My Bookings — FjordAnglers' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateRange(
  bookingDate: string,
  dateTo: string | null,
  requestedDates: string[] | null,
): string {
  const days = requestedDates?.length ?? 1
  if (dateTo != null && dateTo !== bookingDate) {
    return `${fmtDate(bookingDate)} – ${fmtDate(dateTo)} · ${days} ${days === 1 ? 'day' : 'days'}`
  }
  return fmtDate(bookingDate)
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Awaiting confirmation',
  confirmed: 'Confirmed',
  declined:  'Not confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    pending:   { bg: '#FFF7ED', text: '#C05621',  border: 'rgba(230,126,80,0.3)' },
    confirmed: { bg: '#F0FDF4', text: '#15803D',  border: 'rgba(34,197,94,0.3)'  },
    declined:  { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'               },
    cancelled: { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'               },
    completed: { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full f-body"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'declined',  label: 'Declined'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab    = params.tab ?? 'all'

  const result = await getAnglerBookings()

  if (!result.success) {
    redirect('/login')
  }

  const all      = result.bookings
  const filtered = tab === 'all'
    ? all
    : all.filter(b => b.status === tab)

  return (
    <div className="w-full min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            My Bookings
          </h1>
          <p className="mt-1 text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {all.length} {all.length === 1 ? 'booking request' : 'booking requests'} total
          </p>
        </div>

        {/* ── Filter tabs ── */}
        <div
          className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{ background: 'rgba(10,46,77,0.07)', width: 'fit-content' }}
        >
          {TABS.map(t => {
            const count = t.key === 'all'
              ? all.length
              : all.filter(b => b.status === t.key).length
            const active = tab === t.key
            return (
              <Link
                key={t.key}
                href={`/account/bookings?tab=${t.key}`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm f-body font-medium transition-all"
                style={{
                  background: active ? '#FFFFFF' : 'transparent',
                  color:      active ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
                  boxShadow:  active ? '0 1px 4px rgba(10,46,77,0.1)' : 'none',
                }}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full f-body"
                    style={{
                      background: active ? 'rgba(230,126,80,0.1)' : 'rgba(10,46,77,0.08)',
                      color:      active ? '#E67E50' : 'rgba(10,46,77,0.45)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Booking list ── */}
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(10,46,77,0.05)' }}
            >
              <svg width="24" height="24" fill="none" stroke="#0A2E4D" strokeWidth="1.5" opacity="0.4">
                <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-base font-semibold f-body mb-2" style={{ color: '#0A2E4D' }}>
              {tab === 'all' ? 'No booking requests yet' : `No ${tab} bookings`}
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Find a guide and request your first fishing trip.
            </p>
            <Link
              href="/trips"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-90"
              style={{ background: '#E67E50', color: '#FFFFFF' }}
            >
              Browse experiences →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(booking => (
              <AnglerBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function AnglerBookingCard({ booking }: { booking: AnglerBookingListItem }) {
  const dateLabel = formatDateRange(
    booking.booking_date,
    booking.date_to,
    booking.requested_dates,
  )

  const initial = booking.guide_name?.[0]?.toUpperCase() ?? 'G'

  return (
    <Link
      href={`/account/bookings/${booking.id}`}
      className="block rounded-2xl transition-all hover:-translate-y-0.5"
      style={{
        background:  '#FFFFFF',
        border:      '1px solid rgba(10,46,77,0.08)',
        boxShadow:   '0 1px 4px rgba(10,46,77,0.06)',
      }}
    >
      <div className="p-5 sm:p-6">

        {/* Status + experience title */}
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <StatusBadge status={booking.status} />
        </div>

        <h3 className="text-lg font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          {booking.experience_title ?? 'Fishing experience'}
        </h3>

        {/* Guide */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold f-body flex-shrink-0"
            style={{ background: '#0A2E4D' }}
          >
            {initial}
          </div>
          <span className="text-sm f-body font-medium" style={{ color: '#374151' }}>
            {booking.guide_name ?? 'Your guide'}
          </span>
        </div>

        {/* Dates + guests + total */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
              {dateLabel}
              <span className="mx-1.5" style={{ color: 'rgba(10,46,77,0.25)' }}>&middot;</span>
              {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
              {booking.duration_option != null && (
                <>
                  <span className="mx-1.5" style={{ color: 'rgba(10,46,77,0.25)' }}>&middot;</span>
                  {booking.duration_option}
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Total</p>
            <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>
              €{booking.total_eur.toFixed(2)}
            </p>
          </div>
        </div>

      </div>
    </Link>
  )
}
