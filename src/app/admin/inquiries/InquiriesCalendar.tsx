'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/inquiries/state'
import type { InquiryRow } from './InquiriesClient'
import {
  type MainFilter,
  STATUS_GROUPS,
  MAIN_LABELS,
  SUB_OPTIONS,
} from './InquiriesClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  allRows:    InquiryRow[]
  /** tripMap / slugMap / countryMap are keyed by INQUIRY id (resolved via experience-lookup). */
  tripMap:    Record<string, string>
  slugMap:    Record<string, string>
  countryMap: Record<string, string>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
      const c = countryMap[row.id]
      if (c) set.add(c)
    }
    return [...set].sort()
  }, [allRows, countryMap])

  // Filter rows by country first, then by status group/sub
  const filteredRows = useMemo(() => {
    let rows = allRows
    if (country !== null) {
      rows = rows.filter(r => {
        const c = countryMap[r.id]
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
          const c = countryMap[r.id]
          return c === country
        })
      : allRows
    const c: Record<string, number> = {}
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [allRows, country, countryMap])

  const groupCounts = useMemo(() => ({
    lead:      (statusCounts['new'] ?? 0) + (statusCounts['qualifying'] ?? 0),
    guide:     (statusCounts['waiting_guide'] ?? 0) + (statusCounts['offer_presented'] ?? 0) + (statusCounts['awaiting_payment'] ?? 0),
    confirmed: (statusCounts['paid'] ?? 0) + (statusCounts['handed_over'] ?? 0) + (statusCounts['completed'] ?? 0),
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
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all',
              country === null
                ? 'bg-primary text-white'
                : 'bg-primary/[6%] text-primary/55 border border-primary/10',
            )}
          >
            All countries
          </button>
          {countries.map(c => (
            <button
              key={c}
              onClick={() => { setCountry(country === c ? null : c); setSelected(null) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all',
                country === c
                  ? 'bg-primary text-white'
                  : 'bg-primary/[6%] text-primary/55 border border-primary/10',
              )}
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
          const popupOpen = openPopup === key
          const subLabel  = active && subFilter != null
            ? SUB_OPTIONS[key].find(o => o.key === subFilter)?.label ?? null
            : null

          return (
            <div key={key} className={cn('relative', popupOpen && 'z-50')}>
              <div
                data-key={key}
                data-active={String(active)}
                className="filter-tab flex items-center rounded-full text-sm font-semibold f-body overflow-hidden"
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
                    data-active={String(active)}
                    className="filter-count text-[10px] font-bold px-1.5 py-0.5 rounded-full"
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
                  data-active={String(active)}
                  className="filter-chevron flex items-center px-2.5 py-2 transition-opacity hover:opacity-80"
                >
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                    className={cn('transition-transform', popupOpen && 'rotate-180')}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Sub-filter popup */}
              {popupOpen && (
                <div className="absolute top-full left-0 mt-1.5 rounded-[16px] p-1.5 min-w-[200px] bg-white border border-primary/10 shadow-[0_8px_32px_rgba(10,46,77,0.13)] z-50">
                  <button
                    onClick={() => { setSubFilter(null); setOpenPopup(null); setSelected(null) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body font-semibold text-primary transition-colors hover:bg-black/[0.03]',
                      subFilter == null && 'bg-primary/[6%]',
                    )}
                  >
                    <span>All {MAIN_LABELS[key]}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/[8%] text-primary/50">
                      {count}
                    </span>
                  </button>

                  <div className="my-1 mx-2 h-px bg-primary/7" />

                  {SUB_OPTIONS[key].map(opt => {
                    const optCount  = statusCounts[opt.key] ?? 0
                    const optActive = subFilter === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSubFilter(opt.key); setOpenPopup(null); setSelected(null) }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-sm f-body text-primary transition-colors hover:bg-black/[0.03]',
                          optActive ? 'bg-primary/[6%] font-semibold' : 'font-normal',
                        )}
                      >
                        <span>{opt.label}</span>
                        {optCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/[8%] text-primary/50">
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
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs f-body transition-opacity hover:opacity-70 bg-primary/[6%] text-primary/50 border border-primary/10"
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
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.05] border border-primary/[12%]"
        >
          <ChevronLeft size={15} className="text-primary/60" />
        </button>

        <span className="text-base font-bold f-display text-primary min-w-[160px] text-center">
          {monthLabel}
        </span>

        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.05] border border-primary/[12%]"
        >
          <ChevronRight size={15} className="text-primary/60" />
        </button>

        <div className="flex-1" />

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] f-body text-primary/45">
          {[
            { label: 'Active', twClass: 'bg-yellow-400' },
            { label: 'Offer',  twClass: 'bg-cyan-400'   },
            { label: 'Paid',   twClass: 'bg-emerald-500' },
            { label: 'Lost',   twClass: 'bg-red-500'    },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', l.twClass)} />
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
            className="text-center text-[9px] font-bold f-body uppercase tracking-[0.14em] py-1.5 text-primary/30"
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
              data-selected={isSelected ? 'true' : undefined}
              data-sibling={isSibling ? 'true' : undefined}
              data-today={isToday ? 'true' : undefined}
              data-has-inquiries={hasInquiries ? 'true' : undefined}
              className="cal-day-cell flex flex-col items-center pt-2 pb-1.5 px-0.5 rounded-[14px] transition-all min-h-[64px]"
            >
              <span
                data-selected={isSelected ? 'true' : undefined}
                data-sibling={isSibling ? 'true' : undefined}
                data-today={isToday ? 'true' : undefined}
                className="cal-day-num text-sm font-semibold f-body leading-none mb-1.5"
              >
                {dayNum}
              </span>

              {/* Status dots */}
              {hasInquiries && (
                <div className="flex flex-wrap gap-0.5 justify-center px-0.5">
                  {inquiries.slice(0, 4).map((inq, idx) => (
                    <span
                      key={idx}
                      data-status={inq.status}
                      data-selected={isSelected ? 'true' : undefined}
                      className="cal-status-dot w-[6px] h-[6px] rounded-full flex-shrink-0"
                    />
                  ))}
                  {inquiries.length > 4 && (
                    <span
                      className={cn(
                        'text-[8px] font-bold f-body leading-none self-center',
                        isSelected ? 'text-white/70' : 'text-primary/40',
                      )}
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
            className="fixed inset-0 z-40 bg-primary/[18%] backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden w-[min(420px,100vw)] bg-[#FDFAF7] border-l border-primary/10 shadow-[-8px_0_40px_rgba(10,46,77,0.12)]">
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 flex-shrink-0 border-b border-primary/[8%]">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] f-body mb-1 text-primary/38">
                  Trip date
                </p>
                <h2 className="text-xl font-bold f-display text-primary leading-tight">
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h2>
                <p className="text-sm f-body mt-1 text-primary/45">
                  {selectedInquiries.length === 0
                    ? 'No inquiries'
                    : `${selectedInquiries.length} inquir${selectedInquiries.length === 1 ? 'y' : 'ies'}`}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-black/[0.06] mt-0.5 border border-primary/10"
              >
                <X size={14} className="text-primary/50" />
              </button>
            </div>

            {/* Drawer cards */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {selectedInquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-[20px] text-center bg-primary/[2%] border-2 border-dashed border-primary/10">
                  <p className="text-primary/40 text-sm f-display">No inquiries on this date</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedInquiries.map(row => {
                    const statusLabel = (STATUS_LABELS as Record<string, string>)[row.status] ?? row.status
                    const tripTitle  = tripMap[row.id] ?? '—'
                    const tripSlug   = slugMap[row.id] ?? null
                    const tripHref   = tripSlug != null
                      ? `/experiences/${tripSlug}`
                      : row.trip_id != null ? `/trips/${row.trip_id}` : null
                    const allDates   = ([...(row.requested_dates ?? [])]).sort() as string[]
                    const otherDates = allDates.filter(d => d !== selected)

                    return (
                      <Link
                        key={row.id}
                        href={`/admin/inquiries/${row.id}`}
                        className="block group no-underline"
                        onClick={() => setSelected(null)}
                      >
                        <div className="px-4 py-3.5 rounded-[18px] transition-all group-hover:shadow-md bg-white border border-primary/[8%] shadow-[0_1px_4px_rgba(10,46,77,0.05)]">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold f-body text-primary leading-snug">
                              {row.angler_name}
                            </span>
                            <span
                              data-status={row.status}
                              className="status-badge px-2 py-0.5 rounded-full text-[10px] font-bold f-body flex-shrink-0"
                            >
                              {statusLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mb-2 min-w-0">
                            <p className="text-xs f-body truncate text-primary/50">
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
                                <ExternalLink size={10} className="text-primary/40" />
                              </a>
                            )}
                          </div>

                          {/* Date chips — selected day bold, others muted */}
                          {allDates.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {/* Selected date — highlighted */}
                              {selected != null && allDates.includes(selected) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body bg-primary text-white">
                                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {/* Other dates — muted chips */}
                              {otherDates.map(d => (
                                <span
                                  key={d}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] f-body bg-accent/[8%] text-orange-700 border border-accent/20"
                                >
                                  {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 flex-wrap">
                            {row.party_size > 1 && (
                              <span className="text-[11px] f-body px-1.5 py-0.5 rounded-full bg-primary/[6%] text-primary/50">
                                {row.party_size} pax
                              </span>
                            )}
                            {row.internal_commission_eur != null && (
                              <span className="text-[11px] font-bold f-body text-accent">
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
