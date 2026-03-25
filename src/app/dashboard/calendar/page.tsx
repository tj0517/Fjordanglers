import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import CalendarGrid from '@/components/dashboard/calendar-grid'
import CalendarsPanel from '@/components/dashboard/calendars-panel'
import { getGuideCalendars, getCalendarExperienceMap } from '@/actions/calendars'
import { CalendarDisabledToggle } from '@/components/dashboard/calendar-disabled-toggle'
import type { WeeklySchedule } from '@/actions/weekly-schedules'

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
  const blockedQuery = expIds.length > 0
    ? supabase
        .from('experience_blocked_dates')
        .select('id, experience_id, date_start, date_end, reason')
        .in('experience_id', expIds)
        .lte('date_start', lastDay)
        .gte('date_end', firstDay)
        .order('date_start')
    : null

  // ── Bookings in the viewed month ─────────────────────────────────────────────
  const bookingsQuery = expIds.length > 0
    ? supabase
        .from('bookings')
        .select('id, experience_id, booking_date, guests, status, angler_full_name')
        .in('experience_id', expIds)
        .gte('booking_date', firstDay)
        .lte('booking_date', lastDay)
        .in('status', ['pending', 'confirmed', 'accepted'])
        .order('booking_date')
    : null

  // ── Trip inquiries assigned to this guide, overlapping the viewed month ──────
  // Service client needed — RLS blocks user-scoped reads on trip_inquiries
  const serviceClient = createServiceClient()
  const inquiriesQuery = serviceClient
    .from('trip_inquiries')
    .select('id, dates_from, dates_to, offer_date_from, offer_date_to, angler_name, group_size, status')
    .eq('assigned_guide_id', guide.id)
    .neq('status', 'cancelled')
    .lte('dates_from', lastDay)
    .gte('dates_to', firstDay)
    .order('dates_from')

  // ── Weekly schedules ─────────────────────────────────────────────────────────
  const weeklySchedulesQuery = supabase
    .from('guide_weekly_schedules')
    .select('id, guide_id, label, period_from, period_to, blocked_weekdays, created_at')
    .eq('guide_id', guide.id)
    .order('period_from')

  const [blockedResult, bookingsResult, inquiriesResult, weeklySchedulesResult] = await Promise.all([
    blockedQuery  ?? Promise.resolve({ data: [] }),
    bookingsQuery ?? Promise.resolve({ data: [] }),
    inquiriesQuery,
    weeklySchedulesQuery,
  ])

  const blocked = (blockedResult.data ?? []) as Array<{
    id: string; experience_id: string; date_start: string; date_end: string; reason: string | null
  }>
  const bookings = (bookingsResult.data ?? []) as Array<{
    id: string; experience_id: string; booking_date: string; guests: number; status: string; angler_full_name: string | null
  }>
  const inquiries = (inquiriesResult.data ?? []) as Array<{
    id: string; dates_from: string; dates_to: string
    offer_date_from: string | null; offer_date_to: string | null
    angler_name: string; group_size: number; status: string
  }>
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
        <h1 className="text-3xl font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
          {activeCalendarName != null ? activeCalendarName : 'Availability Calendar'}
        </h1>
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
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

        {/* ── Left: Calendars panel ─────────────────────────────────────── */}
        <div className="lg:w-56 flex-shrink-0">
          <CalendarsPanel
            calendars={calendars}
            allExperiences={allExperiences}
            calendarExperienceMap={calendarExperienceMap}
            activeCalendarId={activeCalendarId}
            currentYear={safeYear}
            currentMonth={safeMonth}
          />
        </div>

        {/* ── Right: Stats + Calendar grid ──────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              {
                label: activeCalendarId != null ? 'Listings in view' : 'Trips',
                value: String(expIds.length),
                sub:   expIds.length === 1 ? 'managed trip' : 'managed trips',
              },
              {
                label: 'Blocked periods',
                value: String(blocked.length),
                sub:   `${blockedDaysCount} day${blockedDaysCount !== 1 ? 's' : ''} this month`,
              },
              {
                label: 'Bookings this month',
                value: String(bookings.length + inquiries.length),
                sub:   `${bookings.length} bookings · ${inquiries.length} requests`,
              },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl px-4 py-3"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  opacity: calendarDisabled ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>
                  {s.label}
                </p>
                <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>{s.value}</p>
                <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Disabled overlay wrapper */}
          <div className="relative">

            {/* Gray overlay when calendar is disabled */}
            {calendarDisabled && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl text-center px-6 gap-3"
                style={{
                  background: 'rgba(243,237,228,0.82)',
                  backdropFilter: 'blur(3px)',
                  WebkitBackdropFilter: 'blur(3px)',
                  border: '1.5px dashed rgba(10,46,77,0.18)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="rgba(10,46,77,0.45)" strokeWidth="1.5">
                    <rect x="3" y="4" width="14" height="12" rx="2" />
                    <line x1="3" y1="8.5" x2="17" y2="8.5" />
                    <line x1="7" y1="2" x2="7" y2="6" />
                    <line x1="13" y1="2" x2="13" y2="6" />
                    <line x1="6" y1="13" x2="14" y2="13" strokeOpacity="0.4" />
                    <line x1="6" y1="11" x2="14" y2="11" strokeOpacity="0.4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                    Calendar disabled
                  </p>
                  <p className="text-xs f-body mt-1 max-w-xs mx-auto" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    Your trip pages show a &ldquo;Request this trip&rdquo; button instead of the date picker.
                    Turn off the toggle above to re-enable direct booking.
                  </p>
                </div>
              </div>
            )}

            {/* Empty state when calendar has no experiences assigned */}
            {activeCalendarId != null && expIds.length === 0 ? (
              <div
                className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
                style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(10,46,77,0.4)" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                  </svg>
                </div>
                <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
                  No listings assigned
                </p>
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  Click the pencil icon next to this calendar to assign listings.
                </p>
              </div>
            ) : (
              <CalendarGrid
                year={safeYear}
                month={safeMonth}
                experiences={experiences}
                blocked={blocked}
                bookings={bookings}
                inquiries={inquiries}
                calendarMode="shared"
                weeklySchedules={weeklySchedules}
                calendarExperienceMap={calendarExperienceMap}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
