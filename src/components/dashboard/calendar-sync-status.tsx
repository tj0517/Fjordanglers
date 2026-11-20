/**
 * FA-M.13 — what FjordAnglers sees of the guide's calendar: connected or not, the provider, whether
 * the sync works (ok / failing / disconnected) and when it last succeeded. Layout and copy follow
 * docs/design/fa-m-guide-app/Calendar.dc.html (the status card above the month grid).
 *
 * Pure render (no hooks), used on /dashboard/calendar and in the account's calendar card.
 */

import Link from 'next/link'
import type { CalendarStatus } from '@/lib/calendar/connections'
import { syncAge } from '@/lib/calendar/sync-age'

export function providerName(connection: CalendarStatus): string {
  return connection.provider === 'google' ? 'Google Calendar' : 'Apple Calendar'
}

type Tone = 'ok' | 'warn' | 'none'

const DOT: Record<Tone, string> = { ok: '#10B981', warn: '#DC2626', none: 'rgba(10,46,77,0.25)' }

export function CalendarSyncStatus({
  connection,
  manageHref,
  now,
}: {
  connection: CalendarStatus | null
  /** Where "Manage" / "Connect" leads; omitted where the actions are already on the page. */
  manageHref?: string
  /** For tests; defaults to the time of rendering. */
  now?: number
}) {
  const age = connection == null ? null : syncAge(connection.lastSyncedAt, now)
  const state: 'none' | CalendarStatus['status'] = connection == null ? 'none' : connection.status

  const tone: Tone = state === 'ok' ? 'ok' : state === 'none' ? 'none' : 'warn'
  const title =
    connection == null ? 'No calendar connected'
      : state === 'ok' ? `${providerName(connection)} connected`
      : state === 'error' ? `${providerName(connection)} — sync failing`
      : 'Google Calendar disconnected'
  const detail =
    connection == null ? 'FjordAnglers only knows the days you block here.'
      : state === 'ok' ? `Last sync ${age} · busy / free only`
      : state === 'error' ? `Last successful sync ${age}. Busy days from that sync are kept.`
      : `Google no longer lets FjordAnglers read it. Last successful sync ${age}; those busy days are kept.`

  return (
    <div
      className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
      data-testid="calendar-sync-status"
      data-status={state}
    >
      <span aria-hidden className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DOT[tone] }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold f-body" style={{ color: tone === 'warn' ? '#991B1B' : '#0A2E4D' }}>
          {title}
        </p>
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
          {connection?.lastSyncedAt != null
            ? <time dateTime={connection.lastSyncedAt}>{detail}</time>
            : detail}
        </p>
      </div>
      {manageHref != null && (
        <Link href={manageHref} className="text-xs font-semibold f-body flex-shrink-0 underline"
          style={{ color: '#0A2E4D' }}>
          {connection == null || state === 'disconnected' ? 'Connect' : 'Manage'}
        </Link>
      )}
    </div>
  )
}
