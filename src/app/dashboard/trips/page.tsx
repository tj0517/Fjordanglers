import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { guideRequestList, sessionGuide, type GuidePanelRequest } from '@/lib/guide-panel/queries'
import type { GuideRequestListStatus } from '@/lib/guide-requests/requests'

export const revalidate = 0

export const metadata = { title: 'Assignments — Guide Dashboard' }

/**
 * FA-M.13 — the guide's requests, newest first (docs/design/fa-m-guide-app/Requests.dc.html):
 * "Waiting for you" on top, answered below with their status. Source: the request records (FA-M.03)
 * plus assignments from before them (tj decision B, 2026-11-18). Answering happens on the trip page
 * through respondToAssignment, as before.
 */

const COUNTRY_FLAG: Record<string, string> = {
  PL: '🇵🇱', DE: '🇩🇪', FR: '🇫🇷', GB: '🇬🇧', NL: '🇳🇱',
  SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', DK: '🇩🇰', IS: '🇮🇸',
  CZ: '🇨🇿', SK: '🇸🇰', HU: '🇭🇺', AT: '🇦🇹', CH: '🇨🇭',
  US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺',
}

const STATUS: Record<GuideRequestListStatus, { label: string; bg: string; fg: string }> = {
  waiting:     { label: 'New',             bg: 'rgba(230,126,80,0.12)', fg: '#B4532A' },
  accepted:    { label: 'Accepted',        bg: 'rgba(16,185,129,0.1)',  fg: '#065F46' },
  other_dates: { label: 'Other dates',     bg: 'rgba(59,130,246,0.1)',  fg: '#1E40AF' },
  declined:    { label: 'Declined',        bg: 'rgba(10,46,77,0.07)',   fg: 'rgba(10,46,77,0.6)' },
  withdrawn:   { label: 'Withdrawn',       bg: 'rgba(10,46,77,0.07)',   fg: 'rgba(10,46,77,0.6)' },
  closed:      { label: 'No longer open',  bg: 'rgba(10,46,77,0.07)',   fg: 'rgba(10,46,77,0.6)' },
}

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return ''
  return dates.slice(0, 2).map(fmtDay).join(', ') + (dates.length > 2 ? ` +${dates.length - 2} more` : '')
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function GuideRequestsPage() {
  const me = await sessionGuide()
  if (me.kind === 'signed_out') redirect('/login')
  // The layout shows the no-listing notice before this page renders; this is a fallback.
  if (me.kind === 'no_listing') notFound()

  const requests = await guideRequestList(me.guideId)
  const waiting  = requests.filter(r => r.status === 'waiting')
  const answered = requests.filter(r => r.status === 'accepted' || r.status === 'declined' || r.status === 'other_dates')
  const closed   = requests.filter(r => r.status === 'withdrawn' || r.status === 'closed')

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl">

      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Assignments
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Trips FjordAnglers asked you about, newest first
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center" data-testid="requests-empty"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-base font-semibold f-body" style={{ color: '#0A2E4D' }}>
            No requests yet
          </p>
          <p className="text-sm f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
            When FjordAnglers asks you about a trip, it shows up here and on WhatsApp.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {waiting.length > 0 && (
            <Section title={`Waiting for you · ${waiting.length}`}>
              {waiting.map((r, i) => <RequestCard key={r.inquiryId} request={r} primary={i === 0} />)}
            </Section>
          )}
          {answered.length > 0 && (
            <Section title="Answered">
              {answered.map(r => <RequestCard key={r.inquiryId} request={r} />)}
            </Section>
          )}
          {closed.length > 0 && (
            <Section title="No longer open">
              {closed.map(r => <RequestCard key={r.inquiryId} request={r} />)}
            </Section>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold f-body mb-2.5"
        style={{ color: 'rgba(10,46,77,0.45)' }}>
        {title}
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  )
}

function RequestCard({ request: r, primary = false }: { request: GuidePanelRequest; primary?: boolean }) {
  const flag   = COUNTRY_FLAG[r.anglerCountry ?? ''] ?? ''
  const status = STATUS[r.status]
  const dates  = fmtDates(r.requestedDates)
  const body = (
    <div className="rounded-2xl px-4 py-3.5"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold f-body truncate" style={{ color: '#0A2E4D' }}>
            {flag !== '' && <span className="mr-1.5">{flag}</span>}
            {r.anglerName}
          </p>
          {r.experienceName != null && (
            <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>{r.experienceName}</p>
          )}
        </div>
        <span data-testid="request-status" data-status={r.status}
          className="text-[11px] font-bold f-body px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: status.bg, color: status.fg }}>
          {status.label}
        </span>
      </div>
      <p className="text-xs f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
        {[dates, `${r.partySize} ${r.partySize === 1 ? 'angler' : 'anglers'}`].filter(Boolean).join(' · ')}
      </p>
      {r.status === 'other_dates' && r.altDates.length > 0 && (
        <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.6)' }}>
          You offered {r.altDates.map(fmtDay).join(', ')}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 mt-2.5">
        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
          Asked {timeAgo(r.askedAt)}
        </span>
        {r.status === 'waiting' && (
          <span className="text-xs font-bold f-body px-3.5 py-2 rounded-xl"
            style={primary
              ? { background: '#E67E50', color: '#0A2E4D' }
              : { background: 'transparent', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.25)' }}>
            Answer now
          </span>
        )}
      </div>
    </div>
  )
  return (
    <li data-testid="request-row" data-inquiry-id={r.inquiryId}>
      {r.canOpen
        ? <Link href={`/dashboard/trips/${r.inquiryId}`} style={{ textDecoration: 'none' }}>{body}</Link>
        : body}
    </li>
  )
}
