'use client'

/**
 * FA-M.09 — a guide's calendar on the inquiry card: connected or not, the host (never the link),
 * the last successful sync, a failing sync, and the one-time "Connect with your calendar" link to
 * copy and send on WhatsApp. The link is shown once, right after it is created — only its sha256
 * is stored; a new link revokes the guide's unused one.
 *
 * FA-M.10: a Google calendar shows as "Google Calendar"; "disconnected" means Google refused FA's
 * access (the guide revoked it, or it expired) — busy days stay until the guide disconnects.
 */

import { useState, useTransition } from 'react'
import { Check, Copy, Link2, Loader2 } from 'lucide-react'
import { issueCalendarConnectLink } from '@/actions/calendar'
import type { CalendarStatus } from '@/lib/calendar/connections'
import { syncAge } from '@/lib/calendar/sync-age'

const ERROR_TEXT: Record<string, string> = {
  not_found:          'calendar link no longer works',
  http_error:         'calendar refused the request',
  timeout:            'calendar did not answer',
  network:            'calendar could not be reached',
  too_large:          'calendar too large',
  blocked_address:    'link points somewhere FA does not fetch',
  too_many_redirects: 'link redirects too often',
  not_a_calendar:     'link no longer returns a calendar',
  decrypt_failed:     'stored link unreadable — ask the guide to reconnect',
  insufficient_scope: 'Google calendar permission missing — ask the guide to reconnect',
  bad_response:       'Google sent an unexpected answer',
}

export function CalendarConnectStatus({ guideId, calendar }: { guideId: string; calendar: CalendarStatus | null }) {
  const [pending, start] = useTransition()
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function issue() {
    setError(null)
    start(async () => {
      const res = await issueCalendarConnectLink(guideId)
      if (!res.success) { setError(res.error); return }
      setLink({ url: res.link, expiresAt: res.expiresAt })
      setCopied(false)
    })
  }

  async function copy() {
    if (link == null) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      setError('Copy failed — select the link and copy it by hand.')
    }
  }

  return (
    <div className="mt-1 space-y-1" data-testid="guide-calendar-status">
      <p className="text-[11px] f-body text-primary/55">
        {calendar == null ? (
          <>No calendar connected</>
        ) : calendar.status === 'disconnected' ? (
          <span className="text-red-700" data-testid="guide-calendar-disconnected">
            Google Calendar disconnected — the guide removed FjordAnglers&apos; access · last good sync {syncAge(calendar.lastSyncedAt)} · busy days kept
          </span>
        ) : calendar.status === 'ok' ? (
          <>Calendar · {calendar.provider === 'google' ? 'Google Calendar' : calendar.host} · synced {syncAge(calendar.lastSyncedAt)}</>
        ) : (
          <span className="text-red-700">
            Calendar sync failing ({ERROR_TEXT[calendar.lastError ?? ''] ?? calendar.lastError}) · last good sync {syncAge(calendar.lastSyncedAt)}
          </span>
        )}
        {' · '}
        <button type="button" onClick={issue} disabled={pending}
          className="inline-flex items-center gap-1 font-semibold underline text-primary/80 disabled:opacity-50">
          {pending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Link2 size={11} aria-hidden />}
          {calendar == null ? 'Create calendar link' : 'New calendar link'}
        </button>
      </p>
      {link != null && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] f-body">
          <input readOnly value={link.url} aria-label="Calendar connect link"
            className="basis-full min-w-0 rounded-md px-2 py-1 bg-primary/5 text-primary" onFocus={e => e.currentTarget.select()} />
          <button type="button" onClick={copy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">
            {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="text-primary/45 whitespace-nowrap">
            works once · until {new Date(link.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}
      {error != null && <p className="text-[11px] f-body text-red-700" role="alert">{error}</p>}
    </div>
  )
}
