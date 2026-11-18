'use client'

/**
 * The "Connect your calendar" panel (FA-M.09, mock-up Connect.dc.html). Google (FA-M.10): the button
 * asks the server for Google's consent URL and sends the browser there; Google sends the guide back to
 * /connect-calendar/done. Apple takes the calendar's share link, which the server validates and
 * fetches once before storing it (encrypted). The link the guide types never leaves this form
 * except to the server action — it is not put into the URL, storage or analytics.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, ChevronRight } from 'lucide-react'
import { connectCalendar, startGoogleFromLink, type ConnectPageOutcome } from './actions'

const NAVY = '#0A2E4D'
const MUTED = '#4A5F73'
const SALMON = '#E67E50'
const BORDER = '#C9D3DC'
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '48698936563'
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi FjordAnglers, I need help connecting my calendar.')}`

/** What the guide reads for each outcome that is not a success. */
function problem(outcome: ConnectPageOutcome): string | null {
  switch (outcome.kind) {
    case 'connected':
    case 'refused':
      return null
    case 'invalid_link':
      return 'That doesn’t look like a calendar link. It starts with webcal:// or https:// — copy it again from the Calendar app.'
    case 'not_a_calendar':
      return 'That link opens a web page, not a calendar. Copy the Share Link from the Calendar app.'
    case 'disabled':
      return 'Connecting calendars isn’t available right now. Write to us on WhatsApp and we’ll sort it out.'
    case 'error':
      return 'Something went wrong on our side. Try again in a minute.'
    case 'fetch_failed':
      switch (outcome.error) {
        case 'not_found':
        case 'http_error':
          return 'We couldn’t open that calendar. Check that Public Calendar is still on, then copy the link again.'
        case 'timeout':
        case 'network':
          return 'Your calendar didn’t answer in time. Try again in a minute.'
        case 'too_large':
          return 'That calendar is too big for us to read. Write to us on WhatsApp.'
        case 'invalid_url':
        case 'blocked_address':
        case 'too_many_redirects':
          return 'We can’t use that link. Copy the Share Link from the Calendar app and paste it here.'
      }
  }
}

const GOOGLE_PROBLEM = {
  disabled: 'Google Calendar isn’t available right now. Use the Apple steps below or write to us on WhatsApp.',
  error: 'Something went wrong on our side. Try again in a minute.',
} as const

export function ConnectPanel({ token, available, googleAvailable }: { token: string; available: boolean; googleAvailable: boolean }) {
  const [link, setLink] = useState('')
  const [outcome, setOutcome] = useState<ConnectPageOutcome | null>(available ? null : { kind: 'disabled' })
  const [pending, start] = useTransition()
  const [googlePending, startGoogle] = useTransition()
  const [googleProblem, setGoogleProblem] = useState<string | null>(null)

  function connectGoogle() {
    if (googlePending || !googleAvailable) return
    setGoogleProblem(null)
    startGoogle(async () => {
      const res = await startGoogleFromLink(token)
      if (res.kind === 'redirect') window.location.assign(res.url)
      else if (res.kind === 'refused') setOutcome({ kind: 'refused', reason: 'not_found' })
      else setGoogleProblem(GOOGLE_PROBLEM[res.kind])
    })
  }

  if (outcome?.kind === 'refused') {
    return (
      <div className="text-center py-12 f-body" data-testid="connect-calendar-invalid">
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: NAVY }}>This link no longer works</h1>
        <p className="text-base mb-6" style={{ color: MUTED }}>Write to us on WhatsApp and we’ll send a new one.</p>
        <a href={WHATSAPP_HREF} rel="noopener noreferrer" target="_blank" className="font-semibold underline" style={{ color: NAVY }}>
          Write to us on WhatsApp
        </a>
      </div>
    )
  }

  if (outcome?.kind === 'connected') {
    return (
      <div className="py-10 f-body" data-testid="connect-calendar-done">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(10,46,77,0.07)' }}>
          <Check size={24} color={NAVY} aria-hidden />
        </div>
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: NAVY }}>Calendar connected</h1>
        <p className="text-base mb-2" style={{ color: MUTED }}>
          {outcome.busyDays === 0
            ? 'No busy days in the next 12 months.'
            : `${outcome.busyDays} busy ${outcome.busyDays === 1 ? 'day' : 'days'} in the next 12 months.`}
        </p>
        <p className="text-base" style={{ color: MUTED }}>
          We check your calendar every few hours. You still confirm every request.
        </p>
      </div>
    )
  }

  const message = outcome == null ? null : problem(outcome)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending || !available) return
    setOutcome(null)
    start(async () => setOutcome(await connectCalendar(token, link)))
  }

  return (
    <div className="flex flex-col gap-5 f-body" style={{ color: NAVY }}>
      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(10,46,77,0.6)' }}>
        FjordAnglers · Connect your calendar
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold f-display leading-tight">Stop getting asked about days you’re booked</h1>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Your calendar stays yours. We only read when you’re busy — no titles, no details. You still confirm every request.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={connectGoogle} disabled={!googleAvailable || googlePending}
          data-testid="connect-google"
          className="h-14 rounded-2xl px-4 flex items-center gap-3 text-base font-semibold disabled:cursor-not-allowed"
          style={{ border: `1.5px solid ${googleAvailable ? NAVY : BORDER}`, background: '#FFFFFF', color: googleAvailable ? NAVY : 'rgba(10,46,77,0.45)' }}>
          <CalendarDays size={22} aria-hidden />
          <span className="flex-1 text-left">{googlePending ? 'Opening Google…' : 'Connect Google Calendar'}</span>
          {googleAvailable
            ? <ChevronRight size={18} aria-hidden />
            : <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: 'rgba(10,46,77,0.07)', color: MUTED }}>Unavailable</span>}
        </button>
        {googleProblem != null && (
          <p role="alert" className="text-sm leading-snug" style={{ color: '#9A3F1C' }}>{googleProblem}</p>
        )}
      </div>

      <form onSubmit={submit} className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ background: '#FFFFFF', border: `1.5px solid ${NAVY}` }}>
        <div className="flex items-center gap-3">
          <CalendarDays size={22} aria-hidden />
          <h2 className="flex-1 text-base font-semibold">Apple Calendar (iCloud)</h2>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>On iPhone</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-2 text-sm leading-snug">
            <li>Open the Calendar app and tap <strong>Calendars</strong>.</li>
            <li>Tap the <strong>info</strong> icon next to your work calendar.</li>
            <li>Turn on <strong>Public Calendar</strong>, then <strong>Share Link</strong> → Copy.</li>
            <li>Paste it below.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>On Mac</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-2 text-sm leading-snug">
            <li>Open Calendar and Control-click your work calendar in the sidebar.</li>
            <li>Choose <strong>Share Calendar…</strong> and tick <strong>Public Calendar</strong>.</li>
            <li>Copy the link that appears and paste it below.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="calendar-link" className="text-sm font-semibold">Calendar link</label>
          <input id="calendar-link" name="calendar-link" type="url" inputMode="url" required
            autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder="webcal://p…-caldav.icloud.com/…"
            value={link} onChange={e => setLink(e.target.value)} disabled={!available}
            aria-invalid={message != null} aria-describedby={message != null ? 'calendar-link-error' : undefined}
            className="h-12 rounded-xl px-3.5 text-sm"
            style={{ border: `1.5px solid ${message != null ? '#B4532A' : BORDER}`, background: '#F8FAFB', color: NAVY }} />
          {message != null && (
            <p id="calendar-link-error" role="alert" className="text-sm leading-snug" style={{ color: '#9A3F1C' }}>
              {message}
            </p>
          )}
        </div>

        <button type="submit" disabled={pending || !available}
          className="h-[50px] rounded-xl text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: SALMON, color: NAVY }}>
          {pending ? 'Checking your calendar…' : 'Connect'}
          {!pending && <ChevronRight size={18} aria-hidden />}
        </button>
      </form>

      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
        Using FishingBooker or something else?{' '}
        <Link href="/dashboard/calendar" className="font-semibold underline" style={{ color: NAVY }}>Block days manually</Link>{' '}
        or <a href={WHATSAPP_HREF} rel="noopener noreferrer" target="_blank" className="font-semibold underline" style={{ color: NAVY }}>message us on WhatsApp</a>.
      </p>
    </div>
  )
}
