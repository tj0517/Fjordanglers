'use client'

/**
 * GuideOfferForm — lets a guide send a custom trip offer for an inquiry.
 *
 * Sections:
 * 1. Angler's requested dates (read-only summary + multi-period chips)
 * 2. OfferDatePicker — calendar with angler dates highlighted, guide picks confirmed range
 * 3. River / Location — text field
 * 4. Meeting point — Leaflet map picker (toggleable, SSR-disabled)
 * 5. Total price — number input
 * 6. Offer details — textarea
 */

import { useState, useTransition, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { sendOfferByGuide } from '@/actions/inquiries'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import {
  type PriceTier,
  findApplicableTierPrice,
  validatePriceTiers,
} from '@/lib/inquiry-pricing'

// ─── Dynamic map import (Leaflet needs browser DOM) ───────────────────────────

const LocationPickerMap = dynamic(
  () => import('@/components/trips/location-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height:       200,
          borderRadius: 12,
          background:   'rgba(10,46,77,0.04)',
        }}
        className="animate-pulse"
      />
    ),
  },
)

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = { from: string; to: string }

type WeeklySchedule = {
  period_from:      string
  period_to:        string
  blocked_weekdays: number[]
}

export type GuideOfferFormProps = {
  inquiryId:             string
  anglerDatesFrom:       string
  anglerDatesTo:         string
  anglerAllPeriods?:     Period[]
  guideWeeklySchedules?: WeeklySchedule[]
  /** Group size from the inquiry — used for live tier preview */
  groupSize?:            number
}

// ─── Tier builder helpers ─────────────────────────────────────────────────────

type TierRow = { anglers: string; price: string }

const DEFAULT_TIERS: TierRow[] = [
  { anglers: '1', price: '' },
  { anglers: '2', price: '' },
]

type DayCellState =
  | 'past'
  | 'available'
  | 'angler_window'
  | 'angler_period'
  | 'guide_blocked'
  | 'selected_start'
  | 'selected_end'
  | 'selected_both'
  | 'selected_range'

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const WEEKDAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getOfferDayCellState(
  iso:             string,
  todayISO:        string,
  anglerFrom:      string,
  anglerTo:        string,
  anglerPeriods:   Period[],
  weeklySchedules: WeeklySchedule[],
  selectedFrom:    string | null,
  selectedTo:      string | null,
  hoveredISO:      string | null,
): DayCellState {
  if (iso < todayISO) return 'past'

  // Effective range end: confirmed selectedTo OR hover preview
  const effectiveEnd =
    selectedTo ?? (selectedFrom != null ? hoveredISO : null)

  if (selectedFrom != null) {
    // Normalise so s <= e
    const s =
      effectiveEnd != null && effectiveEnd < selectedFrom
        ? effectiveEnd
        : selectedFrom
    const e =
      effectiveEnd != null && effectiveEnd < selectedFrom
        ? selectedFrom
        : (effectiveEnd ?? selectedFrom)

    if (iso === s && iso === e) return 'selected_both'
    if (iso === s)              return 'selected_start'
    if (iso === e)              return 'selected_end'
    if (iso > s && iso < e)    return 'selected_range'
  }

  // Guide blocked weekday
  // JS Date.getDay(): 0=Sun, 1=Mon, …, 6=Sat
  // guide_weekly_schedules: 0=Mon, 1=Tue, …, 6=Sun
  const jsDay = new Date(iso + 'T12:00:00').getDay()
  const isoWd = jsDay === 0 ? 6 : jsDay - 1
  for (const sched of weeklySchedules) {
    if (iso >= sched.period_from && iso <= sched.period_to) {
      if (sched.blocked_weekdays.includes(isoWd)) return 'guide_blocked'
    }
  }

  // Angler's specifically selected periods
  for (const p of anglerPeriods) {
    if (iso >= p.from && iso <= p.to) return 'angler_period'
  }

  // Angler's overall window
  if (iso >= anglerFrom && iso <= anglerTo) return 'angler_window'

  return 'available'
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   '#F3EDE4',
  border:       '1.5px solid rgba(10,46,77,0.12)',
  borderRadius: '12px',
  padding:      '10px 13px',
  fontSize:     '14px',
  color:        '#0A2E4D',
  outline:      'none',
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '10px',
  fontWeight:    700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.18em',
  color:         'rgba(10,46,77,0.45)',
  marginBottom:  '6px',
}

// ─── OfferDatePicker ──────────────────────────────────────────────────────────

function OfferDatePicker({
  anglerDatesFrom,
  anglerDatesTo,
  anglerAllPeriods,
  guideWeeklySchedules,
  selectedFrom,
  selectedTo,
  onChange,
  disabled,
}: {
  anglerDatesFrom:      string
  anglerDatesTo:        string
  anglerAllPeriods:     Period[]
  guideWeeklySchedules: WeeklySchedule[]
  selectedFrom:         string | null
  selectedTo:           string | null
  onChange:             (from: string | null, to: string | null) => void
  disabled:             boolean
}) {
  const now      = new Date()
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Start the view at angler's datesFrom month, but not before today
  const anglerDate = new Date(anglerDatesFrom + 'T12:00:00')
  const aY = anglerDate.getFullYear()
  const aM = anglerDate.getMonth()
  const afterToday = aY > now.getFullYear() || (aY === now.getFullYear() && aM >= now.getMonth())
  const initY = afterToday ? aY : now.getFullYear()
  const initM = afterToday ? aM : now.getMonth()

  const [viewY, setViewY] = useState(initY)
  const [viewM, setViewM] = useState(initM)
  const [hoveredISO, setHoveredISO] = useState<string | null>(null)

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7

  const canPrev =
    viewY > now.getFullYear() ||
    (viewY === now.getFullYear() && viewM > now.getMonth())

  function goPrev() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11) }
    else setViewM(m => m - 1)
  }
  function goNext() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0) }
    else setViewM(m => m + 1)
  }

  function handleDayClick(iso: string) {
    if (disabled || iso < todayISO) return
    if (selectedFrom === null) {
      // First click: start date
      onChange(iso, null)
    } else if (selectedTo === null) {
      // Second click: end date (normalise order)
      if (iso < selectedFrom) onChange(iso, selectedFrom)
      else                    onChange(selectedFrom, iso)
    } else {
      // Third click: reset and start fresh
      onChange(iso, null)
    }
  }

  const selectedSummary = useMemo(() => {
    if (selectedFrom == null) return null
    if (selectedTo == null)   return `${selectedFrom} → pick end date…`
    if (selectedFrom === selectedTo) return selectedFrom
    return `${selectedFrom} → ${selectedTo}`
  }, [selectedFrom, selectedTo])

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#FDFAF7',
        border:     '1.5px solid rgba(10,46,77,0.12)',
      }}
    >
      <div className="px-4 pt-4 pb-3">

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev || disabled}
            aria-label="Previous month"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}
          >
            <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
              <path d="M4 1L1 4.5 4 8" stroke="#0A2E4D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            {MONTH_NAMES[viewM]} {viewY}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={disabled}
            aria-label="Next month"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}
          >
            <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
              <path d="M1 1L4 4.5 1 8" stroke="#0A2E4D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

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
        <div className="grid grid-cols-7">
          {/* Padding cells */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d       = i + 1
            const iso     = toISO(viewY, viewM, d)
            const isToday = iso === todayISO

            const state = getOfferDayCellState(
              iso, todayISO,
              anglerDatesFrom, anglerDatesTo,
              anglerAllPeriods, guideWeeklySchedules,
              selectedFrom, selectedTo, hoveredISO,
            )

            const isPast     = state === 'past'
            const isSelected = (
              state === 'selected_start' ||
              state === 'selected_end'   ||
              state === 'selected_both'
            )

            // ── Outer cell background (range bar) ──────────────────
            let outerBg = 'transparent'
            if      (state === 'selected_range')  outerBg = 'rgba(230,126,80,0.1)'
            else if (state === 'selected_start')  outerBg = 'linear-gradient(to right, transparent 50%, rgba(230,126,80,0.1) 50%)'
            else if (state === 'selected_end')    outerBg = 'linear-gradient(to left,  transparent 50%, rgba(230,126,80,0.1) 50%)'
            else if (state === 'angler_period')   outerBg = 'rgba(59,130,246,0.09)'
            else if (state === 'angler_window')   outerBg = 'rgba(59,130,246,0.04)'

            // ── Inner circle background ─────────────────────────────
            let innerBg: string | undefined
            if      (isSelected)               innerBg = '#E67E50'
            else if (isToday && !isPast)        innerBg = 'rgba(10,46,77,0.07)'

            // ── Text styling ────────────────────────────────────────
            let textColor   = '#0A2E4D'
            let textWeight  = isToday ? 700 : 400
            let textDeco    = 'none'
            let textOpacity = 1

            if (isPast)                     { textColor = 'rgba(10,46,77,0.2)'; textOpacity = 0.4 }
            if (isSelected)                 { textColor = 'white'; textWeight = 700 }
            if (state === 'guide_blocked')  { textColor = 'rgba(239,68,68,0.5)'; textDeco = 'line-through' }
            if (state === 'angler_period')  textWeight = 600

            const tooltipTitle =
              state === 'guide_blocked' ? 'Your off-day — click to override' :
              state === 'angler_period' ? "Angler's requested date" :
              state === 'angler_window' ? "Within angler's window" :
              undefined

            return (
              <div
                key={d}
                className="h-8 flex items-center justify-center"
                style={{ background: outerBg }}
              >
                <button
                  type="button"
                  disabled={isPast || disabled}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => { if (!disabled) setHoveredISO(iso) }}
                  onMouseLeave={() => { if (!disabled) setHoveredISO(null) }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: innerBg,
                    cursor:     (isPast || disabled) ? 'default' : 'pointer',
                  }}
                  title={tooltipTitle}
                >
                  <span
                    className="text-[11px] f-body leading-none select-none"
                    style={{
                      color:          textColor,
                      fontWeight:     textWeight,
                      textDecoration: textDeco,
                      opacity:        textOpacity,
                    }}
                  >
                    {d}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Hint when first date is picked, waiting for second */}
        {selectedFrom != null && selectedTo == null && (
          <p
            className="text-[10px] f-body text-center mt-2"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Now click the end date
          </p>
        )}

        {/* Legend */}
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
        >
          {([
            { color: 'rgba(59,130,246,0.55)',  label: "Angler's dates"  },
            { color: '#E67E50',                label: 'Your offer dates' },
            { color: 'rgba(239,68,68,0.45)',   label: 'Off-day', strike: true },
          ] as { color: string; label: string; strike?: true }[]).map(({ color, label, strike }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span
                className={`text-[10px] f-body ${strike === true ? 'line-through' : ''}`}
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection summary footer */}
      {selectedSummary != null && (
        <div
          className="px-4 py-2.5 flex items-center justify-between gap-2"
          style={{
            background:  'rgba(230,126,80,0.06)',
            borderTop:   '1px solid rgba(230,126,80,0.12)',
          }}
        >
          <span
            className="text-xs f-body font-medium truncate"
            style={{ color: '#0A2E4D' }}
          >
            {selectedSummary}
          </span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            disabled={disabled}
            className="text-[10px] f-body flex-shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(10,46,77,0.45)' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuideOfferForm({
  inquiryId,
  anglerDatesFrom,
  anglerDatesTo,
  anglerAllPeriods     = [],
  guideWeeklySchedules = [],
  groupSize,
}: GuideOfferFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Offer date range (from calendar)
  const [offerDateFrom, setOfferDateFrom] = useState<string | null>(null)
  const [offerDateTo,   setOfferDateTo]   = useState<string | null>(null)
  // Duration type — only relevant for single-day offers
  const [singleDayDuration, setSingleDayDuration] = useState<'half_day' | 'full_day'>('full_day')

  // Form fields
  const [assignedRiver, setAssignedRiver] = useState('')
  const [offerDetails,  setOfferDetails]  = useState('')

  // ── Pricing mode ─────────────────────────────────────────────────────────────
  const [pricingMode, setPricingMode] = useState<'single' | 'tiers'>('single')
  // Single price mode
  const [offerPriceMin, setOfferPriceMin] = useState('')   // optional lower bound (widełki)
  const [offerPrice,    setOfferPrice]    = useState('')   // final / max price
  // Tiers mode
  const [tiers, setTiers] = useState<TierRow[]>(DEFAULT_TIERS)

  function addTier() {
    setTiers(prev => {
      const nums = prev.map(t => parseInt(t.anglers)).filter(n => !isNaN(n))
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
      return [...prev, { anglers: String(next), price: '' }]
    })
  }

  function removeTier(idx: number) {
    setTiers(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  function updateTier(idx: number, field: 'anglers' | 'price', value: string) {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  // Sorted tiers for display (highest anglers = last = "N+")
  const sortedTierIndices = useMemo(
    () =>
      tiers
        .map((t, i) => ({ idx: i, anglers: parseInt(t.anglers) || 0 }))
        .sort((a, b) => a.anglers - b.anglers)
        .map(x => x.idx),
    [tiers],
  )

  // Live preview: which tier applies to the inquiry's group size
  const tierPreviewPrice = useMemo<number | null>(() => {
    if (pricingMode !== 'tiers' || groupSize == null) return null
    const parsed: PriceTier[] = tiers
      .map(t => ({ anglers: parseInt(t.anglers), priceEur: parseFloat(t.price) }))
      .filter(t => !isNaN(t.anglers) && !isNaN(t.priceEur) && t.anglers > 0 && t.priceEur > 0)
    if (parsed.length === 0) return null
    return findApplicableTierPrice(parsed, groupSize)
  }, [pricingMode, tiers, groupSize])

  // Meeting point map
  const [showMap, setShowMap] = useState(false)
  const [meetLat, setMeetLat] = useState<number | null>(null)
  const [meetLng, setMeetLng] = useState<number | null>(null)

  function handleDatesChange(from: string | null, to: string | null) {
    setOfferDateFrom(from)
    setOfferDateTo(to)
  }

  // Compute confirmed duration for display
  const confirmedDays = useMemo(() => {
    if (offerDateFrom == null || offerDateTo == null) return null
    const from = new Date(offerDateFrom + 'T12:00:00')
    const to   = new Date(offerDateTo   + 'T12:00:00')
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  }, [offerDateFrom, offerDateTo])

  const isSingleDay = confirmedDays === 1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!assignedRiver.trim()) {
      setError('Enter the river or location name.')
      return
    }

    // Validate pricing
    if (pricingMode === 'single') {
      const priceNum    = parseFloat(offerPrice)
      const priceMinNum = offerPriceMin.trim() ? parseFloat(offerPriceMin) : null
      if (isNaN(priceNum) || priceNum <= 0) {
        setError('Enter a valid offer price.')
        return
      }
      if (priceMinNum != null && (isNaN(priceMinNum) || priceMinNum <= 0)) {
        setError('Enter a valid minimum price.')
        return
      }
      if (priceMinNum != null && priceMinNum >= priceNum) {
        setError('Minimum price must be less than the final price.')
        return
      }
    } else {
      const parsed: PriceTier[] = tiers.map(t => ({
        anglers:  parseInt(t.anglers),
        priceEur: parseFloat(t.price),
      }))
      const tiersErr = validatePriceTiers(parsed)
      if (tiersErr != null) {
        setError(tiersErr)
        return
      }
    }

    if (!offerDetails.trim()) {
      setError('Add offer details for the angler.')
      return
    }

    startTransition(async () => {
      const base = {
        assignedRiver:   assignedRiver.trim(),
        offerDetails:    offerDetails.trim(),
        offerDateFrom:   offerDateFrom ?? undefined,
        offerDateTo:     offerDateTo   ?? undefined,
        offerMeetingLat: meetLat       ?? undefined,
        offerMeetingLng: meetLng       ?? undefined,
      } as const

      const priceMinParsed = offerPriceMin.trim() ? parseFloat(offerPriceMin) : undefined
      const pricingPayload =
        pricingMode === 'single'
          ? {
              offerPriceEur:    parseFloat(offerPrice),
              offerPriceMinEur: priceMinParsed,
            }
          : {
              offerPriceTiers: tiers.map(t => ({
                anglers:  parseInt(t.anglers),
                priceEur: parseFloat(t.price),
              })),
            }

      const result = await sendOfferByGuide(inquiryId, { ...base, ...pricingPayload })
      if (result.error != null) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  // ── Success state ───────────────────────────────────────────────────────────

  if (success) {
    return (
      <div
        className="px-4 py-4 rounded-xl flex flex-col gap-1"
        style={{
          background: 'rgba(74,222,128,0.08)',
          border:     '1px solid rgba(74,222,128,0.2)',
        }}
      >
        <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
          Offer sent!
        </p>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
          The angler will receive your offer and can accept or ask questions.
        </p>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
      {isPending && <LoadingOverlay rounded="rounded-none" />}

      {/* ── 1. Angler's dates (read-only summary) ───────────────── */}
      <div>
        <p style={labelStyle}>Angler&rsquo;s requested dates</p>
        {anglerAllPeriods.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {anglerAllPeriods.map((p, i) => (
              <span
                key={i}
                className="text-xs f-body px-2.5 py-1 rounded-lg"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  color:      '#1D4ED8',
                  border:     '1px solid rgba(59,130,246,0.18)',
                }}
              >
                {p.from === p.to ? p.from : `${p.from} – ${p.to}`}
              </span>
            ))}
          </div>
        ) : (
          <span
            className="inline-block text-xs f-body px-2.5 py-1 rounded-lg"
            style={{
              background: 'rgba(59,130,246,0.1)',
              color:      '#1D4ED8',
              border:     '1px solid rgba(59,130,246,0.18)',
            }}
          >
            {anglerDatesFrom === anglerDatesTo
              ? anglerDatesFrom
              : `${anglerDatesFrom} – ${anglerDatesTo}`}
          </span>
        )}
      </div>

      {/* ── 2. Confirm trip dates ─────────────────────────────────── */}
      <div>
        <p style={labelStyle}>
          Confirm trip dates
          <span
            className="ml-1 normal-case tracking-normal"
            style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}
          >
            (optional)
          </span>
        </p>
        <OfferDatePicker
          anglerDatesFrom={anglerDatesFrom}
          anglerDatesTo={anglerDatesTo}
          anglerAllPeriods={anglerAllPeriods}
          guideWeeklySchedules={guideWeeklySchedules}
          selectedFrom={offerDateFrom}
          selectedTo={offerDateTo}
          onChange={handleDatesChange}
          disabled={isPending}
        />

        {/* Duration badge + single-day type picker */}
        {confirmedDays != null && (
          <div className="mt-2.5 flex flex-col gap-2">

            {/* Badge: how many days confirmed */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs f-body font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(230,126,80,0.1)', color: '#C4622A' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                  stroke="currentColor" strokeWidth="1.6">
                  <circle cx="5" cy="5" r="4" />
                  <polyline points="5,2.5 5,5 6.5,6.5" />
                </svg>
                {confirmedDays === 1 ? '1 day' : `${confirmedDays} days`}
              </span>
              {isSingleDay && (
                <span
                  className="text-[10px] f-body"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  — select duration:
                </span>
              )}
            </div>

            {/* Half / full day toggle for single-day bookings */}
            {isSingleDay && (
              <div className="flex gap-2">
                {(
                  [
                    { value: 'full_day' as const, label: 'Full day', sub: '~8 hrs' },
                    { value: 'half_day' as const, label: 'Half day', sub: '~4 hrs' },
                  ]
                ).map(opt => {
                  const on = singleDayDuration === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSingleDayDuration(opt.value)}
                      disabled={isPending}
                      className="flex flex-col items-start px-3 py-2.5 rounded-xl transition-all flex-1"
                      style={{
                        background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                        border: on
                          ? '1.5px solid #0A2E4D'
                          : '1px solid rgba(10,46,77,0.1)',
                      }}
                    >
                      <span
                        className="text-[12px] font-bold f-body"
                        style={{ color: on ? 'white' : '#0A2E4D' }}
                      >
                        {opt.label}
                      </span>
                      <span
                        className="text-[10px] f-body mt-0.5"
                        style={{ color: on ? 'rgba(255,255,255,0.55)' : 'rgba(10,46,77,0.4)' }}
                      >
                        {opt.sub}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. River / location ───────────────────────────────────── */}
      <div>
        <label style={labelStyle}>River / location *</label>
        <input
          type="text"
          placeholder="e.g. Alta River, Norway"
          value={assignedRiver}
          onChange={e => setAssignedRiver(e.target.value)}
          disabled={isPending}
          className="f-body"
          style={inputStyle}
        />
      </div>

      {/* ── 4. Meeting point (toggleable map) ────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p style={{ ...labelStyle, marginBottom: 0 }}>
            Meeting point
            <span
              className="ml-1 normal-case tracking-normal"
              style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}
            >
              (optional)
            </span>
          </p>
          <button
            type="button"
            onClick={() => setShowMap(v => !v)}
            disabled={isPending}
            className="text-[11px] f-body font-semibold transition-opacity hover:opacity-75"
            style={{ color: '#E67E50' }}
          >
            {showMap ? 'Hide map' : 'Pin on map →'}
          </button>
        </div>

        {showMap && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}
          >
            <LocationPickerMap
              mode="pin"
              lat={meetLat}
              lng={meetLng}
              onChange={(lat, lng) => {
                setMeetLat(lat)
                setMeetLng(lng)
              }}
            />
            {meetLat != null && meetLng != null && (
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-3"
                style={{
                  background: 'rgba(10,46,77,0.03)',
                  borderTop:  '1px solid rgba(10,46,77,0.07)',
                }}
              >
                <span
                  className="text-[11px] f-body font-mono truncate"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  {meetLat.toFixed(5)}, {meetLng.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => { setMeetLat(null); setMeetLng(null) }}
                  disabled={isPending}
                  className="text-[10px] f-body flex-shrink-0 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Remove
                </button>
              </div>
            )}
            {meetLat == null && (
              <p
                className="text-[10px] f-body text-center py-2"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                Click the map to place a meeting point pin
              </p>
            )}
          </div>
        )}

        {/* Show coords when map is hidden but pin is set */}
        {!showMap && meetLat != null && meetLng != null && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <svg width="10" height="13" viewBox="0 0 10 13" fill="none" className="flex-shrink-0">
              <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5Z" fill="#E67E50" />
              <circle cx="5" cy="5" r="1.8" fill="white" />
            </svg>
            <span
              className="text-[11px] f-body font-mono"
              style={{ color: 'rgba(10,46,77,0.55)' }}
            >
              {meetLat.toFixed(4)}, {meetLng.toFixed(4)}
            </span>
            <button
              type="button"
              onClick={() => { setMeetLat(null); setMeetLng(null) }}
              disabled={isPending}
              className="ml-auto text-[10px] f-body hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(10,46,77,0.35)' }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ── 5. Pricing ────────────────────────────────────────────── */}
      <div>
        <p style={labelStyle}>Pricing *</p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-3">
          {(['single', 'tiers'] as const).map(mode => {
            const on = pricingMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setPricingMode(mode)}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold f-body transition-all"
                style={{
                  background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                  color:      on ? 'white'   : '#0A2E4D',
                  border:     on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                }}
              >
                {mode === 'single' ? 'Single price' : 'By group size'}
              </button>
            )
          })}
        </div>

        {/* ── Single price ── */}
        {pricingMode === 'single' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {/* From (optional) */}
              <div>
                <p className="text-[10px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  From — optional
                </p>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    €
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="800"
                    value={offerPriceMin}
                    onChange={e => setOfferPriceMin(e.target.value)}
                    disabled={isPending}
                    className="f-body"
                    style={{ ...inputStyle, paddingLeft: '26px' }}
                    aria-label="Minimum offer price in EUR (optional)"
                  />
                </div>
              </div>

              {/* Final price (required) */}
              <div>
                <p className="text-[10px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  {offerPriceMin.trim() ? 'To / Final *' : 'Total *'}
                </p>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    €
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="1200"
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    disabled={isPending}
                    className="f-body"
                    style={{ ...inputStyle, paddingLeft: '26px' }}
                    aria-label="Total offer price in EUR"
                  />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <p className="mt-1.5 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {offerPriceMin.trim() && offerPrice.trim()
                ? `Angler sees: €${offerPriceMin} – €${offerPrice}`
                : offerPrice.trim()
                ? `Angler sees: €${offerPrice} (fixed)`
                : 'Set a range if the final price depends on conditions.'}
            </p>
          </>
        )}

        {/* ── Price tiers ── */}
        {pricingMode === 'tiers' && (
          <div className="flex flex-col gap-2">

            {/* Tier table */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}
            >
              {/* Header row */}
              <div
                className="grid gap-2 px-3 py-2"
                style={{
                  gridTemplateColumns: '76px 1fr 28px',
                  background:   'rgba(10,46,77,0.04)',
                  borderBottom: '1px solid rgba(10,46,77,0.08)',
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.15em] f-body"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Anglers
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.15em] f-body"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  Total (EUR)
                </span>
                <span />
              </div>

              {/* Data rows — sorted ascending by anglers */}
              {sortedTierIndices.map((originalIdx, displayIdx) => {
                const tier   = tiers[originalIdx]
                const isLast = displayIdx === sortedTierIndices.length - 1
                const isOnly = tiers.length <= 1

                return (
                  <div
                    key={originalIdx}
                    className="grid gap-2 px-3 py-2 items-center"
                    style={{
                      gridTemplateColumns: '76px 1fr 28px',
                      borderBottom: displayIdx < sortedTierIndices.length - 1
                        ? '1px solid rgba(10,46,77,0.06)'
                        : undefined,
                    }}
                  >
                    {/* Anglers input + "+" suffix on last row */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tier.anglers}
                        onChange={e => updateTier(originalIdx, 'anglers', e.target.value)}
                        disabled={isPending}
                        aria-label={`Anglers for tier ${displayIdx + 1}`}
                        className="f-body text-center"
                        style={{
                          width:        48,
                          background:   '#F3EDE4',
                          border:       '1px solid rgba(10,46,77,0.12)',
                          borderRadius: 8,
                          padding:      '5px 4px',
                          fontSize:     13,
                          color:        '#0A2E4D',
                          outline:      'none',
                        }}
                      />
                      {isLast && (
                        <span
                          className="text-[11px] font-bold f-body"
                          style={{ color: 'rgba(10,46,77,0.35)' }}
                        >
                          +
                        </span>
                      )}
                    </div>

                    {/* Price input */}
                    <div className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none"
                        style={{ color: 'rgba(10,46,77,0.4)' }}
                      >
                        €
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="1200"
                        value={tier.price}
                        onChange={e => updateTier(originalIdx, 'price', e.target.value)}
                        disabled={isPending}
                        aria-label={`Price for tier ${displayIdx + 1}`}
                        className="f-body w-full"
                        style={{ ...inputStyle, paddingLeft: '24px', padding: '7px 10px 7px 24px' }}
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeTier(originalIdx)}
                      disabled={isPending || isOnly}
                      aria-label={`Remove tier ${displayIdx + 1}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="1" y1="1" x2="7" y2="7" />
                        <line x1="7" y1="1" x2="1" y2="7" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add tier button */}
            <button
              type="button"
              onClick={addTier}
              disabled={isPending}
              className="self-start flex items-center gap-1.5 text-[11px] font-semibold f-body transition-opacity hover:opacity-75 disabled:opacity-40"
              style={{ color: '#E67E50' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
              Add tier
            </button>

            {/* Live preview for this inquiry's group size */}
            {groupSize != null && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: tierPreviewPrice != null
                    ? 'rgba(230,126,80,0.06)'
                    : 'rgba(10,46,77,0.03)',
                  border: tierPreviewPrice != null
                    ? '1px solid rgba(230,126,80,0.15)'
                    : '1px solid rgba(10,46,77,0.07)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
                  stroke={tierPreviewPrice != null ? '#C4622A' : 'rgba(10,46,77,0.3)'}
                  strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="6" cy="6" r="5" />
                  <path d="M6 3.5v3l2 1.5" />
                </svg>
                <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  Group of {groupSize}:{' '}
                  <span
                    className="font-semibold"
                    style={{ color: tierPreviewPrice != null ? '#C4622A' : 'rgba(10,46,77,0.3)' }}
                  >
                    {tierPreviewPrice != null ? `€${tierPreviewPrice}` : '—'}
                  </span>
                </p>
              </div>
            )}

            <p
              className="text-[11px] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Last row covers that count and above. Price auto-selected at checkout.
            </p>
          </div>
        )}
      </div>

      {/* ── 6. Offer details ─────────────────────────────────────── */}
      <div>
        <label style={labelStyle}>Offer details *</label>
        <textarea
          rows={5}
          placeholder="What's included, schedule, equipment, lunch, cancellation policy…"
          value={offerDetails}
          onChange={e => setOfferDetails(e.target.value)}
          disabled={isPending}
          className="f-body resize-none"
          style={{ ...inputStyle, height: 'auto' }}
        />
      </div>

      {/* Error banner */}
      {error != null && (
        <div
          className="px-4 py-3 rounded-xl text-sm f-body"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border:     '1px solid rgba(239,68,68,0.2)',
            color:      '#DC2626',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110 disabled:opacity-60"
        style={{ background: '#E67E50' }}
      >
        {isPending ? 'Sending…' : 'Send Offer →'}
      </button>
    </form>
  )
}
