import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import OfferActions from './AcceptOfferButton'
import InquiryChat, { type ChatMessage } from '@/components/inquiry-chat'
import { type PriceTier, findApplicableTierPrice } from '@/lib/inquiry-pricing'
import { Check, X, MapPin, Calendar, Users, Clock } from 'lucide-react'
import { MicroCalendar } from '@/components/account/micro-calendar'
import { ExperienceLocationMap } from '@/components/trips/experience-location-map-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtShortDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}

export default async function AnglerTripPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp      = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/account/trips/${id}`)

  const serviceClient = createServiceClient()

  const [bookingResult, messagesResult] = await Promise.all([
    serviceClient
      .from('bookings')
      .select('*, guides(full_name, country, avatar_url), experience:experiences(id, title)')
      .eq('id', id)
      .eq('source', 'inquiry')
      .single(),
    serviceClient
      .from('booking_messages')
      .select('id, sender_id, sender_role, body, created_at, read_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true }),
  ])

  const booking = bookingResult.data as unknown as {
    id:                    string
    status:                BookingStatus
    source:                string
    angler_id:             string | null
    angler_email:          string | null
    angler_full_name:      string | null
    guests:                number
    booking_date:          string
    date_to:               string | null
    target_species:        string[] | null
    experience_level:      string | null
    assigned_river:        string | null
    offer_price_eur:       number | null
    offer_price_min_eur:   number | null
    offer_price_tiers:     unknown | null
    offer_date_from:       string | null
    offer_date_to:         string | null
    offer_days:            string[] | null
    offer_meeting_lat:     number | null
    offer_meeting_lng:     number | null
    offer_details:         string | null
    deposit_eur:           number | null
    total_eur:             number | null
    preferences:           unknown | null
    guides: { full_name: string; country: string; avatar_url: string | null } | null
    experience: { id: string; title: string } | null
  } | null

  const initialMessages = (messagesResult.data ?? []) as ChatMessage[]

  if (!booking) notFound()

  const isOwner =
    booking.angler_id === user.id ||
    (user.email != null && booking.angler_email === user.email)
  if (!isOwner) notFound()

  // ── Post-offer states: redirect to booking detail (same as guide side) ──────
  if (['offer_accepted', 'confirmed', 'completed'].includes(booking.status)) {
    redirect(`/account/bookings/${id}`)
  }

  const assignedGuide = booking.guides
  const prefs         = (booking.preferences ?? {}) as {
    budgetMin?: number; budgetMax?: number
    accommodation?: boolean; riverType?: string; notes?: string
    selectedPackageLabel?: string
  }
  const groupSize         = booking.guests
  const paidSuccessfully  = sp.status === 'paid' || sp.status === 'accepted'
  const isDeclinedOrCancelled = booking.status === 'declined' || booking.status === 'cancelled'

  // Page title: prefer experience title, fall back to species-based for general inquiries
  const pageTitle = booking.experience?.title
    ?? (booking.target_species != null && booking.target_species.length > 0
      ? booking.target_species.join(' & ') + ' Fishing'
      : 'Custom Fishing Trip')

  // Availability range (what angler originally sent)
  const availFrom  = booking.booking_date
  const availTo    = booking.date_to
  const availLabel = availFrom
    ? availTo && availTo !== availFrom
      ? `${fmtShortDate(availFrom)} – ${fmtShortDate(availTo)}`
      : fmtShortDate(availFrom)
    : ''

  // Offer dates (what guide confirmed)
  // Use offer_days array for non-consecutive day display — avoids showing a
  // misleading continuous range like "4 Apr – 26 Apr" when only 3 days were selected.
  const offerDaysArr: string[] | null =
    Array.isArray(booking.offer_days) && booking.offer_days.length > 0
      ? [...booking.offer_days].sort()
      : null
  const hasNonConsecutiveOffer =
    offerDaysArr != null && offerDaysArr.length > 1 && !isConsecutiveDays(offerDaysArr)
  const offerDateLabel = booking.offer_date_from
    ? hasNonConsecutiveOffer
      ? offerDaysArr!.length <= 3
        ? formatDaysList(offerDaysArr!)
        : `${offerDaysArr!.length} fishing days`
      : booking.offer_date_to && booking.offer_date_to !== booking.offer_date_from
        ? `${fmtDate(booking.offer_date_from)} – ${fmtDate(booking.offer_date_to)}`
        : fmtDate(booking.offer_date_from)
    : null

  // Offer price
  const priceTiers     = Array.isArray(booking.offer_price_tiers)
    ? (booking.offer_price_tiers as PriceTier[])
    : null
  const hasTiers       = priceTiers != null && priceTiers.length > 0
  const sortedTiers    = hasTiers ? [...priceTiers!].sort((a, b) => a.anglers - b.anglers) : null
  const effectivePrice = hasTiers
    ? findApplicableTierPrice(priceTiers!, groupSize)
    : booking.offer_price_eur

  const activeTierAnglers: number | null = (() => {
    if (!hasTiers || !sortedTiers) return null
    let match = sortedTiers[0]
    for (const t of sortedTiers) { if (t.anglers <= groupSize) match = t }
    return match.anglers
  })()

  const bookingRef = id.slice(-8).toUpperCase()

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 w-full max-w-[1120px]">

      {/* ── Back nav ──────────────────────────────────────────────────────────── */}
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-7 transition-opacity hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        ← My Bookings
      </Link>

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            #{bookingRef} · Trip request
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-1">
            {pageTitle}
          </h1>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            {availLabel && <span>{availLabel} · </span>}
            {groupSize} {groupSize === 1 ? 'angler' : 'anglers'}
            {booking.target_species != null && booking.target_species.length > 0 && (
              <span> · {booking.target_species.join(', ')}</span>
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* ── Two-column grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── LEFT column ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* ── Main section card ─────────────────────────────────────────────── */}
          <div
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            <div className="p-6 flex flex-col gap-5">

              {/* ── Payment confirmed banner ─────────────────────────────────── */}
              {paidSuccessfully && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}
                >
                  <Check width={18} height={18} stroke="#16A34A" strokeWidth={1.5} />
                  <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
                    Payment confirmed — your trip is booked!
                  </p>
                </div>
              )}

              {/* ── Date section ─────────────────────────────────────────────── */}
              {booking.status === 'offer_sent' && offerDateLabel != null ? (
                <div
                  className="px-4 py-4 rounded-2xl"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar width={16} height={16} stroke="#16A34A" strokeWidth={1.5} className="flex-shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] f-body mb-0.5" style={{ color: 'rgba(22,163,74,0.65)' }}>
                        Guide confirmed your trip dates
                      </p>
                      <p className="text-sm font-bold f-display" style={{ color: '#15803D' }}>
                        {offerDateLabel}
                      </p>
                    </div>
                  </div>

                  {/* Calendar + meeting-point map side-by-side on sm+ */}
                  {booking.offer_date_from != null && (
                    <div className={
                      booking.offer_meeting_lat != null && booking.offer_meeting_lng != null
                        ? 'flex flex-col sm:flex-row gap-4 items-start'
                        : ''
                    }>
                      {/* Calendar */}
                      <div className="flex-shrink-0">
                        <MicroCalendar
                          from={booking.offer_date_from}
                          to={booking.offer_date_to ?? booking.offer_date_from}
                          days={offerDaysArr ?? undefined}
                        />
                      </div>

                      {/* Meeting point map */}
                      {booking.offer_meeting_lat != null && booking.offer_meeting_lng != null && (
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <p
                            className="text-[10px] uppercase tracking-[0.15em] f-body mb-2"
                            style={{ color: 'rgba(22,163,74,0.6)' }}
                          >
                            Meeting point
                          </p>
                          <div style={{ height: 180, borderRadius: 12, overflow: 'hidden', isolation: 'isolate' }}>
                            <ExperienceLocationMap
                              lat={booking.offer_meeting_lat}
                              lng={booking.offer_meeting_lng}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : availFrom != null && (
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
                      {availLabel}
                    </p>
                    <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(37,99,235,0.55)' }}>
                      Guide will confirm exact dates with the offer.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Status-specific content ───────────────────────────────────── */}

              {/* Pending / Reviewing — waiting for guide offer */}
              {(booking.status === 'pending' || booking.status === 'reviewing') && (
                <div
                  className="flex items-start gap-3 px-3.5 py-3 rounded-2xl"
                  style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.15)' }}
                >
                  <Clock width={14} height={14} stroke="#E67E50" strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#C46030' }}>
                      Waiting for {assignedGuide?.full_name ?? 'your guide'} to send an offer
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      Guides typically respond within 24–48 hours. You&apos;ll be notified at{' '}
                      <span className="font-semibold">{booking.angler_email}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Declined */}
              {booking.status === 'declined' && (
                <div
                  className="flex items-start gap-3 px-4 py-4 rounded-2xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <X width={18} height={18} stroke="#DC2626" strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
                      Guide couldn&apos;t accept this request
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      You can browse other experiences and send a new request.
                    </p>
                  </div>
                </div>
              )}

              {/* Cancelled */}
              {booking.status === 'cancelled' && (
                <div
                  className="flex items-start gap-3 px-4 py-4 rounded-2xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}
                >
                  <X width={18} height={18} stroke="#DC2626" strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
                      Request cancelled
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      You can submit a new request anytime.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Offer details (offer_sent) ────────────────────────────────── */}
              {booking.status === 'offer_sent' &&
                (booking.offer_price_eur != null || booking.offer_price_tiers != null) && (
                <div className="flex flex-col gap-4">

                  {/* Location + chips */}
                  <div className="flex flex-wrap gap-2">
                    {booking.assigned_river != null && (
                      <div
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs f-body font-medium"
                        style={{ background: 'rgba(10,46,77,0.05)', border: '1px solid rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                      >
                        <MapPin size={12} strokeWidth={1.5} />
                        {booking.assigned_river}
                      </div>
                    )}
                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs f-body font-medium"
                      style={{ background: 'rgba(10,46,77,0.05)', border: '1px solid rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                    >
                      <Users size={12} strokeWidth={1.5} />
                      {groupSize} {groupSize === 1 ? 'angler' : 'anglers'}
                    </div>
                  </div>

                  {/* What's included */}
                  {booking.offer_details != null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        What&apos;s included
                      </p>
                      <p className="text-sm f-body whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(10,46,77,0.7)' }}>
                        {booking.offer_details}
                      </p>
                    </div>
                  )}

                  {/* Price */}
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(10,46,77,0.08)' }}>
                    {hasTiers && sortedTiers != null ? (
                      <>
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)', background: 'rgba(10,46,77,0.02)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                            Price by group size
                          </p>
                        </div>
                        {sortedTiers.map((tier, i) => {
                          const isActive = tier.anglers === activeTierAnglers
                          const isLast   = i === sortedTiers.length - 1
                          return (
                            <div
                              key={tier.anglers}
                              className="flex items-center justify-between px-4 py-3"
                              style={{
                                background:   isActive ? 'rgba(230,126,80,0.07)' : i % 2 === 0 ? 'rgba(10,46,77,0.015)' : 'transparent',
                                borderBottom: !isLast ? '1px solid rgba(10,46,77,0.05)' : undefined,
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm f-body" style={{ color: isActive ? '#0A2E4D' : 'rgba(10,46,77,0.5)', fontWeight: isActive ? 600 : 400 }}>
                                  {isLast ? `${tier.anglers}+ anglers` : `${tier.anglers} ${tier.anglers === 1 ? 'angler' : 'anglers'}`}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full f-body" style={{ background: 'rgba(230,126,80,0.18)', color: '#C4622A' }}>
                                    your group
                                  </span>
                                )}
                              </div>
                              <span className="text-base f-display font-bold" style={{ color: isActive ? '#E67E50' : '#0A2E4D' }}>
                                €{tier.priceEur}
                              </span>
                            </div>
                          )
                        })}
                        <div
                          className="flex items-center justify-between px-4 py-3.5"
                          style={{ background: 'rgba(230,126,80,0.06)', borderTop: '1px solid rgba(230,126,80,0.15)' }}
                        >
                          <p className="text-sm f-body font-medium" style={{ color: 'rgba(10,46,77,0.6)' }}>
                            Your total ({groupSize} {groupSize === 1 ? 'angler' : 'anglers'})
                          </p>
                          <p className="text-2xl font-bold f-display" style={{ color: '#E67E50' }}>€{effectivePrice}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between px-4 py-4">
                        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                          {booking.offer_price_min_eur != null ? 'Price range' : 'Total price'}
                        </p>
                        <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                          {booking.offer_price_min_eur != null
                            ? `€${booking.offer_price_min_eur} – €${booking.offer_price_eur}`
                            : `€${booking.offer_price_eur}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Accept / Decline */}
                  <OfferActions bookingId={id} />

                </div>
              )}

              {/* ── Stats grid ───────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoCard label="Anglers" value={`${groupSize}`} />
                <InfoCard
                  label="Location"
                  value={booking.assigned_river ?? (booking.status === 'offer_sent' ? '—' : 'TBD')}
                />
                <InfoCard
                  label="Offer price"
                  value={effectivePrice != null ? `€${effectivePrice}` : 'TBD'}
                  subValue={booking.status === 'pending' || booking.status === 'reviewing' ? 'Awaiting offer' : undefined}
                  subColor="rgba(10,46,77,0.38)"
                />
                <InfoCard
                  label="Experience"
                  value={
                    booking.experience_level != null
                      ? ({ beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[booking.experience_level] ?? booking.experience_level)
                      : '—'
                  }
                />
              </div>

              {/* ── Guide card ───────────────────────────────────────────────── */}
              {assignedGuide != null && (
                <div
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
                >
                  {assignedGuide.avatar_url != null ? (
                    <Image
                      src={assignedGuide.avatar_url}
                      alt={assignedGuide.full_name}
                      width={40}
                      height={40}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: 40, height: 40 }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: '#0A2E4D' }}
                    >
                      {assignedGuide.full_name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {assignedGuide.full_name}
                    </p>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {assignedGuide.country} · Your guide
                    </p>
                  </div>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Message via chat →
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* ── Request summary card ──────────────────────────────────────────── */}
          <div
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >
            <div className="p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Your Request
              </p>
              <div className="flex flex-col gap-3">
                {availLabel && <InfoRow label="Availability" value={availLabel} />}
                <InfoRow label="Group size" value={`${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`} />
                {booking.target_species != null && booking.target_species.length > 0 && (
                  <InfoRow label="Target species" value={booking.target_species.join(', ')} />
                )}
                {booking.experience_level != null && (
                  <InfoRow
                    label="Experience level"
                    value={{ beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[booking.experience_level] ?? booking.experience_level}
                  />
                )}
                {prefs.budgetMin != null && (
                  <InfoRow
                    label="Budget"
                    value={`€${prefs.budgetMin}${prefs.budgetMax != null ? ` – €${prefs.budgetMax}` : '+'}`}
                  />
                )}
                {prefs.riverType && prefs.riverType !== 'Any' && (
                  <InfoRow label="Water type" value={prefs.riverType} />
                )}
                {prefs.selectedPackageLabel && (
                  <InfoRow label="Package" value={prefs.selectedPackageLabel} />
                )}
                {prefs.notes && <InfoRow label="Notes" value={prefs.notes} />}
              </div>
            </div>
          </div>

        </div>{/* ── end LEFT ── */}

        {/* ── RIGHT column: chat ──────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          {!isDeclinedOrCancelled && (
            <InquiryChat
              bookingId={id}
              currentUserId={user.id}
              currentUserRole="angler"
              initialMessages={initialMessages}
              otherPartyName={assignedGuide?.full_name ?? 'Your Guide'}
            />
          )}
          <div className="text-center">
            <Link
              href="/trips"
              className="text-xs f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              Browse more experiences →
            </Link>
          </div>
        </div>

      </div>{/* ── end grid ── */}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  pending:   { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'Pending'      },
  reviewing: { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', label: 'Reviewing'    },
  offer_sent:{ bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'Offer ready'  },
  declined:  { bg: 'rgba(239,68,68,0.08)',  color: '#B91C1C', label: 'Declined'     },
  cancelled: { bg: 'rgba(239,68,68,0.08)',  color: '#B91C1C', label: 'Cancelled'    },
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS_STYLES[status]
  if (!s) return null
  return (
    <span
      className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function InfoCard({
  label, value, subValue, subColor,
}: {
  label: string; value: string; subValue?: string; subColor?: string
}) {
  return (
    <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.06)' }}>
      <p className="text-[10px] uppercase tracking-[0.15em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
        {label}
      </p>
      <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>{value}</p>
      {subValue != null && (
        <p className="text-[10px] font-semibold f-body mt-0.5" style={{ color: subColor ?? 'rgba(10,46,77,0.4)' }}>
          {subValue}
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>{label}</dt>
      <dd className="text-sm f-body text-right font-medium" style={{ color: '#0A2E4D' }}>{value}</dd>
    </div>
  )
}
