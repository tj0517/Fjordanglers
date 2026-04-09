import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAnglerBookings } from '@/actions/bookings'
import type { AnglerBookingListItem } from '@/actions/bookings'

export const revalidate = 0
export const metadata = { title: 'Receipts — FjordAnglers' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Receipt card ─────────────────────────────────────────────────────────────

function ReceiptCard({ booking }: { booking: AnglerBookingListItem }) {
  const bookingFeeEur = Math.round((booking.platform_fee_eur + booking.service_fee_eur) * 100) / 100
  const paidAt = booking.balance_paid_at!
  const tripStart = fmtDate(booking.booking_date)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#FFFFFF',
        border:     '1px solid rgba(10,46,77,0.08)',
        boxShadow:  '0 1px 4px rgba(10,46,77,0.06)',
      }}
    >
      <div className="p-5 sm:p-6">
        {/* Top row: title + paid badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-bold f-display leading-snug" style={{ color: '#0A2E4D' }}>
            {booking.experience_title ?? 'Fishing experience'}
          </h3>
          <span
            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full f-body flex-shrink-0"
            style={{
              background: '#F0FDF4',
              color:      '#15803D',
              border:     '1px solid rgba(34,197,94,0.3)',
            }}
          >
            Paid
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            {booking.guide_name != null ? `with ${booking.guide_name}` : 'Guide TBC'}
          </span>
          <span style={{ color: 'rgba(10,46,77,0.2)' }}>&middot;</span>
          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            Trip starts {tripStart}
          </span>
          <span style={{ color: 'rgba(10,46,77,0.2)' }}>&middot;</span>
          <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            Paid {fmtDate(paidAt)}
          </span>
        </div>

        {/* Amount + receipt link */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Booking fee paid to FjordAnglers</p>
            <p className="text-xl font-bold f-display mt-0.5" style={{ color: '#0A2E4D' }}>
              €{bookingFeeEur.toFixed(2)}
            </p>
          </div>
          <Link
            href={`/account/receipts/${booking.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold f-body transition-all hover:opacity-90"
            style={{ background: '#0A2E4D', color: '#FFFFFF' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View receipt
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReceiptsPage() {
  const result = await getAnglerBookings()
  if (!result.success) redirect('/login')

  // Only show bookings where the booking fee was actually paid to Stripe
  const eligible = result.bookings.filter(b => b.balance_paid_at != null)

  return (
    <div className="w-full min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            Receipts
          </h1>
          <p className="mt-1 text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Booking fees paid to FjordAnglers via Stripe
          </p>
        </div>

        {eligible.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(10,46,77,0.05)' }}
            >
              <svg width="24" height="24" fill="none" stroke="#0A2E4D" strokeWidth="1.5" opacity="0.4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-base font-semibold f-body mb-2" style={{ color: '#0A2E4D' }}>
              No receipts yet
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Receipts appear here after you pay the booking fee.
            </p>
            <Link
              href="/account/bookings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-90"
              style={{ background: '#E67E50', color: '#FFFFFF' }}
            >
              View my bookings →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {eligible.map(b => (
              <ReceiptCard key={b.id} booking={b} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
