'use client'

/**
 * BookingDateStep — Step 1 of the booking flow.
 *
 * Two modes (tab selector at top):
 *
 *  "Book directly"  (mode = 'direct')
 *    • Angler picks one specific date on an inline calendar
 *    • Group size stepper
 *    • Live price estimate
 *    • CTA → /book/[expId]?windowFrom=…&windowTo=…&numDays=1&durationType=full_day&guests=…
 *
 *  "Send request"  (mode = 'request')
 *    • Angler picks an availability window (date range from the multi-period picker)
 *    • Trip duration (half / full / multi-day) + days stepper
 *    • Group size stepper
 *    • Live price estimate
 *    • CTA → /book/[expId]?windowFrom=…&windowTo=…&numDays=N&durationType=X&guests=…
 *
 * No payment in either mode — guide always confirms first.
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import type { DurationOptionPayload } from '@/actions/experiences'
import {
  MultiPeriodPicker,
  encodePeriodsParam,
  type Period,
  type BlockedRange,
} from '@/components/trips/multi-period-picker'
import { HelpWidget } from '@/components/ui/help-widget'
import { FieldTooltip } from '@/components/ui/field-tooltip'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE = 0.05

type BookingMode = 'direct' | 'request'

// ─── Package helpers ──────────────────────────────────────────────────────────

/** Human-readable label for a duration option */
function pkgLabel(opt: DurationOptionPayload): string {
  if (opt.label && opt.label !== 'Standard') return opt.label
  if (opt.hours != null) return `${opt.hours} hours`
  if (opt.days  != null) return `${opt.days} ${opt.days === 1 ? 'day' : 'days'}`
  return opt.label || 'Standard'
}

/** How many trip-days this package represents (1 for sub-day options) */
function pkgDays(opt: DurationOptionPayload): number {
  if (opt.days != null && opt.days > 0) return opt.days
  return 1
}

/** Total price for a package at a given group size */
function pkgTotal(opt: DurationOptionPayload, groupSize: number): number {
  if (opt.pricing_type === 'per_boat') return opt.price_eur
  if (opt.pricing_type === 'per_group') {
    const gp = opt.group_prices as Record<string, number> | undefined
    return gp?.[String(groupSize)] ?? opt.price_eur
  }
  return Math.round(opt.price_eur * groupSize * 100) / 100
}

/** Sub-label for the package card price display */
function pkgPriceLabel(opt: DurationOptionPayload): string {
  if (opt.pricing_type === 'per_boat')  return 'per boat'
  if (opt.pricing_type === 'per_group') return 'per group'
  return 'per person'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  expId:               string
  pricePerPerson:      number
  maxGuests:           number
  initialGuests:       number
  availabilityConfig:  AvailConfigRow | null
  blockedDates:        BlockedRange[]
  rawDurationOptions?: unknown
  /** Which tab to open by default ('direct' | 'request') */
  initialMode?:        'direct' | 'request'
  /** Dates to pre-select in the "Book directly" calendar */
  initialDates?:       string[]
}

// ─── ISO helpers ──────────────────────────────────────────────────────────────

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Return an ISO date string N calendar days after isoDate. */
function addDays(isoDate: string, n: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-')
  const date = new Date(Number(yStr), Number(mStr) - 1, Number(dStr) + n)
  return toISO(date.getFullYear(), date.getMonth(), date.getDate())
}

// ─── Day status ───────────────────────────────────────────────────────────────

type DayStatus = 'available' | 'blocked' | 'unavailable' | 'past'

function getDayStatus(
  y: number, m: number, d: number,
  minISO: string,
  maxISO: string,
  config: AvailConfigRow | null,
  blocked: BlockedRange[],
): DayStatus {
  const iso = toISO(y, m, d)
  if (iso < minISO) return 'past'
  if (iso > maxISO) return 'unavailable'
  for (const r of blocked) {
    if (iso >= r.date_start && iso <= r.date_end) return 'blocked'
  }
  if (config) {
    const month1 = m + 1
    if (config.available_months.length > 0 && !config.available_months.includes(month1))
      return 'unavailable'
    const weekday = new Date(y, m, d).getDay()
    if (config.available_weekdays.length > 0 && !config.available_weekdays.includes(weekday))
      return 'unavailable'
  }
  return 'available'
}

// ─── DirectDateCalendar ───────────────────────────────────────────────────────

/**
 * Month calendar for "Book directly" mode.
 *
 * numDays === 1  → multi-select individual dates (green dot per day)
 * numDays  >  1  → range-start picker: click a start date → entire N-day span
 *                  highlights; clicking same date again deselects.
 */
function DirectDateCalendar({
  selected,
  onToggle,
  availabilityConfig,
  blockedDates,
  numDays = 1,
}: {
  selected:           string[]
  onToggle:           (iso: string) => void
  availabilityConfig: AvailConfigRow | null
  blockedDates:       BlockedRange[]
  numDays?:           number
}) {
  const isRangeMode = numDays > 1

  const now     = new Date()
  const todayY  = now.getFullYear()
  const todayM  = now.getMonth()
  const todayD  = now.getDate()
  const todayISO = toISO(todayY, todayM, todayD)

  const advHours = availabilityConfig?.advance_notice_hours ?? 0
  const minDate  = new Date(now.getTime() + advHours * 3_600_000)
  const minISO   = toISO(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())

  const maxDays  = availabilityConfig?.max_advance_days ?? 365
  const maxDate  = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const maxISO   = toISO(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())

  const [viewY, setViewY] = useState(todayY)
  const [viewM, setViewM] = useState(todayM)

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7

  const canPrev = viewY > todayY || (viewY === todayY && viewM > todayM)
  const canNext = (() => {
    const ny = viewM === 11 ? viewY + 1 : viewY
    const nm = viewM === 11 ? 0 : viewM + 1
    return toISO(ny, nm, 1) <= maxISO
  })()

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) }
    else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) }
    else setViewM(m => m + 1)
  }

  // Range mode: derive start / end from the single selected start date
  const rangeStart = isRangeMode ? (selected[0] ?? null) : null
  const rangeEnd   = rangeStart != null ? addDays(rangeStart, numDays - 1) : null

  // Count available days for subheading (single-day mode only — range mode shows hint instead)
  const availableCount = useMemo(() => {
    if (isRangeMode) return 0
    let n = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (getDayStatus(viewY, viewM, d, minISO, maxISO, availabilityConfig, blockedDates) === 'available') n++
    }
    return n
  }, [isRangeMode, viewY, viewM, daysInMonth, minISO, maxISO, availabilityConfig, blockedDates])

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.1)' }}
    >
      <div className="p-4">

        {/* Range mode hint banner */}
        {isRangeMode && (
          <div
            className="mb-3 px-3 py-2 rounded-xl text-center"
            style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.14)' }}
          >
            <p className="text-[11px] f-body font-medium" style={{ color: '#C4622A' }}>
              Pick the <strong>start date</strong> — we'll block out {numDays} consecutive days
            </p>
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous month"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.08)' }}
          >
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M5 1L1 5l4 4" stroke="#0A2E4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
              {MONTH_NAMES[viewM]} {viewY}
            </p>
            {!isRangeMode && availableCount > 0 && (
              <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                {availableCount} day{availableCount === 1 ? '' : 's'} open
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Next month"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.08)' }}
          >
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M1 1l4 4-4 4" stroke="#0A2E4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mt-3 mb-1.5">
          {WEEKDAY_LABELS.map(wl => (
            <p
              key={wl}
              className="text-center text-[9px] font-bold uppercase tracking-wide f-body"
              style={{ color: 'rgba(10,46,77,0.28)' }}
            >
              {wl}
            </p>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d        = i + 1
            const iso      = toISO(viewY, viewM, d)
            const status   = getDayStatus(viewY, viewM, d, minISO, maxISO, availabilityConfig, blockedDates)
            const isToday  = iso === todayISO
            const isAvail  = status === 'available'

            // ── Range-mode cell states ───────────────────────────────────
            const isRangeStartDay = isRangeMode && rangeStart != null && iso === rangeStart
            const isRangeEndDay   = isRangeMode && rangeEnd   != null && iso === rangeEnd
            const isRangeMidDay   = isRangeMode && rangeStart != null && rangeEnd != null &&
                                    iso > rangeStart && iso < rangeEnd
            const isRangeAny      = isRangeStartDay || isRangeMidDay || isRangeEndDay

            // ── Single-mode cell state ───────────────────────────────────
            const isSingleSel = !isRangeMode && selected.includes(iso)
            const isHighlighted = isSingleSel || isRangeStartDay || isRangeEndDay

            // ── Outer cell background (range bar) ────────────────────────
            let outerBg = 'transparent'
            if (isRangeMidDay)    outerBg = 'rgba(230,126,80,0.1)'
            if (isRangeStartDay && !isRangeEndDay)
              outerBg = 'linear-gradient(to right, transparent 50%, rgba(230,126,80,0.1) 50%)'
            if (isRangeEndDay && !isRangeStartDay)
              outerBg = 'linear-gradient(to left, transparent 50%, rgba(230,126,80,0.1) 50%)'

            // ── Inner circle ─────────────────────────────────────────────
            let innerBg: string | undefined
            if (isHighlighted)             innerBg = '#E67E50'
            else if (isToday && isAvail)   innerBg = 'rgba(10,46,77,0.05)'

            // ── Text styling ─────────────────────────────────────────────
            let color    = '#0A2E4D'
            let opacity  = 1
            let textDeco = 'none'
            let fw: number = isToday ? 700 : 400

            if (isHighlighted)                              { color = 'white'; fw = 700 }
            else if (isRangeMidDay)                         { color = '#0A2E4D'; fw = 600 }
            else if (status === 'blocked')                  { color = 'rgba(239,68,68,0.4)'; textDeco = 'line-through' }
            else if (status === 'past' || status === 'unavailable') { color = 'rgba(10,46,77,0.2)'; opacity = 0.4 }

            return (
              <div
                key={d}
                className="flex items-center justify-center py-px"
                style={{ background: outerBg }}
              >
                <button
                  type="button"
                  disabled={!isAvail}
                  onClick={() => onToggle(iso)}
                  title={status === 'blocked' ? 'Guide is closed on this date' : undefined}
                  className="w-8 h-8 rounded-full flex flex-col items-center justify-center relative transition-all disabled:cursor-not-allowed"
                  style={{
                    background:     innerBg,
                    color,
                    opacity,
                    fontWeight:     fw,
                    textDecoration: textDeco,
                    fontSize:       '12px',
                  }}
                >
                  <span className="f-body leading-none">{d}</span>

                  {/* Today ring (single-day mode only, when not selected) */}
                  {isToday && !isHighlighted && !isRangeAny && isAvail && (
                    <span
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{ border: '1.5px solid rgba(10,46,77,0.18)' }}
                    />
                  )}

                  {/* Available dot (single-day mode, not selected) */}
                  {!isRangeMode && isAvail && !isSingleSel && (
                    <span
                      className="absolute rounded-full"
                      style={{ width: 3, height: 3, background: '#059669', bottom: 3, left: '50%', transform: 'translateX(-50%)' }}
                    />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {(isRangeMode
            ? [
                { color: '#E67E50',             label: 'Selected range' },
                { color: 'rgba(239,68,68,0.4)', label: 'Closed', strike: true },
                { color: 'rgba(10,46,77,0.18)', label: 'Not available' },
              ]
            : [
                { color: '#059669',             label: 'Available' },
                { color: 'rgba(239,68,68,0.4)', label: 'Closed', strike: true },
                { color: 'rgba(10,46,77,0.18)', label: 'Not available' },
              ]
          ).map(({ color, label, strike }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span
                className={`text-[10px] f-body ${strike ? 'line-through' : ''}`}
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value:    number
  onChange: (v: number) => void
  min:      number
  max:      number
  suffix?:  string
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{ background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.12)' }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
      >
        <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
          <rect x="0" y="0.5" width="12" height="1.2" rx="0.6" fill="currentColor" />
        </svg>
      </button>

      <span className="text-lg font-bold f-display select-none" style={{ color: '#0A2E4D' }}>
        {value}
        {suffix && (
          <span className="text-sm font-normal ml-1.5 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            {suffix}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase"
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ background: '#E67E50', color: '#fff' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="5.1" y="0" width="1.8" height="12" rx="0.9" fill="currentColor" />
          <rect x="0" y="5.1" width="12" height="1.8" rx="0.9" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

// ─── Price estimate box ───────────────────────────────────────────────────────

function PriceEstimate({
  pricePerPerson,
  groupSize,
  effectiveDays,
}: {
  pricePerPerson: number
  groupSize:      number
  effectiveDays:  number
}) {
  const subtotal = Math.round(pricePerPerson * groupSize * effectiveDays * 100) / 100
  const fee      = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
  const total    = Math.round((subtotal + fee) * 100) / 100

  return (
    <div
      className="mt-5 px-4 py-4 rounded-2xl"
      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
          €{pricePerPerson} × {groupSize} {groupSize === 1 ? 'angler' : 'anglers'} × {effectiveDays} {effectiveDays === 1 ? 'day' : 'days'}
        </span>
        <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
          €{subtotal}
        </span>
      </div>
      <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '10px' }} />
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Estimate
        </p>
        <div className="text-right">
          <p className="font-bold f-display" style={{ fontSize: '28px', color: '#0A2E4D', lineHeight: 1 }}>
            €{total}
          </p>
          <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
            no payment now
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BookingDateStep({
  expId,
  pricePerPerson,
  maxGuests,
  initialGuests,
  availabilityConfig,
  blockedDates,
  rawDurationOptions,
  initialMode  = 'direct',
  initialDates = [],
}: Props) {
  const router = useRouter()

  // ── Parse guide's duration packages ──────────────────────────────────────
  const durationOptions: DurationOptionPayload[] = useMemo(() => {
    if (Array.isArray(rawDurationOptions) && rawDurationOptions.length > 0)
      return rawDurationOptions as DurationOptionPayload[]
    return [{
      label: 'Standard', hours: null, days: 1,
      pricing_type: 'per_person' as const, price_eur: pricePerPerson,
      includes_lodging: false,
    }]
  }, [rawDurationOptions, pricePerPerson])

  // ── Mode toggle ───────────────────────────────────────────────────────────
  const [bookingMode, setBookingMode] = useState<BookingMode>(initialMode)

  // ── Direct mode state ────────────────────────────────────────────────────
  /**
   * For 1-day packages: array of individually selected ISO dates.
   * For N-day packages: at most ONE element — the chosen start date.
   */
  const [directDates,    setDirectDates]    = useState<string[]>(initialDates)
  const [selectedPkgIdx, setSelectedPkgIdx] = useState(0)
  const selectedPkg = durationOptions[selectedPkgIdx] ?? durationOptions[0]

  // ── Request mode state ───────────────────────────────────────────────────
  const [periods,         setPeriods]        = useState<Period[]>([])
  const [requestPkgIdx,   setRequestPkgIdx]  = useState(0)
  const [numDaysRequest,  setNumDaysRequest]  = useState(() => pkgDays(durationOptions[0] ?? durationOptions[0]))

  // ── Shared ────────────────────────────────────────────────────────────────
  const [groupSize, setGroupSize] = useState(Math.min(initialGuests, maxGuests))

  // ── Request mode — derived ────────────────────────────────────────────────
  const windowFrom     = periods.length > 0 ? periods[0].from : null
  const windowTo       = periods.length > 0 ? periods[periods.length - 1].to : null
  const hasWindow      = windowFrom != null && windowTo != null
  const requestPkg     = durationOptions[requestPkgIdx] ?? durationOptions[0]
  const requestPkgDays = pkgDays(requestPkg)
  const requestPkgFixed = requestPkgDays > 1  // package has a fixed multi-day duration

  /** Human-readable label sent to step 2 and stored as duration_option on the booking */
  const requestDurationLabel =
    numDaysRequest === 1
      ? pkgLabel(requestPkg)
      : `${pkgLabel(requestPkg)} · ${numDaysRequest} days`

  // ── Availability bounds (for range validation in direct mode) ─────────────
  const minDateISO = useMemo(() => {
    const now      = new Date()
    const advHours = availabilityConfig?.advance_notice_hours ?? 0
    const minDate  = new Date(now.getTime() + advHours * 3_600_000)
    return toISO(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
  }, [availabilityConfig])

  const maxDateISO = useMemo(() => {
    const now     = new Date()
    const maxDays = availabilityConfig?.max_advance_days ?? 365
    const maxDate = new Date(now)
    maxDate.setDate(maxDate.getDate() + maxDays)
    return toISO(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())
  }, [availabilityConfig])

  /**
   * For N-day direct bookings: true when at least one day inside the selected
   * range is blocked / unavailable.  CTA is disabled in this case.
   */
  const directRangeHasBlockedDay = useMemo(() => {
    const days = pkgDays(selectedPkg)
    if (days <= 1 || directDates.length === 0) return false
    const startISO = directDates[0]
    const endISO   = addDays(startISO, days - 1)
    let cursor = startISO
    while (cursor <= endISO) {
      const [yStr, mStr, dStr] = cursor.split('-')
      const s = getDayStatus(
        Number(yStr), Number(mStr) - 1, Number(dStr),
        minDateISO, maxDateISO, availabilityConfig, blockedDates,
      )
      if (s !== 'available') return true
      cursor = addDays(cursor, 1)
    }
    return false
  }, [selectedPkg, directDates, minDateISO, maxDateISO, availabilityConfig, blockedDates])

  // ── Navigation handlers ───────────────────────────────────────────────────

  function toggleDirectDate(iso: string) {
    const days = pkgDays(selectedPkg)
    if (days > 1) {
      // Range mode: single start-date toggle
      setDirectDates(prev => (prev[0] === iso ? [] : [iso]))
    } else {
      // Single-day mode: multi-select toggle
      setDirectDates(prev =>
        prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort(),
      )
    }
  }

  function handleDirectContinue() {
    if (directDates.length === 0 || directRangeHasBlockedDay) return
    const days = pkgDays(selectedPkg)
    if (days > 1) {
      // Multi-day package: send windowFrom / windowTo / numDays (same as request flow)
      const startISO = directDates[0]
      const endISO   = addDays(startISO, days - 1)
      const params   = new URLSearchParams({
        windowFrom: startISO,
        windowTo:   endISO,
        numDays:    String(days),
        pkgLabel:   pkgLabel(selectedPkg),
        guests:     String(groupSize),
      })
      router.push(`/book/${expId}?${params.toString()}`)
    } else {
      // Single-day: legacy dates param
      const params = new URLSearchParams({
        dates:  directDates.join(','),
        guests: String(groupSize),
      })
      router.push(`/book/${expId}?${params.toString()}`)
    }
  }

  function handleRequestContinue() {
    if (!hasWindow) return
    const params = new URLSearchParams({
      windowFrom: windowFrom!,
      windowTo:   windowTo!,
      numDays:    String(numDaysRequest),
      pkgLabel:   requestDurationLabel,
      guests:     String(groupSize),
    })
    // Preserve individual period boundaries so the booking stores every selected
    // date — not just the envelope start/end. Needed for correct calendar blocking.
    if (periods.length > 1) {
      params.set('periods', encodePeriodsParam(periods))
    }
    router.push(`/book/${expId}?${params.toString()}`)
  }

  // ── CTA label for selected dates ─────────────────────────────────────────
  const directDatesLabel = (() => {
    if (directDates.length === 0) return null
    const days = pkgDays(selectedPkg)
    if (days > 1) {
      const start = new Date(`${directDates[0]}T12:00:00`)
      return `${days} days from ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    }
    if (directDates.length === 1)
      return new Date(`${directDates[0]}T12:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    return `${directDates.length} dates`
  })()

  // ── Direct mode price (package × group size × number of selected dates) ────
  const directSubtotal = directDates.length > 0
    ? Math.round(pkgTotal(selectedPkg, groupSize) * directDates.length * 100) / 100
    : 0
  const directFee      = Math.round(directSubtotal * SERVICE_FEE_RATE * 100) / 100
  const directTotal    = Math.round((directSubtotal + directFee) * 100) / 100

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="p-6 sm:p-8"
      style={{
        background:   '#FDFAF7',
        borderRadius: '28px',
        border:       '1px solid rgba(10,46,77,0.09)',
        boxShadow:    '0 4px 24px rgba(10,46,77,0.07)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <p
          className="text-[11px] uppercase tracking-[0.22em] f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Step 1 of 2
        </p>
        <HelpWidget
          title="Step 1 — Choose your dates"
          description="Pick how you'd like to book this fishing trip. Either way, there's no payment now — the guide always reviews and confirms first."
          items={[
            { icon: '📅', title: 'Book directly', text: 'Select exact date(s) from the calendar. Guide confirms within 24 hours, then you pay a 40% deposit.' },
            { icon: '✉️', title: 'Send request', text: "Tell the guide a window of availability — they'll schedule the exact dates and confirm. Great if your dates are flexible." },
            { icon: '📦', title: 'Package', text: 'Each package has a price and duration. Choose the one that fits your trip style.' },
            { icon: '👥', title: 'Anglers', text: 'How many people are fishing? Price is calculated per angler for most packages.' },
            { icon: '💶', title: 'Price estimate', text: 'This is an estimate. The guide may adjust the final price based on your request details.' },
          ]}
        />
      </div>
      <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-4">
        How would you like to book?
      </h2>

      {/* ── Mode selector ─────────────────────────────────────────────────── */}
      <div
        className="flex gap-2 mb-6 p-1 rounded-2xl"
        style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.08)' }}
      >
        {([
          {
            mode: 'direct'  as BookingMode,
            label: 'Book directly',
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="2" width="11" height="10" rx="1.5" />
                <line x1="1" y1="5" x2="12" y2="5" />
                <line x1="4" y1="0.5" x2="4" y2="3.5" />
                <line x1="9" y1="0.5" x2="9" y2="3.5" />
              </svg>
            ),
          },
          {
            mode: 'request' as BookingMode,
            label: 'Send request',
            icon: (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 2h11l-5 5-6-5z" />
                <path d="M1 2v8.5a1 1 0 001 1h9a1 1 0 001-1V2" />
              </svg>
            ),
          },
        ] as { mode: BookingMode; label: string; icon: React.ReactNode }[]).map(({ mode, label, icon }) => {
          const active = bookingMode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setBookingMode(mode)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold f-body transition-all"
              style={active
                ? { background: '#0A2E4D', color: 'white', boxShadow: '0 1px 8px rgba(10,46,77,0.18)' }
                : { background: 'transparent', color: 'rgba(10,46,77,0.45)' }
              }
            >
              {icon}
              {label}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  DIRECT MODE                                                       */}
      {/*  1. Pick package  2. Pick start date  3. Group size  4. Send      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {bookingMode === 'direct' && (
        <>
          <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Pick the guide&apos;s package, then choose your start date.
          </p>

          {/* ── 1. Package selector ─────────────────────────────────────── */}
          <div className="mb-6">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body flex items-center gap-1"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Package
              <FieldTooltip text="Select the trip duration and style that suits you. Price updates automatically based on your group size." />
            </p>
            <div className="flex flex-col gap-2">
              {durationOptions.map((opt, idx) => {
                const on    = selectedPkgIdx === idx
                const label = pkgLabel(opt)
                const days  = pkgDays(opt)
                const price = pkgTotal(opt, groupSize)
                const priceLbl = pkgPriceLabel(opt)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedPkgIdx(idx); setDirectDates([]) }}
                    className="flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                      border:     on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-bold f-body" style={{ color: on ? 'white' : '#0A2E4D' }}>
                        {label}
                      </p>
                      <p className="text-[11px] f-body mt-0.5" style={{ color: on ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.4)' }}>
                        {days === 1 ? '1 day' : `${days} days`}
                        {opt.includes_lodging && ' · incl. lodging'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-bold f-display" style={{ color: on ? '#E67E50' : '#0A2E4D' }}>
                        €{price}
                      </p>
                      <p className="text-[10px] f-body" style={{ color: on ? 'rgba(255,255,255,0.45)' : 'rgba(10,46,77,0.35)' }}>
                        {priceLbl}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 2. Dates calendar (multi-select) ────────────────────────── */}
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body flex items-center gap-1"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Dates
            <FieldTooltip text="Green dot = available. Strikethrough = guide is closed. Grey = outside booking window." />
          </p>
          <DirectDateCalendar
            selected={directDates}
            onToggle={toggleDirectDate}
            availabilityConfig={availabilityConfig}
            blockedDates={blockedDates}
            numDays={pkgDays(selectedPkg)}
          />

          {/* Blocked-range warning (multi-day mode) */}
          {directRangeHasBlockedDay && directDates.length > 0 && (
            <div
              className="mt-2 px-3 py-2.5 rounded-xl flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <circle cx="6.5" cy="6.5" r="5.5" />
                <line x1="6.5" y1="4" x2="6.5" y2="7" />
                <circle cx="6.5" cy="9" r="0.6" fill="#DC2626" stroke="none" />
              </svg>
              <p className="text-[11px] f-body" style={{ color: '#DC2626' }}>
                Some days in this {pkgDays(selectedPkg)}-day range are not available. Please pick a different start date.
              </p>
            </div>
          )}

          {/* Selected chips */}
          {directDates.length > 0 && !directRangeHasBlockedDay && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pkgDays(selectedPkg) > 1 ? (
                // Range chip for multi-day packages
                <span
                  className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(230,126,80,0.1)',
                    color: '#C05A2A',
                    border: '1px solid rgba(230,126,80,0.2)',
                  }}
                >
                  {new Date(`${directDates[0]}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' '}–{' '}
                  {new Date(`${addDays(directDates[0], pkgDays(selectedPkg) - 1)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' '}({pkgDays(selectedPkg)} days)
                  <button
                    type="button"
                    onClick={() => setDirectDates([])}
                    aria-label="Remove selection"
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    style={{ lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ) : (
                // Individual date chips for single-day packages
                directDates.map(iso => (
                  <span
                    key={iso}
                    className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(230,126,80,0.1)',
                      color: '#C05A2A',
                      border: '1px solid rgba(230,126,80,0.2)',
                    }}
                  >
                    {new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <button
                      type="button"
                      onClick={() => toggleDirectDate(iso)}
                      aria-label={`Remove ${iso}`}
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      style={{ lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          )}

          {/* ── 3. Anglers ──────────────────────────────────────────────── */}
          <div className="mt-6">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body flex items-center gap-1"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Anglers
              <FieldTooltip text="Total number of people fishing on this trip. Includes all adults and children who will hold a rod." />
            </p>
            <Stepper
              value={groupSize}
              onChange={setGroupSize}
              min={1}
              max={maxGuests}
              suffix={groupSize === 1 ? 'angler' : 'anglers'}
            />
          </div>

          {/* ── 4. Price estimate ────────────────────────────────────────── */}
          {directDates.length > 0 && (
            <div
              className="mt-5 px-4 py-4 rounded-2xl"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
                  {pkgLabel(selectedPkg)} × {groupSize} {groupSize === 1 ? 'angler' : 'anglers'} × {directDates.length} {directDates.length === 1 ? 'date' : 'dates'}
                </span>
                <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
                  €{directSubtotal}
                </span>
              </div>
              <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '10px' }} />
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
                   style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Estimate
                </p>
                <div className="text-right">
                  <p className="font-bold f-display" style={{ fontSize: '28px', color: '#0A2E4D', lineHeight: 1 }}>
                    €{directTotal}
                  </p>
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    no payment now
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── CTA ─────────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleDirectContinue}
            disabled={directDates.length === 0 || directRangeHasBlockedDay}
            className="mt-5 w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed f-body"
            style={{ background: '#E67E50' }}
          >
            {directDates.length === 0 ? (
              pkgDays(selectedPkg) > 1
                ? `Pick a start date for your ${pkgDays(selectedPkg)}-day trip`
                : 'Select dates to continue'
            ) : (
              <>
                Continue — {pkgLabel(selectedPkg)} · {directDatesLabel} · {groupSize} {groupSize === 1 ? 'angler' : 'anglers'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h8M8 4l3 3-3 3" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs mt-3 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
            No payment now — guide reviews and confirms within 24 hours.
          </p>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  REQUEST MODE                                                      */}
      {/*  1. Package     2. Availability window  3. Days  4. Group  5. Send */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {bookingMode === 'request' && (
        <>
          <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Choose a package, tell the guide when you could come — they&apos;ll confirm exact dates.
          </p>

          {/* ── 1. Package selector ─────────────────────────────────────── */}
          <div className="mb-6">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Package
            </p>
            <div className="flex flex-col gap-2">
              {durationOptions.map((opt, idx) => {
                const on       = requestPkgIdx === idx
                const label    = pkgLabel(opt)
                const days     = pkgDays(opt)
                const price    = pkgTotal(opt, groupSize)
                const priceLbl = pkgPriceLabel(opt)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRequestPkgIdx(idx)
                      setNumDaysRequest(pkgDays(opt))
                    }}
                    className="flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                      border:     on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-bold f-body" style={{ color: on ? 'white' : '#0A2E4D' }}>
                        {label}
                      </p>
                      <p className="text-[11px] f-body mt-0.5" style={{ color: on ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.4)' }}>
                        {days === 1 ? '1 day' : `${days} days`}
                        {opt.includes_lodging && ' · incl. lodging'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-bold f-display" style={{ color: on ? '#E67E50' : '#0A2E4D' }}>
                        €{price}
                      </p>
                      <p className="text-[10px] f-body" style={{ color: on ? 'rgba(255,255,255,0.45)' : 'rgba(10,46,77,0.35)' }}>
                        {priceLbl}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 2. Availability window ──────────────────────────────────── */}
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body flex items-center gap-1"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            When can you come?
            <FieldTooltip text="Select one or more date ranges when you could potentially come. The guide will schedule the exact dates within your window." />
          </p>
          <MultiPeriodPicker
            periods={periods}
            onChange={setPeriods}
            availabilityConfig={availabilityConfig}
            blockedDates={blockedDates}
          />

          {/* ── 3. How many days + anglers — visible once window is set ─── */}
          {hasWindow && (
            <>
              <div className="mt-6">
                <div className="flex items-center justify-between mb-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    How many days?
                  </p>
                  {requestPkgFixed && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full f-body"
                      style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.45)' }}
                    >
                      Fixed by package
                    </span>
                  )}
                </div>
                {!requestPkgFixed && (
                  <p
                    className="text-xs f-body mb-3"
                    style={{ color: 'rgba(10,46,77,0.45)' }}
                  >
                    Number of fishing days within your availability window.
                  </p>
                )}

                {requestPkgFixed ? (
                  /* Locked display — package defines the day count */
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-2xl"
                    style={{ background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.12)' }}
                  >
                    <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Duration fixed by "{pkgLabel(requestPkg)}"
                    </span>
                    <span className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
                      {requestPkgDays}
                      <span className="text-sm font-normal ml-1.5 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                        {requestPkgDays === 1 ? 'day' : 'days'}
                      </span>
                    </span>
                  </div>
                ) : (
                  /* Free stepper — package has no fixed day count */
                  <Stepper
                    value={numDaysRequest}
                    onChange={setNumDaysRequest}
                    min={1}
                    max={21}
                    suffix={numDaysRequest === 1 ? 'day' : 'days'}
                  />
                )}
              </div>

              {/* ── 4. Anglers ──────────────────────────────────────────── */}
              <div className="mt-6">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}
                >
                  Anglers
                </p>
                <Stepper
                  value={groupSize}
                  onChange={setGroupSize}
                  min={1}
                  max={maxGuests}
                  suffix={groupSize === 1 ? 'angler' : 'anglers'}
                />
              </div>

              {/* ── 5. Price estimate ────────────────────────────────────── */}
              {(() => {
                const subtotal = Math.round(pkgTotal(requestPkg, groupSize) * numDaysRequest * 100) / 100
                const fee      = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
                const total    = Math.round((subtotal + fee) * 100) / 100
                const priceLbl = pkgPriceLabel(requestPkg)
                return (
                  <div
                    className="mt-5 px-4 py-4 rounded-2xl"
                    style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
                        {pkgLabel(requestPkg)} ({priceLbl}) × {groupSize} {groupSize === 1 ? 'angler' : 'anglers'} × {numDaysRequest} {numDaysRequest === 1 ? 'day' : 'days'}
                      </span>
                      <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        €{subtotal}
                      </span>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '10px' }} />
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
                         style={{ color: 'rgba(10,46,77,0.38)' }}>
                        Estimate
                      </p>
                      <div className="text-right">
                        <p className="font-bold f-display" style={{ fontSize: '28px', color: '#0A2E4D', lineHeight: 1 }}>
                          €{total}
                        </p>
                        <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          no payment now
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleRequestContinue}
            disabled={!hasWindow}
            className="mt-5 w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed f-body"
            style={{ background: '#E67E50' }}
          >
            {!hasWindow ? (
              'Pick your availability window to continue'
            ) : (
              <>
                Continue — {pkgLabel(requestPkg)} · {numDaysRequest} {numDaysRequest === 1 ? 'day' : 'days'} · {groupSize} {groupSize === 1 ? 'angler' : 'anglers'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h8M8 4l3 3-3 3" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs mt-3 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
            No payment now — guide confirms exact dates &amp; you pay a 40% deposit.
          </p>
        </>
      )}
    </div>
  )
}
