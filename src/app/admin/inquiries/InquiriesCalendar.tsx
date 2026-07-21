'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'
import type { InquiryRow } from './InquiriesClient'
import {
  type MainFilter,
  STATUS_GROUPS,
  MAIN_LABELS,
  MAIN_COLORS,
  SUB_OPTIONS,
} from './InquiriesClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  allRows:    InquiryRow[]
  tripMap:    Record<string, string>
  slugMap:    Record<string, string>
  countryMap: Record<string, string>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:                 { label: 'Pending',         color: '#92400E', bg: 'rgba(251,191,36,0.15)',  border: '1px solid rgba(251,191,36,0.4)'   },
  in_negotiation:          { label: 'Negotiating',     color: '#5B21B6', bg: 'rgba(139,92,246,0.15)',  border: '1px solid rgba(139,92,246,0.35)'  },
  waiting_for_guide_offer: { label: 'Waiting Guide',   color: '#C2410C', bg: 'rgba(234,88,12,0.12)',   border: '1px solid rgba(234,88,12,0.35)'   },
  offer_sent:              { label: 'Offer Sent',      color: '#0E7490', bg: 'rgba(6,182,212,0.12)',   border: '1px solid rgba(6,182,212,0.35)'   },
  waiting_for_deposit:     { label: 'Waiting Deposit', color: '#3730A3', bg: 'rgba(99,102,241,0.12)',  border: '1px solid rgba(99,102,241,0.35)'  },
  deposit_sent:            { label: 'Deposit Sent',    color: '#1E40AF', bg: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)'   },
  deposit_paid:            { label: 'Confirmed',       color: '#065F46', bg: 'rgba(16,185,129,0.12)',  border: '1px solid rgba(16,185,129,0.3)'   },
  completed:               { label: 'Completed',       color: '#374151', bg: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.2)'  },
  lost:                    { label: 'Lost',            color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
  cancelled:               { label: 'Cancelled',       color: '#991B1B', bg: 'rgba(239,68,68,0.10)',   border: '1px solid rgba(239,68,68,0.25)'   },
}

const STATUS_DOT: Record<string, string> = {
  pending:                 '#FBBF24',
  in_negotiation:          '#8B5CF6',
  waiting_for_guide_offer: '#EA580C',
  offer_sent:              '#06B6D4',
  waiting_for_deposit:     '#6366F1',
  deposit_sent:            '#3B82F6',
  deposit_paid:            '#10B981',
  completed:               '#9CA3AF',
  lost:                    '#EF4444',
  cancelled:               '#EF4444',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildDateMap(rows: InquiryRow[]): Map<string, InquiryRow[]> {
  const map = new Map<string, InquiryRow[]>()
  for (const row of rows) {
    for (const d of row.requested_dates ?? []) {
      const key = (d as string).slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(row)
      map.set(key, arr)
    }
  }
  return map
}

function buildGridDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  // Monday-first: (0=Sun → 6, 1=Mon → 0, …)
  const startDow = (firstDay.getDay() + 6) % 7
  const cells: (string | null)[] = []

  for (let i = 0; i < startDow; i++) cells.push(null)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    )
  }

  // Fill remainder to complete last row (optional, keeps grid uniform)
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

// Build set of all "sibling" dates when a day is selected.
// Siblings = any date that shares at least one inquiry with the selected day.
function buildSiblingDates(selected: string | null, dateMap: Map<string, InquiryRow[]>): Set<string> {
  if (selected === null) return new Set()
  const inqsOnDay = dateMap.get(selected) ?? []
  const ids = new Set(inqsOnDay.map(r => r.id))
  const siblings = new Set<string>()
  for (const [date, rows] of dateMap) {
    if (date === selected) continue
    if (rows.some(r => ids.has(r.id))) siblings.add(date)
  }
  return siblings
}

// ─── InquiriesCalendar ────────────────────────────────────────────────────────

// Country flag emoji lookup
const COUNTRY_FLAG: Record<string, string> = {
  NO: '🇳🇴', SE: '🇸🇪', IS: '🇮🇸', FI: '🇫🇮', DK: '🇩🇰',
}

export function InquiriesCalendar({ allRows, tripMap, slugMap, countryMap }: Props) {
  const today = useMemo(() => toIsoDate(new Date()), [])

  const [year,       setYear      ] = useState(() => new Date().getFullYear())
  const [month,      setMonth     ] = useState(() => new Date().getMonth())
  const [selected,   setSelected  ] = useState<string | null>(null)
  const [country,    setCountry   ] = useState<string | null>(null)
  const [mainFilter, setMainFilter] = useState<MainFilter | null>(null)
  const [subFilter,  setSubFilter ] = useState<string | null>(null)
  const [openPopup,  setOpenPopup ] = useState<MainFilter | null>(null)

  // Unique countries present in the current data
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const row of allRows) {
      const c = row.trip_id ? countryMap[row.trip_id] : undefined
      if (c) set.add(c)
    }
    return [...set].sort()
  }, [allRows, countryMap])

  // Filter rows by country first, then by status group/sub
  const filteredRows = useMemo(() => {
    let rows = allRows
    if (country !== null) {
      rows = rows.filter(r => {
        const c = r.trip_id ? countryMap[r.trip_id] : undefined
        return c === country
      })
    }
    if (mainFilter !== null) {
      const group = STATUS_GROUPS[mainFilter]
      rows = subFilter != null
        ? rows.filter(r => r.status === subFilter)
        : rows.filter(r => group.includes(r.status))
    }
    return rows
  }, [allRows, country, mainFilter, subFilter, countryMap])

  // Per-status counts (from country-filtered rows only)
  const statusCounts = useMemo(() => {
    const base = country !== null
      ? allRows.filter(r => {
          const c = r.trip_id ? countryMap[r.trip_id] : undefined
          return c === country
        })
      : allRows
    const c: Record<string, number> = {}
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [allRows, country, countryMap])

  const groupCounts = useMemo(() => ({
    lead:      (statusCounts['pending'] ?? 0) + (statusCounts['in_negotiation'] ?? 0),
    guide:     (statusCounts['waiting_for_guide_offer'] ?? 0) + (statusCounts['offer_sent'] ?? 0) + (statusCounts['waiting_for_deposit'] ?? 0) + (statusCounts['deposit_sent'] ?? 0),
    confirmed: (statusCounts['deposit_paid'] ?? 0) + (statusCounts['completed'] ?? 0),
    lost:      (statusCounts['lost'] ?? 0) + (statusCounts['cancelled'] ?? 0),
  }), [statusCounts])

  const dateMap      = useMemo(() => buildDateMap(filteredRows), [filteredRows])
  const cells        = useMemo(() => buildGridDays(year, month), [year, month])
  const siblingDates = useMemo(() => buildSiblingDates(selected, dateMap), [selected, dateMap])

  const selectedInquiries = selected ? (dateMap.get(selected) ?? []) : []

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <>
      {/* ─── Country filter ─────────────────────────────────────────────────── */}
      {countries.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => { setCountry(null); setSelected(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
            style={{
              background: country === null ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
              color:      country === null ? '#fff'    : 'rgba(10,46,77,0.55)',
              border:     country === null ? 'none'    : '1px solid rgba(10,46,77,0.1)',
            }}
          >
            All countries
          </button>
          {countries.map(c => (
            <button
              key={c}
              onClick={() => { setCountry(country === c ? null : c); setSelected(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
              style={{
                background: country === c ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
                color:      country === c ? '#fff'    : 'rgba(10,46,77,0.55)',
                border:     country === c ? 'none'    : '1px solid rgba(10,46,77,0.1)',
              }}
            >
              <span>{COUNTRY_FLAG[c] ?? '🌍'}</span>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ─── Status filter ──────────────────────────────────────────────────── */}
      {openPopup != null && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenPopup(null)} />
      )}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {(['lead', 'guide', 'confirmed', 'lost'] as const).map(key => {
          const active    = mainFilter === key
          const count     = groupCounts[key]
          const colors    = MAIN_COLORS[key]
          const popupOpen = openPopup === key
          const subLabel  = active && subFilter != null
            ? SUB_OPTIONS[key].find(o => o.key === subFilter)?.label ?? null
            : null

          return (
            <div key={key} className="relative" style={{ zIndex: popupOpen ? 50 : 'auto' }}>
              <div
                className="flex items-center rounded-full text-sm font-semibold f-body overflow-hidden"
                style={{
                  background: active ? colors.active : 'rgba(10,46,77,0.06)',
                  color:      active ? colors.text   : 'rgba(10,46,77,0.6)',
                  border:     active ? 'none'        : '1px solid rgba(10,46,77,0.1)',
                }}
              >
                {/* Label + count */}
                <button
                  onClick={() => {
                    if (active) { setMainFilter(null); setSubFilter(null) }
                    else { setMainFilter(key); setSubFilter(null) }
                    setOpenPopup(null)
                    setSelected(null)
                  }}
                  className="flex items-center gap-2 pl-4 py-2 pr-2.5"
                >
                  <span>{MAIN_LABELS[key]}</span>
                  {subLabel != null && (
                    <span className="text-[11px] font-normal opacity-70">· {subLabel}</span>
                  )}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active ? 'rgba(255,255,255,0.18)' : 'rgba(10,46,77,0.1)',
                      color:      active ? 'rgba(255,255,255,0.9)'  : 'rgba(10,46,77,0.5)',
                    }}
                  >
                    {count}
                  </span>
                </button>

                {/* Chevron */}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (!active) { setMainFilter(key); setSubFilter(null); setSelected(null) }
                    setOpenPopup(popupOpen ? null : key)
                  }}
                  className="flex items-center px-2.5 py-2 transition-opacity hover:opacity-80"
                  style={{
                    borderLeft: active
                      ? '1px solid rgba(255,255,255,0.15)'
                      : '1px solid rgba(10,46,77,0.1)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    style={{ transition: 'transform 0.15s', transform: popupOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Sub-filter popup */}
              {popupOpen && (
                <div
                  className="absolute top-full left-0 mt-1.5 rounded-[16px] p-1.5 min-w-[200px]"
                  style={{
                    background: '#fff',
                    border:     '1px solid rgba(10,46,77,0.1)',
                    boxShadow:  '0 8px 32px rgba(10,46,77,0.13)',
                    zIndex: 50,
                  }}
                >
                  <button
                    onClick={() => { setSubFilter(null); setOpenPopup(null); setSelected(null) }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body font-semibold transition-colors hover:bg-black/[0.03]"
                    style={{
                      background: subFilter == null ? 'rgba(10,46,77,0.06)' : 'transparent',
                      color: '#0A2E4D',
                    }}
                  >
                    <span>All {MAIN_LABELS[key]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.5)' }}>
                      {count}
                    </span>
                  </button>

                  <div className="my-1 mx-2" style={{ height: 1, background: 'rgba(10,46,77,0.07)' }} />

                  {SUB_OPTIONS[key].map(opt => {
                    const optCount  = statusCounts[opt.key] ?? 0
                    const optActive = subFilter === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSubFilter(opt.key); setOpenPopup(null); setSelected(null) }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body transition-colors hover:bg-black/[0.03]"
                        style={{
                          background: optActive ? 'rgba(10,46,77,0.06)' : 'transparent',
                          color:      '#0A2E4D',
                          fontWeight: optActive ? 600 : 400,
                        }}
                      >
                        <span>{opt.label}</span>
                        {optCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.5)' }}>
                            {optCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Clear status filter */}
        {mainFilter != null && (
          <button
            onClick={() => { setMainFilter(null); setSubFilter(null); setSelected(null) }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs f-body transition-opacity hover:opacity-70"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.1)' }}
          >
            <X size={10} />
            {MAIN_LABELS[mainFilter]}{subFilter != null ? ` · ${SUB_OPTIONS[mainFilter].find(o => o.key === subFilter)?.label}` : ''}
          </button>
        )}
      </div>

      {/* ─── Month nav ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.05]"
          style={{ border: '1px solid rgba(10,46,77,0.12)' }}
        >
          <ChevronLeft size={15} style={{ color: 'rgba(10,46,77,0.6)' }} />
        </button>

        <span className="text-base font-bold f-display text-[#0A2E4D] min-w-[160px] text-center">
          {monthLabel}
        </span>

        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.05]"
          style={{ border: '1px solid rgba(10,46,77,0.12)' }}
        >
          <ChevronRight size={15} style={{ color: 'rgba(10,46,77,0.6)' }} />
        </button>

        <div className="flex-1" />

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] f-body"
          style={{ color: 'rgba(10,46,77,0.45)' }}>
          {[
            { label: 'Active', color: '#FBBF24' },
            { label: 'Offer',  color: '#06B6D4' },
            { label: 'Paid',   color: '#10B981' },
            { label: 'Lost',   color: '#EF4444' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Day-of-week headers ────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1.5">
        {DOW.map(d => (
          <div
            key={d}
            className="text-center text-[9px] font-bold f-body uppercase tracking-[0.14em] py-1.5"
            style={{ color: 'rgba(10,46,77,0.3)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ─── Day grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />

          const inquiries    = dateMap.get(day) ?? []
          const isToday      = day === today
          const isSelected   = day === selected
          const isSibling    = siblingDates.has(day)
          const hasInquiries = inquiries.length > 0
          const dayNum       = parseInt(day.slice(8), 10)

          return (
            <button
              key={day}
              onClick={() => setSelected(isSelected ? null : day)}
              className="flex flex-col items-center pt-2 pb-1.5 px-0.5 rounded-[14px] transition-all min-h-[64px]"
              style={{
                background: isSelected
                  ? '#0A2E4D'
                  : isSibling
                    ? 'rgba(230,126,80,0.08)'
                    : hasInquiries
                      ? 'rgba(10,46,77,0.035)'
                      : 'transparent',
                border: isSelected
                  ? '1.5px solid #0A2E4D'
                  : isSibling
                    ? '1.5px solid rgba(230,126,80,0.4)'
                    : isToday
                      ? '1.5px solid rgba(230,126,80,0.55)'
                      : hasInquiries
                        ? '1px solid rgba(10,46,77,0.1)'
                        : '1px solid transparent',
                cursor: hasInquiries ? 'pointer' : 'default',
              }}
            >
              <span
                className="text-sm font-semibold f-body leading-none mb-1.5"
                style={{
                  color: isSelected
                    ? '#fff'
                    : isSibling
                      ? '#C2410C'
                      : isToday
                        ? '#E67E50'
                        : 'rgba(10,46,77,0.75)',
                }}
              >
                {dayNum}
              </span>

              {/* Status dots */}
              {hasInquiries && (
                <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                  {inquiries.slice(0, 4).map((inq, idx) => (
                    <span
                      key={idx}
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{
                        background: isSelected
                          ? 'rgba(255,255,255,0.75)'
                          : (STATUS_DOT[inq.status] ?? '#9CA3AF'),
                      }}
                    />
                  ))}
                  {inquiries.length > 4 && (
                    <span
                      className="text-[8px] font-bold f-body leading-none self-center"
                      style={{
                        color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(10,46,77,0.4)',
                      }}
                    >
                      +{inquiries.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Right drawer ───────────────────────────────────────────────────── */}
      {selected != null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(10,46,77,0.18)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div
            className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
            style={{
              width: 'min(420px, 100vw)',
              background: '#FDFAF7',
              borderLeft: '1px solid rgba(10,46,77,0.1)',
              boxShadow: '-8px 0 40px rgba(10,46,77,0.12)',
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-start justify-between gap-3 px-6 py-5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}
            >
              <div>
                <p
                  className="text-[9px] uppercase tracking-[0.2em] f-body mb-1"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Trip date
                </p>
                <h2 className="text-xl font-bold f-display text-[#0A2E4D] leading-tight">
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h2>
                <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  {selectedInquiries.length === 0
                    ? 'No inquiries'
                    : `${selectedInquiries.length} inquir${selectedInquiries.length === 1 ? 'y' : 'ies'}`}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.06] mt-0.5"
                style={{ border: '1px solid rgba(10,46,77,0.1)' }}
              >
                <X size={14} style={{ color: 'rgba(10,46,77,0.5)' }} />
              </button>
            </div>

            {/* Drawer cards */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {selectedInquiries.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-[20px] text-center"
                  style={{ background: 'rgba(10,46,77,0.02)', border: '2px dashed rgba(10,46,77,0.1)' }}
                >
                  <p className="text-[#0A2E4D]/40 text-sm f-display">No inquiries on this date</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedInquiries.map(row => {
                    const st          = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending
                    const tripTitle  = row.trip_id ? (tripMap[row.trip_id] ?? '—') : '—'
                    const tripSlug   = row.trip_id ? (slugMap[row.trip_id] ?? null) : null
                    const tripHref   = tripSlug != null
                      ? `/experiences/${tripSlug}`
                      : row.trip_id != null ? `/trips/${row.trip_id}` : null
                    const allDates   = ([...(row.requested_dates ?? [])]).sort() as string[]
                    const otherDates = allDates.filter(d => d !== selected)

                    return (
                      <Link
                        key={row.id}
                        href={`/admin/inquiries/${row.id}`}
                        className="block group"
                        style={{ textDecoration: 'none' }}
                        onClick={() => setSelected(null)}
                      >
                        <div
                          className="px-4 py-3.5 rounded-[18px] transition-all group-hover:shadow-md"
                          style={{
                            background: '#fff',
                            border: '1px solid rgba(10,46,77,0.08)',
                            boxShadow: '0 1px 4px rgba(10,46,77,0.05)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold f-body text-[#0A2E4D] leading-snug">
                              {row.angler_name}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold f-body flex-shrink-0"
                              style={{ background: st.bg, color: st.color, border: st.border }}
                            >
                              {st.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mb-2 min-w-0">
                            <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>
                              {tripTitle}
                            </p>
                            {tripHref != null && (
                              <a
                                href={tripHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded transition-colors hover:bg-black/[0.07]"
                                title="Open experience page"
                              >
                                <ExternalLink size={10} style={{ color: 'rgba(10,46,77,0.4)' }} />
                              </a>
                            )}
                          </div>

                          {/* Date chips — selected day bold, others muted */}
                          {allDates.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {/* Selected date — highlighted */}
                              {selected != null && allDates.includes(selected) && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body"
                                  style={{
                                    background: '#0A2E4D',
                                    color: '#fff',
                                  }}
                                >
                                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {/* Other dates — muted chips */}
                              {otherDates.map(d => (
                                <span
                                  key={d}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] f-body"
                                  style={{
                                    background: 'rgba(230,126,80,0.08)',
                                    color: '#C2410C',
                                    border: '1px solid rgba(230,126,80,0.2)',
                                  }}
                                >
                                  {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 flex-wrap">
                            {row.party_size > 1 && (
                              <span
                                className="text-[11px] f-body px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}
                              >
                                {row.party_size} pax
                              </span>
                            )}
                            {row.internal_commission_eur != null && (
                              <span className="text-[11px] font-bold f-body" style={{ color: '#E67E50' }}>
                                +{row.deal_currency === 'USD' ? '$' : '€'}{Number(row.internal_commission_eur).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
