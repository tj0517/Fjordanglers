'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { assignGuideToInquiry, assignGuideSilently } from '@/actions/inquiries'

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
    <div
      className="rounded-2xl overflow-hidden mt-4"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      {/* Month nav */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
      >
        <button
          type="button"
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(10,46,77,0.4)', background: 'rgba(10,46,77,0.05)' }}
          aria-label="Previous month"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(10,46,77,0.4)', background: 'rgba(10,46,77,0.05)' }}
          aria-label="Next month"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 px-3 pt-2 pb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold f-body"
            style={{ color: 'rgba(10,46,77,0.28)' }}>{d}</div>
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

          return (
            <div
              key={iso}
              className="h-7 flex items-center justify-center rounded-lg text-[11px] f-body"
              style={{
                background: isConflict  ? 'rgba(239,68,68,0.15)'
                  : isRequested         ? 'rgba(230,126,80,0.15)'
                  : isBlocked           ? 'rgba(10,46,77,0.06)'
                  : 'transparent',
                color: isConflict       ? '#DC2626'
                  : isRequested         ? '#C05C28'
                  : isBlocked           ? 'rgba(10,46,77,0.28)'
                  : isPast              ? 'rgba(10,46,77,0.18)'
                  : 'rgba(10,46,77,0.65)',
                textDecoration: isBlocked && !isRequested ? 'line-through' : 'none',
                fontWeight:     isRequested || isConflict ? 700 : 400,
                border:         isRequested
                  ? `1.5px solid ${isConflict ? 'rgba(239,68,68,0.4)' : 'rgba(230,126,80,0.4)'}`
                  : '1.5px solid transparent',
              }}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div
        className="px-3 pb-3 flex flex-wrap gap-3"
        style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
      >
        {requestedDates.length > 0 && (
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(230,126,80,0.15)', border: '1px solid rgba(230,126,80,0.4)' }} />
            <span className="text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Requested date</span>
          </div>
        )}
        <div className="flex items-center gap-1 pt-2">
          <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(10,46,77,0.06)' }} />
          <span className="text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Guide blocked</span>
        </div>
        {hasConflicts && (
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }} />
            <span className="text-[9px] f-body font-semibold" style={{ color: '#DC2626' }}>Conflict</span>
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
  guideAcceptance,
  guideDeclineReason,
}: {
  guide:               GuideWithCalendar
  requestedDates:      string[]
  isAssigned:          boolean
  inquiryId:           string
  onAssigned:          (guideId: string) => void
  guideAcceptance?:    string | null
  guideDeclineReason?: string | null
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [pending, start]               = useTransition()
  const [lastMode, setLastMode]        = useState<'notify' | 'silent' | null>(null)
  const [done, setDone]                = useState(false)
  const [err,  setErr]                 = useState<string | null>(null)

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
    start(async () => {
      const res = silent
        ? await assignGuideSilently(inquiryId, guide.id)
        : await assignGuideToInquiry(inquiryId, guide.id)
      if (!res.success) {
        setErr(res.error ?? 'Failed to assign')
      } else {
        setDone(true)
        onAssigned(guide.id)
      }
    })
  }

  return (
    <div
      className="rounded-[22px] overflow-hidden transition-all"
      style={{
        background: isAssigned ? 'rgba(16,185,129,0.04)' : '#FDFAF7',
        border: isAssigned
          ? '1.5px solid rgba(16,185,129,0.3)'
          : '1px solid rgba(10,46,77,0.08)',
        boxShadow: '0 2px 12px rgba(10,46,77,0.04)',
      }}
    >
      {/* ── Card header ── */}
      <div className="px-5 py-4 flex items-center gap-4">

        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: 'rgba(10,46,77,0.1)' }}
        >
          {guide.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={guide.avatar_url} alt={guide.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{initials}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
              {guide.full_name}
            </p>
            {isAssigned && (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#065F46', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                Assigned
              </span>
            )}
            {hasConflicts && (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                ⚠ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
              </span>
            )}
            {!hasConflicts && requestedDates.length > 0 && guide.blockedDates.length >= 0 && (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#065F46', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                ✓ Available
              </span>
            )}
          </div>
          {guide.country && (
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
              {guide.country}
            </p>
          )}
          {isAssigned && (
            <div className="mt-1">
              {guideAcceptance === 'accepted' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#065F46', border: '1px solid rgba(16,185,129,0.25)' }}>
                  ✓ Accepted
                </span>
              )}
              {guideAcceptance === 'declined' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.22)' }}>
                  ✗ Declined{guideDeclineReason ? ` — ${guideDeclineReason}` : ''}
                </span>
              )}
              {(guideAcceptance == null) && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body inline-block"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E', border: '1px solid rgba(251,191,36,0.35)' }}>
                  ⏳ Awaiting response
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isAssigned || done ? (
            <span className="text-[10px] font-bold f-body px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#065F46', border: '1px solid rgba(16,185,129,0.25)' }}>
              ✓ {lastMode === 'silent' ? 'Linked' : 'Assigned'}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAssign(false)}
                disabled={pending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold f-body transition-all whitespace-nowrap"
                style={{
                  background: '#0A2E4D',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: pending ? 'default' : 'pointer',
                  opacity: pending && lastMode === 'notify' ? 0.6 : 1,
                }}
              >
                {pending && lastMode === 'notify' ? '…' : 'Assign & notify'}
              </button>
              <button
                type="button"
                onClick={() => handleAssign(true)}
                disabled={pending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold f-body transition-all whitespace-nowrap"
                style={{
                  background: 'rgba(10,46,77,0.06)',
                  color: 'rgba(10,46,77,0.5)',
                  border: '1px solid rgba(10,46,77,0.1)',
                  cursor: pending ? 'default' : 'pointer',
                  opacity: pending && lastMode === 'silent' ? 0.6 : 1,
                }}
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
          <p className="text-xs f-body" style={{ color: '#DC2626' }}>{err}</p>
        </div>
      )}

      {/* ── Calendar toggle ── */}
      <div style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
        <button
          type="button"
          onClick={() => setShowCalendar(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 transition-all"
          style={{ background: 'transparent', cursor: 'pointer' }}
        >
          <span className="text-[11px] font-semibold f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Check availability
          </span>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="transition-transform"
            style={{
              color: 'rgba(10,46,77,0.35)',
              transform: showCalendar ? 'rotate(180deg)' : 'rotate(0)',
            }}
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
}: Props) {
  const router = useRouter()
  const [assignedGuideId, setAssignedGuideId] = useState(currentAssignedGuideId)

  function handleAssigned(guideId: string) {
    setAssignedGuideId(guideId)
    router.refresh()
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
        <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
          Guide Attachment
        </p>
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
          {tripCountry
            ? `Showing active guides in ${tripCountry}.`
            : 'Showing all active guides.'}
          {requestedDates.length > 0 && ' Orange dates = requested by angler. Red = conflict with guide blocked dates.'}
        </p>
      </div>

      {guides.length === 0 ? (
        <div
          className="px-6 py-10 rounded-[22px] text-center"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
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
              guideAcceptance={guide.id === assignedGuideId ? guideAcceptance : null}
              guideDeclineReason={guide.id === assignedGuideId ? guideDeclineReason : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
