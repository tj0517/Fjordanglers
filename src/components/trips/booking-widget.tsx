'use client'

/**
 * BookingWidget — Direct booking panel shown on /trips/[id].
 *
 * Shown only for experiences with booking_type = 'classic' | 'both'.
 *
 * UI flow:
 *   idle → date picker + package dropdown + guests + price breakdown
 *   "Request to Book →" navigates to /book/[expId]?dates=...&pkg=...&guests=...
 *   All auth / confirming / success / error states live on the booking page.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, Minus, Plus,
} from 'lucide-react'
import type { DurationOptionPayload } from '@/actions/experiences'
import { useBookingState } from '@/contexts/booking-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlockedRange {
  date_start: string
  date_end: string
}

interface InitialUser {
  id: string
  email: string
  name: string
}

interface ExperienceSummary {
  id: string
  title: string
  price_per_person_eur: number
  max_guests: number
  duration_options: DurationOptionPayload[] | null
  booking_type: string
}

export interface BookingWidgetProps {
  experience: ExperienceSummary
  guideId: string
  guideName: string
  blockedRanges: BlockedRange[]
  commissionRate: number
  initialUser: InitialUser | null
}

type OpenDropdown = 'date' | 'package' | null

// ─── Price helpers ────────────────────────────────────────────────────────────

function calcSubtotal(pkg: DurationOptionPayload, guests: number, days: number): number {
  switch (pkg.pricing_type) {
    case 'per_person': return pkg.price_eur * guests * days
    case 'per_boat':   return pkg.price_eur * days
    case 'per_group':  return (pkg.group_prices?.[String(guests)] ?? pkg.price_eur) * days
    default:           return pkg.price_eur * guests * days
  }
}

function calcServiceFee(subtotal: number): number {
  return Math.min(Math.round(subtotal * 0.05 * 100) / 100, 50)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isBlocked(date: string, ranges: BlockedRange[]): boolean {
  return ranges.some(r => date >= r.date_start && date <= r.date_end)
}

function pkgDays(pkg: DurationOptionPayload): number {
  return pkg.days ?? 1
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtEur(amount: number): string {
  return `€${amount.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── MiniCalendar (multi-select: tap individual dates, not a range) ───────────

interface MiniCalendarProps {
  selectedDates: string[]           // set of selected YYYY-MM-DD strings
  blockedRanges: BlockedRange[]
  onToggle: (date: string) => void  // toggle a single date in/out
  onClearAll: () => void
}

function MiniCalendar({ selectedDates, blockedRanges, onToggle, onClearAll }: MiniCalendarProps) {
  const today = isoToday()
  const [viewYear, setViewYear]   = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthName = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offset      = (firstDay + 6) % 7  // Monday = 0

  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'rgba(10,46,77,0.4)' }} aria-label="Previous month">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'rgba(10,46,77,0.4)', transform: 'rotate(180deg)' }} aria-label="Next month">
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold f-body py-0.5"
            style={{ color: 'rgba(10,46,77,0.28)' }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />

          const d        = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast   = d < today
          const blocked  = isBlocked(d, blockedRanges)
          const disabled = isPast || blocked
          const selected = selectedSet.has(d)

          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggle(d)}
              className="aspect-square flex items-center justify-center rounded-md transition-all f-body relative"
              style={{
                background:  selected ? '#E67E50' : 'transparent',
                color:       selected ? '#fff'
                             : blocked && !isPast ? 'rgba(10,46,77,0.18)'
                             : '#0A2E4D',
                opacity:     isPast ? 0.22 : 1,
                cursor:      disabled ? 'not-allowed' : 'pointer',
                fontWeight:  selected ? '700' : '400',
                fontSize:    '11px',
                boxShadow:   selected ? '0 2px 6px rgba(230,126,80,0.35)' : 'none',
                transform:   selected ? 'scale(1.08)' : 'scale(1)',
              }}
              aria-label={`${d}${blocked ? ' — unavailable' : ''}${selected ? ' — selected' : ''}`}
              aria-pressed={selected}
            >
              {day}
              {/* Guide-blocked dot */}
              {blocked && !isPast && (
                <span style={{
                  position: 'absolute', bottom: '2px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px', height: '3px', borderRadius: '50%',
                  background: 'rgba(10,46,77,0.2)',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Footer: count + legend */}
      <div className="flex items-center justify-between mt-2 pt-2"
        style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
        <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {selectedDates.length === 0
            ? 'Tap dates to select'
            : `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected`
          }
        </span>
        {selectedDates.length > 0 && (
          <button type="button"
            className="text-[10px] f-body font-semibold transition-colors"
            style={{ color: 'rgba(10,46,77,0.4)' }}
            onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

// ─── BookingWidget ────────────────────────────────────────────────────────────

export function BookingWidget({
  experience,
  guideName,
  blockedRanges,
  commissionRate: _commissionRate,
}: BookingWidgetProps) {

  const router = useRouter()

  // ── State ────────────────────────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const dateRef = useRef<HTMLDivElement>(null)
  const pkgRef  = useRef<HTMLDivElement>(null)

  // Close dropdowns on click outside
  useEffect(() => {
    if (openDropdown == null) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      const inDate = dateRef.current?.contains(t) ?? false
      const inPkg  = pkgRef.current?.contains(t) ?? false
      if (!inDate && !inPkg) setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [openDropdown])

  // Shared booking state (synced with left column via context)
  const { selectedDates, toggleDate, clearDates, selectedPkg, setSelectedPkg } = useBookingState()

  // Selection (packages list is local — only the selected value is shared via context)
  const packages = useMemo(
    () => Array.isArray(experience.duration_options) && experience.duration_options.length > 0
      ? experience.duration_options as DurationOptionPayload[]
      : null,
    [experience.duration_options],
  )
  const [guests, setGuests] = useState(1)

  // ── Computed ─────────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (selectedDates.length > 0) return selectedDates.length
    return selectedPkg != null ? pkgDays(selectedPkg) : 1
  }, [selectedDates, selectedPkg])

  const subtotalEur = useMemo(() => {
    if (selectedPkg != null) return calcSubtotal(selectedPkg, guests, days)
    return experience.price_per_person_eur * guests * days
  }, [selectedPkg, guests, days, experience.price_per_person_eur])

  const serviceFeeEur = useMemo(() => calcServiceFee(subtotalEur), [subtotalEur])
  const totalEur      = subtotalEur + serviceFeeEur

  const fromPrice = useMemo(() => {
    if (selectedPkg == null) return `€${experience.price_per_person_eur}/pp`
    switch (selectedPkg.pricing_type) {
      case 'per_person': return `€${selectedPkg.price_eur}/pp`
      case 'per_boat':   return `€${selectedPkg.price_eur} flat`
      case 'per_group':  return `€${selectedPkg.price_eur}+`
    }
  }, [selectedPkg, experience.price_per_person_eur])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePkgChange = useCallback((pkg: DurationOptionPayload) => {
    setSelectedPkg(pkg)   // context setter also clears dates
    setOpenDropdown(null)
  }, [setSelectedPkg])

  const handleGuestsChange = useCallback((delta: number) => {
    setGuests(prev => Math.max(1, Math.min(prev + delta, experience.max_guests)))
  }, [experience.max_guests])

  function handleBookNow() {
    if (selectedDates.length === 0) return
    const sorted = [...selectedDates].sort()
    const params = new URLSearchParams()
    params.set('dates', sorted.join(','))
    params.set('guests', String(guests))
    if (selectedPkg != null) params.set('pkg', selectedPkg.label)
    router.push(`/book/${experience.id}?${params}`)
  }

  // ── Date label helper ─────────────────────────────────────────────────────
  const dateTriggerLabel = selectedDates.length === 0
    ? 'Select dates'
    : selectedDates.length === 1
      ? fmtDate(selectedDates[0])
      : `${selectedDates.length} dates selected`

  // ── IDLE — main panel ─────────────────────────────────────────────────────
  const canBook = selectedDates.length > 0

  return (
    <div className="rounded-3xl overflow-visible" style={card}>

      {/* ── 1. Date picker — very top ── */}
      <div className="px-5 pt-5 pb-4">
        <div ref={dateRef} style={{ position: 'relative' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 f-body"
            style={{ color: 'rgba(255,255,255,0.42)' }}>Dates</p>
          <button
            type="button"
            onClick={() => setOpenDropdown(o => o === 'date' ? null : 'date')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all f-body"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: openDropdown === 'date'
                ? '1.5px solid #E67E50'
                : selectedDates.length > 0
                  ? '1.5px solid rgba(230,126,80,0.5)'
                  : '1.5px solid rgba(255,255,255,0.12)',
              boxShadow: openDropdown === 'date' ? '0 0 0 3px rgba(230,126,80,0.15)' : 'none',
            }}
            aria-expanded={openDropdown === 'date'}
          >
            <span className="text-sm f-body"
              style={{ color: selectedDates.length > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.35)', fontWeight: selectedDates.length > 0 ? '600' : '400' }}>
              {dateTriggerLabel}
            </span>
            <ChevronDown size={14}
              style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0,
                transform: openDropdown === 'date' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s' }} />
          </button>

          {openDropdown === 'date' && (
            <div className="absolute left-0 right-0 z-50 mt-1 p-3 rounded-2xl"
              style={{ background: '#fff', border: '1.5px solid rgba(10,46,77,0.09)', boxShadow: '0 8px 28px rgba(10,46,77,0.13)' }}>
              <MiniCalendar
                selectedDates={selectedDates}
                blockedRanges={blockedRanges}
                onToggle={toggleDate}
                onClearAll={clearDates}
              />
            </div>
          )}
        </div>
      </div>

      {/* divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

      <div className="px-5 pt-4 pb-5 space-y-0">

        {/* ── 2. Package dropdown ── */}
        {packages != null && (
          <div ref={pkgRef} style={{ position: 'relative' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 f-body"
              style={{ color: 'rgba(255,255,255,0.42)' }}>Package</p>
            <button
              type="button"
              onClick={() => setOpenDropdown(o => o === 'package' ? null : 'package')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all f-body"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: openDropdown === 'package'
                  ? '1.5px solid #E67E50'
                  : '1.5px solid rgba(255,255,255,0.12)',
                boxShadow: openDropdown === 'package' ? '0 0 0 3px rgba(230,126,80,0.15)' : 'none',
              }}
              aria-expanded={openDropdown === 'package'}
            >
              <div className="text-left">
                <span className="text-sm font-semibold f-body"
                  style={{ color: selectedPkg != null ? '#FFFFFF' : 'rgba(255,255,255,0.35)', fontWeight: selectedPkg != null ? '600' : '400' }}>
                  {selectedPkg?.label ?? 'Select package'}
                </span>
                {selectedPkg != null && (
                  <span className="ml-2 text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {selectedPkg.hours != null ? `${selectedPkg.hours}h` : selectedPkg.days != null ? `${selectedPkg.days}d` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedPkg != null && (
                  <span className="text-sm font-bold f-body" style={{ color: '#E67E50' }}>
                    {selectedPkg.pricing_type === 'per_person' ? `€${selectedPkg.price_eur}/pp`
                      : selectedPkg.pricing_type === 'per_boat' ? `€${selectedPkg.price_eur} flat`
                      : `€${selectedPkg.price_eur}+`}
                  </span>
                )}
                <ChevronDown size={14}
                  style={{ color: 'rgba(255,255,255,0.4)',
                    transform: openDropdown === 'package' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s' }} />
              </div>
            </button>

            {openDropdown === 'package' && (
              <div className="absolute left-0 right-0 z-50 mt-1 rounded-2xl overflow-hidden"
                style={{ background: '#fff', border: '1.5px solid rgba(10,46,77,0.09)', boxShadow: '0 8px 28px rgba(10,46,77,0.13)' }}>
                {packages.map((pkg, idx) => {
                  const isSelected = selectedPkg?.label === pkg.label
                  const pricePart = pkg.pricing_type === 'per_person' ? `€${pkg.price_eur}/pp`
                    : pkg.pricing_type === 'per_boat' ? `€${pkg.price_eur} flat` : `€${pkg.price_eur}+`
                  const durPart = pkg.hours != null ? `${pkg.hours}h` : pkg.days != null ? `${pkg.days} ${pkg.days === 1 ? 'day' : 'days'}` : ''
                  return (
                    <button key={pkg.label} type="button"
                      onClick={() => handlePkgChange(pkg)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors f-body"
                      style={{
                        background: isSelected ? 'rgba(230,126,80,0.07)' : 'transparent',
                        borderTop: idx > 0 ? '1px solid rgba(10,46,77,0.05)' : 'none',
                      }}>
                      <div>
                        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{pkg.label}</p>
                        {durPart && <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{durPart}</p>}
                      </div>
                      <span className="text-sm font-bold f-body ml-3"
                        style={{ color: isSelected ? '#E67E50' : 'rgba(10,46,77,0.65)' }}>{pricePart}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* divider before guests */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '12px 0' }} />

        {/* ── 3. Guests stepper ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 f-body"
            style={{ color: 'rgba(255,255,255,0.42)' }}>Anglers</p>
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
            <button type="button" onClick={() => handleGuestsChange(-1)} disabled={guests <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{
                background: guests <= 1 ? 'transparent' : 'rgba(255,255,255,0.1)',
                color: guests <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
                cursor: guests <= 1 ? 'not-allowed' : 'pointer',
              }} aria-label="Remove angler">
              <Minus size={13} />
            </button>
            <span className="text-sm font-bold f-body" style={{ color: '#FFFFFF' }}>
              {guests} {guests === 1 ? 'angler' : 'anglers'}
            </span>
            <button type="button" onClick={() => handleGuestsChange(+1)} disabled={guests >= experience.max_guests}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{
                background: guests >= experience.max_guests ? 'transparent' : 'rgba(255,255,255,0.1)',
                color: guests >= experience.max_guests ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
                cursor: guests >= experience.max_guests ? 'not-allowed' : 'pointer',
              }} aria-label="Add angler">
              <Plus size={13} />
            </button>
          </div>
          {experience.max_guests <= 8 && (
            <p className="text-[10px] mt-1 text-right f-body" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Max {experience.max_guests} anglers
            </p>
          )}
        </div>

        {/* divider before price */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '12px 0' }} />

        {/* ── 4. Price breakdown ── */}
        <div className="rounded-xl p-3.5"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="space-y-1 mb-2.5">
            <div className="flex justify-between text-xs f-body">
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                {selectedPkg != null
                  ? `${selectedPkg.label}${selectedPkg.pricing_type === 'per_person' ? ` × ${guests}` : ''}${days > 1 ? ` × ${days}d` : ''}`
                  : `€${experience.price_per_person_eur} × ${guests} × ${days}d`
                }
              </span>
              <span className="font-semibold" style={{ color: '#FFFFFF' }}>{fmtEur(subtotalEur)}</span>
            </div>
            <div className="flex justify-between text-xs f-body">
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Service fee (5%{serviceFeeEur >= 50 ? ', capped' : ''})</span>
              <span className="font-semibold" style={{ color: '#FFFFFF' }}>+{fmtEur(serviceFeeEur)}</span>
            </div>
            <div className="flex justify-between text-sm f-body font-bold pt-1.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}>
              <span>Estimated total</span>
              <span style={{ color: '#E67E50' }}>{fmtEur(totalEur)}</span>
            </div>
          </div>

          <button type="button" disabled={!canBook} onClick={handleBookNow}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all f-body"
            style={{
              background: canBook ? '#E67E50' : 'rgba(255,255,255,0.1)',
              color: canBook ? '#fff' : 'rgba(255,255,255,0.28)',
              cursor: canBook ? 'pointer' : 'not-allowed',
              boxShadow: canBook ? '0 4px 14px rgba(230,126,80,0.35)' : 'none',
            }}
            aria-disabled={!canBook}>
            {canBook ? 'Request to Book →' : 'Select dates to continue'}
          </button>
        </div>

        {/* ── 5. Trust signals ── */}
        <div className="space-y-1.5 pt-2">
          {[
            'No card or payment needed to request',
            'Guide confirms or declines within 48 hours',
            'You pay directly with the guide after confirmation',
          ].map(text => (
            <div key={text} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgba(230,126,80,0.6)' }} />
              <span className="text-[11px] f-body" style={{ color: 'rgba(255,255,255,0.38)' }}>{text}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

// ─── MobileBookingBar ─────────────────────────────────────────────────────────

export function MobileBookingBar({
  experienceId,
}: {
  experienceId: string
}) {
  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4"
      style={{
        background:     'rgba(243,237,228,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop:      '1px solid rgba(10,46,77,0.08)',
        boxShadow:      '0 -4px 24px rgba(10,46,77,0.08)',
        paddingTop:     '10px',
        paddingBottom:  'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <a
        href={`/book/${experienceId}`}
        className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-bold text-white f-body"
        style={{ background: '#E67E50', boxShadow: '0 4px 14px rgba(230,126,80,0.28)' }}
      >
        Request to Book →
      </a>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#0A2E4D',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 8px 32px rgba(10,46,77,0.3)',
}

const inputStyle: React.CSSProperties = {
  background: '#fff',
  border: '1.5px solid rgba(10,46,77,0.14)',
  color: '#0A2E4D',
}

// ─── SummaryRow ───────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span className="text-xs f-body" style={{ color: '#FFFFFF', fontWeight: bold ? '700' : '500' }}>
        {value}
      </span>
    </div>
  )
}

// ─── AvailabilityCalendarBanner ───────────────────────────────────────────────
// Full-width 2-month availability calendar for the left content column.
// Display-only: shows guide's blocked vs. available dates at a glance.

export function AvailabilityCalendarBanner({
  blockedRanges,
}: {
  blockedRanges: BlockedRange[]
}) {
  const { selectedDates, toggleDate, clearDates } = useBookingState()
  const [today] = useState(isoToday)
  const [monthOffset, setMonthOffset] = useState(0)

  const months = useMemo(() => {
    const now  = new Date()
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const m0   = { year: base.getFullYear(), month: base.getMonth() }
    const next = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    const m1   = { year: next.getFullYear(), month: next.getMonth() }
    return [m0, m1]
  }, [monthOffset])

  return (
    <section className="mb-12">
      {/* Rule */}
      <div className="h-px mb-4" style={{ background: 'linear-gradient(to right, #E67E50, rgba(230,126,80,0.12))' }} />
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body" style={{ color: '#E67E50' }}>
            Availability
          </p>
          <h2 className="text-[#0A2E4D] text-2xl font-bold f-display">
            Pick your dates
          </h2>
        </div>
        {/* Month navigation arrows */}
        <div className="flex items-center gap-1 pb-0.5">
          <button
            type="button"
            onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
            disabled={monthOffset === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{
              background: monthOffset === 0 ? 'rgba(10,46,77,0.04)' : 'rgba(230,126,80,0.1)',
              border: '1px solid',
              borderColor: monthOffset === 0 ? 'rgba(10,46,77,0.08)' : 'rgba(230,126,80,0.25)',
              color: monthOffset === 0 ? 'rgba(10,46,77,0.2)' : '#E67E50',
              cursor: monthOffset === 0 ? 'not-allowed' : 'pointer',
            }}
            aria-label="Previous months"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset(o => o + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{
              background: 'rgba(230,126,80,0.1)',
              border: '1px solid rgba(230,126,80,0.25)',
              color: '#E67E50',
              cursor: 'pointer',
            }}
            aria-label="Next months"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Tap available days to select them — your choices sync with the booking panel.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {months.map(({ year, month }) => (
          <MonthCalendarDisplay
            key={`${year}-${month}`}
            year={year}
            month={month}
            today={today}
            blockedRanges={blockedRanges}
            selectedDates={selectedDates}
            onToggle={toggleDate}
          />
        ))}
      </div>

      {/* Status + legend */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(22,163,74,0.3)' }} />
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#E67E50' }} />
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(10,46,77,0.07)' }} />
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Unavailable</span>
          </div>
        </div>
        {selectedDates.length > 0 && (
          <button type="button" onClick={clearDates}
            className="text-xs f-body font-semibold transition-colors"
            style={{ color: '#E67E50' }}>
            Clear {selectedDates.length} selected →
          </button>
        )}
      </div>
    </section>
  )
}

function MonthCalendarDisplay({
  year,
  month,
  today,
  blockedRanges,
  selectedDates,
  onToggle,
}: {
  year: number
  month: number
  today: string
  blockedRanges: BlockedRange[]
  selectedDates: string[]
  onToggle: (date: string) => void
}) {
  const monthName   = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset      = (firstDay + 6) % 7  // Monday = 0

  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  return (
    <div className="p-5 rounded-2xl"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.04)' }}>
      <p className="text-sm font-bold f-body mb-3" style={{ color: '#0A2E4D' }}>{monthName}</p>

      <div className="grid grid-cols-7 mb-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold f-body py-0.5"
            style={{ color: 'rgba(10,46,77,0.28)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />

          const d        = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast   = d < today
          const blocked  = isBlocked(d, blockedRanges)
          const disabled = isPast || blocked
          const selected = selectedSet.has(d)

          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggle(d)}
              className="aspect-square flex items-center justify-center rounded text-[11px] f-body transition-all"
              style={{
                background: selected           ? '#E67E50'
                  : isPast                     ? 'transparent'
                  : blocked                    ? 'rgba(10,46,77,0.06)'
                  :                              'rgba(22,163,74,0.13)',
                color: selected                ? '#fff'
                  : isPast                     ? 'rgba(10,46,77,0.15)'
                  : blocked                    ? 'rgba(10,46,77,0.28)'
                  :                              'rgba(10,46,77,0.75)',
                textDecoration: blocked && !isPast ? 'line-through' : 'none',
                fontWeight:     selected || (!isPast && !blocked) ? '600' : '400',
                cursor:         disabled ? 'not-allowed' : 'pointer',
                transform:      selected ? 'scale(1.08)' : 'scale(1)',
                boxShadow:      selected ? '0 2px 6px rgba(230,126,80,0.35)' : 'none',
              }}
              aria-label={`${d}${blocked ? ' — unavailable' : ''}${selected ? ' — selected' : ''}`}
              aria-pressed={selected}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
