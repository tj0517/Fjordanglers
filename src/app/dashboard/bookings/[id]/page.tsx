import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BookingChat, { type ChatMessage } from '@/components/booking/chat'
import RespondBookingWidget from './RespondBookingWidget'
import MarkBalancePaidButton from '@/components/dashboard/mark-balance-paid-button'
import MarkTripCompletedButton from '@/components/dashboard/mark-trip-completed-button'
import ShareIbanButton from '@/components/dashboard/share-iban-button'
import { CountryFlag } from '@/components/ui/country-flag'
import type { Database } from '@/lib/supabase/database.types'
import { getPaymentModel } from '@/lib/payment-model'
import { decryptField } from '@/lib/field-encryption'
import { ChevronLeft, Check, Mail, Phone, MessageSquare } from 'lucide-react'

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

export default async function GuideBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/bookings/${id}`)

  // ── Fetch guide — include Stripe fields to derive payment model ────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, iban, iban_holder_name')
    .eq('user_id', user.id)
    .single()
  if (!guide) redirect('/dashboard/bookings')

  // ── Derive payment model from Stripe status ────────────────────────────────
  const paymentModel = getPaymentModel(guide)

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, experience:experiences(id, title, price_per_person_eur, location_country, experience_images(url, is_cover, sort_order))')
    .eq('id', id)
    .eq('guide_id', guide.id)
    .single()
  if (!booking) notFound()

  const serviceClient = createServiceClient()

  const { data: rawMsgs } = await serviceClient
    .from('booking_messages')
    .select('id, body, sender_id, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (rawMsgs ?? []) as ChatMessage[]

  // ── Calendar data for respond form (only when needed) ─────────────────────
  let guideWeeklySchedules: { period_from: string; period_to: string; blocked_weekdays: number[] }[] = []
  let experienceBlockedDates: { date_start: string; date_end: string }[] = []

  if (booking.status === 'pending') {
    const { data: schedules } = await serviceClient
      .from('guide_weekly_schedules')
      .select('period_from, period_to, blocked_weekdays')
      .eq('guide_id', guide.id)
    guideWeeklySchedules = schedules ?? []

    if (booking.experience_id != null) {
      const { data: calExp } = await serviceClient
        .from('calendar_experiences')
        .select('calendar_id')
        .eq('experience_id', booking.experience_id)
        .maybeSingle()

      if (calExp != null) {
        const { data: blocked } = await serviceClient
          .from('calendar_blocked_dates')
          .select('date_start, date_end')
          .eq('calendar_id', calExp.calendar_id)
        experienceBlockedDates = blocked ?? []
      }
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  type ExpShape = {
    id: string
    title: string
    price_per_person_eur: number | null
    location_country: string | null
    experience_images: { url: string; is_cover: boolean; sort_order: number }[]
  } | null
  const exp = booking.experience as unknown as ExpShape

  const s = STATUS_STYLES[booking.status]

  const requestedDates  = (booking.requested_dates as string[] | null) ?? null
  const hasMultiDates   = requestedDates != null && requestedDates.length > 1

  // ── Source-aware display helpers ──────────────────────────────────────────

  const isInquiry = booking.source === 'inquiry'

  // ── Canonical confirmed days array ────────────────────────────────────────
  // confirmed_days = specific trip days (non-consecutive safe).
  // Set by acceptBooking() / acceptBookingOffer() — always prefer over envelope columns.
  const confirmedDaysArr = (booking.confirmed_days as string[] | null)

  // offer_days — guide's specific day selections for inquiry bookings.
  // Used as fallback when confirmed_days is null (pre-backfill legacy rows).
  const offerDaysRaw = (booking.offer_days as string[] | null)
  const offerDaysArr: string[] | null =
    offerDaysRaw != null && offerDaysRaw.length > 0 ? [...offerDaysRaw].sort() : null

  // Helper: check if a sorted day array is consecutive (no gaps between days)
  function isConsecutiveDays(sortedDays: string[]): boolean {
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]! + 'T12:00:00')
      const curr = new Date(sortedDays[i]!      + 'T12:00:00')
      if (Math.round((curr.getTime() - prev.getTime()) / 86_400_000) !== 1) return false
    }
    return true
  }

  // ── Duration label ─────────────────────────────────────────────────────────
  // Priority: confirmed_days.length > offer_days.length > offer range > duration_option > request count
  const durationLabel = (() => {
    // Best source: confirmed_days array (canonical, non-consecutive safe)
    if (confirmedDaysArr != null && confirmedDaysArr.length > 0) {
      const n = confirmedDaysArr.length
      return n > 1 ? `${n} days` : '1 day'
    }
    // Inquiry: offer_days if guide used multi-day picker
    if (isInquiry && offerDaysArr != null && offerDaysArr.length > 0) {
      const n = offerDaysArr.length
      return n > 1 ? `${n} days` : '1 day'
    }
    // Inquiry fallback: range diff from offer_date_from/to
    // NOTE: only reliable if offer_date_from/to represent a consecutive trip
    if (isInquiry && booking.offer_date_from && booking.offer_date_to) {
      const from = new Date(booking.offer_date_from + 'T12:00:00')
      const to   = new Date(booking.offer_date_to   + 'T12:00:00')
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
      return days > 1 ? `${days} days` : '1 day'
    }
    // Direct booking: duration_option label set by angler, or request count
    return booking.duration_option ??
      (requestedDates != null && requestedDates.length > 1
        ? `${requestedDates.length} day${requestedDates.length !== 1 ? 's' : ''}`
        : '1 day')
  })()

  // ── Confirmed date display ─────────────────────────────────────────────────

  // Priority order (most reliable → last resort):
  //   1. confirmed_days[0/last] — canonical array (always correct, non-consecutive safe)
  //   2. confirmed_date_from/to — envelope from acceptBooking (legacy/fallback)
  //   3. offer_date_from/to     — inquiry fallback (pre-acceptBookingOffer-fix data)
  //   4. booking_date           — angler's original request (last resort)
  const confirmedFrom =
    confirmedDaysArr?.[0] ??
    booking.confirmed_date_from ??
    (isInquiry ? booking.offer_date_from : null) ??
    booking.booking_date
  const confirmedTo =
    confirmedDaysArr?.[confirmedDaysArr.length - 1] ??
    booking.confirmed_date_to ??
    (isInquiry ? booking.offer_date_to : null)

  // isConfirmedStatus — guide accepted (dates settled). Used for the confirmed-date banner.
  // Includes offer_accepted: angler confirmed the offer, dates are settled even before payment.
  const isConfirmedStatus = ['accepted', 'offer_accepted', 'confirmed', 'completed'].includes(booking.status)
  // isDepositPaid — angler has actually paid. Used for all money-received indicators.
  // 'accepted' is intentionally excluded: guide accepted but angler hasn't paid yet.
  const isDepositPaid = ['confirmed', 'completed'].includes(booking.status)

  const confirmedDateLabel = isConfirmedStatus && confirmedFrom
    ? (() => {
        const fmtOpt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }
        const from = new Date(confirmedFrom + 'T12:00:00').toLocaleDateString('en-GB', fmtOpt)

        // Non-consecutive case: confirmed_days has gaps (e.g., Apr 1, Apr 5, Apr 10)
        // Show "1 Apr – 10 Apr (3 days)" so guide knows it's not continuous
        if (
          confirmedDaysArr != null &&
          confirmedDaysArr.length > 1 &&
          !isConsecutiveDays(confirmedDaysArr)
        ) {
          const n = confirmedDaysArr.length
          const shortFrom = new Date(confirmedFrom + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const shortTo   = confirmedTo
            ? new Date(confirmedTo + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : null
          return shortTo && shortTo !== shortFrom
            ? `${shortFrom} – ${shortTo} · ${n} days (non-consecutive)`
            : `${shortFrom} · ${n} days`
        }

        if (!confirmedTo || confirmedTo === confirmedFrom) return from
        const toOpt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }
        return `${from} – ${new Date(confirmedTo + 'T12:00:00').toLocaleDateString('en-GB', toOpt)}`
      })()
    : null

  // ── Payment — guide only sees their payout amount ────────────────────────

  const depositEur      = booking.deposit_eur
  const balanceEur      = depositEur != null
    ? Math.max(0, Math.round((booking.total_eur - depositEur) * 100) / 100)
    : null
  const balanceIsPaid   = booking.balance_paid_at != null
  const guideAmountPaid = (booking as Record<string, unknown>).guide_amount_paid_at != null
  const cashBalanceDue  =
    paymentModel === 'stripe_connect' &&
    booking.status === 'confirmed' &&
    booking.balance_payment_method === 'cash' &&
    !balanceIsPaid

  const guidePayoutEur = booking.guide_payout_eur

  // guideTripPrice still needed by RespondBookingWidget (trip total without service fee)
  const commissionRate = booking.commission_rate ?? 0
  const rawSubtotal    = booking.total_eur > 1050
    ? Math.round((booking.total_eur - 50) * 100) / 100
    : Math.round(booking.total_eur / 1.05 * 100) / 100
  const guideTripPrice = guidePayoutEur != null && commissionRate > 0 && commissionRate < 1
    ? Math.round(guidePayoutEur / (1 - commissionRate) * 100) / 100
    : rawSubtotal

  // hasDepositSplit used to determine guide amount payment status
  const hasDepositSplit = !isInquiry && paymentModel === 'stripe_connect' && booking.deposit_eur != null

  // ── IBAN sharing (manual model) ───────────────────────────────────────────
  const ibanSharedAt    = (booking as Record<string, unknown>).iban_shared_at as string | null ?? null
  const decryptedIban   = decryptField(guide.iban)
  const hasGuideIban    = decryptedIban != null && decryptedIban.trim() !== ''
  // Show ShareIbanButton from 'accepted' onwards — guide can share IBAN as soon
  // as they accept, so angler knows where to send the guide amount even before
  // paying the platform booking fee.
  const showShareIban =
    paymentModel === 'manual' &&
    hasGuideIban &&
    ['accepted', 'offer_accepted', 'confirmed', 'completed'].includes(booking.status) &&
    ibanSharedAt == null

  const bookingRef      = id.slice(-8).toUpperCase()
  const createdFormatted = new Date(booking.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-6 transition-colors hover:text-[#E67E50]"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <ChevronLeft size={12} strokeWidth={1.8} />
        All Bookings
      </Link>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            {exp?.title ?? 'Fishing trip'}
          </h1>
          <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
            #{bookingRef} · Booked {createdFormatted}
          </p>
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body mt-1 flex-shrink-0"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

        {/* ══ LEFT — stacked cards ═══════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* ── Trip details tile grid ────────────────────────────────────── */}
          <div
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.08)',
              overflow:     'hidden',
            }}
          >
            {/* Confirmed date banner (accepted/confirmed/completed) */}
            {confirmedDateLabel != null && (
              <div
                className="px-5 py-3.5 flex items-center gap-2"
                style={{
                  background:   'rgba(22,163,74,0.06)',
                  borderBottom: '1px solid rgba(22,163,74,0.12)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(22,163,74,0.2)' }}
                >
                  <Check size={10} strokeWidth={2} style={{ color: '#16A34A' }} />
                </div>
                <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
                  {confirmedDateLabel}
                </p>
              </div>
            )}

            {/* 2×2 tile grid */}
            <div className="grid grid-cols-2">
              {/* Date tile */}
              <InfoTile
                label={
                  isConfirmedStatus && confirmedDaysArr != null && confirmedDaysArr.length > 0
                    ? 'Confirmed dates'
                    : isInquiry && booking.offer_date_from
                      ? 'Offered dates'
                      : hasMultiDates
                        ? 'Requested dates'
                        : 'Date'
                }
                borderRight
                borderBottom
              >
                {/* ── Confirmed days (accepted / confirmed / completed) ──────── */}
                {/* Uses confirmed_days array — non-consecutive safe.             */}
                {/* Consecutive: show "Apr 1 – Apr 7" range.                      */}
                {/* Non-consecutive: show individual chips (Apr 1, Apr 5, Apr 10).*/}
                {isConfirmedStatus && confirmedDaysArr != null && confirmedDaysArr.length > 0 ? (
                  confirmedDaysArr.length === 1 || isConsecutiveDays(confirmedDaysArr) ? (
                    // Consecutive or single day → range label
                    <p
                      className="text-[15px] font-bold f-display leading-tight"
                      style={{ color: '#0A2E4D' }}
                    >
                      {confirmedDaysArr.length === 1
                        ? new Date(confirmedDaysArr[0]! + 'T12:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                          })
                        : `${new Date(confirmedDaysArr[0]! + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(confirmedDaysArr[confirmedDaysArr.length - 1]! + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    </p>
                  ) : (
                    // Non-consecutive → individual chips
                    <div className="flex flex-wrap gap-1">
                      {confirmedDaysArr.map(d => (
                        <span
                          key={d}
                          className="text-[11px] f-body px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: 'rgba(230,126,80,0.1)',
                            color:      '#C4622A',
                            border:     '1px solid rgba(230,126,80,0.25)',
                          }}
                        >
                          {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                        </span>
                      ))}
                    </div>
                  )
                ) : isInquiry && offerDaysArr != null && !isConsecutiveDays(offerDaysArr) ? (
                  /* Inquiry — non-consecutive offer_days fallback (pre-backfill) */
                  <div className="flex flex-wrap gap-1">
                    {offerDaysArr.map(d => (
                      <span
                        key={d}
                        className="text-[11px] f-body px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: 'rgba(230,126,80,0.1)',
                          color:      '#C4622A',
                          border:     '1px solid rgba(230,126,80,0.25)',
                        }}
                      >
                        {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </span>
                    ))}
                  </div>
                ) : isInquiry && booking.offer_date_from ? (
                  /* Inquiry — consecutive range or no offer_days (show range string) */
                  <p
                    className="text-[15px] font-bold f-display leading-tight"
                    style={{ color: '#0A2E4D' }}
                  >
                    {booking.offer_date_to && booking.offer_date_to !== booking.offer_date_from
                      ? `${new Date(booking.offer_date_from + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(booking.offer_date_to + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
                      : new Date(booking.offer_date_from + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                ) : hasMultiDates ? (
                  /* Pending direct booking — show requested date chips (angler's request) */
                  <div className="flex flex-wrap gap-1">
                    {requestedDates!.map(d => (
                      <span
                        key={d}
                        className="text-[11px] f-body px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(10,46,77,0.06)',
                          color:      'rgba(10,46,77,0.65)',
                          border:     '1px solid rgba(10,46,77,0.1)',
                        }}
                      >
                        {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </span>
                    ))}
                  </div>
                ) : (
                  /* Single date fallback */
                  <p
                    className="text-[15px] font-bold f-display leading-tight"
                    style={{ color: '#0A2E4D' }}
                  >
                    {new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </InfoTile>

              {/* Anglers tile */}
              <InfoTile label="Anglers" borderBottom>
                <p
                  className="text-[15px] font-bold f-display"
                  style={{ color: '#0A2E4D' }}
                >
                  {booking.guests}
                </p>
                <p
                  className="text-[11px] f-body"
                  style={{ color: 'rgba(10,46,77,0.45)' }}
                >
                  {booking.guests === 1 ? 'angler' : 'anglers'}
                </p>
              </InfoTile>

              {/* Duration tile */}
              <InfoTile label="Duration" borderRight>
                <p
                  className="text-sm font-semibold f-body"
                  style={{ color: '#0A2E4D' }}
                >
                  {durationLabel}
                </p>
              </InfoTile>

              {/* Trip tile — for inquiry: show guide's location, for direct: experience title */}
              <InfoTile label={isInquiry ? 'Location' : 'Trip'}>
                <p
                  className="text-sm font-semibold f-body"
                  style={{ color: '#0A2E4D' }}
                >
                  {isInquiry
                    ? (booking.assigned_river ?? 'Custom inquiry')
                    : (exp?.title ?? '—')}
                </p>
              </InfoTile>
            </div>
          </div>

          {/* ── Payment card ───────────────────────────────────────────────── */}
          <SectionCard title="Payment">

            {/* Your earnings — the only number the guide needs to see */}
            <div className="mb-4">
              <p
                className="text-[9px] uppercase tracking-[0.22em] font-bold f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.3)' }}
              >
                Your earnings
              </p>
              <p className="text-3xl font-bold f-display" style={{ color: '#E67E50' }}>
                {guidePayoutEur != null ? `€${guidePayoutEur}` : '—'}
              </p>
            </div>

            {/* Status indicators — no amounts, just confirmation dots */}
            <div className="flex flex-col gap-2">

              {/* Booking fee status */}
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isDepositPaid ? '#16A34A' : 'rgba(10,46,77,0.2)' }}
                />
                <p className="text-xs f-body" style={{ color: isDepositPaid ? '#16A34A' : 'rgba(10,46,77,0.45)' }}>
                  {isDepositPaid ? 'Booking fee paid ✓' : 'Awaiting booking fee'}
                </p>
              </div>

              {/* Guide amount status (stripe_connect two-step only) */}
              {hasDepositSplit && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: guideAmountPaid ? '#16A34A' : 'rgba(10,46,77,0.2)' }}
                  />
                  <p className="text-xs f-body" style={{ color: guideAmountPaid ? '#16A34A' : 'rgba(10,46,77,0.45)' }}>
                    {guideAmountPaid ? 'Your payment received ✓' : 'Your payment pending from angler'}
                  </p>
                </div>
              )}

              {/* Manual model: remind guide they collect directly */}
              {paymentModel === 'manual' && isDepositPaid && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgba(10,46,77,0.2)' }} />
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Collect your earnings directly from the angler
                  </p>
                </div>
              )}

            </div>
          </SectionCard>

          {/* ── Angler ────────────────────────────────────────────────────── */}
          <SectionCard title="Angler">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: '#0A2E4D' }}
              >
                {(booking.angler_full_name ?? 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CountryFlag country={booking.angler_country} size={14} />
                  <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                    {booking.angler_full_name ?? 'Angler'}
                  </p>
                </div>
                {booking.angler_country != null && (
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    {booking.angler_country}
                  </p>
                )}
              </div>
            </div>

            {(booking.angler_email != null || booking.angler_phone != null) && (
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(10,46,77,0.08)' }}
              >
                {booking.angler_email != null && (
                  <a
                    href={`mailto:${booking.angler_email}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70 min-w-0 overflow-hidden"
                    style={{ color: '#E67E50' }}
                  >
                    <Mail size={12} strokeWidth={1.4} className="flex-shrink-0" />
                    <span className="truncate">{booking.angler_email}</span>
                  </a>
                )}
                {booking.angler_phone != null && (
                  <a
                    href={`tel:${booking.angler_phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs f-body font-medium transition-opacity hover:opacity-70"
                    style={{
                      color: '#0A2E4D',
                      borderLeft: booking.angler_email != null ? '1px solid rgba(10,46,77,0.08)' : 'none',
                    }}
                  >
                    <Phone size={12} strokeWidth={1.4} />
                    {booking.angler_phone}
                  </a>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── Special requests ──────────────────────────────────────────── */}
          {booking.special_requests != null && (
            <SectionCard title="Special Requests">
              <p
                className="text-sm f-body whitespace-pre-wrap leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.65)' }}
              >
                {booking.special_requests}
              </p>
            </SectionCard>
          )}

          {/* ── Inquiry cross-link ────────────────────────────────────────── */}
          {booking.source === 'inquiry' && (
            <Link
              href={`/dashboard/inquiries/${booking.id}`}
              className="inline-flex items-center gap-1.5 text-xs f-body font-medium px-1 transition-colors hover:text-[#E67E50]"
              style={{ color: 'rgba(10,46,77,0.45)' }}
            >
              <MessageSquare size={12} strokeWidth={1.5} />
              View inquiry detail →
            </Link>
          )}
        </div>

        {/* ══ RIGHT — chat + action widget (sticky) ══════════════════════════ */}
        <div className="xl:sticky xl:top-6 flex flex-col gap-4">

          <BookingChat
            bookingId={id}
            currentUserId={user.id}
            myName={guide.full_name ?? 'Guide'}
            partnerName={booking.angler_full_name ?? 'Angler'}
            initialMessages={initialMessages}
          />

          {/* Pending → respond modal */}
          {booking.status === 'pending' && (
            <RespondBookingWidget
              bookingId={id}
              anglerName={booking.angler_full_name ?? 'Angler'}
              anglerEmail={booking.angler_email ?? ''}
              anglerCountry={booking.angler_country ?? null}
              experienceTitle={exp?.title ?? 'Fishing trip'}
              experienceId={exp?.id ?? null}
              coverUrl={null}
              windowFrom={booking.booking_date}
              anglerRequestedDates={requestedDates ?? undefined}
              durationOption={booking.duration_option}
              guests={booking.guests}
              totalEur={guideTripPrice}
              depositEur={booking.deposit_eur}
              pricePerPersonEur={exp?.price_per_person_eur ?? null}
              specialRequests={booking.special_requests}
              guideWeeklySchedules={guideWeeklySchedules}
              blockedDates={experienceBlockedDates}
              bookingSource={booking.source === 'inquiry' ? 'inquiry' : 'direct'}
              guideCountry={guide.country}
              tripLocationCountry={exp?.location_country ?? null}
            />
          )}

          {booking.status === 'accepted' && (
            <div className="flex flex-col gap-3">
              <ActionStatusCard
                color="blue"
                title="Accepted — awaiting booking fee"
                body="The angler will pay the booking fee to confirm the trip. You'll be notified when payment arrives."
              />
              {/* Guide can share IBAN right away so angler knows where to send guide amount */}
              {showShareIban && (
                <div
                  className="p-5 rounded-2xl"
                  style={{
                    background: '#FDFAF7',
                    border:     '1px solid rgba(10,46,77,0.08)',
                    boxShadow:  '0 2px 8px rgba(10,46,77,0.05)',
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    Payment details
                  </p>
                  <ShareIbanButton
                    bookingId={id}
                    anglerName={booking.angler_full_name ?? 'the angler'}
                  />
                </div>
              )}
            </div>
          )}

          {/* offer_accepted: angler accepted an inquiry offer, payment in progress */}
          {booking.status === 'offer_accepted' && (
            <div className="flex flex-col gap-3">
              <ActionStatusCard
                color="blue"
                title="Offer accepted — payment processing"
                body="The angler accepted your offer and is completing payment. You'll be notified when it clears."
              />
              {showShareIban && (
                <div
                  className="p-5 rounded-2xl"
                  style={{
                    background: '#FDFAF7',
                    border:     '1px solid rgba(10,46,77,0.08)',
                    boxShadow:  '0 2px 8px rgba(10,46,77,0.05)',
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    Payment details
                  </p>
                  <ShareIbanButton
                    bookingId={id}
                    anglerName={booking.angler_full_name ?? 'the angler'}
                  />
                </div>
              )}
            </div>
          )}

          {cashBalanceDue && (
            <div
              className="p-5 rounded-2xl"
              style={{
                background: '#FDFAF7',
                border:     '1px solid rgba(10,46,77,0.08)',
                boxShadow:  '0 2px 8px rgba(10,46,77,0.05)',
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                Cash balance due
              </p>
              <MarkBalancePaidButton
                bookingId={id}
                balanceAmount={balanceEur ?? Math.max(0, booking.total_eur - (depositEur ?? 0))}
              />
            </div>
          )}

          {booking.status === 'confirmed' && !cashBalanceDue && (
            <div
              className="p-5 rounded-2xl flex flex-col gap-4"
              style={{
                background: '#FDFAF7',
                border:     '1px solid rgba(10,46,77,0.08)',
                boxShadow:  '0 2px 8px rgba(10,46,77,0.05)',
              }}
            >
              {/* Share IBAN with angler (manual model with IBAN) */}
              {showShareIban && (
                <>
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                    >
                      Payment details
                    </p>
                    <ShareIbanButton
                      bookingId={id}
                      anglerName={booking.angler_full_name ?? 'the angler'}
                    />
                  </div>
                  <div style={{ height: 1, background: 'rgba(10,46,77,0.06)' }} />
                </>
              )}

              {/* IBAN already shared indicator */}
              {paymentModel === 'manual' && hasGuideIban && ibanSharedAt != null && (
                <>
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.18em] mb-2 f-body"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                    >
                      Payment details
                    </p>
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
                    >
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.2)' }}>
                        <Check size={8} strokeWidth={2.5} style={{ color: '#16A34A' }} />
                      </div>
                      <p className="text-xs font-semibold f-body" style={{ color: '#16A34A' }}>
                        Bank details shared with {booking.angler_full_name ?? 'angler'}
                      </p>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'rgba(10,46,77,0.06)' }} />
                </>
              )}

              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.18em] mb-3 f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Trip status
                </p>
                <MarkTripCompletedButton bookingId={id} />
              </div>
            </div>
          )}

          {booking.status === 'completed' && (
            <ActionStatusCard
              color="green"
              title="Trip completed"
              body="Payout processed. Check your Earnings dashboard for details."
            />
          )}

          {booking.status === 'declined' && (
            <ActionStatusCard
              color="red"
              title="Booking declined"
              body={booking.declined_reason ?? undefined}
            />
          )}

          {booking.status === 'cancelled' && (
            <ActionStatusCard
              color="red"
              title="Booking cancelled"
              body={booking.declined_reason ?? undefined}
            />
          )}

          {booking.status === 'refunded' && (
            <ActionStatusCard
              color="red"
              title="Payment refunded"
              body="The booking was cancelled and the angler has been refunded."
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoTile({
  label,
  children,
  borderRight  = false,
  borderBottom = false,
}: {
  label:        string
  children:     React.ReactNode
  borderRight?: boolean
  borderBottom?: boolean
}) {
  return (
    <div
      className="p-5 flex flex-col gap-1.5"
      style={{
        borderRight:  borderRight  ? '1px solid rgba(10,46,77,0.06)' : 'none',
        borderBottom: borderBottom ? '1px solid rgba(10,46,77,0.06)' : 'none',
      }}
    >
      <p
        className="text-[9px] uppercase tracking-[0.24em] font-bold f-body"
        style={{ color: 'rgba(10,46,77,0.3)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(10,46,77,0.08)',
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

type StatusColor = 'blue' | 'green' | 'orange' | 'red'

const STATUS_COLORS: Record<StatusColor, { bg: string; border: string; titleColor: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  titleColor: '#2563EB' },
  green:  { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.22)', titleColor: '#16A34A' },
  orange: { bg: 'rgba(230,126,80,0.08)',  border: 'rgba(230,126,80,0.22)', titleColor: '#C4622A' },
  red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.18)',  titleColor: '#DC2626' },
}

function ActionStatusCard({
  color,
  title,
  body,
}: {
  color:  StatusColor
  title:  string
  body?:  string
}) {
  const c = STATUS_COLORS[color]
  return (
    <div
      className="px-5 py-4 rounded-2xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <p className="text-sm font-semibold f-body" style={{ color: c.titleColor }}>
        {title}
      </p>
      {body != null && body.length > 0 && (
        <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
          {body}
        </p>
      )}
    </div>
  )
}
