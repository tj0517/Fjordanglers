import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getGuideCalendars, getCalendarExperienceMap } from '@/actions/calendars'
import { CalendarDisabledToggle } from '@/components/dashboard/calendar-disabled-toggle'
import type { WeeklySchedule } from '@/actions/weekly-schedules'
import { HelpWidget } from '@/components/ui/help-widget'
import { CalendarWrapper } from './CalendarWrapper'

export const revalidate = 0  // always fresh — calendar changes frequently

export const metadata = { title: 'Calendar — FjordAnglers Dashboard' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; calendarId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/calendar')

  // ── Guide profile ────────────────────────────────────────────────────────────
  // Base query — columns guaranteed to exist in all DB versions.
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // calendar_disabled — added in migration 20260320170000.
  // Queried separately so a missing column never breaks the page (falls back to false).
  const { data: guideFlags } = await supabase
    .from('guides')
    .select('calendar_disabled')
    .eq('id', guide.id)
    .maybeSingle()

  const calendarDisabled = guideFlags?.calendar_disabled ?? false

  // ── URL params ───────────────────────────────────────────────────────────────
  const sp = await searchParams
  const now = new Date()
  const year  = Number(sp.year  ?? now.getFullYear())
  const month = Number(sp.month ?? now.getMonth() + 1)

  const safeYear  = Math.min(Math.max(year,  2020), 2099)
  const safeMonth = Math.min(Math.max(month, 1),    12)

  const activeCalendarId = sp.calendarId ?? null

  const firstDay = toDateStr(safeYear, safeMonth, 1)
  const lastDay  = toDateStr(safeYear, safeMonth, new Date(safeYear, safeMonth, 0).getDate())

  // ── All experiences for this guide ───────────────────────────────────────────
  const { data: allExperiencesRaw } = await supabase
    .from('experiences')
    .select('id, title, published, booking_type')
    .eq('guide_id', guide.id)
    .order('title')

  const allExperiences = (allExperiencesRaw ?? []) as Array<{
    id: string; title: string; published: boolean; booking_type: string | null
  }>

  // ── Calendar-disabled toggle — shown to ALL guides ───────────────────────────
  // Every guide can choose to hide the date picker and switch to inquiry-only flow.
  const hasClassicListing = allExperiences.some(
    e => e.booking_type === 'classic' || e.booking_type === 'both'
  )
  const showCalendarToggle = true

  // ── Calendars + experience assignments ───────────────────────────────────────
  const [calendars, calendarExperienceMap] = await Promise.all([
    getGuideCalendars(supabase, guide.id),
    getGuideCalendars(supabase, guide.id).then(cals =>
      getCalendarExperienceMap(supabase, cals.map(c => c.id))
    ),
  ])

  // ── Resolve which experiences to show ────────────────────────────────────────
  // If a specific calendar is selected, filter to only its experiences.
  // If "All trips" (no calendarId), show all experiences.
  const activeExpIds: Set<string> | null =
    activeCalendarId != null
      ? new Set(calendarExperienceMap[activeCalendarId] ?? [])
      : null

  const experiences = activeExpIds != null
    ? allExperiences.filter(e => activeExpIds.has(e.id))
    : allExperiences

  const expIds = experiences.map(e => e.id)

  // ── Blocked ranges overlapping the viewed month ───────────────────────────────
  // All blocking lives in `calendar_blocked_dates`. One query covers everything.
  // Expand each row to one BlockedEntry per experience so CalendarGrid (which
  // expects experience_id-keyed entries) works unchanged.
  // All expanded entries from the same calendar block share the same `id` so
  // the unblock UI deduplicates them into one action.

  const allCalendarIds = calendars.map(c => c.id)

  // Fetch blocked data in parallel (calendar_blocked_dates + bookings + inquiries + schedules)
  const serviceClient = createServiceClient()

  const fetchFrom = (() => {
    const d = new Date(`${firstDay}T12:00:00`)
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })()

  const [
    calendarBlockedResult,
    bookingsResult,
    inquiriesResult,
    weeklySchedulesResult,
  ] = await Promise.all([
    // calendar_blocked_dates — single source of truth
    activeCalendarId != null
      ? supabase
          .from('calendar_blocked_dates')
          .select('id, calendar_id, date_start, date_end, reason')
          .eq('calendar_id', activeCalendarId)
          .lte('date_start', lastDay)
          .gte('date_end', firstDay)
          .order('date_start')
      : allCalendarIds.length > 0
          ? supabase
              .from('calendar_blocked_dates')
              .select('id, calendar_id, date_start, date_end, reason')
              .in('calendar_id', allCalendarIds)
              .lte('date_start', lastDay)
              .gte('date_end', firstDay)
              .order('date_start')
          : Promise.resolve({ data: [] as Array<{ id: string; calendar_id: string; date_start: string; date_end: string; reason: string | null }> }),

    // Direct bookings overlapping the month
    expIds.length > 0
      ? supabase
          .from('bookings')
          .select('id, experience_id, booking_date, requested_dates, guests, status, angler_full_name')
          .in('experience_id', expIds)
          .gte('booking_date', fetchFrom)
          .lte('booking_date', lastDay)
          .in('status', ['pending', 'confirmed', 'accepted'])
          .order('booking_date')
      : Promise.resolve({ data: [] as Array<{ id: string; experience_id: string; booking_date: string; requested_dates: string[] | null; guests: number; status: string; angler_full_name: string | null }> }),

    // Inquiry bookings — scoped to the active calendar's experiences when one is selected.
    // When a named calendar is active: show only inquiries pinned to that calendar's trips
    // (experience_id IN expIds). Inquiries with no experience_id appear in "All Trips" only.
    // When "All Trips" (activeCalendarId == null): show all guide inquiries.
    (() => {
      if (activeCalendarId != null && expIds.length === 0) {
        // Calendar has no experiences → no inquiries to show
        return Promise.resolve({ data: [] as Array<{
          id: string; experience_id?: string | null; booking_date: string; date_to?: string | null
          requested_dates?: string[] | null; offer_date_from?: string | null
          offer_date_to?: string | null; offer_days?: string[] | null
          angler_full_name?: string | null; guests: number; status: string
        }> })
      }
      const q = serviceClient
        .from('bookings')
        .select('id, experience_id, booking_date, date_to, requested_dates, offer_date_from, offer_date_to, offer_days, angler_full_name, guests, status')
        .eq('source', 'inquiry')
        .eq('guide_id', guide.id)
        .not('status', 'in', '(cancelled,declined,refunded)')
        .lte('booking_date', lastDay)
        .order('booking_date')
      // Named calendar selected → scope to that calendar's experiences only
      if (activeCalendarId != null) {
        return q.in('experience_id', expIds)
      }
      return q
    })(),

    // Weekly schedules
    supabase
      .from('guide_weekly_schedules')
      .select('id, guide_id, label, period_from, period_to, blocked_weekdays, created_at')
      .eq('guide_id', guide.id)
      .order('period_from'),
  ])

  // ── Expand calendar blocks → BlockedEntry[] ──────────────────────────────────
  // For CalendarGrid: BlockedEntry needs experience_id.
  // Multiple expanded entries from the same calendar block share the same `id`
  // so the unblock UI deduplicates them into one action (correct behaviour).

  type BlockedEntry = { id: string; experience_id: string; date_start: string; date_end: string; reason: string | null }

  const calendarBlocks = (calendarBlockedResult.data ?? []) as Array<{
    id: string; calendar_id: string; date_start: string; date_end: string; reason: string | null
  }>

  const expandedCalendarBlocks: BlockedEntry[] = calendarBlocks.flatMap(block => {
    const blockExpIds = calendarExperienceMap[block.calendar_id] ?? []
    // In named-calendar view, filter to only the experiences currently shown
    const targetExpIds = activeCalendarId != null
      ? blockExpIds.filter(id => expIds.includes(id))
      : blockExpIds
    return targetExpIds.map(expId => ({
      id:            block.id,
      experience_id: expId,
      date_start:    block.date_start,
      date_end:      block.date_end,
      reason:        block.reason,
    }))
  })

  const blocked: BlockedEntry[] = expandedCalendarBlocks

  const bookings = (bookingsResult.data ?? []) as Array<{
    id: string; experience_id: string; booking_date: string; requested_dates: string[] | null; guests: number; status: string; angler_full_name: string | null
  }>

  // Normalize inquiry rows → CalendarGrid's InquiryEntry shape
  const inquiries = (inquiriesResult.data ?? [])
    .filter(r => r.booking_date != null)
    .map(r => ({
      id:               r.id,
      experience_id:    (r as unknown as { experience_id?: string | null }).experience_id ?? null,
      dates_from:       r.booking_date as string,
      dates_to:         (r as unknown as { date_to?: string | null }).date_to ?? (r.booking_date as string),
      requested_dates:  (r as unknown as { requested_dates?: string[] | null }).requested_dates ?? null,
      offer_date_from:  r.offer_date_from ?? null,
      offer_date_to:    r.offer_date_to ?? null,
      offer_days:       r.offer_days ?? null,
      angler_name:      (r as unknown as { angler_full_name?: string | null }).angler_full_name ?? 'Guest',
      group_size:       r.guests ?? 1,
      status:           r.status,
    }))

  const weeklySchedules = (weeklySchedulesResult.data ?? []) as WeeklySchedule[]

  // ── Stats (scoped to active calendar / all) ───────────────────────────────────
  const blockedDaysCount = blocked.reduce((acc, b) => {
    const start = new Date(b.date_start)
    const end   = new Date(b.date_end)
    return acc + Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  }, 0)

  const activeCalendarName = activeCalendarId != null
    ? (calendars.find(c => c.id === activeCalendarId)?.name ?? 'Calendar')
    : null

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10">

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            {activeCalendarName != null ? activeCalendarName : 'Availability Calendar'}
          </h1>
          <HelpWidget
            title="Availability Calendar"
            description="Block dates when you're unavailable — anglers won't see those days in the booking calendar."
            items={[
              { icon: '🚫', title: 'Blocking dates', text: 'Click a date and drag to block a range. Blocked dates become unavailable for all your direct-booking experiences.' },
              { icon: '📋', title: 'Calendars', text: 'Organise your experiences into separate calendars to manage availability for different trip types independently.' },
              { icon: '🔄', title: 'Disable calendar', text: 'Disabling the calendar switches all your trip pages to inquiry-only mode — anglers send a request instead of booking a specific date.' },
              { icon: '📅', title: 'Weekly schedule', text: 'Set recurring unavailability by weekday (e.g. Sundays off) within a date range — avoids blocking days one by one.' },
            ]}
          />
        </div>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          {activeCalendarName != null
            ? `Showing ${expIds.length} listing${expIds.length !== 1 ? 's' : ''} — block dates when you&apos;re unavailable.`
            : 'Block dates when you\'re unavailable — anglers won\'t see those days for booking.'}
        </p>
      </div>

      {/* ─── Calendar-disabled toggle ─────────────────────────────────────── */}
      {showCalendarToggle && (
        <div
          className="mb-6 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{
            background: '#FDFAF7',
            border: `1px solid ${calendarDisabled && hasClassicListing ? 'rgba(230,126,80,0.25)' : 'rgba(10,46,77,0.07)'}`,
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                Disable calendar
              </p>
              {calendarDisabled && (
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body"
                  style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
                >
                  Active
                </span>
              )}
            </div>
            {calendarDisabled && hasClassicListing ? (
              <p className="text-xs f-body leading-relaxed" style={{ color: '#C96030' }}>
                Calendar is disabled but you have a direct-booking listing — turn this off to restore the date picker on your trip pages.
              </p>
            ) : (
              <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.52)' }}>
                When enabled, trip pages show a{' '}
                <strong style={{ color: 'rgba(10,46,77,0.7)' }}>&quot;Request this trip&quot;</strong>
                {' '}button instead of the date picker.
                Anglers send an inquiry — you reply with a custom offer.
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <CalendarDisabledToggle currentlyDisabled={calendarDisabled} />
          </div>
        </div>
      )}

      {/* ─── Two-column layout: panel + calendar ──────────────────────────── */}
      <CalendarWrapper
        safeYear={safeYear}
        safeMonth={safeMonth}
        activeCalendarId={activeCalendarId}
        calendars={calendars}
        allExperiences={allExperiences}
        calendarExperienceMap={calendarExperienceMap}
        experiences={experiences}
        blocked={blocked}
        bookings={bookings}
        inquiries={inquiries}
        weeklySchedules={weeklySchedules}
        expIds={expIds}
        blockedCount={blocked.length}
        blockedDaysCount={blockedDaysCount}
        bookingsCount={bookings.length + inquiries.length}
        calendarDisabled={calendarDisabled}
      />
    </div>
  )
}
