'use client'

/**
 * FA-M.13 — "Connect your calendar" in the guide's account (copy from
 * docs/design/fa-m-guide-app/Connect.dc.html). Three actions, all checked server-side against the
 * signed-in guide (requireGuide):
 *   * Google → startGoogleCalendarConnect (FA-M.10); Google returns to /dashboard/calendar?google=…
 *   * Apple  → startAppleCalendarConnect: a fresh one-time link, then the same /connect-calendar page
 *              as the WhatsApp link (tj decision A, 2026-11-18)
 *   * Disconnect → disconnectCalendar (FA-M.10)
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { disconnectCalendar, startAppleCalendarConnect, startGoogleCalendarConnect } from '@/actions/calendar'
import { CalendarSyncStatus, providerName } from '@/components/dashboard/calendar-sync-status'
import type { CalendarStatus } from '@/lib/calendar/connections'

type Busy = 'google' | 'apple' | 'disconnect' | null

export function CalendarConnectCard({
  guideId,
  connection,
  googleAvailable,
  appleAvailable,
}: {
  guideId: string
  connection: CalendarStatus | null
  googleAvailable: boolean
  appleAvailable: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function google() {
    setError(null); setBusy('google')
    start(async () => {
      const res = await startGoogleCalendarConnect()
      if (!res.success) { setError(res.error); setBusy(null); return }
      window.location.assign(res.url)
    })
  }

  function apple() {
    setError(null); setBusy('apple')
    start(async () => {
      // On success the server redirects to the connect page; only a failure comes back here.
      const res = await startAppleCalendarConnect(guideId)
      setError(res.error); setBusy(null)
    })
  }

  function disconnect() {
    setError(null); setBusy('disconnect')
    start(async () => {
      const res = await disconnectCalendar(guideId)
      setBusy(null); setConfirming(false)
      if (!res.success) { setError(res.error); return }
      router.refresh()
    })
  }

  const connected = connection != null
  const salmonOnGoogle = !connected

  return (
    <div className="px-6 py-4 flex flex-col gap-4" data-testid="calendar-connect">
      <div>
        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
          Stop getting asked about days you&apos;re booked
        </p>
        <p className="text-sm f-body leading-relaxed mt-1" style={{ color: 'rgba(10,46,77,0.6)' }}>
          Your calendar stays yours. We only read when you&apos;re busy — no titles, no details. You still confirm every request.
        </p>
      </div>

      <CalendarSyncStatus connection={connection} />

      <div className="flex flex-col gap-2">
        <button type="button" onClick={google} disabled={pending || !googleAvailable}
          className="w-full py-3 rounded-xl text-sm font-bold f-body inline-flex items-center justify-center gap-2 disabled:opacity-50"
          style={salmonOnGoogle
            ? { background: '#E67E50', color: '#0A2E4D' }
            : { background: 'transparent', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.25)' }}>
          {busy === 'google' && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {connection?.provider === 'google' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </button>
        <button type="button" onClick={apple} disabled={pending || !appleAvailable}
          className="w-full py-3 rounded-xl text-sm font-bold f-body inline-flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'transparent', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.25)' }}>
          {busy === 'apple' && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Apple Calendar (iCloud)
        </button>
        {(!googleAvailable || !appleAvailable) && (
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {!googleAvailable && !appleAvailable
              ? 'Connecting a calendar isn’t available right now — block days in Calendar, or message us on WhatsApp.'
              : !googleAvailable ? 'Google Calendar isn’t available right now.' : 'Apple Calendar isn’t available right now.'}
          </p>
        )}
        {connected && (
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Connecting another calendar replaces {providerName(connection)}.
          </p>
        )}
      </div>

      {connected && (
        <div className="pt-1" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <p className="text-xs f-body w-full" style={{ color: 'rgba(10,46,77,0.6)' }}>
                Disconnect {providerName(connection)}? FjordAnglers stops reading it and its busy days are removed. Days you blocked here stay.
              </p>
              <button type="button" onClick={disconnect} disabled={pending}
                className="text-xs font-bold f-body px-3 py-2 rounded-xl inline-flex items-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.25)' }}>
                {busy === 'disconnect' && <Loader2 size={12} className="animate-spin" aria-hidden />}
                Yes, disconnect
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={pending}
                className="text-xs f-body px-2" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={pending}
              className="text-xs font-semibold f-body underline pt-3" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Disconnect calendar
            </button>
          )}
        </div>
      )}

      {error != null && <p className="text-xs f-body" role="alert" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}
