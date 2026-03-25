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
  confirmed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  pending:    { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'    },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
  completed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  refunded:   { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'   },
  accepted:   { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  declined:   { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'   },
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
  let depositCheckoutUrl: string | null = null
  const awaitingPayment = booking.status === 'accepted'

  if (awaitingPayment && booking.stripe_checkout_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_id)
      if (session.status === 'open' && session.url) {
        depositCheckoutUrl = session.url
      }
    } catch {
      // Session ID might not exist — let banner handle it
    }
  }

  const justPaid        = qStatus === 'paid'
  const awaitingBalance = booking.status === 'confirmed' && booking.balance_paid_at == null
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

  const guideHasStripe = guide?.stripe_payouts_enabled === true

  // Guide's decline message (if they proposed alternatives)
  const guideDeclineMessage =
    booking.status === 'declined' && guide != null
      ? (initialMessages.filter(m => m.sender_id === guide.user_id).at(-1) ?? null)
      : null

  const s = STATUS_STYLES[booking.status]

  // Cover image
  const images = exp?.experience_images ?? []
  const cover  =
    images.find(img => img.is_cover) ??
    images.sort((a, b) => a.sort_order - b.sort_order)[0]
  const coverUrl = cover?.url ?? null

  // Requested dates (what angler originally picked)
  const requestedDates = (booking.requested_dates as string[] | null) ?? null
  const hasRequestedDates = requestedDates != null && requestedDates.length > 0

  // Confirmed trip start date (set by guide on accept — may differ from requested)
  const confirmedDate = ['accepted', 'confirmed', 'completed'].includes(booking.status)
    ? new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  // Duration
  const durationLabel =
    booking.duration_option ??
    (requestedDates != null && requestedDates.length > 1
      ? `${requestedDates.length} day${requestedDates.length !== 1 ? 's' : ''}`
      : '1 day')

  // Financials
  const depositEur = booking.deposit_eur ?? Math.round(booking.total_eur * 0.3)
  const balanceEur = Math.round(booking.total_eur - depositEur)

  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const bookingRef = id.slice(-8).toUpperCase()

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[960px]">

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
              {/* ── Header ─────────────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] uppercase tracking-[0.22em] f-body"
                       style={{ color: 'rgba(10,46,77,0.38)' }}>
                      #{bookingRef}
                    </p>
                    <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 10 }}>·</span>
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      {createdFormatted}
                    </p>
                  </div>
                  <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug">
                    {exp?.title ?? 'Fishing trip'}
                  </h1>
                </div>
                <span
                  className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.label}
                </span>
              </div>

              {/* ── Dates section ───────────────────────────────────────────── */}
              <div className="mb-5 flex flex-col gap-3">

                {/* Confirmed trip date — shown when guide accepted */}
                {confirmedDate != null && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
                      <line x1="5" y1="1" x2="5" y2="4" />
                      <line x1="11" y1="1" x2="11" y2="4" />
                      <line x1="2" y1="6.5" x2="14" y2="6.5" />
                      <path d="M5.5 10l2 2 3.5-3" strokeWidth="1.6" />
                    </svg>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] f-body mb-0.5" style={{ color: 'rgba(22,163,74,0.65)' }}>
                        Trip confirmed for
                      </p>
                      <p className="text-sm font-bold f-display" style={{ color: '#15803D' }}>
                        {confirmedDate}
                      </p>
                    </div>
                  </div>
                )}

                {/* Requested dates — always show what the angler picked */}
                {hasRequestedDates && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] mb-1.5 f-body"
                       style={{ color: 'rgba(10,46,77,0.38)' }}>
                      {booking.status === 'pending' ? 'Your requested dates' : 'Originally requested'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {requestedDates!.map(d => (
                        <span
                          key={d}
                          className="text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                          style={{
                            background: booking.status === 'pending'
                              ? 'rgba(59,130,246,0.08)'
                              : 'rgba(10,46,77,0.05)',
                            color: booking.status === 'pending'
                              ? '#2563EB'
                              : 'rgba(10,46,77,0.5)',
                            border: `1px solid ${booking.status === 'pending' ? 'rgba(59,130,246,0.2)' : 'rgba(10,46,77,0.08)'}`,
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

                {/* Fallback: show booking_date if no requested_dates and no confirmed date */}
                {!hasRequestedDates && confirmedDate == null && (
                  <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                    {new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}

                {/* Pending: waiting message */}
                {booking.status === 'pending' && (
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
                    style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.15)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#E67E50" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
                      <circle cx="7" cy="7" r="6" />
                      <path d="M7 4v3.5l2 2" />
                    </svg>
                    <p className="text-xs f-body" style={{ color: '#C46030' }}>
                      Waiting for your guide to confirm dates and accept the booking.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Stats grid ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <InfoCard
                  label="Anglers"
                  value={`${booking.guests} ${booking.guests === 1 ? 'angler' : 'anglers'}`}
                />
                <InfoCard
                  label="Duration"
                  value={durationLabel}
                />
                <InfoCard
                  label="Deposit (30%)"
                  value={`€${depositEur}`}
                  subValue={booking.status === 'confirmed' || booking.status === 'completed' ? 'Paid ✓' : undefined}
                  subColor="#16A34A"
                />
                <InfoCard
                  label="Balance (70%)"
                  value={`€${balanceEur}`}
                  subValue={booking.balance_paid_at != null ? 'Paid ✓' : booking.status === 'confirmed' ? 'Due before trip' : undefined}
                  subColor={booking.balance_paid_at != null ? '#16A34A' : undefined}
                />
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
                      Deposit received!
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
                      Your booking is being confirmed — usually takes a few seconds.
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
                      Full payment received. See you on the water!
                    </p>
                  </div>
                </div>
              )}

              {/* ── Pay deposit banner ───────────────────────────────────────── */}
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

              {/* ── Pay balance banner ───────────────────────────────────────── */}
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

              {/* ── Guide card ───────────────────────────────────────────────── */}
              {guide != null && (
                <div
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: '#0A2E4D' }}
                  >
                    {guide.full_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {guide.full_name}
                    </p>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Your guide
                    </p>
                  </div>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Message via chat →
                  </p>
                </div>
              )}

              {/* ── Link to original inquiry ────────────────────────────────── */}
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

              {/* ── Declined: reason + guide's alternative dates ────────────── */}
              {booking.status === 'declined' && (
                <div className="mt-4 pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>

                  <div
                    className="flex items-start gap-3 px-4 py-4 rounded-2xl"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                      <circle cx="9" cy="9" r="7.5" />
                      <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold f-body mb-1" style={{ color: '#DC2626' }}>
                        Guide couldn&apos;t accept this booking
                      </p>
                      {booking.declined_reason != null && booking.declined_reason.length > 0 ? (
                        <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
                          {booking.declined_reason}
                        </p>
                      ) : (
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                          No reason provided. Feel free to reach out via chat.
                        </p>
                      )}
                    </div>
                  </div>

                  {guideDeclineMessage != null && (
                    <div
                      className="px-4 py-4 rounded-2xl flex flex-col gap-2.5"
                      style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.18)' }}
                    >
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
                          <line x1="5" y1="1" x2="5" y2="4" />
                          <line x1="11" y1="1" x2="11" y2="4" />
                          <line x1="2" y1="6.5" x2="14" y2="6.5" />
                        </svg>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: '#2563EB' }}>
                          Message from {guide?.full_name ?? 'guide'}
                        </p>
                      </div>
                      <p className="text-xs f-body leading-relaxed whitespace-pre-line" style={{ color: 'rgba(10,46,77,0.7)' }}>
                        {guideDeclineMessage.body}
                      </p>
                      {exp?.id != null && (
                        <a
                          href={`/book/${exp.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold f-body transition-opacity hover:opacity-75"
                          style={{ color: '#2563EB' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                            <path d="M3 6h6M7 4l2 2-2 2" />
                          </svg>
                          Book new dates for this experience →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Special requests ────────────────────────────────────────── */}
              {booking.special_requests != null && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Your requests
                  </p>
                  <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
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

function InfoCard({
  label,
  value,
  subValue,
  subColor,
}: {
  label:     string
  value:     string
  subValue?: string
  subColor?: string
}) {
  return (
    <div
      className="px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] mb-1 f-body"
         style={{ color: 'rgba(10,46,77,0.38)' }}>
        {label}
      </p>
      <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
        {value}
      </p>
      {subValue != null && (
        <p className="text-[10px] font-semibold f-body mt-0.5" style={{ color: subColor ?? 'rgba(10,46,77,0.4)' }}>
          {subValue}
        </p>
      )}
    </div>
  )
}
