import { redirect, notFound } from 'next/navigation'
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar'
import { CalendarSyncStatus } from '@/components/dashboard/calendar-sync-status'
import { guideCalendarPreview, sessionGuide } from '@/lib/guide-panel/queries'

export const revalidate = 0

export const metadata = { title: 'Calendar — FjordAnglers Dashboard' }

/**
 * FA-M.13 — what FjordAnglers sees before asking the guide (docs/design/fa-m-guide-app/Calendar.dc.html):
 * the connection status, busy days by source (calendar / blocked by hand) and manual blocking as before.
 * `?google=connected|denied|error` is where "Connect Google Calendar" from the account returns
 * (FA-M.10 callback, session entry).
 */
const GOOGLE_RETURN: Record<string, { text: string; ok: boolean }> = {
  connected: { ok: true,  text: 'Google Calendar connected. FjordAnglers now sees your busy days — never the event titles.' },
  denied:    { ok: false, text: 'Google Calendar was not connected — access wasn’t granted on Google’s page. You can try again from Settings.' },
  error:     { ok: false, text: 'Something went wrong connecting Google Calendar. Try again from Settings, or message us on WhatsApp.' },
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await sessionGuide()
  if (me.kind === 'signed_out') redirect('/login?next=/dashboard/calendar')
  // The layout shows the no-listing notice before this page renders; this is a fallback.
  if (me.kind === 'no_listing') notFound()

  const [{ google }, { busyDays, connection }] = await Promise.all([searchParams, guideCalendarPreview(me.guideId)])
  const googleReturn = google != null ? GOOGLE_RETURN[google] : undefined

  const manualDates   = busyDays.filter(d => d.sources.includes('manual')).map(d => d.date)
  const calendarDates = busyDays.filter(d => d.sources.includes('calendar')).map(d => d.date)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10">

      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Calendar
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          What FjordAnglers sees before asking you.
        </p>
      </div>

      {googleReturn != null && (
        <p role="status" data-testid="google-return" data-ok={googleReturn.ok}
          className="text-sm f-body rounded-2xl px-4 py-3 mb-4"
          style={googleReturn.ok
            ? { background: 'rgba(16,185,129,0.08)', color: '#065F46', border: '1px solid rgba(16,185,129,0.25)' }
            : { background: 'rgba(239,68,68,0.06)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }}>
          {googleReturn.text}
        </p>
      )}

      <div className="mb-5 max-w-xl">
        <CalendarSyncStatus connection={connection} manageHref="/dashboard/account#calendar" />
      </div>

      <AvailabilityCalendar initialDates={manualDates} calendarDates={calendarDates} />

      <p className="text-xs f-body mt-5" style={{ color: 'rgba(10,46,77,0.45)' }}>
        We never see event titles. A free day still needs your yes.
      </p>

    </div>
  )
}
