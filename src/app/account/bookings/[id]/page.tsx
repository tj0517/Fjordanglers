import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import PayDepositBanner from '@/components/booking/pay-deposit-banner'
import PayBalanceBanner from '@/components/booking/pay-balance-banner'
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

export default async function AnglerBookingDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  const [{ id }, { status: qStatus }] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/account/bookings/${id}`)

  // Booking — must belong to this angler (RLS enforces angler_id = auth.uid())
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      '*, experience:experiences(id, title, experience_images(url, is_cover, sort_order)), guide:guides(id, full_name, user_id, stripe_payouts_enabled)',
    )
    .eq('id', id)
    .eq('angler_id', user.id)
    .single()

  if (!booking) notFound()

  // ── Stripe Checkout URL ───────────────────────────────────────────────────
  // Guide has accepted → a Checkout session was created in acceptBooking().
  // Try to fetch the live URL server-side (no JS round-trip).
  // If expired / missing, the banner's renewDepositCheckout() handles it client-side.
  let depositCheckoutUrl: string | null = null

  // awaitingPayment: guide has accepted (deposit banner always shown)
  // - if guideHasStripe: shows real Stripe link (or renew button if expired)
  // - if !guideHasStripe: shows test YES / NO mock panel
  const awaitingPayment = booking.status === 'accepted'

  if (awaitingPayment && booking.stripe_checkout_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_id)
      if (session.status === 'open' && session.url) {
        depositCheckoutUrl = session.url
      }
      // If expired (status !== 'open') we leave depositCheckoutUrl = null →
      // the banner will call renewDepositCheckout() on click.
    } catch {
      // Session ID might not exist (e.g. test env mismatch) — let banner handle it
    }
  }

  // ── ?status=paid — Stripe success_url callback (deposit) ─────────────────
  // Stripe redirects here after successful deposit payment.  The webhook will
  // confirm the booking asynchronously; show a short "payment received" message.
  const justPaid = qStatus === 'paid'

  // ── awaitingBalance: deposit paid, balance not yet settled ─────────────────
  const awaitingBalance =
    booking.status === 'confirmed' &&
    booking.balance_paid_at == null

  // ── ?status=balance_paid — Stripe balance success_url callback ─────────────
  const justBalancePaid = qStatus === 'balance_paid'

  // Initial messages
  const serviceClient = createServiceClient()
  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  const exp   = booking.experience as unknown as {
    id: string; title: string;
    experience_images: { url: string; is_cover: boolean; sort_order: number }[]
  } | null
  const guide = booking.guide as unknown as {
    id: string; full_name: string; user_id: string; stripe_payouts_enabled: boolean | null
  } | null

  // testMode = true when guide has no Stripe connected yet
  const guideHasStripe = guide?.stripe_payouts_enabled === true
  const s     = STATUS_STYLES[booking.status]

  // Cover image
  const images = exp?.experience_images ?? []
  const cover  =
    images.find(img => img.is_cover) ??
    images.sort((a, b) => a.sort_order - b.sort_order)[0]
  const coverUrl = cover?.url ?? null

  const dateFormatted = new Date(booking.booking_date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="px-10 py-10 max-w-[960px]">

      {/* ── Back nav ────────────────────────────────────────────────────────── */}
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-7 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="7,2 3,6 7,10" />
          <line x1="3" y1="6" x2="11" y2="6" />
        </svg>
        My Bookings
      </Link>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── LEFT: Booking info ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div
            className="overflow-hidden"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            {/* Cover image */}
            {coverUrl != null && (
              <div style={{ height: 180, position: 'relative', background: 'rgba(10,46,77,0.08)' }}>
                <Image
                  src={coverUrl}
                  alt={exp?.title ?? 'Trip'}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p
                    className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    Your Booking · {createdFormatted}
                  </p>
                  <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug">
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

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <InfoCard label="Anglers"    value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`} />
                <InfoCard label="Total" value={`€${booking.total_eur}`} />
              </div>

              {/* ── Deposit payment success banner ─────────────────────────── */}
              {justPaid && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="9" cy="9" r="7.5" />
                    <path d="M6 9l2 2 4-4" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
                      Payment received!
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
                      Your booking is being confirmed — this usually takes a few seconds.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Balance payment success banner ─────────────────────────── */}
              {justBalancePaid && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="9" cy="9" r="7.5" />
                    <path d="M6 9l2 2 4-4" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
                      Balance paid — you&apos;re all set!
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
                      Full payment received. Your trip is confirmed and ready to go.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Pay deposit banner ───────────────────────────────────────
                   pending + checkout_id → direct booking (angler didn't complete Stripe yet)
                   accepted             → icelandic booking (guide accepted, waiting for payment)
              ── */}
              {awaitingPayment && !justPaid && (
                <div className="mb-4">
                  <PayDepositBanner
                    bookingId={id}
                    initialCheckoutUrl={depositCheckoutUrl}
                    totalEur={booking.total_eur}
                    testMode={!guideHasStripe}
                  />
                </div>
              )}

              {/* ── Pay balance banner ─────────────────────────────────────── */}
              {awaitingBalance && !justBalancePaid && (
                <div className="mb-4">
                  <PayBalanceBanner
                    bookingId={id}
                    totalEur={booking.total_eur}
                    paymentMethod={(booking.balance_payment_method ?? 'cash') as 'stripe' | 'cash'}
                    guideName={guide?.full_name ?? 'Your guide'}
                    testMode={!guideHasStripe}
                  />
                </div>
              )}

              {/* Guide card */}
              {guide != null && (
                <div
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: '#0A2E4D' }}
                  >
                    {guide.full_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {guide.full_name}
                    </p>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Your guide
                    </p>
                  </div>
                </div>
              )}

              {/* Link to original inquiry (custom trips only) */}
              {booking.inquiry_id != null && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <Link
                    href={`/account/trips/${booking.inquiry_id}`}
                    className="inline-flex items-center gap-1.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'rgba(10,46,77,0.5)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 2H2a1 1 0 00-1 1v6a1 1 0 001 1h2.5l1.5 1.5 1.5-1.5H10a1 1 0 001-1V3a1 1 0 00-1-1z" />
                    </svg>
                    View original request →
                  </Link>
                </div>
              )}

              {/* Special requests */}
              {booking.special_requests != null && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <p
                    className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    Your requests
                  </p>
                  <p
                    className="text-sm f-body leading-relaxed"
                    style={{ color: 'rgba(10,46,77,0.65)' }}
                  >
                    {booking.special_requests}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Chat ────────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <BookingChat
            bookingId={id}
            currentUserId={user.id}
            myName={booking.angler_full_name ?? 'You'}
            partnerName={guide?.full_name ?? 'Guide'}
            initialMessages={initialMessages}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
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
      <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
        {value}
      </p>
    </div>
  )
}
