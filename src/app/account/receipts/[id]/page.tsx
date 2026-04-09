import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getAnglerBookingDetail } from '@/actions/bookings'
import { stripe } from '@/lib/stripe/client'
import PrintButton from './PrintButton'

export const revalidate = 0

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day:    'numeric',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// ─── Row component ────────────────────────────────────────────────────────────

function ReceiptRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string
  value: string
  bold?: boolean
  accent?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between py-2.5 gap-4"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
    >
      <span className="text-sm f-body flex-1" style={{ color: 'rgba(10,46,77,0.55)' }}>
        {label}
      </span>
      <span
        className="text-sm f-body text-right"
        style={{
          color:      accent ? '#E67E50' : '#0A2E4D',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Fetch Stripe receipt URL ─────────────────────────────────────────────────

async function getStripeReceiptUrl(checkoutSessionId: string): Promise<string | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['payment_intent.latest_charge'],
    })
    const pi = session.payment_intent as { latest_charge?: { receipt_url?: string | null } } | null
    return pi?.latest_charge?.receipt_url ?? null
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAnglerBookingDetail(id)

  if (!result.success) notFound()

  const booking = result.booking

  // Receipt is only for bookings where the booking fee was actually paid
  if (booking.balance_paid_at == null) notFound()

  const bookingFeeEur = Math.round((booking.platform_fee_eur + booking.service_fee_eur) * 100) / 100

  // Fetch Stripe-hosted receipt URL
  const stripeReceiptUrl = booking.stripe_checkout_id != null
    ? await getStripeReceiptUrl(booking.stripe_checkout_id)
    : null

  const confirmedDates = booking.confirmed_days ?? []
  const requestedDates = booking.requested_dates ?? [booking.booking_date]
  const displayDates   = confirmedDates.length > 0 ? confirmedDates : requestedDates

  const ref = booking.id.slice(0, 8).toUpperCase()
  const paidAt = booking.balance_paid_at

  return (
    <div className="w-full min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Back link */}
        <Link
          href="/account/receipts"
          className="inline-flex items-center gap-2 text-sm f-body mb-6 transition-opacity hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.55)' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to receipts
        </Link>

        {/* Receipt card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border:     '1px solid rgba(10,46,77,0.08)',
            boxShadow:  '0 4px 24px rgba(10,46,77,0.1)',
          }}
        >
          {/* Header */}
          <div
            className="px-6 sm:px-8 py-6 sm:py-8"
            style={{
              background:   '#0A2E4D',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Image
                  src="/brand/white-logo.png"
                  alt="FjordAnglers"
                  width={120}
                  height={30}
                  className="h-6 w-auto mb-4"
                />
                <p className="text-xs f-body font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Booking fee receipt
                </p>
                <h1 className="text-xl font-bold f-display mt-1" style={{ color: '#FFFFFF' }}>
                  #{ref}
                </h1>
              </div>
              <div className="text-right">
                <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Paid
                </p>
                <p className="text-xs f-body font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {fmtDate(paidAt)}
                </p>
                <div
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold f-body"
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    color:      '#86EFAC',
                    border:     '1px solid rgba(34,197,94,0.3)',
                  }}
                >
                  <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Payment confirmed
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-8 py-6 sm:py-8">

            {/* Experience + guide */}
            <div className="mb-6">
              <h2 className="text-lg font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
                {booking.experience_title ?? 'Fishing experience'}
              </h2>
              {booking.guide_name != null && (
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  with {booking.guide_name}
                </p>
              )}
            </div>

            {/* Trip dates */}
            <div className="mb-6">
              <p className="text-xs font-bold f-body uppercase tracking-wider mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Trip dates
              </p>
              <div className="flex flex-wrap gap-2">
                {displayDates.map(d => (
                  <span
                    key={d}
                    className="inline-flex items-center text-sm f-body font-medium px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(34,197,94,0.08)',
                      color:      '#15803D',
                      border:     '1px solid rgba(34,197,94,0.2)',
                    }}
                  >
                    {fmtDate(d)}
                  </span>
                ))}
              </div>
            </div>

            {/* Details rows */}
            <div
              className="rounded-2xl overflow-hidden mb-6"
              style={{
                background: '#F9F6F1',
                border:     '1px solid rgba(10,46,77,0.06)',
              }}
            >
              <div className="px-4 py-1">
                <ReceiptRow
                  label="Anglers"
                  value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`}
                />
                {booking.duration_option != null && (
                  <ReceiptRow label="Package" value={booking.duration_option} />
                )}
                <ReceiptRow label="Booking reference" value={`#${ref}`} />
                <ReceiptRow label="Payment date" value={fmtDateTime(paidAt)} />
              </div>
            </div>

            {/* Booking fee breakdown */}
            <div
              className="rounded-2xl p-5 mb-6"
              style={{
                background: '#0A2E4D',
                border:     '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p className="text-xs f-body font-bold uppercase tracking-wider mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Paid to FjordAnglers
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm f-body">
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>Platform commission</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>€{booking.platform_fee_eur.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm f-body">
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>Service fee</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>€{booking.service_fee_eur.toFixed(2)}</span>
                </div>
              </div>
              <div
                className="flex items-center justify-between pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p className="text-sm f-body font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Total charged
                </p>
                <p className="text-2xl font-bold f-display" style={{ color: '#FFFFFF' }}>
                  €{bookingFeeEur.toFixed(2)}
                </p>
              </div>
              <p className="text-xs f-body mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {booking.guide_stripe_enabled
                  ? `Paid via Stripe. The remaining €${booking.guide_payout_eur.toFixed(2)} trip payment is handled automatically via Stripe.`
                  : `Paid via Stripe. The guide's trip fee (€${booking.guide_payout_eur.toFixed(2)}) is arranged directly between you and your guide.`
                }
              </p>
            </div>

            {/* Stripe receipt link */}
            {stripeReceiptUrl != null && (
              <a
                href={stripeReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold f-body mb-4 transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(10,46,77,0.05)',
                  color:      '#0A2E4D',
                  border:     '1px solid rgba(10,46,77,0.12)',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Open Stripe receipt
              </a>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/account/bookings/${booking.id}`}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-90 flex-1"
                style={{ background: '#0A2E4D', color: '#FFFFFF' }}
              >
                View booking
              </Link>
              <PrintButton />
            </div>

          </div>

          {/* Footer */}
          <div
            className="px-6 sm:px-8 py-4 text-center"
            style={{
              borderTop:  '1px solid rgba(10,46,77,0.06)',
              background: '#F9F6F1',
            }}
          >
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              FjordAnglers — fjordanglers.com · Questions?{' '}
              <a
                href="mailto:support@fjordanglers.com"
                className="underline underline-offset-2"
                style={{ color: 'rgba(10,46,77,0.6)' }}
              >
                support@fjordanglers.com
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
