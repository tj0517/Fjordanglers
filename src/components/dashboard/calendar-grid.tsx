'use client'

/**
 * CalendarGrid — interactive monthly calendar for guide availability management.
 *
 * Features:
 *   • Single-day click → day-detail modal (bookings + blocks + range-block form)
 *   • Multi-pick mode  → click days to toggle selection → bulk-block N days at once
 *   • Pending bookings shown in amber (distinct from confirmed blue)
 *   • Month navigation via URL (?year=&month=) → Server Component re-fetch
 */

import { useState, useMemo, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { blockDates, blockMultipleDates, unblockDates } from '@/actions/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Experience = { id: string; title: string; published: boolean }

type BlockedEntry = {
  id:            string
  experience_id: string
  date_start:    string
  date_end:      string
  reason:        string | null
}

type BookingEntry = {
  id:               string
  experience_id:    string
  booking_date:     string
  guests:           number
  status:           string
  angler_full_name: string | null
}

type InquiryEntry = {
  id:          string
  dates_from:  string
  dates_to:    string
  angler_name: string
  group_size:  number
  status:      string
}

type DayData = {
  blockedEntries:  BlockedEntry[]
  bookingEntries:  BookingEntry[]
  blockedExpIds:   Set<string>
  inquiryEntries:  InquiryEntry[]
}

export type CalendarGridProps = {
  year:         number
  month:        number
  experiences:  Experience[]
  blocked:      BlockedEntry[]
  bookings:     BookingEntry[]
  inquiries:    InquiryEntry[]
  /** How this guide manages availability. Defaults to 'per_listing'. */
  calendarMode: 'per_listing' | 'shared'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March',    'April',   'May',      'June',
  'July',    'August',   'September','October', 'November', 'December',
]
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Season presets — used by the range-block modal
const SEASON_PRESETS = [
  { key: 'winter', icon: '❄️', label: 'Winter',    range: 'Jan 1 – Mar 31',  startMD: [1,  1] as [number, number], endMD: [3, 31] as [number, number] },
  { key: 'spring', icon: '🌿', label: 'Spring',    range: 'Apr 1 – May 31',  startMD: [4,  1] as [number, number], endMD: [5, 31] as [number, number] },
  { key: 'summer', icon: '☀️', label: 'Summer',    range: 'Jun 1 – Aug 31',  startMD: [6,  1] as [number, number], endMD: [8, 31] as [number, number] },
  { key: 'autumn', icon: '🍂', label: 'Autumn',    range: 'Sep 1 – Nov 30',  startMD: [9,  1] as [number, number], endMD: [11,30] as [number, number] },
  { key: 'full',   icon: '🔒', label: 'Full year', range: 'Jan 1 – Dec 31',  startMD: [1,  1] as [number, number], endMD: [12,31] as [number, number] },
]

// ─── Trip colour palette — one colour per experience, cycling ─────────────────
const TRIP_PALETTE: string[] = ['#1B4F72', '#0891B2', '#059669', '#7C3AED', '#BE185D']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseUTC(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

function formatDayShort(dateStr: string): string {
  return parseUTC(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function formatDayLong(dateStr: string): string {
  return parseUTC(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarGrid({
  year, month, experiences, blocked, bookings, inquiries, calendarMode,
}: CalendarGridProps) {
  const isShared = calendarMode === 'shared'
  const router = useRouter()
  const [navPending,     startNav]     = useTransition()
  const [unblockPending, startUnblock] = useTransition()
  const modalRef       = useRef<HTMLDivElement>(null)
  const multiModalRef  = useRef<HTMLDivElement>(null)
  const monthModalRef  = useRef<HTMLDivElement>(null)
  const blockMenuRef   = useRef<HTMLDivElement>(null)

  // ── Single-day modal state ─────────────────────────────────────────────────
  const [selectedDay,   setSelectedDay]   = useState<string | null>(null)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockExpIds,   setBlockExpIds]   = useState<string[]>([])
  const [blockEndDate,  setBlockEndDate]  = useState('')
  const [blockReason,   setBlockReason]   = useState('')

  // ── Multi-pick state ────────────────────────────────────────────────────────
  const [selectionMode,   setSelectionMode]   = useState(false)
  const [selectedDays,    setSelectedDays]    = useState<Set<string>>(new Set())
  const [showMultiModal,  setShowMultiModal]  = useState(false)
  const [multiBlockExpIds, setMultiBlockExpIds] = useState<string[]>([])
  const [multiBlockReason, setMultiBlockReason] = useState('')

  // ── Per-trip mode: which trip is currently shown ────────────────────────────
  const [activeTripId, setActiveTripId] = useState<string | null>(
    calendarMode === 'per_listing' ? (experiences[0]?.id ?? null) : null
  )

  // ── Range / season-block modal state ────────────────────────────────────────
  const [showRangeModal, setShowRangeModal] = useState(false)
  const [rangeStart,     setRangeStart]     = useState('')
  const [rangeEnd,       setRangeEnd]       = useState('')
  const [rangeExpIds,    setRangeExpIds]    = useState<string[]>([])
  const [rangeReason,    setRangeReason]    = useState('')

  // ── Block-this-month modal state ─────────────────────────────────────────────
  const [showMonthModal,    setShowMonthModal]    = useState(false)
  const [monthBlockExpIds,  setMonthBlockExpIds]  = useState<string[]>([])
  const [monthBlockReason,  setMonthBlockReason]  = useState('')

  // ── Listings filter (view only — which trips to show in calendar) ─────────────
  const [visibleExpIds, setVisibleExpIds] = useState<Set<string>>(
    () => new Set(experiences.map(e => e.id))
  )

  // ── Block menu (season / month) ───────────────────────────────────────────────
  const [showBlockMenu, setShowBlockMenu] = useState(false)

  // ── Shared action state ─────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)
  // Tracks which specific block entry is being unblocked (for per-row spinner)
  const [unblockingId,      setUnblockingId]      = useState<string | null>(null)
  // Multiselect unblock
  const [selectedBlockIds,  setSelectedBlockIds]  = useState<Set<string>>(new Set())
  const [isUnblockingMulti, setIsUnblockingMulti] = useState(false)

  // ── Per-trip colour map ────────────────────────────────────────────────────
  const expColors = useMemo(
    () => Object.fromEntries(
      experiences.map((e, i) => [e.id, TRIP_PALETTE[i % TRIP_PALETTE.length]!])
    ),
    [experiences]
  )

  // ── Visible trips (view filter) ────────────────────────────────────────────
  const visibleExps = useMemo(
    () => experiences.filter(e => visibleExpIds.has(e.id)),
    [experiences, visibleExpIds]
  )

  // ── Keyboard: Escape closes modals / exits selection ──────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showBlockMenu)       { setShowBlockMenu(false); return }
      if (showMonthModal)      { setShowMonthModal(false); return }
      if (showRangeModal)      { setShowRangeModal(false); return }
      if (showMultiModal)      { setShowMultiModal(false); return }
      if (selectedDay != null) { closeModal(); return }
      if (selectionMode)       { exitSelectionMode(); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showBlockMenu, showMonthModal, showRangeModal, showMultiModal, selectedDay, selectionMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click-outside: close block menu ───────────────────────────────────────
  useEffect(() => {
    if (!showBlockMenu) return
    const handler = (e: MouseEvent) => {
      if (!blockMenuRef.current?.contains(e.target as Node)) {
        setShowBlockMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showBlockMenu])

  // Focus modal on open
  useEffect(() => { if (selectedDay != null)  modalRef.current?.focus()      }, [selectedDay])
  useEffect(() => { if (showMultiModal)        multiModalRef.current?.focus() }, [showMultiModal])
  useEffect(() => { if (showMonthModal)        monthModalRef.current?.focus() }, [showMonthModal])

  // ── Build per-day index ────────────────────────────────────────────────────
  // In per_listing mode, filter to only the active trip so the calendar is
  // scoped to exactly one trip at a time.
  const dayMap = useMemo((): Record<string, DayData> => {
    const map: Record<string, DayData> = {}
    function get(key: string): DayData {
      if (map[key] == null) map[key] = { blockedEntries: [], bookingEntries: [], blockedExpIds: new Set(), inquiryEntries: [] }
      return map[key]!
    }
    // Apply view filter (visibleExpIds) on top of per_listing / shared mode filter
    const filteredBlocked  = (!isShared && activeTripId != null
      ? blocked.filter(b => b.experience_id === activeTripId)
      : blocked
    ).filter(b => visibleExpIds.has(b.experience_id))
    const filteredBookings = (!isShared && activeTripId != null
      ? bookings.filter(bk => bk.experience_id === activeTripId)
      : bookings
    ).filter(bk => visibleExpIds.has(bk.experience_id))
    for (const b of filteredBlocked) {
      let cur = parseUTC(b.date_start)
      const end = parseUTC(b.date_end)
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10)
        const day = get(key)
        if (!day.blockedEntries.some(e => e.id === b.id)) day.blockedEntries.push(b)
        day.blockedExpIds.add(b.experience_id)
        cur = new Date(cur.getTime() + 86_400_000)
      }
    }
    for (const bk of filteredBookings) get(bk.booking_date).bookingEntries.push(bk)

    // Expand inquiry date ranges into every day they cover
    for (const inq of inquiries) {
      let cur = parseUTC(inq.dates_from)
      const end = parseUTC(inq.dates_to)
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10)
        const day = get(key)
        if (!day.inquiryEntries.some(e => e.id === inq.id)) day.inquiryEntries.push(inq)
        cur = new Date(cur.getTime() + 86_400_000)
      }
    }

    return map
  }, [blocked, bookings, inquiries, isShared, activeTripId, visibleExpIds])

  // ── Calendar geometry ──────────────────────────────────────────────────────
  const daysInMonth  = new Date(year, month, 0).getDate()
  const startOffset  = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const today        = new Date()
  const todayStr     = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())

  // ── Month navigation ───────────────────────────────────────────────────────
  function navigate(y: number, m: number) {
    startNav(() => router.push(`/dashboard/calendar?year=${y}&month=${m}`, { scroll: false }))
  }
  function prevMonth() { navigate(month === 1  ? year - 1 : year, month === 1  ? 12 : month - 1) }
  function nextMonth() { navigate(month === 12 ? year + 1 : year, month === 12 ? 1  : month + 1) }
  function goToday()   { navigate(today.getFullYear(), today.getMonth() + 1) }

  // ── Single-day modal helpers ───────────────────────────────────────────────
  function openDay(dayStr: string) {
    setSelectedDay(dayStr)
    setShowBlockForm(false)
    setBlockExpIds(experiences.map(e => e.id))
    setBlockEndDate(dayStr)
    setBlockReason('')
    setActionError(null)
  }
  function closeModal() { setSelectedDay(null); setShowBlockForm(false); setActionError(null); setSelectedBlockIds(new Set()) }

  // ── Multi-pick helpers ─────────────────────────────────────────────────────
  function enterSelectionMode() {
    setSelectionMode(true)
    setSelectedDays(new Set())
    setActionError(null)
  }
  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedDays(new Set())
    setShowMultiModal(false)
    setActionError(null)
  }
  function toggleDaySelection(dayStr: string) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(dayStr)) next.delete(dayStr)
      else next.add(dayStr)
      return next
    })
  }
  function openMultiModal() {
    setMultiBlockExpIds(experiences.map(e => e.id))
    setMultiBlockReason('')
    setActionError(null)
    setShowMultiModal(true)
  }

  async function handleMultiUnblock() {
    // Collect all block IDs from all selected days
    const blockIds = Array.from(selectedDays).flatMap(
      day => (dayMap[day]?.blockedEntries ?? []).map(b => b.id)
    )
    if (blockIds.length === 0) return
    setIsUnblockingMulti(true); setActionError(null)
    const results = await Promise.all(blockIds.map(id => unblockDates(id)))
    const failed = results.find(r => 'error' in r)
    if (failed && 'error' in failed) {
      setActionError(failed.error)
      setIsUnblockingMulti(false)
      return
    }
    setIsUnblockingMulti(false)
    exitSelectionMode()
    startUnblock(() => { router.refresh() })
  }

  // ── Day click ──────────────────────────────────────────────────────────────
  function handleDayClick(dayStr: string) {
    if (selectionMode) toggleDaySelection(dayStr)
    else openDay(dayStr)
  }

  // ── Range / season-block helpers ───────────────────────────────────────────
  function openRangeModal() {
    setRangeStart(toDateStr(year, month, 1))
    setRangeEnd(toDateStr(year, month, new Date(year, month, 0).getDate()))
    setRangeExpIds(experiences.map(e => e.id))
    setRangeReason('')
    setActionError(null)
    setShowRangeModal(true)
  }

  async function handleRangeBlock() {
    const expIds = rangeExpIds
    if (expIds.length === 0 || rangeStart === '') return
    setIsSubmitting(true); setActionError(null)
    const end    = rangeEnd >= rangeStart ? rangeEnd : rangeStart
    const result = await blockDates({
      experienceIds: expIds,
      dateStart:     rangeStart,
      dateEnd:       end,
      reason:        rangeReason.trim() || undefined,
    })
    setIsSubmitting(false)
    if ('error' in result) { setActionError(result.error); return }
    setShowRangeModal(false)
    router.refresh()
  }

  // ── Block-this-month helpers ────────────────────────────────────────────────
  function openMonthModal() {
    setMonthBlockExpIds(experiences.map(e => e.id))
    setMonthBlockReason('')
    setActionError(null)
    setShowMonthModal(true)
  }

  async function handleMonthBlock() {
    if (monthBlockExpIds.length === 0) return
    const firstDay = toDateStr(year, month, 1)
    const lastDay  = toDateStr(year, month, new Date(year, month, 0).getDate())
    setIsSubmitting(true); setActionError(null)
    const result = await blockDates({
      experienceIds: monthBlockExpIds,
      dateStart:     firstDay,
      dateEnd:       lastDay,
      reason:        monthBlockReason.trim() || undefined,
    })
    setIsSubmitting(false)
    if ('error' in result) { setActionError(result.error); return }
    setShowMonthModal(false)
    router.refresh()
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleBlock() {
    if (selectedDay == null) return
    const expIds = blockExpIds
    if (expIds.length === 0) return
    setIsSubmitting(true); setActionError(null)
    const end = blockEndDate >= selectedDay ? blockEndDate : selectedDay
    const result = await blockDates({
      experienceIds: expIds,
      dateStart:     selectedDay,
      dateEnd:       end,
      reason:        blockReason.trim() || undefined,
    })
    setIsSubmitting(false)
    if ('error' in result) { setActionError(result.error); return }
    closeModal()
    router.refresh()
  }

  async function handleMultiBlock() {
    const dates = Array.from(selectedDays).sort()
    if (dates.length === 0) return
    const expIds = multiBlockExpIds
    if (expIds.length === 0) return
    setIsSubmitting(true); setActionError(null)
    const result = await blockMultipleDates({
      experienceIds: expIds,
      dates,
      reason:        multiBlockReason.trim() || undefined,
    })
    setIsSubmitting(false)
    if ('error' in result) { setActionError(result.error); return }
    exitSelectionMode()
    router.refresh()
  }

  async function handleUnblock(blockId: string) {
    setUnblockingId(blockId); setActionError(null)
    const result = await unblockDates(blockId)
    if ('error' in result) {
      setUnblockingId(null)
      setActionError(result.error)
      return
    }
    startUnblock(() => { router.refresh() })
    setUnblockingId(null)
  }

  async function handleUnblockSelected() {
    if (selectedBlockIds.size === 0 || isUnblockingMulti) return
    setIsUnblockingMulti(true); setActionError(null)
    const ids = Array.from(selectedBlockIds)
    const results = await Promise.all(ids.map(id => unblockDates(id)))
    const failed = results.find(r => 'error' in r)
    if (failed && 'error' in failed) {
      setActionError(failed.error)
      setIsUnblockingMulti(false)
      return
    }
    setSelectedBlockIds(new Set())
    setIsUnblockingMulti(false)
    startUnblock(() => { router.refresh() })
  }

  function toggleBlockSelect(id: string) {
    setSelectedBlockIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const expById = useMemo(
    () => Object.fromEntries(experiences.map(e => [e.id, e])),
    [experiences],
  )
  const selData: DayData = selectedDay != null
    ? (dayMap[selectedDay] ?? { blockedEntries: [], bookingEntries: [], blockedExpIds: new Set(), inquiryEntries: [] })
    : { blockedEntries: [], bookingEntries: [], blockedExpIds: new Set(), inquiryEntries: [] }

  const sortedSelectedDays = useMemo(() => Array.from(selectedDays).sort(), [selectedDays])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (experiences.length === 0) {
    return (
      <div
        className="rounded-2xl flex flex-col items-center justify-center py-20 text-center"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
             style={{ background: 'rgba(10,46,77,0.06)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(10,46,77,0.4)" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </div>
        <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>No trips yet</p>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Create your first trip to start managing availability.
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Listings filter pills ───────────────────────────────────────────── */}
      {experiences.length > 1 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {/* "All" pill */}
          <button
            onClick={() => setVisibleExpIds(new Set(experiences.map(e => e.id)))}
            className="text-xs font-semibold f-body px-3 py-1.5 rounded-full transition-all"
            style={{
              background: visibleExpIds.size === experiences.length ? '#0A2E4D'              : 'rgba(10,46,77,0.05)',
              color:      visibleExpIds.size === experiences.length ? 'white'                : 'rgba(10,46,77,0.5)',
              border:     visibleExpIds.size === experiences.length ? '1px solid transparent' : '1px solid rgba(10,46,77,0.1)',
              cursor: 'pointer',
            }}
          >
            All
          </button>

          {/* Per-trip pills */}
          {experiences.map((exp, i) => {
            const isOn  = visibleExpIds.has(exp.id)
            const dot   = TRIP_PALETTE[i % TRIP_PALETTE.length]!
            return (
              <button
                key={exp.id}
                onClick={() => {
                  setVisibleExpIds(prev => {
                    const next = new Set(prev)
                    if (next.has(exp.id)) next.delete(exp.id)
                    else next.add(exp.id)
                    // Never leave everything unchecked — if last one deselected, restore all
                    if (next.size === 0) return new Set(experiences.map(e => e.id))
                    return next
                  })
                }}
                className="flex items-center gap-1.5 text-xs font-semibold f-body px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: isOn ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.03)',
                  color:      isOn ? '#0A2E4D'              : 'rgba(10,46,77,0.35)',
                  border:     isOn ? `1.5px solid ${dot}`   : '1.5px solid rgba(10,46,77,0.08)',
                  cursor: 'pointer',
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOn ? dot : 'rgba(10,46,77,0.2)' }} />
                <span className="max-w-[120px] truncate">{exp.title}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ─── Calendar card ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:  '#FDFAF7',
          border:      '1px solid rgba(10,46,77,0.07)',
          opacity:     navPending ? 0.6 : 1,
          transition:  'opacity 0.15s',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 gap-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
        >
          {selectionMode ? (
            /* ── Selection mode header ─────────────────────────────────────── */
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: '#E67E50', boxShadow: '0 0 6px rgba(230,126,80,0.6)' }}
                />
                <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                  {selectedDays.size === 0
                    ? 'Click days to select'
                    : `${selectedDays.size} day${selectedDays.size !== 1 ? 's' : ''} selected`}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedDays.size > 0 && (() => {
                  const blockedCount = Array.from(selectedDays).reduce(
                    (acc, day) => acc + (dayMap[day]?.blockedEntries.length ?? 0), 0
                  )
                  return (
                    <>
                      <button
                        onClick={() => setSelectedDays(new Set())}
                        className="text-xs f-body px-3 py-2 rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                        style={{ color: 'rgba(10,46,77,0.45)', cursor: 'pointer', border: '1px solid rgba(10,46,77,0.08)', background: 'transparent' }}
                      >
                        Clear
                      </button>
                      {blockedCount > 0 && (
                        <button
                          onClick={handleMultiUnblock}
                          disabled={isUnblockingMulti}
                          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-colors f-body"
                          style={{
                            background: isUnblockingMulti ? 'rgba(10,46,77,0.15)' : 'rgba(10,46,77,0.08)',
                            color:      '#0A2E4D',
                            border:     'none',
                            cursor:     isUnblockingMulti ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isUnblockingMulti ? (
                            <>
                              <svg className="animate-spin" width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M5.5 1.5 A4 4 0 0 1 9.5 5.5" />
                              </svg>
                              Unblocking…
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <line x1="1" y1="5.5" x2="10" y2="5.5" />
                              </svg>
                              Unblock {selectedDays.size} {selectedDays.size === 1 ? 'day' : 'days'}
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={openMultiModal}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-colors f-body"
                        style={{ background: '#E67E50', color: 'white', border: 'none', cursor: 'pointer' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                          <rect x="4.5" y="0" width="2" height="11" rx="1" />
                          <rect x="0" y="4.5" width="11" height="2" rx="1" />
                        </svg>
                        Block {selectedDays.size} {selectedDays.size === 1 ? 'day' : 'days'}
                      </button>
                    </>
                  )
                })()}
                <button
                  onClick={exitSelectionMode}
                  className="text-xs f-body px-3 py-2 rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                  style={{ color: 'rgba(10,46,77,0.5)', cursor: 'pointer', border: '1px solid rgba(10,46,77,0.1)', background: 'transparent' }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* ── Normal header ─────────────────────────────────────────────── */
            <>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} disabled={navPending} aria-label="Previous month"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06]"
                  style={{ color: 'rgba(10,46,77,0.5)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <polyline points="10,3 6,8 10,13" />
                  </svg>
                </button>
                <h2 className="text-lg font-bold f-display px-1"
                    style={{ color: '#0A2E4D', minWidth: '190px', textAlign: 'center' }}>
                  {MONTH_NAMES[month - 1]} {year}
                </h2>
                <button onClick={nextMonth} disabled={navPending} aria-label="Next month"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06]"
                  style={{ color: 'rgba(10,46,77,0.5)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <polyline points="6,3 10,8 6,13" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={goToday} disabled={navPending}
                  className="text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors hover:bg-[#0A2E4D]/[0.06]"
                  style={{ color: 'rgba(10,46,77,0.55)' }}>
                  Today
                </button>
                <button
                  onClick={enterSelectionMode}
                  className="flex items-center gap-1.5 text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors hover:bg-[#E67E50]/[0.08]"
                  style={{ color: '#E67E50', border: '1px solid rgba(230,126,80,0.2)', cursor: 'pointer', background: 'transparent' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="0.5" y="0.5" width="4" height="4" rx="0.5" />
                    <rect x="6.5" y="0.5" width="4" height="4" rx="0.5" />
                    <rect x="0.5" y="6.5" width="4" height="4" rx="0.5" />
                    <rect x="6.5" y="6.5" width="4" height="4" rx="0.5" />
                  </svg>
                  <span className="hidden sm:inline">Select days</span>
                </button>

                {/* ── Block ▾ dropdown ──────────────────────────────────────── */}
                <div className="relative" ref={blockMenuRef}>
                  <button
                    onClick={() => setShowBlockMenu(p => !p)}
                    className="flex items-center gap-1 text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      color:      '#0A2E4D',
                      border:     '1px solid rgba(10,46,77,0.12)',
                      background: showBlockMenu ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.04)',
                      cursor:     'pointer',
                    }}
                    aria-haspopup="menu"
                    aria-expanded={showBlockMenu}
                  >
                    Block
                    <svg
                      width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      style={{ transform: showBlockMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                    >
                      <polyline points="1.5,3 4.5,6 7.5,3" />
                    </svg>
                  </button>

                  {showBlockMenu && (
                    <div
                      className="absolute right-0 top-full mt-1.5 z-30 rounded-xl overflow-hidden flex flex-col"
                      style={{
                        background:  '#FDFAF7',
                        border:      '1px solid rgba(10,46,77,0.1)',
                        boxShadow:   '0 8px 28px rgba(7,17,28,0.12)',
                        minWidth:    '152px',
                      }}
                      role="menu"
                    >
                      <button
                        role="menuitem"
                        onClick={() => { setShowBlockMenu(false); openRangeModal() }}
                        className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold f-body text-left transition-colors"
                        style={{ color: '#0A2E4D', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,46,77,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="0.5" y="2.5" width="10" height="8" rx="1" />
                          <line x1="0.5" y1="5" x2="10.5" y2="5" />
                          <line x1="3" y1="0.5" x2="3" y2="3.5" />
                          <line x1="8" y1="0.5" x2="8" y2="3.5" />
                        </svg>
                        Block season
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setShowBlockMenu(false); openMonthModal() }}
                        className="flex items-center gap-2.5 px-4 py-3 text-xs font-semibold f-body text-left transition-colors"
                        style={{ color: '#E67E50', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(230,126,80,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="0.5" y="2.5" width="10" height="8" rx="1" />
                          <line x1="0.5" y1="5" x2="10.5" y2="5" />
                          <line x1="3" y1="0.5" x2="3" y2="3.5" />
                          <line x1="8" y1="0.5" x2="8" y2="3.5" />
                          <line x1="5.5" y1="7" x2="5.5" y2="9.5" strokeWidth="2" strokeLinecap="round" />
                          <line x1="4.25" y1="7" x2="6.75" y2="7" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Block month
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Day name headers ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 px-4 py-2"
             style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}>
          {DAY_NAMES_SHORT.map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-[0.12em] f-body py-1"
                 style={{ color: 'rgba(10,46,77,0.3)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* ── Day grid ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 gap-px p-px" style={{ background: 'rgba(10,46,77,0.04)' }}>
          {/* Empty offset */}
          {Array.from({ length: startOffset }, (_, i) => (
            <div key={`off-${i}`} style={{ background: '#FDFAF7', height: '80px' }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day    = i + 1
            const dayStr = toDateStr(year, month, day)
            const data   = dayMap[dayStr]

            const isToday      = dayStr === todayStr
            const isPast       = dayStr < todayStr
            const isSelected   = selectionMode && selectedDays.has(dayStr)
            const blockedCount  = data?.blockedExpIds.size ?? 0
            // Per-trip mode: day is simply blocked or not for this one trip.
            // Shared / "all trips" mode: partial = some but not all visible trips blocked.
            const fullyBlocked = !isShared && activeTripId != null
              ? (data?.blockedExpIds.has(activeTripId) ?? false)
              : (blockedCount >= visibleExps.length && blockedCount > 0)
            const partBlocked  = !isShared && activeTripId != null
              ? false
              : (blockedCount > 0 && !fullyBlocked)

            // Booking state split by status
            const confirmedBk = data?.bookingEntries.filter(b => b.status === 'confirmed' || b.status === 'accepted') ?? []
            const pendingBk   = data?.bookingEntries.filter(b => b.status === 'pending')   ?? []
            const hasConfirmed = confirmedBk.length > 0
            const hasPending   = pendingBk.length > 0

            // Background
            let bg = '#FDFAF7'
            if (isSelected)        bg = 'rgba(230,126,80,0.13)'
            else if (fullyBlocked) bg = 'rgba(230,126,80,0.08)'
            else if (partBlocked)  bg = 'rgba(230,126,80,0.04)'

            return (
              <button
                key={dayStr}
                onClick={() => handleDayClick(dayStr)}
                className="relative flex flex-col items-start p-2 transition-colors text-left overflow-hidden"
                style={{
                  background: bg,
                  height:     '80px',   // fixed — prevents layout jump when chips change
                  opacity:    isPast && !isSelected ? 0.45 : 1,
                  cursor:     'pointer',
                  outline:    'none',
                  border:     isSelected ? '2px solid #E67E50' : '2px solid transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background =
                    isSelected     ? 'rgba(230,126,80,0.2)'  :
                    isToday        ? 'rgba(10,46,77,0.07)'   :
                    fullyBlocked   ? 'rgba(230,126,80,0.14)' :
                                     'rgba(10,46,77,0.04)'
                }}
                onMouseLeave={e => { e.currentTarget.style.background = bg }}
                aria-label={`${dayStr}${isSelected ? ', selected' : ''}${hasConfirmed ? ', booked' : hasPending ? ', pending booking' : ''}${fullyBlocked ? ', fully blocked' : partBlocked ? ', partially blocked' : ''}`}
              >
                {/* Day number */}
                <span className="text-sm font-semibold f-body leading-none mb-1"
                      style={{ color: isToday ? 'white' : 'rgba(10,46,77,0.8)', fontWeight: isToday ? 700 : 500 }}>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
                          style={{ background: '#E67E50', color: 'white' }}>
                      {day}
                    </span>
                  ) : isSelected ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
                          style={{ background: 'rgba(230,126,80,0.25)', color: '#C96030' }}>
                      ✓
                    </span>
                  ) : day}
                </span>

                {/* Per-trip status indicators */}
                <div className="flex flex-col gap-px w-full mt-auto">
                  {visibleExps.map((exp) => {
                    const isExpBlocked = data?.blockedExpIds.has(exp.id) ?? false
                    const expBks       = data?.bookingEntries.filter(b => b.experience_id === exp.id) ?? []
                    const hasConf      = expBks.some(b => b.status === 'confirmed' || b.status === 'accepted')
                    const hasPend      = expBks.some(b => b.status === 'pending')
                    if (!isExpBlocked && !hasConf && !hasPend) return null
                    const dotColor = expColors[exp.id] ?? '#0A2E4D'

                    // Booking takes visual priority over blocked
                    if (hasConf || hasPend) {
                      return (
                        <div key={exp.id}
                          className="flex items-center gap-0.5 text-[8px] font-bold f-body leading-none px-1 py-[3px] rounded"
                          style={{
                            background: hasConf ? 'rgba(27,79,114,0.12)' : 'rgba(217,119,6,0.11)',
                            color:      hasConf ? '#1B4F72'              : '#B45309',
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" style={{ flexShrink: 0 }}>
                            <circle cx="4" cy="2.5" r="1.8"/>
                            <path d="M1 7c0-1.657 1.343-3 3-3s3 1.343 3 3" strokeWidth="0" fillRule="evenodd"/>
                          </svg>
                          <span className="truncate" style={{ maxWidth: 36 }}>
                            {hasConf ? 'Booked' : 'Pending'}
                          </span>
                        </div>
                      )
                    }

                    // Blocked only
                    return (
                      <div key={exp.id}
                        className="flex items-center gap-0.5 text-[8px] font-bold f-body leading-none px-1 py-[3px] rounded"
                        style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor, opacity: 0.5 }} />
                        <span>Off</span>
                      </div>
                    )
                  })}

                  {/* Inquiry chip — one per day showing count */}
                  {(() => {
                    const inqs = data?.inquiryEntries ?? []
                    if (inqs.length === 0) return null
                    const hasConfirmedInq = inqs.some(i => i.status === 'confirmed' || i.status === 'offer_accepted' || i.status === 'completed')
                    const hasOfferInq     = inqs.some(i => i.status === 'offer_sent')
                    const bg    = hasConfirmedInq ? 'rgba(74,222,128,0.1)'   : hasOfferInq ? 'rgba(230,126,80,0.12)'  : 'rgba(109,40,217,0.1)'
                    const color = hasConfirmedInq ? '#16A34A'                : hasOfferInq ? '#C96030'               : '#6D28D9'
                    const label = hasConfirmedInq ? 'Confirmed'              : hasOfferInq ? 'Offer'                 : inqs.length > 1 ? `${inqs.length} Req` : 'Request'
                    return (
                      <div
                        className="flex items-center gap-0.5 text-[8px] font-bold f-body leading-none px-1 py-[3px] rounded"
                        style={{ background: bg, color }}
                      >
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0 }}>
                          <path d="M7 1H1a.5.5 0 00-.5.5v4A.5.5 0 001 6h2l1.5 1.5L6 6h1a.5.5 0 00.5-.5v-4A.5.5 0 007 1z"/>
                        </svg>
                        <span>{label}</span>
                      </div>
                    )
                  })()}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Legend ────────────────────────────────────────────────────────────── */}
        <div className="px-6 py-3 flex flex-col gap-2.5"
             style={{ borderTop: '1px solid rgba(10,46,77,0.05)' }}>

          {/* Trip colour key — only visible trips */}
          {visibleExps.length > 0 && (
            <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5">
              {visibleExps.map((exp) => {
                const globalIdx = experiences.findIndex(e => e.id === exp.id)
                return (
                  <div key={exp.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: TRIP_PALETTE[globalIdx % TRIP_PALETTE.length] }}
                    />
                    <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                      {exp.title}
                      {!exp.published && (
                        <span style={{ color: 'rgba(10,46,77,0.35)' }}> (draft)</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Status key */}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
            {([
              { label: 'Booked',   chip: { bg: 'rgba(27,79,114,0.12)',  color: '#1B4F72' }, icon: 'person' },
              { label: 'Pending',  chip: { bg: 'rgba(217,119,6,0.11)',  color: '#B45309' }, icon: 'person' },
              { label: 'Request',  chip: { bg: 'rgba(109,40,217,0.1)',  color: '#6D28D9' }, icon: 'msg'    },
              { label: 'Off',      chip: { bg: 'rgba(10,46,77,0.07)',   color: 'rgba(10,46,77,0.4)' }, icon: 'dot' },
            ] as const).map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold f-body"
                     style={{ background: item.chip.bg, color: item.chip.color }}>
                  {item.icon === 'person' ? (
                    <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
                      <circle cx="4" cy="2.5" r="1.8"/>
                      <path d="M1 7c0-1.657 1.343-3 3-3s3 1.343 3 3"/>
                    </svg>
                  ) : item.icon === 'msg' ? (
                    <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M7 1H1a.5.5 0 00-.5.5v4A.5.5 0 001 6h2l1.5 1.5L6 6h1a.5.5 0 00.5-.5v-4A.5.5 0 007 1z"/>
                    </svg>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(10,46,77,0.4)', opacity: 0.5 }} />
                  )}
                  {item.label}
                </div>
                <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  {item.label === 'Booked'   ? 'confirmed booking' :
                   item.label === 'Pending'  ? 'awaiting confirmation' :
                   item.label === 'Request'  ? 'custom trip inquiry' :
                   'unavailable / blocked'}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ─── Single-day modal ─────────────────────────────────────────────────── */}
      {selectedDay != null && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(7,17,28,0.55)', backdropFilter: 'blur(2px)' }}
               onClick={closeModal} aria-hidden="true" />

          <div ref={modalRef} role="dialog" aria-modal="true"
               aria-label={`Day details: ${formatDayLong(selectedDay)}`}
               tabIndex={-1}
               className="fixed z-50 flex flex-col"
               style={{
                 top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                 width: '100%', maxWidth: '460px', maxHeight: '85vh',
                 background: '#FDFAF7', borderRadius: '20px',
                 boxShadow: '0 20px 60px rgba(7,17,28,0.25)',
                 border: '1px solid rgba(10,46,77,0.08)', outline: 'none',
               }}>

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-5"
                 style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>Availability</p>
                <h3 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                  {formatDayLong(selectedDay)}
                </h3>
              </div>
              <button onClick={closeModal} aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06] flex-shrink-0"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* Trip inquiries / requests */}
              {selData.inquiryEntries.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-3"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Requests ({selData.inquiryEntries.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {selData.inquiryEntries.map(inq => {
                      const isConfirmedInq = inq.status === 'confirmed' || inq.status === 'offer_accepted' || inq.status === 'completed'
                      const isOfferInq     = inq.status === 'offer_sent'
                      const bgInq   = isConfirmedInq ? 'rgba(74,222,128,0.06)'  : isOfferInq ? 'rgba(230,126,80,0.06)'  : 'rgba(109,40,217,0.05)'
                      const bdrInq  = isConfirmedInq ? '1px solid rgba(74,222,128,0.18)' : isOfferInq ? '1px solid rgba(230,126,80,0.18)' : '1px solid rgba(109,40,217,0.15)'
                      const dotInq  = isConfirmedInq ? '#16A34A' : isOfferInq ? '#E67E50' : '#6D28D9'
                      const statusLabel =
                        inq.status === 'inquiry'        ? 'New'        :
                        inq.status === 'reviewing'      ? 'Reviewing'  :
                        inq.status === 'offer_sent'     ? 'Offer sent' :
                        inq.status === 'offer_accepted' ? 'Accepted'   :
                        inq.status === 'confirmed'      ? 'Confirmed'  :
                        inq.status === 'completed'      ? 'Completed'  : inq.status
                      return (
                        <a
                          key={inq.id}
                          href={`/dashboard/inquiries/${inq.id}`}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity hover:opacity-80"
                          style={{ background: bgInq, border: bdrInq, textDecoration: 'none' }}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotInq }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                              {inq.angler_name}
                            </p>
                            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                              {inq.dates_from} → {inq.dates_to} · {inq.group_size} {inq.group_size === 1 ? 'angler' : 'anglers'}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                                style={{ background: bgInq, color: dotInq, border: bdrInq }}>
                            {statusLabel}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Bookings */}
              {selData.bookingEntries.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-3"
                     style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Bookings ({selData.bookingEntries.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {selData.bookingEntries.map(bk => {
                      const isConfirmed = bk.status === 'confirmed' || bk.status === 'accepted'
                      const isPendingBk = bk.status === 'pending'
                      return (
                        <div key={bk.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                             style={{
                               background: isConfirmed ? 'rgba(27,79,114,0.06)' : 'rgba(217,119,6,0.06)',
                               border:     isConfirmed ? '1px solid rgba(27,79,114,0.1)' : '1px solid rgba(217,119,6,0.15)',
                             }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                               style={{ background: isConfirmed ? '#1B4F72' : '#D97706' }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                              {expById[bk.experience_id]?.title ?? 'Trip'}
                            </p>
                            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                              {bk.angler_full_name ?? 'Angler'} · {bk.guests} guest{bk.guests !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                                style={
                                  isConfirmed
                                    ? { background: 'rgba(74,222,128,0.12)', color: '#16A34A' }
                                    : isPendingBk
                                    ? { background: 'rgba(217,119,6,0.12)',   color: '#B45309' }
                                    : { background: 'rgba(10,46,77,0.07)',    color: 'rgba(10,46,77,0.5)' }
                                }>
                            {bk.status}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Blocked entries */}
              {selData.blockedEntries.length > 0 && (
                <section>
                  {/* Header row: label + select-all + unblock-selected */}
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body flex-1"
                       style={{ color: 'rgba(10,46,77,0.38)' }}>
                      Blocked ({selData.blockedEntries.length})
                    </p>
                    {selData.blockedEntries.length > 1 && (
                      <button
                        onClick={() => {
                          const allIds = new Set(selData.blockedEntries.map(b => b.id))
                          const allSelected = selData.blockedEntries.every(b => selectedBlockIds.has(b.id))
                          setSelectedBlockIds(allSelected ? new Set() : allIds)
                        }}
                        className="text-[10px] font-semibold f-body transition-colors"
                        style={{ color: 'rgba(10,46,77,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {selData.blockedEntries.every(b => selectedBlockIds.has(b.id)) ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                    {selectedBlockIds.size > 0 && (
                      <button
                        onClick={handleUnblockSelected}
                        disabled={isUnblockingMulti}
                        className="flex items-center gap-1.5 text-xs font-bold f-body px-3 py-1 rounded-lg transition-all"
                        style={{
                          background: isUnblockingMulti ? 'rgba(230,126,80,0.4)' : '#E67E50',
                          color:      'white',
                          border:     'none',
                          cursor:     isUnblockingMulti ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isUnblockingMulti ? (
                          <>
                            <svg className="animate-spin" width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M5.5 1.5 A4 4 0 0 1 9.5 5.5" />
                            </svg>
                            Unblocking…
                          </>
                        ) : (
                          `Unblock ${selectedBlockIds.size}`
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {selData.blockedEntries.map(b => {
                      const isSelected = selectedBlockIds.has(b.id)
                      const isBusy = unblockingId === b.id || isUnblockingMulti
                      return (
                        <div
                          key={b.id}
                          className="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer"
                          style={{
                            background:    isSelected ? 'rgba(230,126,80,0.1)' : 'rgba(230,126,80,0.06)',
                            border:        isSelected ? '1px solid rgba(230,126,80,0.3)' : '1px solid rgba(230,126,80,0.12)',
                            opacity:       isBusy ? 0.45 : 1,
                            transition:    'all 0.15s',
                            pointerEvents: isBusy ? 'none' : 'auto',
                          }}
                          onClick={() => toggleBlockSelect(b.id)}
                        >
                          {/* Checkbox */}
                          <div
                            className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center mt-0.5"
                            style={{
                              background: isSelected ? '#E67E50' : 'transparent',
                              border:     isSelected ? 'none' : '1.5px solid rgba(10,46,77,0.2)',
                              transition: 'all 0.12s',
                            }}
                          >
                            {isSelected && (
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1.5,4.5 3.5,6.5 7.5,2.5"/>
                              </svg>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                              {expById[b.experience_id]?.title ?? 'Trip'}
                            </p>
                            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                              {b.date_start === b.date_end ? b.date_start : `${b.date_start} → ${b.date_end}`}
                            </p>
                            {b.reason != null && b.reason !== '' && (
                              <p className="text-xs f-body mt-1 italic" style={{ color: 'rgba(10,46,77,0.45)' }}>
                                &ldquo;{b.reason}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Single unblock button (only when nothing selected) */}
                          {selectedBlockIds.size === 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); void handleUnblock(b.id) }}
                              disabled={unblockingId === b.id || unblockPending}
                              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold f-body px-2.5 py-1 rounded-lg transition-all"
                              style={{
                                color:      unblockingId === b.id ? 'rgba(201,96,48,0.5)' : '#C96030',
                                cursor:     unblockingId !== null ? 'not-allowed' : 'pointer',
                                background: 'transparent',
                                border:     'none',
                              }}
                            >
                              {unblockingId === b.id ? (
                                <>
                                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M5.5 1.5 A4 4 0 0 1 9.5 5.5" />
                                  </svg>
                                  Unblocking…
                                </>
                              ) : 'Unblock'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {selData.blockedEntries.length === 0 && selData.bookingEntries.length === 0 && !showBlockForm && (
                <p className="text-sm f-body text-center py-4" style={{ color: 'rgba(10,46,77,0.35)' }}>
                  No bookings or blocks on this day.
                </p>
              )}

              {/* Range-block form */}
              {showBlockForm && (
                <section className="rounded-xl p-4"
                         style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
                  <p className="text-sm font-bold f-body mb-4" style={{ color: '#0A2E4D' }}>Block dates</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label htmlFor="block-start" className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                             style={{ color: 'rgba(10,46,77,0.5)' }}>From</label>
                      <input id="block-start" type="date" readOnly value={selectedDay}
                        className="w-full text-sm f-body px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.12)', color: 'rgba(10,46,77,0.6)', cursor: 'default', outline: 'none' }} />
                    </div>
                    <div>
                      <label htmlFor="block-end" className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                             style={{ color: 'rgba(10,46,77,0.5)' }}>To</label>
                      <input id="block-end" type="date" min={selectedDay} value={blockEndDate}
                        onChange={e => setBlockEndDate(e.target.value)}
                        className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                        style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }} />
                    </div>
                  </div>
                  {/* Which trips to block */}
                  {experiences.length > 1 ? (
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-2"
                         style={{ color: 'rgba(10,46,77,0.5)' }}>Block for</p>
                      <div className="flex flex-col gap-1.5">
                        {experiences.map((exp, i) => {
                          const checked = blockExpIds.includes(exp.id)
                          return (
                            <label key={exp.id}
                              className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg"
                              style={{
                                background: checked ? 'rgba(230,126,80,0.06)' : 'rgba(10,46,77,0.02)',
                                border: `1px solid ${checked ? 'rgba(230,126,80,0.2)' : 'rgba(10,46,77,0.08)'}`,
                              }}
                            >
                              <input type="checkbox" checked={checked} className="sr-only"
                                onChange={() => setBlockExpIds(prev =>
                                  prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                                )}
                              />
                              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                    style={{ background: checked ? '#E67E50' : 'transparent', border: checked ? 'none' : '1.5px solid rgba(10,46,77,0.2)' }}>
                                {checked && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <span className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: TRIP_PALETTE[i % TRIP_PALETTE.length] }} />
                              <span className="text-xs f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
                                {exp.title}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg"
                         style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TRIP_PALETTE[0] }} />
                      <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                        Will block <strong>{experiences[0]?.title ?? 'trip'}</strong>
                      </p>
                    </div>
                  )}
                  <div className="mb-4">
                    <label htmlFor="block-reason" className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                           style={{ color: 'rgba(10,46,77,0.5)' }}>Reason (private)</label>
                    <input id="block-reason" type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                      placeholder="e.g. Holiday, local festival…" maxLength={120}
                      className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                      style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }} />
                  </div>
                  {actionError != null && <p className="text-xs f-body mb-3" style={{ color: '#DC2626' }}>{actionError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleBlock}
                      disabled={isSubmitting || blockExpIds.length === 0}
                      className="flex-1 text-sm font-semibold f-body py-2.5 rounded-xl transition-opacity"
                      style={{
                        background: '#E67E50',
                        color:      'white',
                        opacity:    isSubmitting || blockExpIds.length === 0 ? 0.55 : 1,
                        cursor:     isSubmitting || blockExpIds.length === 0 ? 'not-allowed' : 'pointer',
                        border:     'none',
                      }}>
                      {isSubmitting
                        ? 'Blocking…'
                        : blockExpIds.length === experiences.length
                        ? 'Block all trips'
                        : `Block ${blockExpIds.length} trip${blockExpIds.length !== 1 ? 's' : ''}`}
                    </button>
                    <button onClick={() => setShowBlockForm(false)} disabled={isSubmitting}
                      className="px-4 text-sm f-body rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                      style={{ color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)', cursor: 'pointer', background: 'transparent' }}>
                      Cancel
                    </button>
                  </div>
                </section>
              )}
            </div>

            {/* Modal footer */}
            {!showBlockForm && (
              <div className="px-6 py-4 flex items-center justify-between"
                   style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                {actionError != null && <p className="text-xs f-body" style={{ color: '#DC2626' }}>{actionError}</p>}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setShowBlockForm(true)}
                    className="flex items-center gap-2 text-sm font-semibold f-body px-4 py-2.5 rounded-xl transition-colors hover:bg-[#E67E50]/[0.08]"
                    style={{ color: '#E67E50', border: '1px solid rgba(230,126,80,0.2)', cursor: 'pointer', background: 'transparent' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                      <rect x="5.5" y="0.5" width="2" height="12" rx="1" />
                      <rect x="0.5" y="5.5" width="12" height="2" rx="1" />
                    </svg>
                    Block this day
                  </button>
                  <button onClick={closeModal}
                    className="text-sm f-body px-4 py-2.5 rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                    style={{ color: 'rgba(10,46,77,0.45)', cursor: 'pointer', border: '1px solid rgba(10,46,77,0.08)', background: 'transparent' }}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Multi-pick block modal ───────────────────────────────────────────── */}
      {showMultiModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(7,17,28,0.55)', backdropFilter: 'blur(2px)' }}
               onClick={() => setShowMultiModal(false)} aria-hidden="true" />

          <div ref={multiModalRef} role="dialog" aria-modal="true"
               aria-label={`Block ${selectedDays.size} selected days`}
               tabIndex={-1}
               className="fixed z-50 flex flex-col"
               style={{
                 top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                 width: '100%', maxWidth: '460px', maxHeight: '85vh',
                 background: '#FDFAF7', borderRadius: '20px',
                 boxShadow: '0 20px 60px rgba(7,17,28,0.25)',
                 border: '1px solid rgba(10,46,77,0.08)', outline: 'none',
               }}>

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5"
                 style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>Multi-day block</p>
                <h3 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                  Block {selectedDays.size} {selectedDays.size === 1 ? 'day' : 'days'}
                </h3>
              </div>
              <button onClick={() => setShowMultiModal(false)} aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06] flex-shrink-0"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* Selected dates chips */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-2"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Selected dates ({selectedDays.size})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sortedSelectedDays.slice(0, 20).map(d => (
                    <span key={d}
                      className="text-xs f-body px-2.5 py-1 rounded-full flex items-center gap-1.5"
                      style={{ background: 'rgba(230,126,80,0.1)', color: '#C96030', border: '1px solid rgba(230,126,80,0.2)' }}>
                      {formatDayShort(d)}
                      <button
                        onClick={() => setSelectedDays(prev => { const next = new Set(prev); next.delete(d); return next })}
                        className="text-[#C96030]/60 hover:text-[#C96030] transition-colors leading-none"
                        aria-label={`Remove ${d}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  {sortedSelectedDays.length > 20 && (
                    <span className="text-xs f-body px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}>
                      +{sortedSelectedDays.length - 20} more
                    </span>
                  )}
                </div>
              </div>

              {/* Which trips to block */}
              {experiences.length > 1 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-2"
                     style={{ color: 'rgba(10,46,77,0.5)' }}>Block for</p>
                  <div className="flex flex-col gap-1.5">
                    {experiences.map((exp, i) => {
                      const checked = multiBlockExpIds.includes(exp.id)
                      return (
                        <label key={exp.id}
                          className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg"
                          style={{
                            background: checked ? 'rgba(230,126,80,0.06)' : 'rgba(10,46,77,0.02)',
                            border: `1px solid ${checked ? 'rgba(230,126,80,0.2)' : 'rgba(10,46,77,0.08)'}`,
                          }}
                        >
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={() => setMultiBlockExpIds(prev =>
                              prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                            )}
                          />
                          <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                style={{ background: checked ? '#E67E50' : 'transparent', border: checked ? 'none' : '1.5px solid rgba(10,46,77,0.2)' }}>
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: TRIP_PALETTE[i % TRIP_PALETTE.length] }} />
                          <span className="text-xs f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
                            {exp.title}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                     style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TRIP_PALETTE[0] }} />
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    Will block <strong>{experiences[0]?.title ?? 'trip'}</strong> for {selectedDays.size} day{selectedDays.size !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label htmlFor="multi-reason" className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                       style={{ color: 'rgba(10,46,77,0.5)' }}>Reason (private, optional)</label>
                <input id="multi-reason" type="text" value={multiBlockReason} onChange={e => setMultiBlockReason(e.target.value)}
                  placeholder="e.g. Holiday, competition, season closed…" maxLength={120}
                  className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }} />
              </div>

              {actionError != null && <p className="text-xs f-body" style={{ color: '#DC2626' }}>{actionError}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2"
                 style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
              <button
                onClick={handleMultiBlock}
                disabled={isSubmitting || selectedDays.size === 0 || multiBlockExpIds.length === 0}
                className="flex-1 text-sm font-semibold f-body py-3 rounded-xl transition-opacity"
                style={{
                  background: '#E67E50',
                  color:      'white',
                  border:     'none',
                  cursor:     isSubmitting || multiBlockExpIds.length === 0 ? 'not-allowed' : 'pointer',
                  opacity:    isSubmitting || multiBlockExpIds.length === 0 ? 0.55 : 1,
                }}>
                {isSubmitting
                  ? 'Blocking…'
                  : multiBlockExpIds.length === experiences.length
                  ? `Block ${selectedDays.size} day${selectedDays.size !== 1 ? 's' : ''} for all trips`
                  : `Block ${selectedDays.size} day${selectedDays.size !== 1 ? 's' : ''} for ${multiBlockExpIds.length} trip${multiBlockExpIds.length !== 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setShowMultiModal(false)} disabled={isSubmitting}
                className="px-5 text-sm f-body rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)', cursor: 'pointer', background: 'transparent' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
      {/* ─── Range / season-block modal ───────────────────────────────────────── */}
      {showRangeModal && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(7,17,28,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowRangeModal(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Block a date range"
            className="fixed z-50 flex flex-col"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: '100%', maxWidth: '480px', maxHeight: '90vh',
              background: '#FDFAF7', borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(7,17,28,0.25)',
              border: '1px solid rgba(10,46,77,0.08)', outline: 'none',
            }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-6 py-5"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>Availability</p>
                <h3 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                  Block date range
                </h3>
              </div>
              <button
                onClick={() => setShowRangeModal(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06] flex-shrink-0"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* ── Season preset chips ───────────────────────────────────── */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-2.5"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Season shortcuts
                </p>
                <div className="flex flex-wrap gap-2">
                  {SEASON_PRESETS.map(s => {
                    const isActive =
                      rangeStart === toDateStr(year, s.startMD[0], s.startMD[1]) &&
                      rangeEnd   === toDateStr(year, s.endMD[0],   s.endMD[1])
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setRangeStart(toDateStr(year, s.startMD[0], s.startMD[1]))
                          setRangeEnd(toDateStr(year,   s.endMD[0],   s.endMD[1]))
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold f-body px-3 py-1.5 rounded-full transition-all"
                        style={{
                          background: isActive ? 'rgba(230,126,80,0.1)' : 'rgba(10,46,77,0.05)',
                          color:      isActive ? '#E67E50'               : '#0A2E4D',
                          border:     `1px solid ${isActive ? 'rgba(230,126,80,0.25)' : 'rgba(10,46,77,0.1)'}`,
                          cursor:     'pointer',
                        }}
                      >
                        <span>{s.icon}</span>
                        {s.label}
                        <span
                          className="text-[9px]"
                          style={{ opacity: 0.5 }}
                        >
                          {s.range}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Date range inputs ─────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="range-start"
                    className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                    style={{ color: 'rgba(10,46,77,0.5)' }}
                  >
                    From
                  </label>
                  <input
                    id="range-start"
                    type="date"
                    value={rangeStart}
                    onChange={e => setRangeStart(e.target.value)}
                    className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="range-end"
                    className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                    style={{ color: 'rgba(10,46,77,0.5)' }}
                  >
                    To
                  </label>
                  <input
                    id="range-end"
                    type="date"
                    min={rangeStart}
                    value={rangeEnd}
                    onChange={e => setRangeEnd(e.target.value)}
                    className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }}
                  />
                </div>
              </div>

              {/* ── Which trips to block ──────────────────────────────── */}
              {experiences.length > 1 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-2"
                     style={{ color: 'rgba(10,46,77,0.5)' }}>Block for</p>
                  <div className="flex flex-col gap-1.5">
                    {experiences.map((exp, i) => {
                      const checked = rangeExpIds.includes(exp.id)
                      return (
                        <label key={exp.id}
                          className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg"
                          style={{
                            background: checked ? 'rgba(230,126,80,0.06)' : 'rgba(10,46,77,0.02)',
                            border: `1px solid ${checked ? 'rgba(230,126,80,0.2)' : 'rgba(10,46,77,0.08)'}`,
                          }}
                        >
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={() => setRangeExpIds(prev =>
                              prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                            )}
                          />
                          <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                style={{ background: checked ? '#E67E50' : 'transparent', border: checked ? 'none' : '1.5px solid rgba(10,46,77,0.2)' }}>
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: TRIP_PALETTE[i % TRIP_PALETTE.length] }} />
                          <span className="text-xs f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
                            {exp.title}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                     style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TRIP_PALETTE[0] }} />
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    Will block <strong>{experiences[0]?.title ?? 'trip'}</strong>
                  </p>
                </div>
              )}

              {/* ── Reason ────────────────────────────────────────────────── */}
              <div>
                <label
                  htmlFor="range-reason"
                  className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  Reason (private, optional)
                </label>
                <input
                  id="range-reason"
                  type="text"
                  value={rangeReason}
                  onChange={e => setRangeReason(e.target.value)}
                  placeholder="e.g. Main season, winter closure, holiday…"
                  maxLength={120}
                  className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }}
                />
              </div>

              {actionError != null && (
                <p className="text-xs f-body" style={{ color: '#DC2626' }}>{actionError}</p>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex gap-2"
              style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
            >
              <button
                onClick={handleRangeBlock}
                disabled={isSubmitting || rangeStart === '' || rangeEnd === '' || rangeExpIds.length === 0}
                className="flex-1 text-sm font-semibold f-body py-3 rounded-xl transition-opacity"
                style={{
                  background: '#E67E50',
                  color:      'white',
                  border:     'none',
                  opacity: isSubmitting || rangeStart === '' || rangeExpIds.length === 0 ? 0.55 : 1,
                  cursor:  isSubmitting || rangeStart === '' || rangeExpIds.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting
                  ? 'Blocking…'
                  : rangeExpIds.length === experiences.length
                  ? 'Block dates for all trips'
                  : `Block dates for ${rangeExpIds.length} trip${rangeExpIds.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setShowRangeModal(false)}
                disabled={isSubmitting}
                className="px-5 text-sm f-body rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)', cursor: 'pointer', background: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Block-this-month modal ───────────────────────────────────────── */}
      {showMonthModal && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(7,17,28,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowMonthModal(false)}
            aria-hidden="true"
          />

          <div
            ref={monthModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Block ${MONTH_NAMES[month - 1]} ${year}`}
            tabIndex={-1}
            className="fixed z-50 flex flex-col"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: '100%', maxWidth: '460px', maxHeight: '85vh',
              background: '#FDFAF7', borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(7,17,28,0.25)',
              border: '1px solid rgba(10,46,77,0.08)', outline: 'none',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5"
                 style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>Block availability</p>
                <h3 className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                  Block {MONTH_NAMES[month - 1]} {year}
                </h3>
              </div>
              <button onClick={() => setShowMonthModal(false)} aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.06] flex-shrink-0"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* Date badge — read-only */}
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                   style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.18)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#E67E50" strokeWidth="1.5" className="flex-shrink-0">
                  <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
                  <line x1="1.5" y1="6" x2="12.5" y2="6" />
                  <line x1="4.5" y1="2" x2="4.5" y2="6" />
                  <line x1="9.5" y1="2" x2="9.5" y2="6" />
                </svg>
                <p className="text-xs f-body font-semibold" style={{ color: '#C96030' }}>
                  {toDateStr(year, month, 1)} → {toDateStr(year, month, new Date(year, month, 0).getDate())}
                  <span className="font-normal ml-2" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    ({new Date(year, month, 0).getDate()} days)
                  </span>
                </p>
              </div>

              {/* Which trips to block */}
              {experiences.length > 1 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-2"
                     style={{ color: 'rgba(10,46,77,0.5)' }}>Block for</p>
                  <div className="flex flex-col gap-1.5">
                    {experiences.map((exp, i) => {
                      const checked = monthBlockExpIds.includes(exp.id)
                      return (
                        <label key={exp.id}
                          className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg"
                          style={{
                            background: checked ? 'rgba(230,126,80,0.06)' : 'rgba(10,46,77,0.02)',
                            border: `1px solid ${checked ? 'rgba(230,126,80,0.2)' : 'rgba(10,46,77,0.08)'}`,
                          }}
                        >
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={() => setMonthBlockExpIds(prev =>
                              prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                            )}
                          />
                          <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                style={{ background: checked ? '#E67E50' : 'transparent', border: checked ? 'none' : '1.5px solid rgba(10,46,77,0.2)' }}>
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: TRIP_PALETTE[i % TRIP_PALETTE.length] }} />
                          <span className="text-xs f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
                            {exp.title}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                     style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.15)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TRIP_PALETTE[0] }} />
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    Will block <strong>{experiences[0]?.title ?? 'trip'}</strong>
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label htmlFor="month-reason"
                  className="block text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
                  style={{ color: 'rgba(10,46,77,0.5)' }}>
                  Reason (private, optional)
                </label>
                <input
                  id="month-reason"
                  type="text"
                  value={monthBlockReason}
                  onChange={e => setMonthBlockReason(e.target.value)}
                  placeholder="e.g. Off season, vacation, maintenance…"
                  maxLength={120}
                  className="w-full text-sm f-body px-3 py-2 rounded-lg focus:outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.15)', color: '#0A2E4D' }}
                />
              </div>

              {actionError != null && (
                <p className="text-xs f-body" style={{ color: '#DC2626' }}>{actionError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2"
                 style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
              <button
                onClick={handleMonthBlock}
                disabled={isSubmitting || monthBlockExpIds.length === 0}
                className="flex-1 text-sm font-semibold f-body py-3 rounded-xl transition-opacity"
                style={{
                  background: '#E67E50',
                  color:      'white',
                  border:     'none',
                  opacity: isSubmitting || monthBlockExpIds.length === 0 ? 0.55 : 1,
                  cursor:  isSubmitting || monthBlockExpIds.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting
                  ? 'Blocking…'
                  : monthBlockExpIds.length === experiences.length
                  ? `Block all of ${MONTH_NAMES[month - 1]}`
                  : `Block ${MONTH_NAMES[month - 1]} for ${monthBlockExpIds.length} trip${monthBlockExpIds.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setShowMonthModal(false)}
                disabled={isSubmitting}
                className="px-5 text-sm f-body rounded-xl transition-colors hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)', cursor: 'pointer', background: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
