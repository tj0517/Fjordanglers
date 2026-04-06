'use client'

/**
 * BookingWidget — interactive price calculator + CTA in the experience sidebar.
 *
 * Handles all three pricing models per duration option:
 *   • per_person  — price × number of anglers
 *   • per_boat    — flat rate regardless of group size
 *   • per_group   — lookup table: group_prices[groupSize]
 *
 * Rendered as a Client Component because price updates live on user interaction.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { DurationOptionPayload } from '@/actions/experiences'
import type { Json } from '@/lib/supabase/database.types'
import { DURATION_EVENT } from '@/components/trips/duration-cards-selector'
import {
  MultiPeriodPicker,
  type Period,
  fmtPeriod,
  INQUIRY_PERIOD_EVENT,
  type InquiryPeriodEventDetail,
  encodePeriodsParam,
} from '@/components/trips/multi-period-picker'
import {
  ChevronLeft, ChevronRight, ChevronDown,
  Calendar, Clock, Info, Check, Minus, Plus, MessageSquare, ArrowDown,
} from 'lucide-react'

// ─── Availability types ───────────────────────────────────────────────────────

export type AvailConfigRow = {
  available_months: number[]    // 1-indexed: 1=Jan … 12=Dec
  available_weekdays: number[]  // JS convention: 0=Sun, 1=Mon … 6=Sat
  advance_notice_hours: number  // min hours before trip start date
  max_advance_days: number      // how far ahead bookings are accepted
  slots_per_day: number
  start_time: string | null
}

type BlockedRange = { date_start: string; date_end: string }  // ISO date strings

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toISO(y: number, m: number, d: number): string {
  // m is 0-indexed (matches Date.getMonth())
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(isoDate: string, n: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-')
  const date = new Date(Number(yStr), Number(mStr) - 1, Number(dStr) + n)
  return toISO(date.getFullYear(), date.getMonth(), date.getDate())
}

type DayStatus = 'available' | 'selected' | 'booked' | 'blocked' | 'unavailable'

function getDayStatus(
  y: number, m: number, d: number,
  selectedSet: Set<string>,           // ← multi-select: set of ISO strings
  config: AvailConfigRow | null,
  blocked: BlockedRange[],
  booked: Set<string>,
  todayISO: string,
  minISO: string,
  maxISO: string,
): DayStatus {
  const iso = toISO(y, m, d)
  if (selectedSet.has(iso)) return 'selected'
  if (iso < todayISO || iso < minISO) return 'unavailable'
  if (iso > maxISO) return 'unavailable'

  if (config) {
    const month1 = m + 1
    if (config.available_months.length > 0 && !config.available_months.includes(month1))
      return 'unavailable'
    const weekday = new Date(y, m, d).getDay()
    if (config.available_weekdays.length > 0 && !config.available_weekdays.includes(weekday))
      return 'unavailable'
  }

  for (const r of blocked) {
    if (iso >= r.date_start && iso <= r.date_end) return 'blocked'
  }

  if (booked.has(iso)) return 'booked'
  return 'available'
}

// ─── AvailabilityCalendar (multi-select) ──────────────────────────────────────

type CalendarProps = {
  config: AvailConfigRow | null
  blocked: BlockedRange[]
  booked: Set<string>
  /** Current selection as a Set of ISO strings for O(1) lookups. */
  selectedSet: Set<string>
  /** Toggle a date in/out of the selection. */
  onToggle: (iso: string) => void
  /** When > 1, switches to range-start picker: click = start, N consecutive days highlighted. */
  numDays?: number
  /** ISO date currently hovered (for range preview). Only used when numDays > 1. */
  hoverDate?: string | null
  /** Fires when the hover date changes. */
  onHoverChange?: (iso: string | null) => void
}

function AvailabilityCalendar({ config, blocked, booked, selectedSet, onToggle, numDays, hoverDate, onHoverChange }: CalendarProps) {
  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayISO = toISO(todayY, todayM, now.getDate())

  const advHours = config?.advance_notice_hours ?? 0
  const minDate = new Date(now.getTime() + advHours * 3_600_000)
  const minISO = toISO(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())

  const maxDays = config?.max_advance_days ?? 180
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + maxDays)
  const maxISO = toISO(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())

  const [viewY, setViewY] = useState(todayY)
  const [viewM, setViewM] = useState(todayM)

  const firstDayOfMonth = new Date(viewY, viewM, 1)
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad = (firstDayOfMonth.getDay() + 6) % 7  // Monday-first offset

  // ── Range-mode helpers ────────────────────────────────────────────────────
  const nDays      = numDays ?? 1
  const isRangeCal = nDays > 1

  const rangeStart: string | null = isRangeCal && selectedSet.size > 0
    ? ([...selectedSet].sort()[0] ?? null)
    : null
  const rangeEnd: string | null = rangeStart ? addDays(rangeStart, nDays - 1) : null

  const hoverStart: string | null = isRangeCal && !rangeStart && (hoverDate ?? null)
    ? hoverDate!
    : null
  const hoverEnd: string | null = hoverStart ? addDays(hoverStart, nDays - 1) : null

  const canPrev = viewY > todayY || (viewY === todayY && viewM > todayM)
  const canNext = (() => {
    const ny = viewM === 11 ? viewY + 1 : viewY
    const nm = viewM === 11 ? 0 : viewM + 1
    return toISO(ny, nm, 1) <= maxISO
  })()

  function goPrev() {
    if (!canPrev) return
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) }
    else setViewM(m => m - 1)
  }
  function goNext() {
    if (!canNext) return
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) }
    else setViewM(m => m + 1)
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Previous month"
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ background: 'rgba(10,46,77,0.08)' }}
        >
          <ChevronLeft size={12} strokeWidth={1.8} style={{ color: '#0A2E4D' }} />
        </button>
        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
          {MONTH_NAMES[viewM]} {viewY}
        </p>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Next month"
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ background: 'rgba(10,46,77,0.08)' }}
        >
          <ChevronRight size={12} strokeWidth={1.8} style={{ color: '#0A2E4D' }} />
        </button>
      </div>

      {/* Range-mode hint */}
      {isRangeCal && (
        <p className="text-center text-[10px] f-body mb-3" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Click a start date — {nDays} consecutive days will be selected
        </p>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map(wl => (
          <p
            key={wl}
            className="text-center text-[9px] font-bold f-body tracking-wide uppercase"
            style={{ color: 'rgba(10,46,77,0.28)' }}
          >
            {wl}
          </p>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => onHoverChange?.(null)}>
        {/* Leading empty cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`p${i}`} />
        ))}

        {/* Day buttons */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const status = getDayStatus(
            viewY, viewM, d, selectedSet, config, blocked, booked,
            todayISO, minISO, maxISO,
          )
          const iso = toISO(viewY, viewM, d)
          const clickable = status === 'available' || status === 'selected'

          // ── Range-mode: band position helpers ──────────────────────────
          const inCommitted    = rangeStart != null && iso >= rangeStart && iso <= rangeEnd!
          const isRangeStartDay = iso === rangeStart
          const isRangeEndDay   = iso === rangeEnd
          const inHover        = hoverStart != null && iso >= hoverStart && iso <= hoverEnd!
          const isHoverStartDay = iso === hoverStart
          const isHoverEndDay   = iso === hoverEnd

          // Container div: orange band strip across the range
          let containerRangeBg: React.CSSProperties = {}
          if (inCommitted) {
            containerRangeBg = isRangeStartDay
              ? { background: 'linear-gradient(to right, transparent 50%, rgba(230,126,80,0.18) 50%)' }
              : isRangeEndDay
              ? { background: 'linear-gradient(to left, transparent 50%, rgba(230,126,80,0.18) 50%)' }
              : { background: 'rgba(230,126,80,0.18)' }
          } else if (inHover) {
            containerRangeBg = isHoverStartDay
              ? { background: 'linear-gradient(to right, transparent 50%, rgba(230,126,80,0.10) 50%)' }
              : isHoverEndDay
              ? { background: 'linear-gradient(to left, transparent 50%, rgba(230,126,80,0.10) 50%)' }
              : { background: 'rgba(230,126,80,0.10)' }
          }

          // Button styles: range endpoints get filled orange circle; mid cells are transparent on the band
          const bgStyle: React.CSSProperties =
            isRangeCal && (isRangeStartDay || isRangeEndDay) ? { background: '#E67E50' } :
            isRangeCal && (isHoverStartDay || isHoverEndDay) ? { background: 'rgba(230,126,80,0.55)' } :
            status === 'selected' ? { background: '#E67E50' } :
            status === 'booked'   ? { background: 'rgba(10,46,77,0.06)' } :
            {}

          const textStyle: React.CSSProperties =
            isRangeCal && (isRangeStartDay || isRangeEndDay) ? { color: '#fff' } :
            isRangeCal && (isHoverStartDay || isHoverEndDay) ? { color: '#fff' } :
            status === 'selected'    ? { color: '#fff' } :
            status === 'available'   ? { color: '#0A2E4D' } :
            status === 'booked'      ? { color: 'rgba(10,46,77,0.28)', textDecoration: 'line-through' } :
            { color: 'rgba(10,46,77,0.2)' }

          return (
            <div
              key={d}
              className="flex items-center justify-center py-0.5"
              style={containerRangeBg}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onToggle(iso)}
                onMouseEnter={() => isRangeCal && clickable && onHoverChange?.(iso)}
                aria-label={iso}
                aria-pressed={status === 'selected' || (isRangeCal && (isRangeStartDay || isRangeEndDay))}
                className={[
                  'w-8 h-8 rounded-full text-[11px] font-medium f-body flex items-center justify-center transition-all',
                  clickable ? 'cursor-pointer' : 'cursor-default',
                  !isRangeCal && status === 'available' ? 'hover:bg-[#E67E50] hover:!text-white' : '',
                ].filter(Boolean).join(' ')}
                style={{ ...bgStyle, ...textStyle }}
              >
                {d}
              </button>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {isRangeCal ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center h-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
                <div className="w-4 h-2.5" style={{ background: 'rgba(230,126,80,0.18)' }} />
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
              </div>
              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Selected range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'transparent', border: '1px solid rgba(10,46,77,0.2)' }} />
              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'rgba(10,46,77,0.08)' }} />
              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Booked</span>
            </div>
          </>
        ) : (
          ([
            { bg: '#E67E50', border: undefined, label: 'Selected' },
            { bg: 'transparent', border: 'rgba(10,46,77,0.2)', label: 'Available' },
            { bg: 'rgba(10,46,77,0.08)', border: undefined, label: 'Booked' },
          ] as const).map(({ bg, border, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: bg, border: border ? `1px solid ${border}` : undefined }}
              />
              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                {label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingWidgetProps = {
  expId: string
  isDraft: boolean
  /** Parsed duration_options from DB (Json column). Null → fall back to legacyPrice. */
  rawDurationOptions: Json | null
  maxGuests: number
  /** Backward-compat price used when duration_options is absent. Null for icelandic/on-request. */
  legacyPricePerPerson: number | null
  difficulty?: string | null
  durationHours?: number | null
  durationDays?: number | null
  /** From experience_availability_config — null if guide hasn't configured it. */
  availabilityConfig?: AvailConfigRow | null
  /** Blocked date ranges from calendar_blocked_dates. */
  blockedDates?: BlockedRange[]
  /** ISO booking_date strings of pending/confirmed bookings (already taken). */
  bookedDates?: string[]
  /** 'classic' = Stripe checkout; 'icelandic' = inquiry only; 'both' = angler picks either */
  bookingType?: 'classic' | 'icelandic' | 'both'
  /**
   * When true, the guide has disabled their calendar — override to inquiry-only
   * regardless of the individual experience's booking_type.
   */
  calendarDisabled?: boolean
  /**
   * Payment model derived from guide's Stripe status.
   * stripe_connect — angler pays booking fee via Stripe; guide amount via Stripe separately.
   * manual         — angler pays booking fee via Stripe + guide amount directly (cash/IBAN).
   */
  paymentModel?: 'stripe_connect' | 'manual'
}

// ─── Platform fee ─────────────────────────────────────────────────────────────

/** 5% service fee charged to the angler on top of the base price, capped at €50. */
const SERVICE_FEE_RATE    = 0.05
const SERVICE_FEE_CAP_EUR = 50

// ─── Price calculation ────────────────────────────────────────────────────────

type PriceResult = {
  /** Total to pay */
  total: number
  /** Short breakdown string, e.g. "€150 × 3 anglers" */
  breakdown: string
  /** Label after the big number, e.g. "for 3 anglers" */
  suffix: string
  /** What the "From" teaser shows (min possible for this option) */
  fromPrice: number
}

function calcPrice(opt: DurationOptionPayload, groupSize: number): PriceResult {
  switch (opt.pricing_type) {
    case 'per_boat':
      return {
        total: opt.price_eur,
        breakdown: `€${opt.price_eur} flat rate`,
        suffix: 'whole boat',
        fromPrice: opt.price_eur,
      }

    case 'per_group': {
      const prices = opt.group_prices ?? {}
      const matched = prices[String(groupSize)]
      const total = matched != null ? matched : opt.price_eur
      const vals = Object.values(prices).filter(v => typeof v === 'number') as number[]
      const fromPrice = vals.length > 0 ? Math.min(...vals) : opt.price_eur
      return {
        total,
        breakdown: matched != null
          ? `€${total} for ${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`
          : `€${total}`,
        suffix: `for ${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`,
        fromPrice,
      }
    }

    case 'per_person':
    default:
      return {
        total: opt.price_eur * groupSize,
        breakdown: `€${opt.price_eur} × ${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`,
        suffix: `for ${groupSize} ${groupSize === 1 ? 'angler' : 'anglers'}`,
        fromPrice: opt.price_eur,
      }
  }
}

/** Minimum starting price across all options (for "From €X" teaser). */
function globalFromPrice(opts: DurationOptionPayload[]): number {
  return Math.min(...opts.map(o => {
    if (o.pricing_type === 'per_group' && o.group_prices) {
      const vals = Object.values(o.group_prices).filter(v => typeof v === 'number') as number[]
      return vals.length > 0 ? Math.min(...vals) : o.price_eur
    }
    return o.price_eur
  }))
}

// ─── Duration label helper ─────────────────────────────────────────────────────

function durationLabel(opt: DurationOptionPayload): string {
  const parts: string[] = []
  if (opt.label) parts.push(opt.label)
  const timeParts: string[] = []
  if (opt.hours != null) timeParts.push(`${opt.hours}h`)
  if (opt.days  != null) timeParts.push(`${opt.days}d`)
  if (timeParts.length) parts.push(`(${timeParts.join(' ')})`)
  return parts.join(' ') || 'Option'
}

// ─── Difficulty display ───────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All levels', intermediate: 'Intermediate', expert: 'Expert',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingWidget({
  expId,
  isDraft,
  rawDurationOptions,
  maxGuests,
  legacyPricePerPerson,
  difficulty,
  durationHours,
  durationDays,
  availabilityConfig,
  blockedDates,
  bookedDates,
  bookingType = 'classic',
  calendarDisabled = false,
  paymentModel = 'stripe_connect',
}: BookingWidgetProps) {

  // ── Parse duration options ────────────────────────────────────────────────
  const durationOptions = useMemo<DurationOptionPayload[]>(() => {
    if (!Array.isArray(rawDurationOptions) || rawDurationOptions.length === 0) {
      // Legacy record — synthesise a single per_person option
      const legacyDurationHours = durationHours
      const legacyDurationDays  = durationDays
      return [{
        label:            '',
        hours:            legacyDurationHours ?? null,
        days:             legacyDurationDays  ?? null,
        pricing_type:     'per_person',
        price_eur:        legacyPricePerPerson ?? 0,
        includes_lodging: false,
      }]
    }
    return rawDurationOptions as unknown as DurationOptionPayload[]
  }, [rawDurationOptions, legacyPricePerPerson, durationHours, durationDays])

  const multipleOptions = durationOptions.length > 1

  // ── Local state ───────────────────────────────────────────────────────────
  const [selectedOptIdx, setSelectedOptIdx] = useState(0)
  const [groupSize,      setGroupSize]      = useState(1)
  /** Whether the duration option dropdown is open. */
  const [optionOpen,     setOptionOpen]     = useState(false)
  /** Period picker state for icelandic mode. */
  const [inquiryPeriods,      setInquiryPeriods]      = useState<Period[]>([])
  /** Whether the icelandic period picker dropdown is open. */
  const [inquiryCalendarOpen, setInquiryCalendarOpen] = useState(false)
  /** Classic date selection (multi-select for direct mode). */
  const [selectedDates,       setSelectedDates]       = useState<string[]>([])
  /** Whether the classic date picker dropdown is open (direct mode). */
  const [calendarOpen,        setCalendarOpen]         = useState(false)
  /** Hover date for range-mode preview in direct mode calendar. */
  const [hoverDate,           setHoverDate]            = useState<string | null>(null)
  const calendarRef        = useRef<HTMLDivElement>(null)
  const optionRef          = useRef<HTMLDivElement>(null)
  const inquiryCalendarRef = useRef<HTMLDivElement>(null)

  // ── Booking mode: Direct (message guide) or Icelandic (request with dates) ─
  const [bookMode, setBookMode] = useState<'direct' | 'icelandic'>('direct')
  // Calendar-based booking removed — always use inquiry flow.
  const effectiveType: 'classic' | 'icelandic' = 'icelandic'

  // ── Sync FROM main-content duration cards ────────────────────────────────
  useEffect(() => {
    function onCardSelect(e: Event) {
      const idx = (e as CustomEvent<{ idx: number; source?: string }>).detail?.idx
      if (typeof idx === 'number' && (e as CustomEvent).detail?.source !== 'widget') {
        setSelectedOptIdx(idx)
        setOptionOpen(false)
      }
    }
    window.addEventListener(DURATION_EVENT, onCardSelect)
    return () => window.removeEventListener(DURATION_EVENT, onCardSelect)
  }, [])

  // ── Emit event when widget changes option ────────────────────────────────
  function selectOption(idx: number) {
    setSelectedOptIdx(idx)
    setOptionOpen(false)
    window.dispatchEvent(
      new CustomEvent(DURATION_EVENT, { detail: { idx, source: 'widget' } }),
    )
  }

  // Close option dropdown on outside click
  useEffect(() => {
    if (!optionOpen) return
    function handleOutside(e: MouseEvent) {
      if (optionRef.current && !optionRef.current.contains(e.target as Node)) {
        setOptionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [optionOpen])

  // Close icelandic period picker on outside click
  useEffect(() => {
    if (!inquiryCalendarOpen) return
    function handleOutside(e: MouseEvent) {
      if (inquiryCalendarRef.current && !inquiryCalendarRef.current.contains(e.target as Node)) {
        setInquiryCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [inquiryCalendarOpen])

  // Close direct mode calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return
    function handleOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [calendarOpen])

  // Sync inquiry periods with AvailabilityPreviewCalendar via custom event
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<InquiryPeriodEventDetail>).detail
      if (detail.source !== 'widget') setInquiryPeriods(detail.periods)
    }
    window.addEventListener(INQUIRY_PERIOD_EVENT, handler)
    return () => window.removeEventListener(INQUIRY_PERIOD_EVENT, handler)
  }, [])


  function handleInquiryPeriodsChange(periods: Period[]) {
    setInquiryPeriods(periods)
    window.dispatchEvent(
      new CustomEvent<InquiryPeriodEventDetail>(INQUIRY_PERIOD_EVENT, {
        detail: { periods, source: 'widget' },
      }),
    )
  }

  const selectedOpt = durationOptions[selectedOptIdx] ?? durationOptions[0]

  // ── Live price ────────────────────────────────────────────────────────────
  const price = useMemo(
    () => calcPrice(selectedOpt, groupSize),
    [selectedOpt, groupSize],
  )

  const fromPrice = useMemo(() => globalFromPrice(durationOptions), [durationOptions])

  // ── Price + service fee ───────────────────────────────────────────────────
  const subtotal   = Math.round(price.total * 100) / 100
  const serviceFee = Math.min(Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100, SERVICE_FEE_CAP_EUR)
  const grandTotal = Math.round((subtotal + serviceFee) * 100) / 100

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showGroupSelector = selectedOpt.pricing_type !== 'per_boat'
  const diffLabel = difficulty != null ? (DIFFICULTY_LABEL[difficulty] ?? difficulty) : null

  const legacyDuration =
    durationHours != null ? `${durationHours} hours`
    : durationDays  != null ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`
    : null

  // For "no duration_options" records, fall back to legacy duration string
  const selectedDurationLabel =
    multipleOptions || durationOptions[0].label || durationOptions[0].hours != null || durationOptions[0].days != null
      ? durationLabel(selectedOpt)
      : legacyDuration

  // ── Direct mode calendar helpers ──────────────────────────────────────────
  const bookedSet   = useMemo(() => new Set(bookedDates ?? []), [bookedDates])
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])
  const pkgDays     = selectedOpt.days ?? null
  const isRangeMode = (pkgDays ?? 0) > 1

  function handleToggleDate(iso: string) {
    if (isRangeMode && pkgDays != null) {
      const range: string[] = []
      for (let i = 0; i < pkgDays; i++) range.push(addDays(iso, i))
      setSelectedDates(range)
      setHoverDate(null)
    } else {
      setSelectedDates(prev =>
        prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso],
      )
    }
  }

  return (
    <div
      className="p-5"
      style={{
        borderRadius: '28px',
        border: '1px solid rgba(10,46,77,0.1)',
        boxShadow: '0 8px 40px rgba(10,46,77,0.1)',
      }}
    >

      {/* ── Classic date picker — shown in "Direct booking" mode ─────────────── */}
      {!isDraft && bookMode === 'direct' && (
        <div className="mb-4" ref={calendarRef} style={{ position: 'relative' }}>

          {/* Trigger row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarOpen(o => !o)}
              className="flex-1 flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
              style={{
                background: '#F3EDE4',
                border: `1.5px solid ${calendarOpen ? '#0A2E4D' : 'rgba(10,46,77,0.12)'}`,
              }}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calendar size={15} strokeWidth={1.4} className="flex-shrink-0" style={{ color: '#0A2E4D', opacity: 0.45 }} />
                {selectedDates.length === 0 ? (
                  <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Pick your dates (optional)
                  </span>
                ) : (
                  <span className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                    {selectedDates.length === 1
                      ? selectedDates[0]
                      : `${selectedDates.length} days selected`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedDates.length > 0 && (
                  <span
                    onClick={e => { e.stopPropagation(); setSelectedDates([]) }}
                    role="button"
                    aria-label="Clear dates"
                    className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                    style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.5)' }}
                  >
                    Clear
                  </span>
                )}
                <ChevronDown
                  size={12} strokeWidth={1.6}
                  className="transition-transform"
                  style={{
                    transform: calendarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    color: 'rgba(10,46,77,0.35)',
                  }}
                />
              </div>
            </button>

            {/* Scroll-to-CTA anchor */}
            <a
              href="#widget-cta"
              className="flex-shrink-0 w-[50px] h-[50px] rounded-2xl flex items-center justify-center transition-all hover:brightness-110 active:scale-[0.95]"
              style={{ background: '#E67E50' }}
              title="Go to book button"
            >
              <ArrowDown size={13} strokeWidth={1.8} style={{ color: 'white' }} />
            </a>
          </div>

          {/* Calendar dropdown */}
          {calendarOpen && (
            <div
              className="absolute left-0 right-0 z-50 mt-2 p-4 rounded-2xl"
              style={{
                background: '#F3EDE4',
                border: '1.5px solid rgba(10,46,77,0.12)',
                boxShadow: '0 16px 48px rgba(10,46,77,0.16)',
                top: '100%',
              }}
              role="dialog"
              aria-label="Pick trip dates"
            >
              <AvailabilityCalendar
                config={availabilityConfig ?? null}
                blocked={blockedDates ?? []}
                booked={bookedSet}
                selectedSet={selectedSet}
                onToggle={handleToggleDate}
                numDays={pkgDays ?? undefined}
                hoverDate={hoverDate}
                onHoverChange={setHoverDate}
              />
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] f-body transition-opacity hover:opacity-80"
                style={{ background: '#0A2E4D', color: '#fff' }}
              >
                Done
              </button>
            </div>
          )}

          {/* Selected date chips */}
          {selectedDates.length > 0 && !calendarOpen && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[...selectedDates].sort().map(d => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(10,46,77,0.07)',
                    color: '#0A2E4D',
                    border: '1px solid rgba(10,46,77,0.12)',
                  }}
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => setSelectedDates(prev => prev.filter(x => x !== d))}
                    aria-label={`Remove ${d}`}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    style={{ lineHeight: 1, fontSize: '14px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Period picker — shown in "Icelandic flow" mode ────────────────────── */}
      {!isDraft && bookMode === 'icelandic' && (
        <div className="mb-4" ref={inquiryCalendarRef} style={{ position: 'relative' }}>

            {/* Trigger row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInquiryCalendarOpen(o => !o)}
                className="flex-1 flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
                style={{
                  background: '#F3EDE4',
                  border: `1.5px solid ${inquiryCalendarOpen ? '#0A2E4D' : 'rgba(10,46,77,0.12)'}`,
                }}
                aria-expanded={inquiryCalendarOpen}
                aria-haspopup="dialog"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Calendar icon */}
                  <Calendar size={15} strokeWidth={1.4} className="flex-shrink-0" style={{ color: '#0A2E4D', opacity: 0.45 }} />

                  {inquiryPeriods.length === 0 ? (
                    <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Pick your travel period
                    </span>
                  ) : (
                    <span className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {inquiryPeriods.length === 1
                        ? fmtPeriod(inquiryPeriods[0])
                        : `${inquiryPeriods.length} periods selected`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {inquiryPeriods.length > 0 && (
                    <span
                      onClick={e => { e.stopPropagation(); handleInquiryPeriodsChange([]) }}
                      role="button"
                      aria-label="Clear periods"
                      className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                      style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.5)' }}
                    >
                      Clear
                    </span>
                  )}
                  <ChevronDown
                    size={12} strokeWidth={1.6}
                    className="transition-transform"
                    style={{
                      transform: inquiryCalendarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: 'rgba(10,46,77,0.35)',
                    }}
                  />
                </div>
              </button>

              {/* Scroll-to-CTA anchor */}
              <a
                href="#widget-cta"
                className="flex-shrink-0 w-[50px] h-[50px] rounded-2xl flex items-center justify-center transition-all hover:brightness-110 active:scale-[0.95]"
                style={{ background: '#0A2E4D' }}
                title="Go to request button"
              >
                <ArrowDown size={13} strokeWidth={1.8} style={{ color: 'white' }} />
              </a>
            </div>

            {/* Dropdown panel */}
            {inquiryCalendarOpen && (
              <div
                className="absolute left-0 right-0 z-50 mt-2 p-4 rounded-2xl"
                style={{
                  background: '#F3EDE4',
                  border: '1.5px solid rgba(10,46,77,0.12)',
                  boxShadow: '0 16px 48px rgba(10,46,77,0.16)',
                  top: '100%',
                }}
                role="dialog"
                aria-label="Pick travel period"
              >
                <MultiPeriodPicker
                  periods={inquiryPeriods}
                  onChange={handleInquiryPeriodsChange}
                  availabilityConfig={availabilityConfig ?? null}
                  blockedDates={blockedDates ?? []}
                />
                <button
                  type="button"
                  onClick={() => setInquiryCalendarOpen(false)}
                  className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] f-body transition-opacity hover:opacity-80"
                  style={{ background: '#0A2E4D', color: '#fff' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* Selected period chips (shown when dropdown is closed) */}
            {inquiryPeriods.length > 0 && !inquiryCalendarOpen && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {inquiryPeriods.map((p, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 text-[11px] font-medium f-body px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(10,46,77,0.07)',
                      color: '#0A2E4D',
                      border: '1px solid rgba(10,46,77,0.12)',
                    }}
                  >
                    {fmtPeriod(p)}
                    <button
                      type="button"
                      onClick={() => handleInquiryPeriodsChange(inquiryPeriods.filter((_, i) => i !== idx))}
                      aria-label={`Remove ${fmtPeriod(p)}`}
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      style={{ lineHeight: 1, fontSize: '14px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
      )}

      {/* ── Booking mode selector — Direct booking or Request dates ────────── */}
      {!isDraft && (
        <div
          className="flex gap-2 mb-4 p-1 rounded-2xl"
          style={{ background: 'rgba(10,46,77,0.05)', border: '1px solid rgba(10,46,77,0.08)' }}
        >
          {([
            { mode: 'direct'    as const, label: 'Direct booking', icon: '📅' },
            { mode: 'icelandic' as const, label: 'Message guide',  icon: '💬' },
          ]).map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBookMode(mode)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold f-body transition-all"
              style={bookMode === mode
                ? { background: 'white', color: '#0A2E4D', boxShadow: '0 1px 8px rgba(10,46,77,0.10)' }
                : { background: 'transparent', color: 'rgba(10,46,77,0.45)' }
              }
            >
              <span style={{ fontSize: '13px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      {!isDraft && <div className="mb-4" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />}

      {/* ── Duration option dropdown ─────────────────────────────────────────── */}
      {<div className="mb-4" ref={optionRef} style={{ position: 'relative' }}>
        <label
          className="block text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Duration
        </label>

        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOptionOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
          style={{
            background: '#F3EDE4',
            border: `1.5px solid ${optionOpen ? '#0A2E4D' : 'rgba(10,46,77,0.12)'}`,
          }}
          aria-haspopup="listbox"
          aria-expanded={optionOpen}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Clock icon */}
            <Clock size={14} strokeWidth={1.3} className="flex-shrink-0" style={{ color: '#0A2E4D', opacity: 0.5 }} />

            <div className="min-w-0">
              <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                {durationLabel(selectedOpt) || 'Select duration'}
              </p>
              {selectedOpt.includes_lodging && (
                <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
                  🏠 Lodging included
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {/* Selected option price */}
            <span className="text-sm font-bold f-body" style={{ color: '#E67E50' }}>
              {selectedOpt.pricing_type === 'per_boat'
                ? `€${selectedOpt.price_eur} flat`
                : selectedOpt.pricing_type === 'per_group'
                ? `From €${calcPrice(selectedOpt, groupSize).fromPrice}`
                : `€${selectedOpt.price_eur} per person`}
            </span>

            {multipleOptions && (
              <ChevronDown
                size={12} strokeWidth={1.6}
                className="transition-transform"
                style={{
                  transform: optionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: 'rgba(10,46,77,0.35)',
                }}
              />
            )}
          </div>
        </button>

        {/* Dropdown panel */}
        {optionOpen && multipleOptions && (
          <div
            className="absolute left-0 right-0 z-50 mt-2 rounded-2xl p-1.5"
            style={{
              background: '#FDFAF7',
              border: '1.5px solid rgba(10,46,77,0.10)',
              boxShadow: '0 20px 56px rgba(10,46,77,0.18)',
              top: '100%',
            }}
            role="listbox"
          >
            {durationOptions.map((opt, i) => {
              const optPrice  = calcPrice(opt, groupSize)
              const isSel     = i === selectedOptIdx
              const priceStr  = opt.pricing_type === 'per_boat'
                ? `€${opt.price_eur} flat`
                : opt.pricing_type === 'per_group'
                ? `From €${optPrice.fromPrice}`
                : `€${opt.price_eur} per person`

              return (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => selectOption(i)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-left rounded-xl transition-all hover:bg-[rgba(10,46,77,0.05)]"
                  style={{
                    background: isSel ? 'rgba(10,46,77,0.07)' : 'transparent',
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isSel && (
                        <Check size={10} strokeWidth={1.8} className="flex-shrink-0" style={{ color: '#0A2E4D' }} />
                      )}
                      <p
                        className="text-sm font-semibold f-body"
                        style={{ color: isSel ? '#0A2E4D' : 'rgba(10,46,77,0.65)' }}
                      >
                        {durationLabel(opt)}
                      </p>
                    </div>
                    {opt.includes_lodging && (
                      <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        🏠 Lodging included
                      </p>
                    )}
                  </div>
                  <span
                    className="text-sm font-bold f-body flex-shrink-0 ml-3"
                    style={{ color: isSel ? '#E67E50' : 'rgba(10,46,77,0.45)' }}
                  >
                    {priceStr}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>}

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div
        className="mb-4"
        style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }}
      />


      {/* ── Group size stepper ──────────────────────────────────────────────── */}
      {!isDraft && showGroupSelector && (
        <div className="mb-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Anglers
          </p>
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-2xl"
            style={{
              background: '#F3EDE4',
              border: '1.5px solid rgba(10,46,77,0.12)',
            }}
          >
            {/* − */}
            <button
              type="button"
              onClick={() => setGroupSize(n => Math.max(1, n - 1))}
              disabled={groupSize <= 1}
              aria-label="Remove angler"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
            >
              <Minus size={12} strokeWidth={2} />
            </button>

            {/* Count */}
            <div className="flex items-center gap-2 select-none">
              <span
                className="text-lg font-bold f-display"
                style={{ color: '#0A2E4D', lineHeight: '1' }}
              >
                {groupSize}
              </span>
              <span
                className="text-sm f-body"
                style={{ color: 'rgba(10,46,77,0.5)', lineHeight: '1' }}
              >
                {groupSize === 1 ? 'angler' : 'anglers'}
              </span>
            </div>

            {/* + */}
            <button
              type="button"
              onClick={() => setGroupSize(n => Math.min(maxGuests, n + 1))}
              disabled={groupSize >= maxGuests}
              aria-label="Add angler"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={{ background: '#E67E50', color: '#fff' }}
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Live price breakdown ────────────────────────────────────────────── */}
      {!isDraft && (
        <div
          className="mb-4 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          {/* Per-trip line */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
              {price.breakdown}
            </span>
            <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
              €{price.total}
            </span>
          </div>


          {/* Service fee */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
              Service fee{serviceFee >= SERVICE_FEE_CAP_EUR ? ' (capped)' : ' (5%)'}
            </span>
            <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
              €{serviceFee}
            </span>
          </div>

          {/* Divider */}
          <div className="my-2.5" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />

          {/* Grand total */}
          <div className="flex items-baseline justify-between">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Total
            </p>
            <div className="text-right">
              <p
                className="font-bold f-display"
                style={{ fontSize: '28px', color: '#0A2E4D', lineHeight: 1 }}
              >
                €{grandTotal}
              </p>
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                {price.suffix}
              </p>
            </div>
          </div>

          {/* Manual payment model note */}
          {paymentModel === 'manual' && (
            <>
              <div className="my-2.5" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />
              <p className="text-[10px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.42)' }}>
                💳 <span className="font-semibold" style={{ color: '#0A2E4D' }}>Deposit</span> charged
                via card after guide confirms.{' '}
                Rest paid directly to the guide.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div id="widget-cta" />
      {isDraft ? (
        <>
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-2xl mb-4"
            style={{ background: 'rgba(230,126,80,0.08)', border: '1px solid rgba(230,126,80,0.18)' }}
          >
            <Info size={16} strokeWidth={1.5} className="flex-shrink-0 mt-0.5" style={{ color: '#E67E50' }} />
            <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)' }}>
              This experience is a draft. Publish it from your dashboard to accept bookings.
            </p>
          </div>
          <Link
            href={`/dashboard/trips/${expId}/edit`}
            className="block w-full text-center text-white font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
            style={{ background: '#E67E50' }}
          >
            Edit &amp; Publish →
          </Link>
        </>
      ) : bookMode === 'direct' ? (
        /* ── Direct booking — dates required; no redirect without selection ─ */
        <>
          {selectedDates.length > 0 ? (
            <Link
              href={`/trips/${expId}/inquire?dates=${[...selectedDates].sort().join(',')}&group=${groupSize}&mode=direct`}
              className="block w-full text-center text-white font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
              style={{ background: '#E67E50' }}
            >
              {selectedDates.length === 1
                ? `Request — ${[...selectedDates][0]} →`
                : `Request — ${selectedDates.length} days →`}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="w-full text-center font-semibold py-3.5 rounded-2xl text-sm tracking-wide f-body"
              style={{
                background: 'rgba(10,46,77,0.06)',
                color: 'rgba(10,46,77,0.35)',
                border: '1.5px dashed rgba(10,46,77,0.18)',
                cursor: 'pointer',
              }}
            >
              Pick dates above to continue ↑
            </button>
          )}
          <p className="text-center text-xs mt-2 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
            {selectedDates.length > 0
              ? 'Your dates will be pre-filled in the booking form.'
              : 'Select specific dates to send a booking request.'}
          </p>
        </>
      ) : (
        /* ── Request dates — Icelandic flow with period picker ────────────── */
        <>
          <Link
            href={`/trips/${expId}/inquire${
              inquiryPeriods.length > 0
                ? `?periods=${encodePeriodsParam(inquiryPeriods)}&group=${groupSize}`
                : `?group=${groupSize}`
            }`}
            className="block w-full text-center text-white font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
            style={{ background: '#0A2E4D' }}
          >
            {inquiryPeriods.length > 0
              ? inquiryPeriods.length === 1
                ? `Request trip — ${fmtPeriod(inquiryPeriods[0])} →`
                : `Request trip — ${inquiryPeriods.length} periods →`
              : 'Request this trip →'}
          </Link>
          <p className="text-center text-xs mt-2 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
            Guide reviews your request and sets up a custom offer — no payment until confirmed.
          </p>
        </>
      )}

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="my-4" style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />

      {/* ── Trust micro-signals ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {[
          { icon: '✓', text: 'Guide verified by FjordAnglers' },
          { icon: '🔒', text: 'Secure payment via Stripe' },
          { icon: '⌚', text: 'Guide confirms within 24 hours' },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
              style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
            >
              {item.icon}
            </span>
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mobile booking bar ───────────────────────────────────────────────────────

/**
 * Simplified mobile bar — shows live price without the full widget UI.
 * Mirrors the state of the desktop BookingWidget but condensed.
 */
export function MobileBookingBar({
  expId,
  isDraft,
  rawDurationOptions,
  maxGuests,
  legacyPricePerPerson,
  durationHours,
  durationDays,
  bookingType = 'classic',
  calendarDisabled = false,
}: Omit<BookingWidgetProps, 'difficulty'>) {
  const durationOptions = useMemo<DurationOptionPayload[]>(() => {
    if (!Array.isArray(rawDurationOptions) || rawDurationOptions.length === 0) {
      return [{
        label: '', hours: durationHours ?? null, days: durationDays ?? null,
        pricing_type: 'per_person', price_eur: legacyPricePerPerson ?? 0,
        includes_lodging: false,
      }]
    }
    return rawDurationOptions as unknown as DurationOptionPayload[]
  }, [rawDurationOptions, legacyPricePerPerson, durationHours, durationDays])

  const fromPrice = useMemo(() => globalFromPrice(durationOptions), [durationOptions])
  const firstOpt  = durationOptions[0]

  if (isDraft) return null

  // calendarDisabled always wins — show inquiry-only bar
  if (bookingType === 'icelandic' || calendarDisabled) {
    return (
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: '#FDFAF7',
          borderTop: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 -8px 32px rgba(10,46,77,0.1)',
        }}
      >
        <div>
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Price</p>
          <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>On request</p>
        </div>
        <Link
          href={`/trips/${expId}/inquire`}
          className="text-white font-semibold px-8 py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
          style={{ background: '#0A2E4D' }}
        >
          Request this trip →
        </Link>
      </div>
    )
  }

  if (bookingType === 'both') {
    return (
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-5 py-4 gap-3"
        style={{
          background: '#FDFAF7',
          borderTop: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 -8px 32px rgba(10,46,77,0.1)',
        }}
      >
        <div className="flex-shrink-0">
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>From</p>
          <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            €{fromPrice}
            <span className="text-sm font-normal ml-1" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {firstOpt.pricing_type === 'per_boat' ? 'flat' : 'p.p.'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-1 min-w-0">
          <Link
            href={`/book/${expId}`}
            className="flex-1 text-center text-white font-semibold py-3 rounded-xl text-xs tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
            style={{ background: '#E67E50' }}
          >
            Book & Pay
          </Link>
          <Link
            href={`/trips/${expId}/inquire`}
            className="flex-1 text-center font-semibold py-3 rounded-xl text-xs tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
            style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
          >
            Request
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-5 py-3 gap-3"
      style={{
        background: '#FDFAF7',
        borderTop: '1px solid rgba(10,46,77,0.08)',
        boxShadow: '0 -8px 32px rgba(10,46,77,0.1)',
      }}
    >
      <div className="flex-shrink-0">
        <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          From
        </p>
        <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          €{fromPrice}
          <span className="text-sm font-normal ml-1" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {firstOpt.pricing_type === 'per_boat' ? 'flat' : 'p.p.'}
          </span>
        </p>
      </div>
      <div className="flex gap-2 flex-1 min-w-0">
        <Link
          href={`/trips/${expId}/inquire`}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold f-body transition-all hover:brightness-95 active:scale-[0.98] flex-shrink-0"
          style={{
            background: 'rgba(10,46,77,0.06)',
            color: '#0A2E4D',
            border: '1px solid rgba(10,46,77,0.1)',
          }}
          aria-label="Message the guide first"
        >
          <MessageSquare size={13} strokeWidth={1.8} />
          Message
        </Link>
        <Link
          href={`/book/${expId}`}
          className="flex-1 text-center text-white font-semibold py-3 rounded-xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          Book now →
        </Link>
      </div>
    </div>
  )
}
