import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getGuideBookings } from '@/actions/bookings'
import type { GuideBookingListItem } from '@/actions/bookings'

export const revalidate = 0
export const metadata = { title: 'Bookings — FjordAnglers Dashboard' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
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
  pending:    'Pending',
  offer_sent: 'Offer sent',
  confirmed:  'Confirmed',
  declined:   'Declined',
  cancelled:  'Cancelled',
  completed:  'Completed',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    pending:    { bg: '#FFF7ED', text: '#C05621',  border: 'rgba(230,126,80,0.3)'  },
    offer_sent: { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)'  },
    confirmed:  { bg: '#F0FDF4', text: '#15803D',  border: 'rgba(34,197,94,0.3)'   },
    declined:   { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    cancelled:  { bg: '#F9FAFB', text: '#6B7280',  border: '#E5E7EB'                },
    completed:  { bg: '#EFF6FF', text: '#1D4ED8',  border: 'rgba(59,130,246,0.3)'  },
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

const TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'declined',  label: 'Declined'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuideBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab    = params.tab ?? 'all'

  const result = await getGuideBookings()
  if (!result.success) redirect('/dashboard')

  const all      = result.bookings
  const filtered = tab === 'all' ? all : all.filter(b => b.status === tab)

  const pending   = all.filter(b => b.status === 'pending')
  const confirmed = all.filter(b => b.status === 'confirmed')
  const revenue   = confirmed.reduce((sum, b) => sum + b.guide_payout_eur, 0)

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* ── Header ── */}
        <div className="mb-7">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            Bookings
          </h1>
          <p className="mt-1 text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {all.length} {all.length === 1 ? 'booking request' : 'booking requests'} total
          </p>
        </div>

        {/* ── Filter tabs — above both columns so right panel aligns with first card ── */}
        <div
          className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(10,46,77,0.07)' }}
        >
          {TABS.map(t => {
            const count  = t.key === 'all' ? all.length : all.filter(b => b.status === t.key).length
            const active = tab === t.key
            return (
              <Link
                key={t.key}
                href={`/dashboard/bookings?tab=${t.key}`}
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
                      background: active
                        ? t.key === 'pending'
                          ? 'rgba(230,126,80,0.15)'
                          : 'rgba(10,46,77,0.08)'
                        : 'rgba(10,46,77,0.08)',
                      color: active && t.key === 'pending' ? '#E67E50' : active ? '#0A2E4D' : 'rgba(10,46,77,0.45)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* ── Main: booking list ── */}
          <div className="flex-1 min-w-0">

            {/* Booking cards */}
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
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-base font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
                  No bookings yet
                </p>
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {tab === 'all'
                    ? "When anglers request your trips, they'll appear here."
                    : `No ${tab} bookings.`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(booking => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: stats panel ── */}
          <div className="xl:w-[268px] flex-shrink-0 flex flex-col gap-3">

            {/* Pending action card */}
            {pending.length > 0 && (
              <Link
                href="/dashboard/bookings?tab=pending"
                className="block rounded-2xl p-5 transition-opacity hover:opacity-90"
                style={{
                  background: '#FFFBF7',
                  border:     '1.5px solid rgba(230,126,80,0.35)',
                  boxShadow:  '0 2px 12px rgba(230,126,80,0.1)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50' }} />
                  <p className="text-xs font-bold uppercase tracking-wider f-body" style={{ color: '#E67E50' }}>
                    Action required
                  </p>
                </div>
                <p className="text-3xl font-bold f-display" style={{ color: '#E67E50' }}>
                  {pending.length}
                </p>
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  pending {pending.length === 1 ? 'booking' : 'bookings'} to review
                </p>
              </Link>
            )}

            {/* Stats */}
            <div
              className="rounded-2xl p-5"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 1px 4px rgba(10,46,77,0.06)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider f-body mb-4"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                Summary
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>Confirmed</span>
                  <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{confirmed.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>Pending</span>
                  <span className="text-sm font-bold f-body"
                    style={{ color: pending.length > 0 ? '#E67E50' : '#0A2E4D' }}>
                    {pending.length}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 mt-1"
                  style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>Est. revenue</span>
                  <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
                    €{revenue.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: GuideBookingListItem }) {
  const dateLabel = formatDateRange(
    booking.booking_date,
    booking.date_to,
    booking.requested_dates,
  )

  const isPending   = booking.status === 'pending'
  const isOfferSent = booking.status === 'offer_sent'

  return (
    <Link
      href={`/dashboard/bookings/${booking.id}`}
      className="block rounded-2xl transition-all hover:-translate-y-0.5"
      style={{
        background: '#FFFFFF',
        border:     isPending
          ? '1px solid rgba(230,126,80,0.25)'
          : isOfferSent
            ? '1px solid rgba(59,130,246,0.2)'
            : '1px solid rgba(10,46,77,0.08)',
        boxShadow: isPending
          ? '0 1px 8px rgba(230,126,80,0.08)'
          : isOfferSent
            ? '0 1px 8px rgba(59,130,246,0.06)'
            : '0 1px 4px rgba(10,46,77,0.06)',
      }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">

          {/* Left */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={booking.status} />
              {booking.experience_title != null && (
                <span className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                  {booking.experience_title}
                </span>
              )}
            </div>

            <p className="text-sm f-body mb-1" style={{ color: '#374151' }}>
              <span style={{ color: 'rgba(10,46,77,0.45)' }}>Angler: </span>
              <span className="font-medium">{booking.angler_full_name ?? 'Unknown'}</span>
              {booking.angler_email != null && (
                <span className="hidden sm:inline" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  {' '}&middot; {booking.angler_email}
                </span>
              )}
            </p>

            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
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

          {/* Right */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Your payout</p>
              <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>
                €{booking.guide_payout_eur.toFixed(2)}
              </p>
            </div>
            <span className="text-xs f-body font-medium" style={{
              color: isPending ? '#E67E50' : isOfferSent ? '#1D4ED8' : 'rgba(10,46,77,0.4)',
            }}>
              {isPending ? 'Review →' : isOfferSent ? 'Awaiting angler →' : 'View →'}
            </span>
          </div>

        </div>
      </div>
    </Link>
  )
}
