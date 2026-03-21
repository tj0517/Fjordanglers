import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import GuideOfferForm from '@/components/dashboard/guide-offer-form'
import InquiryDeclineButton from '@/components/dashboard/inquiry-decline-button'
import InquiryDetailTabs, { type InquiryDetailTabsProps } from '@/components/dashboard/inquiry-detail-tabs'
import NavigationShortcuts from '@/components/dashboard/navigation-shortcuts'

// ─── Types ─────────────────────────────────────────────────────────────────────

type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

const STATUS_STYLES: Record<InquiryStatus, { bg: string; color: string; label: string }> = {
  inquiry:        { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'New'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Reviewing'  },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer Sent' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> }

export default async function GuideInquiryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Guide identity (user-scoped RLS OK for guides table)
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) notFound()

  const serviceClient = createServiceClient()

  // ── Parallel fetch: inquiry data + navigation list + guide schedules ──────
  const [
    inquiryResult,
    navAssignedResult,
    navUnassignedResult,
    guideSchedulesResult,
  ] = await Promise.all([
    serviceClient
      .from('trip_inquiries')
      .select('*')
      .eq('id', id)
      .single(),

    // All inquiries assigned to this guide (for navigation)
    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, created_at')
      .eq('assigned_guide_id', guide.id)
      .order('created_at', { ascending: false }),

    // Unassigned open inquiries (also navigable)
    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, created_at')
      .is('assigned_guide_id', null)
      .in('status', ['inquiry', 'reviewing'])
      .order('created_at', { ascending: false }),

    // Guide's recurring weekly schedule (for calendar display)
    serviceClient
      .from('guide_weekly_schedules')
      .select('period_from, period_to, blocked_weekdays')
      .eq('guide_id', guide.id),
  ])

  const inquiry         = inquiryResult.data
  const guideSchedules  = guideSchedulesResult.data ?? []
  if (!inquiry) notFound()

  // Authorization: must be assigned to this guide OR unassigned
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

  // ── Navigation list (merge + dedup + sort desc) ────────────────────────────
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
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))  // newest first

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
    /** Multi-period selection from angler's MultiPeriodPicker */
    allDatePeriods?:      { from: string; to: string }[]
  }

  const s = STATUS_STYLES[displayStatus]

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
    if (a == null)                             return undefined
    if (a === true  || a === 'needed')         return 'Yes — include accommodation'
    if (a === false || a === 'not_needed')     return 'No — just guiding'
    if (a === 'flexible')                      return 'Flexible'
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

  // All props for the client-side tab component
  const tabProps: InquiryDetailTabsProps = {
    anglerName:   inquiry.angler_name,
    anglerEmail:  inquiry.angler_email,
    // Trip
    tripTypeLabel:   prefs.durationType ? durationTypeLabel[prefs.durationType] : undefined,
    tripDays,
    datesLabel:      prefs.flexibleDates === true ? 'Preferred window' : 'Dates',
    datesValue:      `${inquiry.dates_from} → ${inquiry.dates_to}`,
    preferredMonths: preferredMonthsStr,
    groupValue:      groupParts.join(' · '),
    experienceLabel: levelLabel ?? undefined,
    speciesValue:    (inquiry.target_species as string[] | null)?.join(', ') ?? '—',
    // Logistics
    gearValue:          prefs.gearNeeded ? gearLabel[prefs.gearNeeded] : undefined,
    accommodationValue: accommodationLabel,
    transportValue:     prefs.transport ? transportLabel[prefs.transport] : undefined,
    boatPreference:     prefs.boatPreference ?? undefined,
    dietaryValue:       prefs.dietaryRestrictions ?? undefined,
    budgetValue:        budgetParts.length > 0 ? budgetParts.join(' — ') : undefined,
    riverType:          prefs.riverType ?? undefined,
    // Context
    stayingAt:         prefs.stayingAt ?? undefined,

    photographyValue:
      prefs.photographyPackage != null
        ? prefs.photographyPackage
          ? 'Interested in photo/video package'
          : 'Not needed'
        : undefined,
    regionExperience: prefs.regionExperience ?? undefined,
    notes:            prefs.notes ?? undefined,
  }

  const canSendOffer = displayStatus === 'inquiry' || displayStatus === 'reviewing'
  const canDecline   = ['inquiry', 'reviewing', 'offer_sent'].includes(displayStatus)
  const hasOffer     = !canSendOffer && displayStatus !== 'cancelled'

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1100px]">

      {/* ── Keyboard navigation (invisible) ──────────────────────────────── */}
      <NavigationShortcuts prevHref={prevHref} nextHref={nextHref} />

      {/* ── Top nav bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">

        {/* Back link */}
        <Link
          href="/dashboard/inquiries"
          className="inline-flex items-center gap-1.5 text-xs f-body hover:text-[#E67E50] transition-colors flex-shrink-0"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="8,2 4,6 8,10" />
          </svg>
          All Requests
        </Link>

        {/* Prev / position / Next */}
        {navList.length > 1 && currentNavIdx >= 0 && (
          <div className="flex items-center gap-2">

            {/* ← Prev */}
            {prevItem != null ? (
              <Link
                href={prevHref!}
                title="Previous (← Arrow key)"
                className="inline-flex items-center gap-1.5 text-xs f-body transition-colors hover:text-[#0A2E4D] group"
                style={{ color: 'rgba(10,46,77,0.45)' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="7,1 3,5 7,9" />
                  </svg>
                </span>
                <span
                  className="max-w-[90px] truncate hidden sm:inline"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  {prevItem.angler_name}
                </span>
              </Link>
            ) : (
              <span style={{ width: 24 }} />
            )}

            {/* Position pill */}
            <span
              className="text-[10px] font-semibold f-body px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(10,46,77,0.06)',
                color:       'rgba(10,46,77,0.45)',
                minWidth:    44,
                textAlign:   'center',
              }}
            >
              {currentNavIdx + 1} / {navList.length}
            </span>

            {/* Next → */}
            {nextItem != null ? (
              <Link
                href={nextHref!}
                title="Next (→ Arrow key)"
                className="inline-flex items-center gap-1.5 text-xs f-body transition-colors hover:text-[#0A2E4D]"
                style={{ color: 'rgba(10,46,77,0.45)' }}
              >
                <span
                  className="max-w-[90px] truncate hidden sm:inline"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  {nextItem.angler_name}
                </span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="3,1 7,5 3,9" />
                  </svg>
                </span>
              </Link>
            ) : (
              <span style={{ width: 24 }} />
            )}

          </div>
        )}
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
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

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

        {/* ── Left: tabbed inquiry data ─────────────────────────────────── */}
        <InquiryDetailTabs {...tabProps} />

        {/* ── Right: actions ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Action card */}
          <div
            className="p-6"
            style={{
              background:   '#FDFAF7',
              borderRadius: '24px',
              border:       '1px solid rgba(10,46,77,0.08)',
              boxShadow:    '0 2px 16px rgba(10,46,77,0.05)',
            }}
          >

            {/* ── Request summary (shown while still responding) ────── */}
            {(canSendOffer || displayStatus === 'offer_sent') && (
              <div
                className="mb-5 pb-5"
                style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 f-body"
                  style={{ color: 'rgba(10,46,77,0.35)' }}
                >
                  What they need
                </p>
                <div className="flex flex-col gap-2">

                  {/* Dates */}
                  <div className="flex items-start gap-2.5">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="rgba(10,46,77,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <rect x="2" y="3" width="12" height="11" rx="1.5" />
                      <line x1="5" y1="1.5" x2="5" y2="4.5" /><line x1="11" y1="1.5" x2="11" y2="4.5" />
                      <line x1="2" y1="7" x2="14" y2="7" />
                    </svg>
                    <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                      {inquiry.dates_from} – {inquiry.dates_to}
                      <span style={{ color: 'rgba(10,46,77,0.4)' }}> · {tripDays}</span>
                    </span>
                  </div>

                  {/* Group */}
                  <div className="flex items-start gap-2.5">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="rgba(10,46,77,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <circle cx="6" cy="5" r="2.5" /><path d="M1 13.5c0-2.76 2.24-5 5-5s5 2.24 5 5" />
                      <circle cx="12" cy="5" r="2" opacity="0.5" /><path d="M15 13.5c0-1.93-1.34-3.55-3.14-3.96" opacity="0.5" />
                    </svg>
                    <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                      {groupParts.join(' · ')}
                    </span>
                  </div>

                  {/* Species */}
                  {(() => {
                    const sp = (inquiry.target_species as string[] | null) ?? []
                    if (sp.length === 0) return null
                    return (
                      <div className="flex items-start gap-2.5">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="rgba(10,46,77,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                          <path d="M2 8c2-4 8-5 12-2.5" /><path d="M2 8c2 4 8 5 12 2.5" />
                          <path d="M14 5.5 Q16 8 14 10.5" /><circle cx="5.5" cy="7" r="0.8" fill="rgba(10,46,77,0.35)" stroke="none" />
                        </svg>
                        <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                          {sp.slice(0, 3).join(', ')}{sp.length > 3 && ` +${sp.length - 3}`}
                        </span>
                      </div>
                    )
                  })()}

                  {/* Duration type */}
                  {prefs.durationType != null && (
                    <div className="flex items-start gap-2.5">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="rgba(10,46,77,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                        <circle cx="8" cy="8" r="6.5" />
                        <polyline points="8,4.5 8,8 10.5,10" />
                      </svg>
                      <span className="text-xs f-body" style={{ color: '#0A2E4D' }}>
                        {durationTypeLabel[prefs.durationType]}
                      </span>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ── Can send offer ────────────────────────────────────── */}
            {canSendOffer && (
              <div className="flex flex-col gap-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
                  style={{ color: 'rgba(10,46,77,0.35)' }}
                >
                  Your offer
                </p>
                <GuideOfferForm
                  inquiryId={id}
                  anglerDatesFrom={inquiry.dates_from}
                  anglerDatesTo={inquiry.dates_to}
                  anglerAllPeriods={prefs.allDatePeriods}
                  guideWeeklySchedules={guideSchedules}
                />
                {canDecline && (
                  <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                    <InquiryDeclineButton inquiryId={id} />
                  </div>
                )}
              </div>
            )}

            {/* ── Offer sent — waiting for angler ──────────────────── */}
            {displayStatus === 'offer_sent' && (
              <div className="flex flex-col gap-4">
                <div
                  className="px-4 py-4 rounded-xl"
                  style={{
                    background: 'rgba(230,126,80,0.07)',
                    border:     '1px solid rgba(230,126,80,0.2)',
                  }}
                >
                  <p className="text-sm font-semibold f-body mb-1" style={{ color: '#C4622A' }}>
                    Offer sent — awaiting reply
                  </p>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    The angler will review your offer and accept or contact you.
                  </p>
                </div>

                {hasOffer && <OfferRecap inquiry={inquiry} />}

                {canDecline && (
                  <div className="pt-1">
                    <InquiryDeclineButton inquiryId={id} />
                  </div>
                )}
              </div>
            )}

            {/* ── Accepted / confirmed / completed ─────────────────── */}
            {(displayStatus === 'offer_accepted' ||
              displayStatus === 'confirmed' ||
              displayStatus === 'completed') && (
              <div className="flex flex-col gap-4">
                <div
                  className="px-4 py-4 rounded-xl"
                  style={{
                    background: 'rgba(74,222,128,0.08)',
                    border:     '1px solid rgba(74,222,128,0.2)',
                  }}
                >
                  <p className="text-sm font-semibold f-body mb-1" style={{ color: '#16A34A' }}>
                    {displayStatus === 'completed'
                      ? 'Trip completed'
                      : displayStatus === 'offer_accepted'
                      ? 'Angler accepted — payment processing'
                      : 'Confirmed — payment received'}
                  </p>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    {displayStatus === 'offer_accepted'
                      ? 'Payout will be transferred once payment clears.'
                      : displayStatus === 'confirmed'
                      ? 'Trip is fully booked and paid. Good luck on the water!'
                      : 'Check your earnings dashboard for payout details.'}
                  </p>
                </div>

                {hasOffer && <OfferRecap inquiry={inquiry} />}
              </div>
            )}

            {/* ── Cancelled ─────────────────────────────────────────── */}
            {displayStatus === 'cancelled' && (
              <div
                className="px-4 py-4 rounded-xl"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border:     '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <p className="text-sm font-semibold f-body mb-1" style={{ color: '#DC2626' }}>
                  Request declined
                </p>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  This request has been cancelled.
                </p>
              </div>
            )}

          </div>

          {/* Tips card — only while actionable */}
          {(canSendOffer || displayStatus === 'offer_sent') && (
            <div
              className="px-5 py-4 rounded-2xl"
              style={{
                background: 'rgba(10,46,77,0.03)',
                border:     '1px solid rgba(10,46,77,0.07)',
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
                style={{ color: 'rgba(10,46,77,0.35)' }}
              >
                Tips
              </p>
              <ul className="flex flex-col gap-1.5">
                {[
                  'Respond within 24 h to maximize conversions.',
                  "Include what's covered: gear, lunch, transport.",
                  'Be specific about the river and access point.',
                ].map(tip => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0" style={{ color: '#E67E50' }}>·</span>
                    <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Keyboard hint */}
          {navList.length > 1 && (
            <p
              className="text-center text-[10px] f-body"
              style={{ color: 'rgba(10,46,77,0.25)' }}
            >
              ← → arrow keys to jump between requests
            </p>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Offer recap sub-component ────────────────────────────────────────────────

function OfferRecap({
  inquiry,
}: {
  inquiry: {
    assigned_river:   string | null
    offer_price_eur:  number | null
    offer_details:    string | null
    offer_date_from:  string | null
    offer_date_to:    string | null
    offer_meeting_lat: number | null
    offer_meeting_lng: number | null
  }
}) {
  if (inquiry.offer_price_eur == null) return null

  const mapsHref =
    inquiry.offer_meeting_lat != null && inquiry.offer_meeting_lng != null
      ? `https://www.google.com/maps?q=${inquiry.offer_meeting_lat},${inquiry.offer_meeting_lng}`
      : null

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5"
      style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        Your Offer
      </p>

      {/* Confirmed dates */}
      {inquiry.offer_date_from != null && inquiry.offer_date_to != null && (
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-xs f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.45)', width: 100 }}
          >
            Confirmed dates
          </span>
          <span className="text-sm f-body font-medium text-right" style={{ color: '#0A2E4D' }}>
            {inquiry.offer_date_from === inquiry.offer_date_to
              ? inquiry.offer_date_from
              : `${inquiry.offer_date_from} – ${inquiry.offer_date_to}`}
          </span>
        </div>
      )}

      {/* River / location */}
      {inquiry.assigned_river != null && (
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-xs f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.45)', width: 100 }}
          >
            Location
          </span>
          <span className="text-sm f-body font-medium text-right" style={{ color: '#0A2E4D' }}>
            {inquiry.assigned_river}
          </span>
        </div>
      )}

      {/* Meeting point */}
      {mapsHref != null && (
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-xs f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.45)', width: 100 }}
          >
            Meeting point
          </span>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs f-body font-medium text-right hover:underline transition-colors"
            style={{ color: '#E67E50' }}
          >
            {inquiry.offer_meeting_lat!.toFixed(4)},{' '}
            {inquiry.offer_meeting_lng!.toFixed(4)} ↗
          </a>
        </div>
      )}

      {/* Price */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="text-xs f-body flex-shrink-0"
          style={{ color: 'rgba(10,46,77,0.45)', width: 100 }}
        >
          Total price
        </span>
        <span className="text-base f-display font-bold" style={{ color: '#E67E50' }}>
          €{inquiry.offer_price_eur}
        </span>
      </div>

      {/* Details */}
      {inquiry.offer_details != null && inquiry.offer_details.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Details sent to angler
          </p>
          <p
            className="text-xs f-body whitespace-pre-wrap leading-relaxed"
            style={{ color: 'rgba(10,46,77,0.65)' }}
          >
            {inquiry.offer_details}
          </p>
        </div>
      )}
    </div>
  )
}
