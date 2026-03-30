'use client'

/**
 * CalendarWrapper — client shell for the two-column calendar layout.
 *
 * Owns navigation for calendar switching so that the right column
 * (stats + CalendarGrid) shows a loading overlay while the Server Component
 * re-fetches data for the new ?calendarId param.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Calendar } from 'lucide-react'
import CalendarsPanel from '@/components/dashboard/calendars-panel'
import CalendarGrid from '@/components/dashboard/calendar-grid'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import type { GuideCalendar } from '@/actions/calendars'
import type { WeeklySchedule } from '@/actions/weekly-schedules'
import type { CalendarGridProps } from '@/components/dashboard/calendar-grid'

// ─── Types mirrored from page.tsx ──────────────────────────────────────────────

type Experience = { id: string; title: string; published: boolean; booking_type: string | null }

type BlockedEntry = {
  id: string; experience_id: string; date_start: string; date_end: string; reason: string | null
}
type BookingEntry = {
  id: string; experience_id: string; booking_date: string; guests: number; status: string; angler_full_name: string | null
}
type InquiryEntry = {
  id: string; dates_from: string; dates_to: string
  offer_date_from: string | null; offer_date_to: string | null
  angler_name: string; group_size: number; status: string
}

// Use CalendarGridProps to ensure experiences type matches exactly
type GridExperience = CalendarGridProps['experiences'][number]

interface Props {
  // Navigation context
  safeYear:          number
  safeMonth:         number
  activeCalendarId:  string | null

  // CalendarsPanel data
  calendars:              GuideCalendar[]
  allExperiences:         Experience[]
  calendarExperienceMap:  Record<string, string[]>

  // CalendarGrid data
  experiences:      GridExperience[]
  blocked:          BlockedEntry[]
  bookings:         BookingEntry[]
  inquiries:        InquiryEntry[]
  weeklySchedules:  WeeklySchedule[]

  // Stats
  expIds:            string[]
  blockedCount:      number
  blockedDaysCount:  number
  bookingsCount:     number

  // Disabled overlay
  calendarDisabled: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CalendarWrapper({
  safeYear, safeMonth, activeCalendarId,
  calendars, allExperiences, calendarExperienceMap,
  experiences, blocked, bookings, inquiries, weeklySchedules,
  expIds, blockedCount, blockedDaysCount, bookingsCount,
  calendarDisabled,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function navigate(calendarId: string | null) {
    const params = new URLSearchParams({
      year:  String(safeYear),
      month: String(safeMonth),
    })
    if (calendarId != null) params.set('calendarId', calendarId)
    startTransition(() => {
      router.push(`/dashboard/calendar?${params}`, { scroll: false })
    })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

      {/* ── Left: Calendars panel ──────────────────────────────────────────── */}
      <div className="lg:w-56 flex-shrink-0">
        <CalendarsPanel
          calendars={calendars}
          allExperiences={allExperiences}
          calendarExperienceMap={calendarExperienceMap}
          activeCalendarId={activeCalendarId}
          currentYear={safeYear}
          currentMonth={safeMonth}
          onNavigate={navigate}
        />
      </div>

      {/* ── Right: Stats + Calendar grid ──────────────────────────────────── */}
      <div className="relative flex-1 min-w-0">

        {/* Loading overlay — shown while switching calendars */}
        {isPending && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center"
            style={{ background: 'rgba(243,237,228,0.7)', backdropFilter: 'blur(2px)' }}
          >
            <Loader2 className="animate-spin" size={32} style={{ color: '#E67E50' }} />
          </div>
        )}

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
              value: String(blockedCount),
              sub:   `${blockedDaysCount} day${blockedDaysCount !== 1 ? 's' : ''} this month`,
            },
            {
              label: 'Bookings this month',
              value: String(bookingsCount),
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
                <Calendar size={20} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.45)' }} />
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
                <Calendar size={20} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.4)' }} />
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
  )
}
