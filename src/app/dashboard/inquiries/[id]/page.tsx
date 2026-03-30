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

type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

const STATUS_STYLES: Record<InquiryStatus, { bg: string; color: string; label: string }> = {
  inquiry:        { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'New'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'  },
  offer_sent:     { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Offer Sent' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
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
    inquiryResult,
    navAssignedResult,
    navUnassignedResult,
    guideSchedulesResult,
    messagesResult,
  ] = await Promise.all([
    serviceClient
      .from('trip_inquiries')
      .select('*')
      .eq('id', id)
      .single(),

    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, created_at')
      .eq('assigned_guide_id', guide.id)
      .order('created_at', { ascending: false }),

    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, created_at')
      .is('assigned_guide_id', null)
      .in('status', ['inquiry', 'reviewing'])
      .order('created_at', { ascending: false }),

    serviceClient
      .from('guide_weekly_schedules')
      .select('period_from, period_to, blocked_weekdays')
      .eq('guide_id', guide.id),

    serviceClient
      .from('inquiry_messages')
      .select('id, sender_id, sender_role, body, created_at, read_at')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true }),
  ])

  const inquiry         = inquiryResult.data
  const guideSchedules  = guideSchedulesResult.data ?? []
  const initialMessages = (messagesResult.data ?? []) as ChatMessage[]
  if (!inquiry) notFound()

  if (
    inquiry.assigned_guide_id !== null &&
    inquiry.assigned_guide_id !== guide.id
  ) {
    notFound()
  }

  // Auto-mark as reviewing on first open
  let displayStatus = inquiry.status
  if (inquiry.status === 'inquiry') {
    await serviceClient
      .from('trip_inquiries')
      .update({ status: 'reviewing' })
      .eq('id', id)
    displayStatus = 'reviewing'
  }

  // ── Navigation list ────────────────────────────────────────────────────────
  const navSeen = new Set<string>()
  const navList = [
    ...(navAssignedResult.data ?? []),
    ...(navUnassignedResult.data ?? []),
  ]
    .filter(r => {
      if (navSeen.has(r.id)) return false
      navSeen.add(r.id)
      return true
    })
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

  const prefs = (inquiry.preferences ?? {}) as {
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

  const s = STATUS_STYLES[displayStatus as InquiryStatus]

  const submittedDate = new Date(inquiry.created_at).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const levelLabel =
    inquiry.experience_level != null
      ? ({ beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }[
          inquiry.experience_level
        ] ?? inquiry.experience_level)
      : null

  const tripDays = (() => {
    if (prefs.numDays != null) return `${prefs.numDays} days`
    const from = new Date(inquiry.dates_from)
    const to   = new Date(inquiry.dates_to)
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
    `${inquiry.group_size} ${inquiry.group_size === 1 ? 'angler' : 'anglers'}`,
    prefs.hasBeginners === true && 'incl. beginners',
    prefs.hasChildren  === true && 'incl. children',
  ].filter(Boolean) as string[]

  const budgetParts = [
    prefs.budgetMin != null && `Min €${prefs.budgetMin}`,
    prefs.budgetMax != null && `Max €${prefs.budgetMax}`,
  ].filter(Boolean) as string[]

  const tabProps: InquiryDetailTabsProps = {
    anglerName:   inquiry.angler_name,
    anglerEmail:  inquiry.angler_email,
    tripTypeLabel:   prefs.durationType ? durationTypeLabel[prefs.durationType] : undefined,
    tripDays,
    datesLabel:      prefs.flexibleDates === true ? 'Preferred window' : 'Dates',
    datesValue:      `${inquiry.dates_from} → ${inquiry.dates_to}`,
    preferredMonths: preferredMonthsStr,
    groupValue:      groupParts.join(' · '),
    experienceLabel: levelLabel ?? undefined,
    speciesValue:    (inquiry.target_species as string[] | null)?.join(', ') ?? '—',
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
    anglerName:        inquiry.angler_name,
    anglerEmail:       inquiry.angler_email,
    datesValue:        `${fmtBriefDate(inquiry.dates_from)} – ${fmtBriefDate(inquiry.dates_to)}`,
    tripDays,
    allPeriods:        prefs.allDatePeriods,
    groupLabel:        groupParts.join(' · '),
    species:           (inquiry.target_species as string[] | null) ?? [],
    durationTypeLabel: prefs.durationType != null ? durationTypeLabel[prefs.durationType] : undefined,
    experienceLabel:   levelLabel ?? undefined,
    gearLabel:         prefs.gearNeeded != null ? gearLabel[prefs.gearNeeded] : undefined,
    accommodLabel:     accommodationLabel,
    transportLabel:    prefs.transport != null ? transportLabel[prefs.transport] : undefined,
    budgetLabel:       budgetParts.length > 0 ? budgetParts.join(' — ') : undefined,
    notes:             prefs.notes,
    boatPref:          prefs.boatPreference,
  }

  const canSendOffer = displayStatus === 'inquiry' || displayStatus === 'reviewing'
  const canDecline   = ['inquiry', 'reviewing', 'offer_sent'].includes(displayStatus)
  const hasOffer     = !canSendOffer && displayStatus !== 'cancelled'

  // ─────────────────────────────────────────────────────────────────────────────

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
                  {prevItem.angler_name}
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
                  {nextItem.angler_name}
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
            {inquiry.angler_name}
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
            inquiryId={id}
            currentUserId={user.id}
            currentUserRole="guide"
            initialMessages={initialMessages}
            otherPartyName={inquiry.angler_name}
            readOnly={displayStatus === 'cancelled'}
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
                anglerDatesFrom={inquiry.dates_from}
                anglerDatesTo={inquiry.dates_to}
                anglerAllPeriods={prefs.allDatePeriods}
                guideWeeklySchedules={guideSchedules}
                groupSize={inquiry.group_size}
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

          {/* Cancelled */}
          {displayStatus === 'cancelled' && (
            <ActionStatusCard
              color="red"
              title="Request declined"
              body="This request has been cancelled."
            />
          )}

          {/* Offer recap (when offer was sent) */}
          {hasOffer && <OfferRecap inquiry={inquiry} />}

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
  inquiry,
}: {
  inquiry: {
    assigned_river:    string | null
    offer_price_eur:   number | null
    offer_details:     string | null
    offer_date_from:   string | null
    offer_date_to:     string | null
    offer_meeting_lat: number | null
    offer_meeting_lng: number | null
  }
}) {
  if (inquiry.offer_price_eur == null) return null

  const mapsHref =
    inquiry.offer_meeting_lat != null && inquiry.offer_meeting_lng != null
      ? `https://www.google.com/maps?q=${inquiry.offer_meeting_lat},${inquiry.offer_meeting_lng}`
      : null

  const rows: { label: string; value: React.ReactNode }[] = []

  if (inquiry.offer_date_from != null && inquiry.offer_date_to != null) {
    rows.push({
      label: 'Dates',
      value: inquiry.offer_date_from === inquiry.offer_date_to
        ? inquiry.offer_date_from
        : `${inquiry.offer_date_from} – ${inquiry.offer_date_to}`,
    })
  }
  if (inquiry.assigned_river != null) {
    rows.push({ label: 'Location', value: inquiry.assigned_river })
  }
  if (mapsHref != null) {
    rows.push({
      label: 'Meeting',
      value: (
        <a href={mapsHref} target="_blank" rel="noopener noreferrer"
           className="hover:underline" style={{ color: '#E67E50' }}>
          {inquiry.offer_meeting_lat!.toFixed(4)}, {inquiry.offer_meeting_lng!.toFixed(4)} ↗
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
          €{inquiry.offer_price_eur}
        </span>
      </div>

      {inquiry.offer_details != null && inquiry.offer_details.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5 f-body"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Details sent to angler
          </p>
          <p className="text-xs f-body whitespace-pre-wrap leading-relaxed"
             style={{ color: 'rgba(10,46,77,0.65)' }}>
            {inquiry.offer_details}
          </p>
        </div>
      )}
    </div>
  )
}
