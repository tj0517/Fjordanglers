'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/inquiries/state'
import { Button } from '@/components/ui/button'
import type { InquiryRow } from './InquiriesClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  rows:    InquiryRow[]
  tripMap: Record<string, string>
  slugMap: Record<string, string>
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

export function InquiriesCalendar({ rows, tripMap, slugMap }: Props) {
  const today = useMemo(() => toIsoDate(new Date()), [])

  const [year,     setYear    ] = useState(() => new Date().getFullYear())
  const [month,    setMonth   ] = useState(() => new Date().getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  const dateMap      = useMemo(() => buildDateMap(rows), [rows])
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
      {/* ─── Month nav ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          className="rounded-full border border-border"
        >
          <ChevronLeft size={15} className="text-primary/60" />
        </Button>

        <span className="text-base font-bold f-display text-primary min-w-[160px] text-center">
          {monthLabel}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="rounded-full border border-border"
        >
          <ChevronRight size={15} className="text-primary/60" />
        </Button>

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
            <Button
              key={day}
              variant="ghost"
              onClick={() => setSelected(isSelected ? null : day)}
              data-selected={isSelected ? 'true' : undefined}
              data-sibling={isSibling ? 'true' : undefined}
              data-today={isToday ? 'true' : undefined}
              data-has-inquiries={hasInquiries ? 'true' : undefined}
              className="cal-day-cell flex flex-col items-center pt-2 pb-1.5 px-0.5 rounded-[14px] min-h-[64px] h-auto w-auto transition-all hover:bg-transparent"
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
            </Button>
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
          <div className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden w-[min(420px,100vw)] bg-background border-l border-border shadow-[-8px_0_40px_rgba(10,46,77,0.12)]">
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 flex-shrink-0 border-b border-border">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] f-body mb-1 text-muted-foreground">
                  Trip date
                </p>
                <h2 className="text-xl font-bold f-display text-primary leading-tight">
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h2>
                <p className="text-sm f-body mt-1 text-muted-foreground">
                  {selectedInquiries.length === 0
                    ? 'No inquiries'
                    : `${selectedInquiries.length} inquir${selectedInquiries.length === 1 ? 'y' : 'ies'}`}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                className="flex-shrink-0 rounded-full border border-border mt-0.5"
              >
                <X size={14} />
              </Button>
            </div>

            {/* Drawer cards */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {selectedInquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-[20px] text-center bg-muted/30 border-2 border-dashed border-border">
                  <p className="text-muted-foreground text-sm f-display">No inquiries on this date</p>
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
                        <div className="px-4 py-3.5 rounded-[18px] transition-all group-hover:shadow-md bg-card border border-border shadow-[0_1px_4px_rgba(10,46,77,0.05)]">
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
                            <p className="text-xs f-body truncate text-muted-foreground">
                              {tripTitle}
                            </p>
                            {tripHref != null && (
                              <a
                                href={tripHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded transition-colors hover:bg-muted"
                                title="Open experience page"
                              >
                                <ExternalLink size={10} className="text-muted-foreground" />
                              </a>
                            )}
                          </div>

                          {/* Date chips — selected day bold, others muted */}
                          {allDates.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {selected != null && allDates.includes(selected) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold f-body bg-primary text-white">
                                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
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
                              <span className="text-[11px] f-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
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
