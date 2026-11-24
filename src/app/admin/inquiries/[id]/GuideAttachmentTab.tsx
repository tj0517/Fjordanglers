'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setExternalOffer } from '@/actions/inquiries'
import { sendGuideRequest, detachGuideWithoutRequestAction } from '@/actions/guide-requests'
import type { InquiryGuideRequest } from '@/lib/guide-requests/requests'
import { GuideRequestTimeline } from './GuideRequestTimeline'
import type { CalendarStatus } from '@/lib/calendar/connections'
import { CalendarConnectStatus } from './CalendarConnectStatus'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuideWithCalendar {
  id:           string
  full_name:    string
  avatar_url:   string | null
  country:      string | null
  blockedDates: string[]  // ISO dates from guide_unavailable_dates, any source
  calendarDates: string[] // FA-M.09: of those, busy in the guide's connected calendar
  manualDates:  string[]  // FA-M.09: of those, blocked by hand
  calendar:     CalendarStatus | null
}

interface Props {
  inquiryId:              string
  currentAssignedGuideId: string | null
  guides:                 GuideWithCalendar[]
  requestedDates:         string[]   // ISO dates the angler requested
  tripCountry:            string | null
  guideAcceptance:        string | null  // 'accepted' | 'declined' | 'other_dates' | null
  guideDeclineReason:     string | null
  externalOfferSent:      boolean
  /** FA-M.05: every request sent for this inquiry, newest first. */
  requests:               InquiryGuideRequest[]
}

// ─── Mini read-only calendar ──────────────────────────────────────────────────

function MiniCalendar({
  blockedDates,
  calendarDates,
  manualDates,
  requestedDates,
}: {
  blockedDates:   string[]
  calendarDates:  string[]
  manualDates:    string[]
  requestedDates: string[]
}) {
  const blockedSet   = useMemo(() => new Set(blockedDates),   [blockedDates])
  const calendarSet  = useMemo(() => new Set(calendarDates),  [calendarDates])
  const manualSet    = useMemo(() => new Set(manualDates),    [manualDates])
  const requestedSet = useMemo(() => new Set(requestedDates), [requestedDates])

  // Start on the month of the first requested date, or current month
  const startDate = requestedDates[0]
    ? new Date(requestedDates[0] + 'T00:00:00')
    : new Date()

  const [year,  setYear]  = useState(startDate.getFullYear())
  const [month, setMonth] = useState(startDate.getMonth() + 1)

  const today = new Date().toISOString().slice(0, 10)

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  function isoDate(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const offset  = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const numDays = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ]
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const hasConflicts = requestedDates.some(d => blockedSet.has(d))

  return (
    <div className="rounded-2xl overflow-hidden mt-4 bg-[#FDFAF7] border border-primary/[8%]">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/7">
        <button
          type="button"
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-primary/40 bg-primary/5"
          aria-label="Previous month"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-bold f-body text-primary">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-primary/40 bg-primary/5"
          aria-label="Next month"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 px-3 pt-2 pb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold f-body text-primary/[28%]">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const iso         = isoDate(year, month, day)
          const isBlocked   = blockedSet.has(iso)
          const isRequested = requestedSet.has(iso)
          const isConflict  = isBlocked && isRequested
          const isPast      = iso < today
          // FA-M.09: where a busy day comes from — the guide's calendar, a manual block, or both.
          const source = calendarSet.has(iso) && manualSet.has(iso) ? 'both'
            : calendarSet.has(iso) ? 'calendar'
            : manualSet.has(iso)   ? 'manual'
            : undefined
          const sourceLabel = source === 'both' ? 'Busy in calendar and blocked by guide'
            : source === 'calendar' ? 'Busy in calendar'
            : source === 'manual'   ? 'Blocked by guide'
            : undefined

          const state = isConflict ? 'conflict'
            : isRequested          ? 'requested'
            : isBlocked            ? 'blocked'
            : isPast               ? 'past'
            : undefined

          return (
            <div
              key={iso}
              data-state={state}
              data-source={isBlocked ? source : undefined}
              title={isBlocked ? sourceLabel : undefined}
              aria-label={isBlocked && sourceLabel != null ? `${iso}: ${sourceLabel}` : undefined}
              className="cal-day h-7 flex items-center justify-center rounded-lg text-[11px] f-body border border-transparent"
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-3 pb-3 flex flex-wrap gap-3 border-t border-primary/[6%]">
        {requestedDates.length > 0 && (
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-sm bg-accent/15 border border-accent/40" />
            <span className="text-[9px] f-body text-primary/45">Requested date</span>
          </div>
        )}
        <div className="flex items-center gap-1 pt-2">
          <div className="w-2 h-2 rounded-sm bg-primary/[6%]" />
          <span className="text-[9px] f-body text-primary/45">Blocked by guide</span>
        </div>
        {calendarDates.length > 0 && (
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-sm cal-legend-calendar" />
            <span className="text-[9px] f-body text-primary/45">Busy in calendar</span>
          </div>
        )}
        {hasConflicts && (
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-sm bg-red-500/15 border border-red-500/40" />
            <span className="text-[9px] f-body font-semibold text-red-600">Conflict</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Guide Card ───────────────────────────────────────────────────────────────

function GuideCard({
  guide,
  requestedDates,
  isAssigned,
  inquiryId,
  onAssigned,
  onUnassigned,
  guideAcceptance,
  guideDeclineReason,
  hasOpenRequest,
}: {
  guide:               GuideWithCalendar
  requestedDates:      string[]
  isAssigned:          boolean
  inquiryId:           string
  onAssigned:          (guideId: string) => void
  onUnassigned:        () => void
  guideAcceptance?:    string | null
  guideDeclineReason?: string | null
  /** FA-M.05 D3: an attached guide with an open request is detached by withdrawing it (timeline). */
  hasOpenRequest:      boolean
}) {
  const [showCalendar,    setShowCalendar]    = useState(false)
  const [pending,         start]              = useTransition()
  const [unassignPending, startUnassign]      = useTransition()
  const [err,             setErr]             = useState<string | null>(null)
  const [warning,         setWarning]         = useState<string | null>(null)
  // FA-M.05 D1 (a): the wa.me link and the request link live only in this state, once, after
  // "Send request" — never in the URL, never re-shown after a reload.
  const [sent,            setSent]            = useState<{ waUrl: string; link: string } | null>(null)
  const [copied,          setCopied]          = useState(false)

  const blockedSet   = useMemo(() => new Set(guide.blockedDates), [guide.blockedDates])
  const conflicts    = requestedDates.filter(d => blockedSet.has(d))
  const hasConflicts = conflicts.length > 0

  const initials = guide.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleSend() {
    setErr(null)
    setWarning(null)
    setSent(null)
    setCopied(false)
    start(async () => {
      const res = await sendGuideRequest(inquiryId, guide.id)
      if (!res.success) {
        setErr(res.error)
      } else {
        setSent({ waUrl: res.waUrl, link: res.link })
        setWarning(res.warning)
        onAssigned(guide.id)
      }
    })
  }

  async function copyLink() {
    if (sent == null) return
    try {
      await navigator.clipboard.writeText(sent.link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  // FA-M.05 D3 (a): only for a guide attached without an open request (before FA-M.03).
  function handleUnassign() {
    if (!window.confirm(`Detach ${guide.full_name} from this inquiry?`)) return
    setErr(null)
    startUnassign(async () => {
      const res = await detachGuideWithoutRequestAction(inquiryId)
      if (!res.success) {
        setErr(res.error)
      } else {
        onUnassigned()
      }
    })
  }

  return (
    <div className={cn(
      'rounded-[22px] overflow-hidden transition-all shadow-[0_2px_12px_rgba(10,46,77,0.04)]',
      isAssigned
        ? 'bg-emerald-500/[4%] border-[1.5px] border-emerald-500/30'
        : 'bg-[#FDFAF7] border border-primary/[8%]',
    )}>
      {/* ── Card header ── */}
      <div className="px-5 py-4 flex items-center gap-4">

        {/* Avatar */}
        <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-primary/10">
          {guide.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={guide.avatar_url} alt={guide.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold f-body text-primary">{initials}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold f-body text-primary">{guide.full_name}</p>
            {isAssigned && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">
                Assigned
              </span>
            )}
            {hasConflicts && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body bg-red-500/10 text-red-600 border border-red-500/25">
                ⚠ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
              </span>
            )}
            {!hasConflicts && requestedDates.length > 0 && guide.blockedDates.length >= 0 && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body bg-emerald-500/10 text-emerald-900 border border-emerald-500/20">
                ✓ Available
              </span>
            )}
          </div>
          {guide.country && (
            <p className="text-[11px] f-body mt-0.5 text-primary/45">{guide.country}</p>
          )}
          <CalendarConnectStatus guideId={guide.id} calendar={guide.calendar} />
          {isAssigned && (
            <div className="mt-1">
              {guideAcceptance === 'accepted' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block bg-emerald-500/12 text-emerald-800 border border-emerald-500/25">
                  ✓ Accepted
                </span>
              )}
              {guideAcceptance === 'declined' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block bg-red-500/10 text-red-800 border border-red-500/22">
                  ✗ Declined{guideDeclineReason ? ` — ${guideDeclineReason}` : ''}
                </span>
              )}
              {guideAcceptance === 'other_dates' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block bg-primary/[6%] text-primary border border-primary/20">
                  ↻ Other dates proposed
                </span>
              )}
              {(guideAcceptance == null) && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block bg-yellow-300/15 text-yellow-900 border border-yellow-400/35">
                  ⏳ Awaiting response
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isAssigned ? (
            <>
              <span className="text-[10px] font-bold f-body px-3 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-800 border border-emerald-500/25">
                ✓ Assigned
              </span>
              <button
                type="button"
                onClick={handleSend}
                disabled={pending}
                className="px-3 py-1 rounded-xl text-[10px] font-semibold f-body transition-all whitespace-nowrap bg-primary/[6%] text-primary border border-primary/15 disabled:opacity-60 disabled:cursor-default"
              >
                {pending ? '…' : 'Send new request'}
              </button>
              {!hasOpenRequest && (
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={unassignPending}
                  className="px-3 py-1 rounded-xl text-[10px] font-semibold f-body transition-all whitespace-nowrap bg-red-500/7 text-red-800 border border-red-500/20 disabled:opacity-60 disabled:cursor-default"
                >
                  {unassignPending ? '…' : 'Unassign'}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSend}
                disabled={pending}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-xs font-bold f-body transition-all whitespace-nowrap bg-primary text-white disabled:cursor-default',
                  pending && 'opacity-60',
                )}
              >
                {pending ? '…' : 'Send request'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {err && (
        <div className="px-5 pb-3">
          <p role="alert" className="text-xs f-body text-red-600">{err}</p>
        </div>
      )}

      {/* ── FA-M.05 D5: the earlier link could not be withdrawn — never a silent success ── */}
      {warning && (
        <div className="px-5 pb-3">
          <p role="alert" data-testid="previous-link-warning" className="text-xs f-body font-semibold text-amber-800 bg-amber-400/15 border border-amber-500/30 rounded-xl px-3 py-2">
            ⚠ {warning}
          </p>
        </div>
      )}

      {/* ── FA-M.05: request created — send it from WhatsApp (shown once) ── */}
      {sent != null && (
        <div className="px-5 pb-4" data-testid="request-sent-panel">
          <div className="rounded-2xl px-4 py-3 bg-emerald-500/[6%] border border-emerald-500/25">
            <p className="text-xs f-body font-semibold text-emerald-900 mb-2">
              Request created. Send it to {guide.full_name.split(' ')[0]} on WhatsApp — this link is shown only now.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={sent.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-xl text-xs font-bold f-body bg-accent text-primary"
              >
                Open WhatsApp
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold f-body bg-white text-primary border border-primary/15"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="mt-2 text-[10px] f-body text-primary/50 break-all select-all">{sent.link}</p>
          </div>
        </div>
      )}

      {/* ── Calendar toggle ── */}
      <div className="border-t border-primary/[6%]">
        <button
          type="button"
          onClick={() => setShowCalendar(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold f-body text-primary/50">
            Check availability
          </span>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={cn('transition-transform text-primary/35', showCalendar && 'rotate-180')}
          />
        </button>

        {showCalendar && (
          <div className="px-4 pb-4">
            <MiniCalendar
              blockedDates={guide.blockedDates}
              calendarDates={guide.calendarDates}
              manualDates={guide.manualDates}
              requestedDates={requestedDates}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuideAttachmentTab({
  inquiryId,
  currentAssignedGuideId,
  guides,
  requestedDates,
  tripCountry,
  guideAcceptance,
  guideDeclineReason,
  externalOfferSent,
  requests,
}: Props) {
  const router = useRouter()
  // FA-M.05: the attached guide comes from the server on every refresh — a withdraw in the timeline
  // (D2) or a send to another guide changes it there, and a local copy would go stale.
  const assignedGuideId = currentAssignedGuideId
  const [extOffer, setExtOffer]               = useState(externalOfferSent)
  const [extPending, startExt]                = useTransition()

  function refresh() {
    router.refresh()
  }

  function toggleExternalOffer() {
    const next = !extOffer
    setExtOffer(next)
    startExt(async () => {
      const res = await setExternalOffer(inquiryId, next)
      if (!res.success) setExtOffer(!next) // revert on error
    })
  }

  // Sort: assigned first, then by conflict (no conflict first), then alphabetical
  const sorted = useMemo(() => {
    return [...guides].sort((a, b) => {
      if (a.id === assignedGuideId) return -1
      if (b.id === assignedGuideId) return  1
      const aConflict = requestedDates.some(d => a.blockedDates.includes(d))
      const bConflict = requestedDates.some(d => b.blockedDates.includes(d))
      if (!aConflict && bConflict) return -1
      if (aConflict && !bConflict) return  1
      return a.full_name.localeCompare(b.full_name)
    })
  }, [guides, assignedGuideId, requestedDates])

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <p className="text-sm font-bold f-display text-primary">Guide Attachment</p>
        <p className="text-xs f-body mt-0.5 text-primary/45">
          {tripCountry
            ? `Showing active guides in ${tripCountry}.`
            : 'Showing all active guides.'}
          {requestedDates.length > 0 && ' Orange dates = requested by angler. Red = conflict with guide blocked dates.'}
        </p>
      </div>

      {/* FA-M.05: requests sent for this inquiry */}
      <GuideRequestTimeline inquiryId={inquiryId} requests={requests} />

      {/* External offer toggle */}
      <button
        type="button"
        onClick={toggleExternalOffer}
        disabled={extPending}
        className={cn(
          'mb-5 flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] text-sm font-semibold f-body transition-all border',
          extOffer
            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30 cursor-pointer'
            : 'bg-primary/5 text-primary/50 border-primary/10 cursor-pointer',
          extPending && 'opacity-60 cursor-default',
        )}
      >
        <span className={cn(
          'inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-white text-[10px] font-bold flex-shrink-0',
          extOffer ? 'bg-emerald-500' : 'bg-primary/[12%]',
        )}>
          {extOffer ? '✓' : ''}
        </span>
        {extOffer ? 'Offer sent externally (click to undo)' : 'Offer done outside system'}
      </button>

      {guides.length === 0 ? (
        <div className="px-6 py-10 rounded-[22px] text-center bg-[#FDFAF7] border border-primary/7">
          <p className="text-sm f-body text-primary/40">
            No active guides found{tripCountry ? ` in ${tripCountry}` : ''}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(guide => (
            <GuideCard
              key={guide.id}
              guide={guide}
              requestedDates={requestedDates}
              isAssigned={guide.id === assignedGuideId}
              inquiryId={inquiryId}
              onAssigned={refresh}
              onUnassigned={refresh}
              guideAcceptance={guide.id === assignedGuideId ? guideAcceptance : null}
              guideDeclineReason={guide.id === assignedGuideId ? guideDeclineReason : null}
              hasOpenRequest={requests.some(r => r.guideId === guide.id && r.withdrawnAt == null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
