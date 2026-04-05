import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import PayDepositBanner from '@/components/booking/pay-deposit-banner'
import PayBalanceBanner from '@/components/booking/pay-balance-banner'
import PayGuideButton from '@/components/booking/pay-guide-button'
import { buildBookingReference } from '@/lib/sepa-qr'
import { getPaymentModel } from '@/lib/payment-model'
import type { Database } from '@/lib/supabase/database.types'
import { ArrowLeft, Calendar, Clock, Check, X, MessageSquare, ArrowRight } from 'lucide-react'
import { MicroCalendar } from '@/components/account/micro-calendar'
import { ExperienceLocationMap } from '@/components/trips/experience-location-map-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  pending:        { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'      },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer sent'     },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Offer accepted' },
  accepted:       { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'       },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'      },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'      },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'      },
  refunded:       { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'       },
  declined:       { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'       },
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
      '*, experience:experiences(id, title, description, fish_types, fishing_methods, technique, difficulty, duration_hours, duration_days, location_country, location_city, location_lat, location_lng, meeting_point_lat, meeting_point_lng, meeting_point_address, experience_images(url, is_cover, sort_order)), guide:guides(id, full_name, user_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, iban, iban_holder_name, iban_bic)',
    )
    .eq('id', id)
    .eq('angler_id', user.id)
    .single()

  if (!booking) notFound()

  const serviceClient = createServiceClient()

  // ── Webhook fallback: confirm directly from Stripe if webhook hasn't arrived ─
  //
  // Stripe webhooks are sent to the registered endpoint (production URL).
  // On preview deployments the webhook never arrives, so we verify payment
  // directly with Stripe whenever the booking is in an awaiting-payment state.
  //
  // We intentionally do NOT gate this on ?status=paid — if the user was logged
  // out mid-redirect (wrong success_url) and navigated back manually, the query
  // param is gone but the payment may have completed. Polling Stripe here is safe:
  //   - Only fires when status is accepted/offer_accepted with a checkout_id set
  //   - Idempotent: .in('status', ...) guard prevents double-updates
  //   - Webhook arriving later is a no-op (status already 'confirmed')

  let webhookFallbackSession: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>> | null = null

  if (
    (booking.status === 'accepted' || booking.status === 'offer_accepted') &&
    booking.stripe_checkout_id
  ) {
    try {
      webhookFallbackSession = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_id)
      const session = webhookFallbackSession
      if (session.payment_status === 'paid') {
        await serviceClient
          .from('bookings')
          .update({
            status:                   'confirmed',
            confirmed_at:             new Date().toISOString(),
            stripe_payment_intent_id: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
          })
          .eq('id', id)
          .in('status', ['accepted', 'offer_accepted']) // idempotent guard
        // Reflect in this render without a second DB round-trip
        booking.status = 'confirmed' as typeof booking.status
      }
    } catch {
      // Non-fatal — webhook may still arrive
    }
  }

  if (booking.status === 'confirmed' && booking.balance_paid_at == null && booking.balance_stripe_checkout_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.balance_stripe_checkout_id)
      if (session.payment_status === 'paid') {
        await serviceClient
          .from('bookings')
          .update({
            status:                           'completed',
            balance_paid_at:                  new Date().toISOString(),
            balance_stripe_payment_intent_id: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
          })
          .eq('id', id)
          .eq('status', 'confirmed')
          .is('balance_paid_at', null) // idempotent guard
        booking.status = 'completed' as typeof booking.status
        ;(booking as typeof booking & { balance_paid_at: string }).balance_paid_at = new Date().toISOString()
      }
    } catch {
      // Non-fatal — webhook may still arrive
    }
  }

  // ── Stripe Checkout URL ───────────────────────────────────────────────────
  let depositCheckoutUrl: string | null = null
  const awaitingPayment = booking.status === 'accepted' || booking.status === 'offer_accepted'

  if (awaitingPayment && booking.stripe_checkout_id) {
    try {
      // Reuse the session already fetched by the webhook fallback above if available,
      // otherwise fetch it now.
      const session = webhookFallbackSession ?? await stripe.checkout.sessions.retrieve(booking.stripe_checkout_id)
      if (session.status === 'open' && session.url) {
        depositCheckoutUrl = session.url
      }
    } catch {
      // Session ID might not exist — let banner handle it
    }
  }

  const justPaid        = qStatus === 'paid'
  const justGuidePaid   = qStatus === 'guide_paid'
  const awaitingBalance = booking.status === 'confirmed' && booking.balance_paid_at == null
  const justBalancePaid = qStatus === 'balance_paid'

  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  const exp = booking.experience as unknown as {
    id: string
    title: string
    description: string | null
    fish_types: string[] | null
    fishing_methods: string[] | null
    technique: string | null
    difficulty: string | null
    duration_hours: number | null
    duration_days: number | null
    location_country: string | null
    location_city: string | null
    location_lat: number | null
    location_lng: number | null
    meeting_point_lat: number | null
    meeting_point_lng: number | null
    meeting_point_address: string | null
    experience_images: { url: string; is_cover: boolean; sort_order: number }[]
  } | null
  const guide = booking.guide as unknown as {
    id: string; full_name: string; user_id: string
    stripe_account_id: string | null
    stripe_charges_enabled: boolean | null
    stripe_payouts_enabled: boolean | null
    iban: string | null
    iban_holder_name: string | null
    iban_bic: string | null
  } | null

  const paymentModel = getPaymentModel({
    stripe_account_id:      guide?.stripe_account_id ?? null,
    stripe_charges_enabled: guide?.stripe_charges_enabled ?? null,
    stripe_payouts_enabled: guide?.stripe_payouts_enabled ?? null,
  })

  // ── Guide amount payment status ────────────────────────────────────────────
  // New two-step model: after booking fee paid, angler still needs to pay guide.
  // Model A (Stripe Connect): guide_stripe_checkout_id set, pay via Stripe
  // Model B (IBAN): iban_shared_at set, pay via bank transfer
  // Model C (nothing): arrange directly
  const guideAmountEur  = booking.guide_payout_eur ?? Math.max(0, (booking.total_eur ?? 0) - (booking.deposit_eur ?? 0))
  const guideAmountPaid = (booking as Record<string, unknown>).guide_amount_paid_at != null
  const ibanShared      = (booking as Record<string, unknown>).iban_shared_at != null
  const guideStripeCheckoutId = (booking as Record<string, unknown>).guide_stripe_checkout_id as string | null ?? null

  // Guide amount payment link (Stripe Connect model)
  let guideAmountCheckoutUrl: string | null = null
  if (
    booking.status === 'confirmed' &&
    !guideAmountPaid &&
    paymentModel === 'stripe_connect' &&
    guideStripeCheckoutId
  ) {
    try {
      const guideSession = await stripe.checkout.sessions.retrieve(guideStripeCheckoutId)
      if (guideSession.payment_status === 'paid') {
        // Guide amount already paid via Stripe — update DB (webhook may have missed it)
        await serviceClient
          .from('bookings')
          .update({
            guide_amount_paid_at:      new Date().toISOString(),
            guide_amount_stripe_pi_id: typeof guideSession.payment_intent === 'string'
              ? guideSession.payment_intent : null,
          })
          .eq('id', id)
          .is('guide_amount_paid_at', null)
        ;(booking as Record<string, unknown>).guide_amount_paid_at = new Date().toISOString()
      } else if (guideSession.status === 'open' && guideSession.url) {
        guideAmountCheckoutUrl = guideSession.url
      }
    } catch {
      // Non-fatal
    }
  }

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
    [...images].sort((a, b) => a.sort_order - b.sort_order)[0]
  const coverUrl = cover?.url ?? null

  // Requested dates (what angler originally picked)
  const requestedDates = (booking.requested_dates as string[] | null) ?? null
  const hasRequestedDates = requestedDates != null && requestedDates.length > 0

  const isInquiry = booking.source === 'inquiry'

  // ── Canonical confirmed days ───────────────────────────────────────────────
  // confirmed_days is the array of specific trip days (non-consecutive safe).
  // Preferred over all other sources once guide has accepted.
  const confirmedDaysArr = (booking.confirmed_days as string[] | null)
  const offerDaysRaw      = (booking.offer_days    as string[] | null)

  // Envelope dates — first/last day used as MicroCalendar from/to fallback
  const confirmedStatuses = ['accepted', 'offer_accepted', 'confirmed', 'completed']
  const isConfirmedStatus = confirmedStatuses.includes(booking.status)
  const dateForConfirmed  =
    confirmedDaysArr?.[0] ??
    (isInquiry ? booking.offer_date_from : null) ??
    booking.booking_date
  const dateToConfirmed: string | null =
    confirmedDaysArr?.[confirmedDaysArr.length - 1] ??
    (isInquiry ? booking.offer_date_to : null) ??
    booking.date_to ?? null
  const isMultiDay = dateToConfirmed != null && dateToConfirmed !== dateForConfirmed

  // ── Robust display days ────────────────────────────────────────────────────
  // Canonical array first, then specific-day fallbacks for pre-backfill bookings
  // where confirmed_days is still null.
  // · direct bookings: old code overwrote requested_dates with the guide's confirmed days
  //   so requested_dates contains the correct specific days for legacy rows.
  // · inquiry bookings: offer_days contains the guide's exact day picks.
  const displayDays: string[] | null =
    (confirmedDaysArr != null && confirmedDaysArr.length > 0 ? confirmedDaysArr : null) ??
    (!isInquiry && isConfirmedStatus && requestedDates != null && requestedDates.length > 0
      ? requestedDates : null) ??
    (isInquiry  && isConfirmedStatus && offerDaysRaw  != null && offerDaysRaw.length  > 0
      ? offerDaysRaw  : null)

  const sortedDisplayDays = displayDays != null ? [...displayDays].sort() : null
  const hasNonConsecutiveDays =
    sortedDisplayDays != null &&
    sortedDisplayDays.length > 1 &&
    !isConsecutiveDays(sortedDisplayDays)

  // Human-readable date text for the "Trip confirmed for" banner
  const confirmedDate = isConfirmedStatus
    ? sortedDisplayDays != null && sortedDisplayDays.length > 0
      ? hasNonConsecutiveDays
        ? sortedDisplayDays.length <= 3
          ? formatDaysList(sortedDisplayDays)
          : `${sortedDisplayDays.length} fishing days`
        : sortedDisplayDays.length === 1
          ? new Date(sortedDisplayDays[0]! + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })
          : `${new Date(sortedDisplayDays[0]! + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long',
            })} – ${new Date(sortedDisplayDays[sortedDisplayDays.length - 1]! + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            })}`
      : isMultiDay
        ? `${new Date(dateForConfirmed + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'long',
          })} – ${new Date(dateToConfirmed! + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          })}`
        : new Date(dateForConfirmed + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })
    : null

  // Duration — only use the guide-confirmed value; never derive from window length
  const durationLabel = booking.duration_option ?? null

  // Availability window for pending inquiry bookings (first → last date in the array)
  const windowFrom = requestedDates?.[0] ?? null
  const windowTo   = requestedDates != null && requestedDates.length > 1
    ? requestedDates[requestedDates.length - 1]
    : null
  const isWindowBooking = windowTo != null  // true = range; false = single exact date

  // Financials
  const depositEur = booking.deposit_eur ?? (booking.total_eur != null ? Math.round(booking.total_eur * 0.4) : 0)
  const balanceEur = booking.total_eur != null ? Math.round(booking.total_eur - depositEur) : 0
  const depositPct = booking.total_eur != null && booking.total_eur > 0
    ? Math.round((depositEur / booking.total_eur) * 100)
    : 40
  const balancePct = 100 - depositPct

  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const bookingRef = id.slice(-8).toUpperCase()

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 w-full max-w-[1120px]">

      {/* ── Back nav ────────────────────────────────────────────────────────── */}
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-7 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <ArrowLeft width={12} height={12} strokeWidth={1.5} />
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
                    {exp?.title ?? (
                      isInquiry && (booking as unknown as Record<string, string[] | null>).target_species?.length
                        ? ((booking as unknown as Record<string, string[]>).target_species.join(' & ') + ' Fishing')
                        : 'Fishing trip'
                    )}
                  </h1>
                </div>
                <span
                  className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.label}
                </span>
              </div>

              {/* ── Pay deposit banner (shown immediately after header when awaiting payment) ── */}
              {awaitingPayment && !justPaid && (
                <div className="mb-2">
                  <PayDepositBanner
                    bookingId={id}
                    initialCheckoutUrl={depositCheckoutUrl}
                    depositEur={depositEur}
                    balanceEur={balanceEur}
                    paymentModel={paymentModel}
                  />
                </div>
              )}

              {/* ── Trip info (experience details) ──────────────────────────── */}
              {exp != null && (
                <div className="mb-5 pb-5 flex flex-col gap-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                  {/* Location + quick facts */}
                  <div className="flex flex-wrap gap-2">
                    {(exp.location_city != null || exp.location_country != null) && (
                      <Chip>📍 {[exp.location_city, exp.location_country].filter(Boolean).join(', ')}</Chip>
                    )}
                    {exp.fish_types != null && exp.fish_types.length > 0 &&
                      exp.fish_types.map(f => <Chip key={f}>🎣 {f}</Chip>)
                    }
                    {exp.technique != null && <Chip>{exp.technique}</Chip>}
                    {exp.duration_hours != null && (
                      <Chip>
                        {exp.duration_hours >= 24
                          ? `${Math.round(exp.duration_hours / 24)} day${Math.round(exp.duration_hours / 24) !== 1 ? 's' : ''}`
                          : `${exp.duration_hours}h`}
                      </Chip>
                    )}
                    {exp.duration_days != null && exp.duration_hours == null && (
                      <Chip>{exp.duration_days} day{exp.duration_days !== 1 ? 's' : ''}</Chip>
                    )}
                  </div>
                  {/* Description excerpt */}
                  {exp.description != null && exp.description.length > 0 && (
                    <p
                      className="text-sm f-body leading-relaxed line-clamp-3"
                      style={{ color: 'rgba(10,46,77,0.6)' }}
                    >
                      {exp.description}
                    </p>
                  )}
                </div>
              )}

              {/* ── Location map ────────────────────────────────────────────────── */}
              {exp != null && (() => {
                const mapLat = exp.meeting_point_lat ?? exp.location_lat
                const mapLng = exp.meeting_point_lng ?? exp.location_lng
                if (mapLat == null || mapLng == null) return null
                return (
                  <div className="mb-5 pb-5 flex flex-col gap-2" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                    <p className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      Meeting point
                    </p>
                    {exp.meeting_point_address != null && (
                      <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {exp.meeting_point_address}
                      </p>
                    )}
                    <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', isolation: 'isolate' }}>
                      <ExperienceLocationMap lat={mapLat} lng={mapLng} />
                    </div>
                  </div>
                )
              })()}

              {/* ── Inquiry: what guide arranged ─────────────────────────────── */}
              {isInquiry && (booking.offer_details != null || booking.assigned_river != null) && (
                <div className="mb-5 pb-5 flex flex-col gap-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    What your guide arranged
                  </p>
                  {booking.assigned_river != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Location</span>
                      <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{booking.assigned_river}</span>
                    </div>
                  )}
                  {booking.offer_details != null && (
                    <p className="text-sm f-body leading-relaxed whitespace-pre-line" style={{ color: 'rgba(10,46,77,0.65)' }}>
                      {booking.offer_details}
                    </p>
                  )}
                </div>
              )}

              {/* ── Dates section ───────────────────────────────────────────── */}
              <div className="mb-5 flex flex-col gap-3">

                {/* Confirmed trip date — shown when guide accepted */}
                {confirmedDate != null && (
                  <div
                    className="px-4 py-4 rounded-2xl"
                    style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Calendar width={16} height={16} stroke="#16A34A" strokeWidth={1.5} className="flex-shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] f-body mb-0.5" style={{ color: 'rgba(22,163,74,0.65)' }}>
                            {awaitingPayment ? 'Your trip dates' : 'Trip confirmed for'}
                          </p>
                          <p className="text-sm font-bold f-display" style={{ color: '#15803D' }}>
                            {confirmedDate}
                          </p>
                        </div>
                      </div>
                      <MicroCalendar
                        from={dateForConfirmed}
                        to={dateToConfirmed ?? dateForConfirmed}
                        days={sortedDisplayDays ?? undefined}
                      />
                    </div>
                  </div>
                )}

                {/* Availability window — only while pending, only for range requests */}
                {booking.status === 'pending' && isWindowBooking && windowFrom != null && (
                  <div
                    className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}
                  >
                    <Calendar width={15} height={15} stroke="#2563EB" strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] f-body mb-0.5" style={{ color: 'rgba(37,99,235,0.6)' }}>
                        Your availability window
                      </p>
                      <p className="text-sm font-semibold f-display" style={{ color: '#1D4ED8' }}>
                        {new Date(`${windowFrom}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' – '}
                        {new Date(`${windowTo}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(37,99,235,0.55)' }}>
                        The guide will confirm your exact trip date{durationLabel ? ` (${durationLabel})` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Single exact date — pending direct booking */}
                {booking.status === 'pending' && !isWindowBooking && windowFrom != null && confirmedDate == null && (
                  <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {new Date(`${windowFrom}T12:00:00`).toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
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
                    <Clock width={14} height={14} stroke="#E67E50" strokeWidth={1.5} className="flex-shrink-0" />
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
                  value={durationLabel ?? '—'}
                />
                <InfoCard
                  label="Booking fee"
                  value={`€${depositEur}`}
                  subValue={booking.status === 'confirmed' || booking.status === 'completed' ? 'Paid ✓' : undefined}
                  subColor="#16A34A"
                />
                <InfoCard
                  label="Guide payment"
                  value={`€${guideAmountEur}`}
                  subValue={
                    guideAmountPaid
                      ? 'Paid ✓'
                      : booking.status === 'confirmed'
                        ? paymentModel === 'stripe_connect'
                          ? 'Due — pay online'
                          : 'Due — pay guide directly'
                        : undefined
                  }
                  subColor={guideAmountPaid ? '#16A34A' : 'rgba(10,46,77,0.45)'}
                />
              </div>

              {/* ── Deposit payment success banner ─────────────────────────── */}
              {justPaid && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <Check width={18} height={18} stroke="#16A34A" strokeWidth={1.5} />
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

              {/* ── Balance payment success banner (legacy) ────────────────── */}
              {justBalancePaid && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <Check width={18} height={18} stroke="#16A34A" strokeWidth={1.5} />
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

              {/* ── Guide payment success banner ────────────────────────────── */}
              {justGuidePaid && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <Check width={18} height={18} stroke="#16A34A" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
                      Guide payment complete — you&apos;re all set!
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
                      Full payment received. See you on the water!
                    </p>
                  </div>
                </div>
              )}

              {/* ── Pay balance banner (legacy — balance_payment_method flow) ── */}
              {awaitingBalance && !justBalancePaid && booking.balance_stripe_checkout_id && (
                <div className="mb-4">
                  <PayBalanceBanner
                    bookingId={id}
                    balanceEur={balanceEur}
                    paymentMethod={(booking.balance_payment_method ?? 'cash') as 'stripe' | 'cash'}
                    guideName={guide?.full_name ?? 'Your guide'}
                  />
                </div>
              )}

              {/* ── Guide payment section (new model) ───────────────────────── */}
              {booking.status === 'confirmed' && !guideAmountPaid && !justGuidePaid && guideAmountEur > 0 && (
                <GuidePaymentSection
                  paymentModel={paymentModel}
                  guideAmountEur={guideAmountEur}
                  guideName={guide?.full_name ?? 'Your guide'}
                  guideAmountCheckoutUrl={guideAmountCheckoutUrl}
                  bookingId={id}
                  ibanShared={ibanShared}
                  guideIban={guide?.iban ?? null}
                  guideIbanHolder={guide?.iban_holder_name ?? null}
                />
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

              {/* ── Link to inquiry view (inquiry-sourced bookings) ─────────── */}
              {booking.source === 'inquiry' && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <Link
                    href={`/account/trips/${booking.id}`}
                    className="inline-flex items-center gap-1.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'rgba(10,46,77,0.5)' }}
                  >
                    <MessageSquare width={12} height={12} strokeWidth={1.5} />
                    View trip request →
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
                    <X width={18} height={18} stroke="#DC2626" strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
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
                        <Calendar width={14} height={14} stroke="#2563EB" strokeWidth={1.5} />
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
                          <ArrowRight width={12} height={12} strokeWidth={1.7} />
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

// ─── GuidePaymentSection ──────────────────────────────────────────────────────

function GuidePaymentSection({
  paymentModel,
  guideAmountEur,
  guideName,
  guideAmountCheckoutUrl,
  bookingId,
  ibanShared,
  guideIban,
  guideIbanHolder,
}: {
  paymentModel:           'stripe_connect' | 'manual'
  guideAmountEur:         number
  guideName:              string
  guideAmountCheckoutUrl: string | null
  bookingId:              string
  ibanShared:             boolean
  guideIban:              string | null
  guideIbanHolder:        string | null
}) {
  if (paymentModel === 'stripe_connect') {
    // Model A: pay guide via Stripe
    return (
      <div
        className="px-4 py-4 rounded-2xl mb-4 flex flex-col gap-3"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: '#2563EB' }}>
              Pay your guide
            </p>
            <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
              €{guideAmountEur}
            </p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Trip payment to {guideName} — paid directly to their account
            </p>
          </div>
          {guideAmountCheckoutUrl != null ? (
            <a
              href={guideAmountCheckoutUrl}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm font-bold f-body px-4 py-2.5 rounded-full transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: '#2563EB', color: '#fff' }}
            >
              Pay €{guideAmountEur} →
            </a>
          ) : (
            <PayGuideButton bookingId={bookingId} guideAmountEur={guideAmountEur} />
          )}
        </div>
        <p className="text-[11px] f-body" style={{ color: 'rgba(37,99,235,0.65)' }}>
          This goes directly to your guide — FjordAnglers does not take any cut from this payment.
        </p>
      </div>
    )
  }

  // Model B: IBAN shared by guide — show transfer details table
  if (ibanShared && guideIban) {
    const reference = buildBookingReference(bookingId)
    return (
      <div
        className="px-4 py-4 rounded-2xl mb-4 flex flex-col gap-3"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-1" style={{ color: '#2563EB' }}>
            Bank transfer to guide
          </p>
          <p className="text-base font-bold f-display mb-0.5" style={{ color: '#0A2E4D' }}>
            €{guideAmountEur}
          </p>
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Pay {guideName} directly via bank transfer
          </p>
        </div>

        {/* Transfer details table */}
        <div
          className="rounded-xl flex flex-col gap-0 overflow-hidden"
          style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}
        >
          {(guideIbanHolder ?? guideName) && (
            <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
              <span className="text-[10px] uppercase tracking-[0.14em] font-bold f-body w-16 flex-shrink-0" style={{ color: 'rgba(10,46,77,0.38)' }}>Name</span>
              <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>{guideIbanHolder ?? guideName}</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold f-body w-16 flex-shrink-0" style={{ color: 'rgba(10,46,77,0.38)' }}>IBAN</span>
            <span className="text-xs font-semibold f-body font-mono" style={{ color: '#0A2E4D' }}>
              {guideIban.replace(/(.{4})/g, '$1 ').trim()}
            </span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold f-body w-16 flex-shrink-0" style={{ color: 'rgba(10,46,77,0.38)' }}>Amount</span>
            <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>€{guideAmountEur}</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold f-body w-16 flex-shrink-0" style={{ color: 'rgba(10,46,77,0.38)' }}>Ref</span>
            <span className="text-xs font-semibold f-body font-mono" style={{ color: '#0A2E4D' }}>{reference}</span>
          </div>
        </div>

        <p className="text-[11px] f-body" style={{ color: 'rgba(37,99,235,0.65)' }}>
          Use the reference when making the transfer so the guide can identify your payment.
        </p>
      </div>
    )
  }

  // Model C: no payment info yet / arrange directly
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 rounded-2xl mb-4"
      style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.12)' }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: '#E67E50' }}>
          Pay guide directly — €{guideAmountEur}
        </p>
        <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
          {ibanShared
            ? 'Your guide will share their bank details shortly.'
            : 'Arrange payment of €' + guideAmountEur + ' directly with ' + guideName + ' (cash, bank transfer, or their preferred method).'}
        </p>
      </div>
    </div>
  )
}


// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns true only if every consecutive pair in a sorted ISO-date array is exactly 1 day apart. */
function isConsecutiveDays(sorted: string[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]! + 'T12:00:00')
    const curr = new Date(sorted[i]!      + 'T12:00:00')
    if (Math.round((curr.getTime() - prev.getTime()) / 86_400_000) !== 1) return false
  }
  return true
}

/** Formats up to 3 specific days as "4 Apr, 16 Apr & 26 Apr 2026". */
function formatDaysList(sorted: string[]): string {
  const fmt = (d: string, includeYear = false) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short',
      ...(includeYear ? { year: 'numeric' } : {}),
    })
  if (sorted.length === 1) {
    return new Date(sorted[0]! + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  }
  const parts = sorted.map((d, i) => fmt(d, i === sorted.length - 1))
  const last  = parts.pop()!
  return parts.join(', ') + ' & ' + last
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs f-body font-medium"
      style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.65)' }}
    >
      {children}
    </span>
  )
}

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
