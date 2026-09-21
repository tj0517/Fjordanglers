'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignGuideToInquiry, assignGuideSilently, setExternalOffer, unassignGuide } from '@/actions/inquiries'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuideWithCalendar {
  id:           string
  full_name:    string
  avatar_url:   string | null
  country:      string | null
  blockedDates: string[]  // ISO dates from guide_unavailable_dates
}

interface Props {
  inquiryId:              string
  currentAssignedGuideId: string | null
  guides:                 GuideWithCalendar[]
  requestedDates:         string[]   // ISO dates the angler requested
  tripCountry:            string | null
  guideAcceptance:        string | null  // 'accepted' | 'declined' | null
  guideDeclineReason:     string | null
  externalOfferSent:      boolean
}

// ─── Mini read-only calendar ──────────────────────────────────────────────────

function MiniCalendar({
  blockedDates,
  requestedDates,
}: {
  blockedDates:   string[]
  requestedDates: string[]
}) {
  const blockedSet   = useMemo(() => new Set(blockedDates),   [blockedDates])
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

          const state = isConflict ? 'conflict'
            : isRequested          ? 'requested'
            : isBlocked            ? 'blocked'
            : isPast               ? 'past'
            : undefined

          return (
            <div
              key={iso}
              data-state={state}
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
          <span className="text-[9px] f-body text-primary/45">Guide blocked</span>
        </div>
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
}: {
  guide:               GuideWithCalendar
  requestedDates:      string[]
  isAssigned:          boolean
  inquiryId:           string
  onAssigned:          (guideId: string) => void
  onUnassigned:        () => void
  guideAcceptance?:    string | null
  guideDeclineReason?: string | null
}) {
  const [showCalendar,    setShowCalendar]    = useState(false)
  const [pending,         start]              = useTransition()
  const [unassignPending, startUnassign]      = useTransition()
  const [lastMode,        setLastMode]        = useState<'notify' | 'silent' | null>(null)
  const [err,             setErr]             = useState<string | null>(null)

  const blockedSet   = useMemo(() => new Set(guide.blockedDates), [guide.blockedDates])
  const conflicts    = requestedDates.filter(d => blockedSet.has(d))
  const hasConflicts = conflicts.length > 0

  const initials = guide.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleAssign(silent: boolean) {
    setLastMode(silent ? 'silent' : 'notify')
    setErr(null)
    start(async () => {
      const res = silent
        ? await assignGuideSilently(inquiryId, guide.id)
        : await assignGuideToInquiry(inquiryId, guide.id)
      if (!res.success) {
        setErr(res.error ?? 'Failed to assign')
      } else {
        onAssigned(guide.id)
      }
    })
  }

  function handleUnassign() {
    setErr(null)
    startUnassign(async () => {
      const res = await unassignGuide(inquiryId)
      if (!res.success) {
        setErr(res.error ?? 'Failed to unassign')
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
                ✓ {lastMode === 'silent' ? 'Linked' : 'Assigned'}
              </span>
              <button
                type="button"
                onClick={handleUnassign}
                disabled={unassignPending}
                className="px-3 py-1 rounded-xl text-[10px] font-semibold f-body transition-all whitespace-nowrap bg-red-500/7 text-red-800 border border-red-500/20 disabled:opacity-60 disabled:cursor-default"
              >
                {unassignPending ? '…' : 'Unassign'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAssign(false)}
                disabled={pending}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-xs font-bold f-body transition-all whitespace-nowrap bg-primary text-white disabled:cursor-default',
                  pending && lastMode === 'notify' && 'opacity-60',
                )}
              >
                {pending && lastMode === 'notify' ? '…' : 'Assign & notify'}
              </button>
              <button
                type="button"
                onClick={() => handleAssign(true)}
                disabled={pending}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-xs font-semibold f-body transition-all whitespace-nowrap bg-primary/[6%] text-primary/50 border border-primary/10 disabled:cursor-default',
                  pending && lastMode === 'silent' && 'opacity-60',
                )}
              >
                {pending && lastMode === 'silent' ? '…' : 'Link silently'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {err && (
        <div className="px-5 pb-3">
          <p className="text-xs f-body text-red-600">{err}</p>
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
}: Props) {
  const router = useRouter()
  const [assignedGuideId, setAssignedGuideId] = useState(currentAssignedGuideId)
  const [extOffer, setExtOffer]               = useState(externalOfferSent)
  const [extPending, startExt]                = useTransition()

  function handleAssigned(guideId: string) {
    setAssignedGuideId(guideId)
    router.refresh()
  }

  function handleUnassigned() {
    setAssignedGuideId(null)
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
              onAssigned={handleAssigned}
              onUnassigned={handleUnassigned}
              guideAcceptance={guide.id === assignedGuideId ? guideAcceptance : null}
              guideDeclineReason={guide.id === assignedGuideId ? guideDeclineReason : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
