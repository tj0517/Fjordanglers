import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAnglerBookings } from '@/actions/bookings'
import type { AnglerBookingListItem } from '@/actions/bookings'

export const revalidate = 0
export const metadata = { title: 'Payments — FjordAnglers' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(eur: number): string {
  return `€${eur.toFixed(2)}`
}

// ─── Payment status logic ──────────────────────────────────────────────────────

type PaymentStatus = 'paid' | 'awaiting' | 'cancelled'

function getPaymentStatus(booking: AnglerBookingListItem): PaymentStatus {
  if (booking.status === 'cancelled' || booking.status === 'declined') return 'cancelled'
  if (booking.status === 'confirmed' || booking.status === 'completed') return 'paid'
  return 'awaiting'
}

function getDisplayAmount(booking: AnglerBookingListItem): number {
  // For offer_sent bookings: show offer price if available
  if (booking.status === 'offer_sent' && booking.offer_price_eur != null) {
    return booking.offer_price_eur
  }
  return booking.total_eur
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function PaymentStatusChip({ status }: { status: PaymentStatus }) {
  const styles = {
    paid:      { bg: '#F0FDF4', text: '#15803D', border: 'rgba(34,197,94,0.3)',  label: 'Agreed' },
    awaiting:  { bg: '#FFF7ED', text: '#C05621', border: 'rgba(230,126,80,0.3)', label: 'Pending'  },
    cancelled: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB',              label: 'Cancelled' },
  }
  const s = styles[status]
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full f-body"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

// ─── Payment row ──────────────────────────────────────────────────────────────

function PaymentRow({ booking }: { booking: AnglerBookingListItem }) {
  const payStatus = getPaymentStatus(booking)
  const amount    = getDisplayAmount(booking)
  const hasAmount = amount > 0

  return (
    <Link
      href={`/account/bookings/${booking.id}`}
      className="flex items-center gap-4 px-5 sm:px-6 py-4 transition-colors hover:bg-[#F9F6F1]"
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: payStatus === 'paid' ? 'rgba(34,197,94,0.08)' : 'rgba(10,46,77,0.06)' }}
      >
        {payStatus === 'paid' ? (
          <svg width="18" height="18" fill="none" stroke="#15803D" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : payStatus === 'awaiting' ? (
          <svg width="18" height="18" fill="none" stroke="#C05621" strokeWidth="1.75">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" fill="none" stroke="#9CA3AF" strokeWidth="1.75">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
          {booking.experience_title ?? 'Fishing experience'}
        </p>
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
          {booking.guide_name != null ? `Guide: ${booking.guide_name}` : 'Guide TBC'}
          <span className="mx-1.5" style={{ color: 'rgba(10,46,77,0.2)' }}>&middot;</span>
          {fmtDate(booking.booking_date)}
        </p>
      </div>

      {/* Status + amount */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <PaymentStatusChip status={payStatus} />
        {hasAmount ? (
          <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
            {fmtMoney(amount)}
          </span>
        ) : (
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            On request
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PaymentsPage() {
  const result = await getAnglerBookings()
  if (!result.success) redirect('/login')

  const bookings = result.bookings

  // Group into sections
  const confirmed  = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const pending    = bookings.filter(b => b.status === 'pending'   || b.status === 'offer_sent')
  const cancelled  = bookings.filter(b => b.status === 'cancelled' || b.status === 'declined')

  // Total agreed (confirmed + completed with non-zero amount)
  const totalAgreed = confirmed.reduce((sum, b) => {
    const amt = getDisplayAmount(b)
    return sum + amt
  }, 0)

  const isEmpty = bookings.length === 0

  return (
    <div className="w-full min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            Payments
          </h1>
          <p className="mt-1 text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Overview of payment agreements for all your trips
          </p>
        </div>

        {/* Summary card (only if confirmed bookings exist) */}
        {confirmed.length > 0 && (
          <div
            className="rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-5"
            style={{
              background: '#0A2E4D',
              boxShadow:  '0 4px 20px rgba(10,46,77,0.18)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(230,126,80,0.18)', border: '1.5px solid rgba(230,126,80,0.35)' }}
            >
              <svg width="22" height="22" fill="none" stroke="#E67E50" strokeWidth="1.75">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs f-body font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Total agreed across {confirmed.length} confirmed {confirmed.length === 1 ? 'trip' : 'trips'}
              </p>
              <p className="text-2xl font-bold f-display mt-0.5" style={{ color: '#FFFFFF' }}>
                {totalAgreed > 0 ? fmtMoney(totalAgreed) : 'Arranged with guide'}
              </p>
            </div>
          </div>
        )}

        {isEmpty ? (
          /* Empty state */
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(10,46,77,0.05)' }}
            >
              <svg width="24" height="24" fill="none" stroke="#0A2E4D" strokeWidth="1.5" opacity="0.4">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-base font-semibold f-body mb-2" style={{ color: '#0A2E4D' }}>
              No payments yet
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Book a fishing trip and payment details will appear here.
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
          <div className="flex flex-col gap-5">

            {/* Confirmed / completed */}
            {confirmed.length > 0 && (
              <section>
                <h2
                  className="text-xs font-bold f-body uppercase tracking-widest mb-2 px-1"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Confirmed
                </h2>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: '#FFFFFF',
                    border:     '1px solid rgba(10,46,77,0.08)',
                  }}
                >
                  {confirmed.map((b, i) => (
                    <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : 'none' }}>
                      <PaymentRow booking={b} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pending / offer sent */}
            {pending.length > 0 && (
              <section>
                <h2
                  className="text-xs font-bold f-body uppercase tracking-widest mb-2 px-1"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Pending
                </h2>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
                >
                  {pending.map((b, i) => (
                    <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : 'none' }}>
                      <PaymentRow booking={b} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cancelled / declined */}
            {cancelled.length > 0 && (
              <section>
                <h2
                  className="text-xs font-bold f-body uppercase tracking-widest mb-2 px-1"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Cancelled / declined
                </h2>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}
                >
                  {cancelled.map((b, i) => (
                    <div key={b.id} style={{ borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : 'none' }}>
                      <PaymentRow booking={b} />
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {/* Note about payment model */}
        <p
          className="text-xs f-body text-center mt-8"
          style={{ color: 'rgba(10,46,77,0.35)' }}
        >
          Payment is arranged directly with your guide. FjordAnglers facilitates the booking only.
        </p>

      </div>
    </div>
  )
}
