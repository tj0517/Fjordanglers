import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import OfferModal, { type AnglerBrief } from '@/components/dashboard/offer-modal'
import InquiryDetailTabs, { type InquiryDetailTabsProps } from '@/components/dashboard/inquiry-detail-tabs'
import NavigationShortcuts from '@/components/dashboard/navigation-shortcuts'
import InquiryChat, { type ChatMessage } from '@/components/inquiry-chat'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

// Statuses that show the OfferModal (guide hasn't sent an offer yet)
const OFFER_SENDABLE: BookingStatus[] = ['pending', 'reviewing']
// Statuses where guide can still decline
const DECLINABLE: BookingStatus[] = ['pending', 'reviewing', 'offer_sent']

const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  pending:        { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'New'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'  },
  offer_sent:     { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Offer Sent' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
  declined:       { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'   },
}

type StatusColor = 'blue' | 'green' | 'orange' | 'red'
const STATUS_COLORS: Record<StatusColor, { bg: string; border: string; titleColor: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  titleColor: '#2563EB' },
  green:  { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.22)', titleColor: '#16A34A' },
  orange: { bg: 'rgba(230,126,80,0.08)',  border: 'rgba(230,126,80,0.22)', titleColor: '#C4622A' },
  red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.18)',  titleColor: '#DC2626' },
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> }

export default async function GuideInquiryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) notFound()

  const serviceClient = createServiceClient()

  const [
    bookingResult,
    navResult,
    guideSchedulesResult,
    messagesResult,
  ] = await Promise.all([
    // Main inquiry booking
    serviceClient
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('source', 'inquiry')
      .single(),

    // All inquiry bookings for navigation (guide's own + unassigned pending)
    serviceClient
      .from('bookings')
      .select('id, angler_full_name, created_at, guide_id, status')
      .eq('source', 'inquiry')
      .or(`guide_id.eq.${guide.id},and(guide_id.is.null,status.in.(pending,reviewing))`)
      .order('created_at', { ascending: false }),

    // Guide's weekly schedules (for the offer date picker)
    serviceClient
      .from('guide_weekly_schedules')
      .select('period_from, period_to, blocked_weekdays')
      .eq('guide_id', guide.id),

    // Chat messages
    serviceClient
      .from('booking_messages')
      .select('id, sender_id, sender_role, body, created_at, read_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true }),
  ])

  const booking        = bookingResult.data
  const guideSchedules = guideSchedulesResult.data ?? []
  const initialMessages = (messagesResult.data ?? []) as ChatMessage[]
  if (!booking) notFound()

  // Ownership check: either assigned to this guide, or unassigned and still open
  if (
    booking.guide_id !== null &&
    booking.guide_id !== guide.id
  ) {
    notFound()
  }

  // Auto-mark as reviewing on first open (pending → reviewing)
  let displayStatus = booking.status
  if (booking.status === 'pending') {
    await serviceClient
      .from('bookings')
      .update({ status: 'reviewing' })
      .eq('id', id)
    displayStatus = 'reviewing'
  }

  // ── Navigation list ────────────────────────────────────────────────────────
  const navList = (navResult.data ?? [])
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const currentNavIdx = navList.findIndex(r => r.id === id)
  const prevItem = currentNavIdx > 0 ? navList[currentNavIdx - 1] : null
  const nextItem =
    currentNavIdx >= 0 && currentNavIdx < navList.length - 1
      ? navList[currentNavIdx + 1]
      : null
  const prevHref = prevItem ? `/dashboard/inquiries/${prevItem.id}` : null
  const nextHref = nextItem ? `/dashboard/inquiries/${nextItem.id}` : null

  // ── Derived display values ─────────────────────────────────────────────────

  const prefs = ((booking as unknown as { preferences?: unknown }).preferences ?? {}) as {
    durationType?:        'half_day' | 'full_day' | 'multi_day'
    numDays?:             number
    flexibleDates?:       boolean
    preferredMonths?:     string[]
    hasBeginners?:        boolean
    hasChildren?:         boolean
    gearNeeded?:          'own' | 'need_some' | 'need_all'
    accommodation?:       boolean | 'needed' | 'not_needed' | 'flexible'
    transport?:           'need_pickup' | 'self_drive' | 'flexible'
    boatPreference?:      string
    dietaryRestrictions?: string
    stayingAt?:           string
    photographyPackage?:  boolean
    regionExperience?:    string
    budgetMin?:           number
    budgetMax?:           number
    riverType?:           string
    notes?:               string
    allDatePeriods?:      { from: string; to: string }[]
  }

  // Cast booking to access nullable inquiry fields added in the migration
  const b = booking as unknown as {
    id: string
    status: BookingStatus
    source: string
    angler_full_name: string | null
    angler_email: string | null
    angler_country: string | null
    guests: number
    // inquiry start/end dates (stored in booking_date + date_to)
    booking_date: string
    date_to: string | null
    target_species: string[] | null
    experience_level: string | null
    assigned_river: string | null
    offer_price_eur: number | null
    offer_date_from: string | null
    offer_date_to: string | null
    offer_meeting_lat: number | null
    offer_meeting_lng: number | null
    offer_details: string | null
    offer_price_tiers: unknown | null
    created_at: string
    preferences: unknown | null
  }

  const anglerName  = b.angler_full_name ?? 'Guest'
  const anglerEmail = b.angler_email ?? ''
  const groupSize   = b.guests
  const datesFrom   = b.booking_date ?? ''
  const datesTo     = b.date_to ?? ''

  const s = STATUS_STYLES[displayStatus as BookingStatus] ?? { bg: 'rgba(10,46,77,0.08)', color: '#0A2E4D', label: displayStatus }

  const submittedDate = new Date(b.created_at).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const levelLabel =
    b.experience_level != null
      ? ({ beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[
          b.experience_level
        ] ?? b.experience_level)
      : null

  const tripDays = (() => {
    if (prefs.numDays != null) return `${prefs.numDays} days`
    if (!datesFrom || !datesTo) return '1 day'
    const from = new Date(datesFrom)
    const to   = new Date(datesTo)
    const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    return diff > 0 ? `${diff + 1} days` : '1 day'
  })()

  const durationTypeLabel: Record<string, string> = {
    half_day:  'Half day (~4 hrs)',
    full_day:  'Full day (~8 hrs)',
    multi_day: 'Multi-day',
  }
  const gearLabel: Record<string, string> = {
    own:       'Has own gear',
    need_some: 'Needs some gear',
    need_all:  'Needs everything provided',
  }
  const transportLabel: Record<string, string> = {
    need_pickup: 'Needs pickup',
    self_drive:  'Will drive',
    flexible:    'Flexible',
  }

  const accommodationLabel = (() => {
    const a = prefs.accommodation
    if (a == null)                         return undefined
    if (a === true  || a === 'needed')     return 'Yes — include accommodation'
    if (a === false || a === 'not_needed') return 'No — just guiding'
    if (a === 'flexible')                  return 'Flexible'
    return String(a)
  })()

  const preferredMonthsStr =
    prefs.flexibleDates === true &&
    prefs.preferredMonths != null &&
    prefs.preferredMonths.length > 0
      ? prefs.preferredMonths
          .slice()
          .sort()
          .map(m => {
            const [y, mo] = m.split('-').map(Number)
            return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', {
              month: 'short', year: 'numeric',
            })
          })
          .join(', ')
      : undefined

  const groupParts = [
    `${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`,
    prefs.hasBeginners === true && 'incl. beginners',
    prefs.hasChildren  === true && 'incl. children',
  ].filter(Boolean) as string[]

  const budgetParts = [
    prefs.budgetMin != null && `Min €${prefs.budgetMin}`,
    prefs.budgetMax != null && `Max €${prefs.budgetMax}`,
  ].filter(Boolean) as string[]

  const tabProps: InquiryDetailTabsProps = {
    anglerName,
    anglerEmail,
    tripTypeLabel:   prefs.durationType ? durationTypeLabel[prefs.durationType] : undefined,
    tripDays,
    datesLabel:      prefs.flexibleDates === true ? 'Preferred window' : 'Dates',
    datesValue:      datesFrom && datesTo ? `${datesFrom} → ${datesTo}` : datesFrom || '—',
    preferredMonths: preferredMonthsStr,
    groupValue:      groupParts.join(' · '),
    experienceLabel: levelLabel ?? undefined,
    speciesValue:    (b.target_species as string[] | null)?.join(', ') ?? '—',
    gearValue:          prefs.gearNeeded ? gearLabel[prefs.gearNeeded] : undefined,
    accommodationValue: accommodationLabel,
    transportValue:     prefs.transport ? transportLabel[prefs.transport] : undefined,
    boatPreference:     prefs.boatPreference ?? undefined,
    dietaryValue:       prefs.dietaryRestrictions ?? undefined,
    budgetValue:        budgetParts.length > 0 ? budgetParts.join(' — ') : undefined,
    riverType:          prefs.riverType ?? undefined,
    stayingAt:          prefs.stayingAt ?? undefined,
    photographyValue:
      prefs.photographyPackage != null
        ? prefs.photographyPackage
          ? 'Interested in photo/video package'
          : 'Not needed'
        : undefined,
    regionExperience: prefs.regionExperience ?? undefined,
    notes:            prefs.notes ?? undefined,
  }

  // ── Angler brief — for the offer modal left panel ─────────────────────────

  function fmtBriefDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const anglerBrief: AnglerBrief = {
    anglerName,
    anglerEmail,
    datesValue:        datesFrom && datesTo ? `${fmtBriefDate(datesFrom)} – ${fmtBriefDate(datesTo)}` : datesFrom ? fmtBriefDate(datesFrom) : '—',
    tripDays,
    allPeriods:        prefs.allDatePeriods,
    groupLabel:        groupParts.join(' · '),
    species:           (b.target_species as string[] | null) ?? [],
    durationTypeLabel: prefs.durationType != null ? durationTypeLabel[prefs.durationType] : undefined,
    experienceLabel:   levelLabel ?? undefined,
    gearLabel:         prefs.gearNeeded != null ? gearLabel[prefs.gearNeeded] : undefined,
    accommodLabel:     accommodationLabel,
    transportLabel:    prefs.transport != null ? transportLabel[prefs.transport] : undefined,
    budgetLabel:       budgetParts.length > 0 ? budgetParts.join(' — ') : undefined,
    notes:             prefs.notes,
    boatPref:          prefs.boatPreference,
  }

  const canSendOffer = OFFER_SENDABLE.includes(displayStatus as BookingStatus)
  const canDecline   = DECLINABLE.includes(displayStatus as BookingStatus)
  const hasOffer     = !canSendOffer && displayStatus !== 'cancelled' && displayStatus !== 'declined'

  // ─────────────────────────────────────────────────────────────────────────────

  const navAnglerName = (item: { angler_full_name?: string | null; angler_name?: string | null }) =>
    item.angler_full_name ?? item.angler_name ?? 'Guest'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* Keyboard navigation (invisible) */}
      <NavigationShortcuts prevHref={prevHref} nextHref={nextHref} />

      {/* ── Top nav bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">

        <Link
          href="/dashboard/bookings?view=action"
          className="inline-flex items-center gap-1.5 text-xs f-body hover:text-[#E67E50] transition-colors flex-shrink-0"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          <ChevronLeft size={12} strokeWidth={1.8} />
          All Requests
        </Link>

        {navList.length > 1 && currentNavIdx >= 0 && (
          <div className="flex items-center gap-2">
            {prevItem != null ? (
              <Link
                href={prevHref!}
                title="Previous (← Arrow key)"
                className="inline-flex items-center gap-1.5 text-xs f-body transition-colors hover:text-[#0A2E4D] group"
                style={{ color: 'rgba(10,46,77,0.45)' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <ChevronLeft size={10} strokeWidth={1.8} />
                </span>
                <span className="max-w-[90px] truncate hidden sm:inline" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {navAnglerName(prevItem)}
                </span>
              </Link>
            ) : (
              <span style={{ width: 24 }} />
            )}

            <span
              className="text-[10px] font-semibold f-body px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.45)', minWidth: 44, textAlign: 'center' }}
            >
              {currentNavIdx + 1} / {navList.length}
            </span>

            {nextItem != null ? (
              <Link
                href={nextHref!}
                title="Next (→ Arrow key)"
                className="inline-flex items-center gap-1.5 text-xs f-body transition-colors hover:text-[#0A2E4D]"
                style={{ color: 'rgba(10,46,77,0.45)' }}
              >
                <span className="max-w-[90px] truncate hidden sm:inline" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {navAnglerName(nextItem)}
                </span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <ChevronRight size={10} strokeWidth={1.8} />
                </span>
              </Link>
            ) : (
              <span style={{ width: 24 }} />
            )}
          </div>
        )}
      </div>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            {anglerName}
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Submitted {submittedDate}
          </p>
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full f-body mt-1 flex-shrink-0"
          style={{ background: s.bg, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          Two-column layout
          Left  = inquiry data (tabs)
          Right = chat + action widget (sticky)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

        {/* ── LEFT: tabbed inquiry data ─────────────────────────────────────── */}
        <InquiryDetailTabs {...tabProps} />

        {/* ── RIGHT: chat + action widget (sticky) ─────────────────────────── */}
        <div className="xl:sticky xl:top-6 flex flex-col gap-4">

          {/* Chat */}
          <InquiryChat
            bookingId={id}
            currentUserId={user.id}
            currentUserRole="guide"
            initialMessages={initialMessages}
            otherPartyName={anglerName}
            readOnly={displayStatus === 'cancelled' || displayStatus === 'declined'}
          />

          {/* ── Action widget — varies by status ──────────────────────────── */}

          {/* Needs offer → primary CTA */}
          {canSendOffer && (
            <div
              className="p-4 rounded-2xl"
              style={{
                background:   '#FDFAF7',
                border:       '1px solid rgba(10,46,77,0.08)',
                boxShadow:    '0 2px 8px rgba(10,46,77,0.05)',
              }}
            >
              <OfferModal
                inquiryId={id}
                anglerDatesFrom={datesFrom || new Date().toISOString().slice(0, 10)}
                anglerDatesTo={datesTo || new Date().toISOString().slice(0, 10)}
                anglerAllPeriods={prefs.allDatePeriods}
                guideWeeklySchedules={guideSchedules}
                groupSize={groupSize}
                canDecline={canDecline}
                anglerBrief={anglerBrief}
              />
            </div>
          )}

          {/* Offer sent → waiting */}
          {displayStatus === 'offer_sent' && (
            <ActionStatusCard
              color="orange"
              title="Offer sent — awaiting reply"
              body="The angler will review your offer and accept or contact you."
            />
          )}

          {/* Offer accepted → payment processing */}
          {displayStatus === 'offer_accepted' && (
            <ActionStatusCard
              color="blue"
              title="Angler accepted — payment processing"
              body="Payout will be transferred once payment clears."
            />
          )}

          {/* Confirmed */}
          {displayStatus === 'confirmed' && (
            <ActionStatusCard
              color="green"
              title="Confirmed — payment received"
              body="Trip is fully booked and paid. Good luck on the water!"
            />
          )}

          {/* Completed */}
          {displayStatus === 'completed' && (
            <ActionStatusCard
              color="green"
              title="Trip completed"
              body="Check your earnings dashboard for payout details."
            />
          )}

          {/* Cancelled / declined */}
          {(displayStatus === 'cancelled' || displayStatus === 'declined') && (
            <ActionStatusCard
              color="red"
              title="Request declined"
              body="This request has been declined."
            />
          )}

          {/* Offer recap (when offer was sent) */}
          {hasOffer && <OfferRecap booking={b} />}

          {/* Keyboard hint */}
          {navList.length > 1 && (
            <p className="text-center text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.25)' }}>
              ← → arrow keys to jump between requests
            </p>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── ActionStatusCard ──────────────────────────────────────────────────────────

function ActionStatusCard({
  color,
  title,
  body,
}: {
  color: StatusColor
  title: string
  body?: string
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

// ─── OfferRecap ────────────────────────────────────────────────────────────────

function OfferRecap({
  booking,
}: {
  booking: {
    assigned_river:    string | null
    offer_price_eur:   number | null
    offer_details:     string | null
    offer_date_from:   string | null
    offer_date_to:     string | null
    offer_meeting_lat: number | null
    offer_meeting_lng: number | null
  }
}) {
  if (booking.offer_price_eur == null) return null

  const mapsHref =
    booking.offer_meeting_lat != null && booking.offer_meeting_lng != null
      ? `https://www.google.com/maps?q=${booking.offer_meeting_lat},${booking.offer_meeting_lng}`
      : null

  const rows: { label: string; value: React.ReactNode }[] = []

  if (booking.offer_date_from != null && booking.offer_date_to != null) {
    rows.push({
      label: 'Dates',
      value: booking.offer_date_from === booking.offer_date_to
        ? booking.offer_date_from
        : `${booking.offer_date_from} – ${booking.offer_date_to}`,
    })
  }
  if (booking.assigned_river != null) {
    rows.push({ label: 'Location', value: booking.assigned_river })
  }
  if (mapsHref != null) {
    rows.push({
      label: 'Meeting',
      value: (
        <a href={mapsHref} target="_blank" rel="noopener noreferrer"
           className="hover:underline" style={{ color: '#E67E50' }}>
          {booking.offer_meeting_lat!.toFixed(4)}, {booking.offer_meeting_lng!.toFixed(4)} ↗
        </a>
      ),
    })
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2.5"
      style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 f-body"
         style={{ color: 'rgba(10,46,77,0.38)' }}>
        Your Offer
      </p>

      {rows.map(r => (
        <div key={r.label} className="flex items-start justify-between gap-3">
          <span className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: 72 }}>
            {r.label}
          </span>
          <span className="text-sm f-body font-medium text-right" style={{ color: '#0A2E4D' }}>
            {r.value}
          </span>
        </div>
      ))}

      <div className="flex items-start justify-between gap-3 pt-1" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
        <span className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)', minWidth: 72 }}>
          Total price
        </span>
        <span className="text-base f-display font-bold" style={{ color: '#E67E50' }}>
          €{booking.offer_price_eur}
        </span>
      </div>

      {booking.offer_details != null && booking.offer_details.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5 f-body"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Details sent to angler
          </p>
          <p className="text-xs f-body whitespace-pre-wrap leading-relaxed"
             style={{ color: 'rgba(10,46,77,0.65)' }}>
            {booking.offer_details}
          </p>
        </div>
      )}
    </div>
  )
}
