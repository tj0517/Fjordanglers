'use client'

import { useState, useTransition, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { sendOffer as sendOfferByGuide } from '@/actions/bookings'
import { ChevronLeft, ChevronRight, Clock, MapPin, X } from 'lucide-react'

// ─── Dynamic map import (Leaflet needs browser DOM) ───────────────────────────

const LocationPickerMap = dynamic(
  () => import('@/components/trips/location-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 200, borderRadius: 12, background: 'rgba(10,46,77,0.04)' }}
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
  groupSize?:            number | null
  onSuccess?:            () => void
  /** Hide the read-only "Angler's requested dates" chip row — used when the
   *  parent modal already shows this info in a side panel. */
  hideAnglerDates?:      boolean
  /** Two-letter ISO country code — used to centre the location map on the guide's operating country. */
  guideCountry?:         string | null
}

// ─── Country centre map (for auto-centering the location picker) ───────────────

const COUNTRY_CENTERS: Record<string, [number, number]> = {
  NO: [65.0, 14.0],
  SE: [62.0, 15.0],
  FI: [64.0, 26.0],
  DK: [56.0, 10.0],
  IS: [65.0, -18.5],
  HR: [45.1, 15.2],
  DE: [51.2, 10.5],
  PL: [52.0, 20.0],
  GB: [54.0,  -2.0],
  IE: [53.4,  -8.0],
  FR: [46.2,   2.2],
  ES: [40.4,  -3.7],
  AT: [47.5,  14.5],
  CZ: [50.0,  15.5],
  SK: [48.7,  19.7],
  SI: [46.1,  14.8],
  RO: [45.9,  25.0],
  RU: [62.0,  55.0],
}

// DB stores country as full name ("Iceland") or ISO code ("IS").
// Normalise to ISO before looking up in COUNTRY_CENTERS.
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  Norway:          'NO',
  Sweden:          'SE',
  Finland:         'FI',
  Denmark:         'DK',
  Iceland:         'IS',
  Croatia:         'HR',
  Germany:         'DE',
  Poland:          'PL',
  'United Kingdom':'GB',
  Ireland:         'IE',
  France:          'FR',
  Spain:           'ES',
  Austria:         'AT',
  'Czech Republic':'CZ',
  Slovakia:        'SK',
  Slovenia:        'SI',
  Romania:         'RO',
  Estonia:         'EE',
  Latvia:          'LV',
  Lithuania:       'LT',
  Switzerland:     'CH',
  Netherlands:     'NL',
  Belgium:         'BE',
  Portugal:        'PT',
  Italy:           'IT',
}

/** Returns the [lat, lng] centre for a country given either its ISO code or full name. */
function getCountryCenter(country: string | null | undefined): [number, number] | null {
  if (!country) return null
  const trimmed = country.trim()
  // Try as ISO code directly (e.g. 'IS', 'NO')
  if (trimmed in COUNTRY_CENTERS) return COUNTRY_CENTERS[trimmed]!
  // Try as full name (e.g. 'Iceland', 'Norway')
  const iso = COUNTRY_NAME_TO_ISO[trimmed]
  if (iso != null && iso in COUNTRY_CENTERS) return COUNTRY_CENTERS[iso]!
  return null
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const WEEKDAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
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

// ─── OfferDatePicker — multi-day toggle ───────────────────────────────────────
// Guide clicks individual days to add/remove them from the offer.
// 1–3 days is the typical case; no range-drag, just tap each day.

function OfferDatePicker({
  anglerDatesFrom,
  anglerDatesTo,
  anglerAllPeriods,
  guideWeeklySchedules,
  selectedDays,
  onChange,
  disabled,
}: {
  anglerDatesFrom:      string
  anglerDatesTo:        string
  anglerAllPeriods:     Period[]
  guideWeeklySchedules: WeeklySchedule[]
  selectedDays:         string[]
  onChange:             (days: string[]) => void
  disabled:             boolean
}) {
  const now      = new Date()
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Open to the month containing the angler's first date (or current month)
  const anglerDate   = new Date(anglerDatesFrom + 'T12:00:00')
  const aY = anglerDate.getFullYear()
  const aM = anglerDate.getMonth()
  const afterToday = aY > now.getFullYear() || (aY === now.getFullYear() && aM >= now.getMonth())
  const initY = afterToday ? aY : now.getFullYear()
  const initM = afterToday ? aM : now.getMonth()

  const [viewY, setViewY] = useState(initY)
  const [viewM, setViewM] = useState(initM)

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const startPad    = (new Date(viewY, viewM, 1).getDay() + 6) % 7

  const selectedSet = useMemo(() => new Set(selectedDays), [selectedDays])

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
    if (selectedSet.has(iso)) {
      onChange(selectedDays.filter(d => d !== iso))
    } else {
      onChange([...selectedDays, iso].sort())
    }
  }

  function isGuideBlocked(iso: string): boolean {
    const jsDay = new Date(iso + 'T12:00:00').getDay()
    const isoWd = jsDay === 0 ? 6 : jsDay - 1
    return guideWeeklySchedules.some(
      sched =>
        iso >= sched.period_from &&
        iso <= sched.period_to &&
        sched.blocked_weekdays.includes(isoWd),
    )
  }

  // Returns true only for dates inside the angler's actual selected periods.
  // When no explicit periods exist (older bookings), falls back to the full envelope.
  // Never highlights gap dates between non-contiguous periods.
  function isAnglerPeriod(iso: string): boolean {
    if (anglerAllPeriods.length > 0) {
      return anglerAllPeriods.some(p => iso >= p.from && iso <= p.to)
    }
    // Fallback: single envelope from old bookings that lack allDatePeriods
    return iso >= anglerDatesFrom && iso <= anglerDatesTo
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1.5px solid rgba(10,46,77,0.12)' }}
    >
      <div className="px-4 pt-4 pb-3">

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button" onClick={goPrev}
            disabled={!canPrev || disabled}
            aria-label="Previous month"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}
          >
            <ChevronLeft size={9} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
          </button>
          <span className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
            {MONTH_NAMES[viewM]} {viewY}
          </span>
          <button
            type="button" onClick={goNext}
            disabled={disabled}
            aria-label="Next month"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.07)' }}
          >
            <ChevronRight size={9} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
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
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d      = i + 1
            const iso    = toISO(viewY, viewM, d)
            const isPast = iso < todayISO
            const isSel  = selectedSet.has(iso)
            const isToday = iso === todayISO
            const blocked = !isPast && isGuideBlocked(iso)
            const inAnglerPeriod = !isPast && isAnglerPeriod(iso)

            // Background tint on the outer cell — only actual angler dates, never gap dates
            let outerBg = 'transparent'
            if (inAnglerPeriod) outerBg = 'rgba(59,130,246,0.09)'

            // Inner circle
            let innerBg: string | undefined
            if (isSel)                 innerBg = '#E67E50'
            else if (isToday && !isPast) innerBg = 'rgba(10,46,77,0.07)'

            let textColor  = '#0A2E4D'
            let textWeight = isToday ? 700 : 400
            let textDeco   = 'none'

            if (isPast)    { textColor = 'rgba(10,46,77,0.2)' }
            if (isSel)     { textColor = 'white'; textWeight = 700 }
            if (blocked)   { textColor = 'rgba(239,68,68,0.5)'; textDeco = 'line-through' }
            if (inAnglerPeriod) textWeight = 600

            const tooltipTitle =
              blocked        ? 'Your off-day — click to override' :
              inAnglerPeriod ? "Angler's requested date" :
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
                  title={tooltipTitle}
                  aria-pressed={isSel}
                  aria-label={`${d} ${MONTH_NAMES[viewM]}${isSel ? ' (selected)' : ''}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-[12px] f-body disabled:cursor-not-allowed hover:brightness-90"
                  style={{
                    background:     innerBg,
                    color:          textColor,
                    fontWeight:     textWeight,
                    textDecoration: textDeco,
                    opacity:        isPast ? 0.4 : 1,
                  }}
                >
                  {d}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div
        className="px-4 pb-3 pt-1"
        style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { color: 'rgba(59,130,246,0.5)', label: "Angler's dates" },
            { color: '#E67E50',              label: 'Your selected days' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <span className="text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── OfferReviewRow — used in the review screen ───────────────────────────────

function OfferReviewRow({
  label,
  children,
  last = false,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="py-4 flex flex-col gap-2"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(10,46,77,0.07)' }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.2em] font-bold f-body"
        style={{ color: 'rgba(10,46,77,0.35)' }}
      >
        {label}
      </p>
      {children}
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
  onSuccess,
  hideAnglerDates = false,
  guideCountry,
}: GuideOfferFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // 'form' → filling, 'review' → preview before sending
  const [step,    setStep]    = useState<'form' | 'review'>('form')

  // Multi-day selection — array of ISO date strings, sorted asc
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  // Fields
  const [assignedRiver, setAssignedRiver] = useState('')
  const [offerDetails,  setOfferDetails]  = useState('')

  // Pricing — flat fee for the group
  const [price, setPrice] = useState('')

  const priceNum = parseFloat(price)
  const totalEur = !isNaN(priceNum) && priceNum > 0 ? priceNum : null

  // Meeting point — always-shown map with geocoder
  const [meetLat,        setMeetLat]        = useState<number | null>(null)
  const [meetLng,        setMeetLng]        = useState<number | null>(null)
  const [isGeocoding,    setIsGeocoding]    = useState(false)
  const [isRevGeocoding, setIsRevGeocoding] = useState(false)
  const [geocodeError,   setGeocodeError]   = useState<string | null>(null)

  // Map default centre — guide's operating country, fallback to Scandinavia.
  // guide.country may be a full name ("Iceland") or ISO code ("IS") — getCountryCenter handles both.
  const mapDefaultCenter: [number, number] = getCountryCenter(guideCountry) ?? [64.0, 14.0]

  async function handleGeocode() {
    const query = assignedRiver.trim()
    if (!query) return
    setIsGeocoding(true)
    setGeocodeError(null)
    try {
      // Nominatim expects 2-letter ISO code — normalise from full name if needed
      const isoCode =
        guideCountry
          ? (/^[A-Z]{2}$/.test(guideCountry.trim())
              ? guideCountry.trim()
              : (COUNTRY_NAME_TO_ISO[guideCountry.trim()] ?? null))
          : null
      const countryParam = isoCode ? `&countrycodes=${isoCode.toLowerCase()}` : ''
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}${countryParam}&format=json&limit=1`
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = (await res.json()) as { lat: string; lon: string }[]
      if (data.length > 0) {
        setMeetLat(parseFloat(parseFloat(data[0].lat).toFixed(6)))
        setMeetLng(parseFloat(parseFloat(data[0].lon).toFixed(6)))
      } else {
        setGeocodeError("Location not found — try a more specific name, or click the map directly.")
      }
    } catch {
      setGeocodeError("Search failed — click the map to place a pin manually.")
    } finally {
      setIsGeocoding(false)
    }
  }

  // ── Reverse geocode: map click → fill location text box ─────────────────────
  async function handleReverseGeocode(lat: number, lng: number) {
    setIsRevGeocoding(true)
    try {
      // zoom=12 returns a meaningful local name (river, village, etc.)
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=12`
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json() as {
        name?: string
        address?: {
          river?: string; stream?: string; waterway?: string
          natural?: string; lake?: string; reservoir?: string
          hamlet?: string; village?: string; town?: string
          city?: string; municipality?: string
        }
      }
      const addr = data.address ?? {}
      // Priority for fishing context:
      //   1. Named water body (river, stream, lake) — most useful for fishing guides
      //   2. Settlement (city > town > village) — gives recognisable place name
      //   3. name — last resort (can be a district, park, building at zoom=12)
      const locationName =
        addr.river        ??
        addr.stream       ??
        addr.waterway     ??
        addr.natural      ??
        addr.lake         ??
        addr.reservoir    ??
        addr.city         ??
        addr.town         ??
        addr.village      ??
        addr.hamlet       ??
        addr.municipality ??
        (data.name && data.name.length > 0 ? data.name : null) ??
        null
      if (locationName) {
        setAssignedRiver(locationName)
        setGeocodeError(null)
      }
    } catch {
      // Silent — pin is still placed, just no text update
    } finally {
      setIsRevGeocoding(false)
    }
  }

  const numSelectedDays = selectedDays.length

  // Derive from/to for the action (min/max of selected days)
  const offerDateFrom = selectedDays.length > 0 ? selectedDays[0]! : null
  const offerDateTo   = selectedDays.length > 0 ? selectedDays[selectedDays.length - 1]! : null

  /** Validate + move to review step — does NOT send yet. */
  function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!assignedRiver.trim()) {
      setError('Enter the river or location name.')
      return
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Enter a valid price.')
      return
    }
    if (!offerDetails.trim()) {
      setError('Add offer details for the angler.')
      return
    }

    setStep('review')
  }

  /** Actually send the offer — called from the review screen. */
  function handleSend() {
    setError(null)
    startTransition(async () => {
      const result = await sendOfferByGuide(inquiryId, {
        assignedRiver:   assignedRiver.trim(),
        offerDetails:    offerDetails.trim(),
        offerPriceEur:   priceNum,
        offerDateFrom:   offerDateFrom              ?? undefined,
        offerDateTo:     offerDateTo                ?? undefined,
        offerDays:       selectedDays.length > 0 ? selectedDays : undefined,
        offerMeetingLat: meetLat                    ?? undefined,
        offerMeetingLng: meetLng                    ?? undefined,
      })
      if (result.error != null) {
        setError(result.error)
        setStep('form') // bounce back to form with error visible
      } else {
        setSuccess(true)
        onSuccess?.()
      }
    })
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div
        className="px-4 py-4 rounded-xl flex flex-col gap-1"
        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
      >
        <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>Offer sent!</p>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
          The angler will receive your offer and can accept or ask questions.
        </p>
      </div>
    )
  }

  // ── Loading screen (shown while sendOfferByGuide is in flight) ──────────────

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div
          className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{ borderColor: 'rgba(230,126,80,0.18)', borderTopColor: '#E67E50' }}
        />
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Sending your offer…</p>
      </div>
    )
  }

  // ── Review screen ─────────────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <div className="flex flex-col">

        {/* Header */}
        <div className="px-1 pb-4 mb-1" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[11px] uppercase tracking-[0.22em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.35)' }}>
            Review before sending
          </p>
          <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
            Check the offer details below, then send.
          </p>
        </div>

        {/* Dates */}
        <OfferReviewRow label="Trip dates">
          {selectedDays.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedDays.map(d => (
                <span
                  key={d}
                  className="text-[11px] f-body font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(230,126,80,0.12)', color: '#C4622A', border: '1px solid rgba(230,126,80,0.25)' }}
                >
                  {fmtDay(d)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Not specified (angler&apos;s window)</p>
          )}
        </OfferReviewRow>

        {/* Location */}
        <OfferReviewRow label="Location">
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{assignedRiver}</p>
          {meetLat != null && meetLng != null && (
            <p className="text-[11px] f-body font-mono mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
              📍 {meetLat.toFixed(4)}, {meetLng.toFixed(4)}
            </p>
          )}
        </OfferReviewRow>

        {/* Price */}
        <OfferReviewRow label="Price">
          <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>€{totalEur}</p>
          {groupSize != null && groupSize > 0 && (
            <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              Total for {groupSize} {groupSize === 1 ? 'angler' : 'anglers'}
            </p>
          )}
        </OfferReviewRow>

        {/* Offer details */}
        <OfferReviewRow label="What's included" last>
          <p className="text-sm f-body leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(10,46,77,0.7)' }}>
            {offerDetails}
          </p>
        </OfferReviewRow>

        {error != null && (
          <div
            className="mt-3 px-4 py-3 rounded-xl text-sm f-body"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 pb-2">
          <button
            type="button"
            onClick={handleSend}
            className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-105"
            style={{ background: '#E67E50' }}
          >
            Send Offer →
          </button>
          <button
            type="button"
            onClick={() => setStep('form')}
            className="px-5 py-3.5 rounded-2xl text-sm f-body font-semibold transition-colors hover:opacity-70"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
          >
            ← Edit
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handlePreview} className="relative flex flex-col gap-5">

      {/* ── Angler's requested dates (read-only, hidden when left panel shows them) ── */}
      {!hideAnglerDates && (
        <div>
          <p style={labelStyle}>Angler&rsquo;s requested dates</p>
          {anglerAllPeriods.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {anglerAllPeriods.map((p, i) => (
                <span
                  key={i}
                  className="text-xs f-body px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#1D4ED8', border: '1px solid rgba(59,130,246,0.18)' }}
                >
                  {p.from === p.to ? p.from : `${p.from} – ${p.to}`}
                </span>
              ))}
            </div>
          ) : (
            <span
              className="inline-block text-xs f-body px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#1D4ED8', border: '1px solid rgba(59,130,246,0.18)' }}
            >
              {anglerDatesFrom === anglerDatesTo
                ? anglerDatesFrom
                : `${anglerDatesFrom} – ${anglerDatesTo}`}
            </span>
          )}
        </div>
      )}

      {/* ── Confirm trip dates (optional) ────────────────────────────── */}
      <div>
        <p style={labelStyle}>
          Confirm trip dates
          <span className="ml-1 normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>
            (optional) — tap to select days
          </span>
        </p>

        <OfferDatePicker
          anglerDatesFrom={anglerDatesFrom}
          anglerDatesTo={anglerDatesTo}
          anglerAllPeriods={anglerAllPeriods}
          guideWeeklySchedules={guideWeeklySchedules}
          selectedDays={selectedDays}
          onChange={setSelectedDays}
          disabled={isPending}
        />

        {/* Selected days chips + clear */}
        {numSelectedDays > 0 && (
          <div className="mt-2.5 flex flex-col gap-2">

            {/* Chips row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDays.map(iso => (
                <span
                  key={iso}
                  className="inline-flex items-center gap-1 text-[11px] f-body font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(230,126,80,0.12)', color: '#C4622A', border: '1px solid rgba(230,126,80,0.25)' }}
                >
                  {fmtDay(iso)}
                  <button
                    type="button"
                    onClick={() => setSelectedDays(prev => prev.filter(d => d !== iso))}
                    disabled={isPending}
                    aria-label={`Remove ${fmtDay(iso)}`}
                    className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <X size={9} strokeWidth={2} />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={() => setSelectedDays([])}
                disabled={isPending}
                className="text-[10px] f-body hover:opacity-70 transition-opacity ml-1"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                Clear all
              </button>
            </div>

            {/* Duration badge */}
            <span
              className="inline-flex items-center gap-1.5 text-xs f-body font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(230,126,80,0.1)', color: '#C4622A' }}
            >
              <Clock size={10} strokeWidth={1.6} />
              {numSelectedDays === 1 ? '1 day' : `${numSelectedDays} days`}
            </span>
          </div>
        )}
      </div>

      {/* ── River / location + geocoder + map ───────────────────────── */}
      <div>
        <label style={labelStyle}>River / location *</label>

        {/* Text input + "Find on map" button on same row */}
        <div className="flex gap-2 mb-2">
          {/* Wrapper for spinner-inside-input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. Alta River"
              value={assignedRiver}
              onChange={e => { setAssignedRiver(e.target.value); setGeocodeError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleGeocode() } }}
              disabled={isPending}
              className="f-body w-full"
              style={{ ...inputStyle, paddingRight: isRevGeocoding ? '34px' : undefined }}
            />
            {/* Spinner while reverse-geocoding a map click */}
            {isRevGeocoding && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 animate-spin pointer-events-none"
                style={{ borderColor: 'rgba(10,46,77,0.15)', borderTopColor: '#0A2E4D' }}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleGeocode()}
            disabled={isPending || isGeocoding || isRevGeocoding || !assignedRiver.trim()}
            className="inline-flex items-center gap-1.5 px-4 rounded-xl text-[12px] font-bold f-body flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: '#0A2E4D', color: 'white' }}
          >
            {isGeocoding ? (
              <span
                className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
            ) : (
              <MapPin size={11} strokeWidth={2} />
            )}
            {isGeocoding ? 'Searching…' : 'Find on map'}
          </button>
        </div>

        {geocodeError != null && (
          <p className="text-[11px] f-body mb-2" style={{ color: '#DC2626' }}>{geocodeError}</p>
        )}

        {/* Map — always visible, auto-centred on guide's country */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}>
          <LocationPickerMap
            mode="pin"
            lat={meetLat}
            lng={meetLng}
            defaultCenter={mapDefaultCenter}
            onChange={(lat, lng) => {
              setMeetLat(lat)
              setMeetLng(lng)
              void handleReverseGeocode(lat, lng)
            }}
          />
          {meetLat != null && meetLng != null ? (
            <div
              className="px-4 py-2.5 flex items-center justify-between gap-3"
              style={{ background: 'rgba(10,46,77,0.03)', borderTop: '1px solid rgba(10,46,77,0.07)' }}
            >
              <span className="flex items-center gap-1.5 text-[11px] f-body font-mono truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>
                <MapPin size={11} strokeWidth={0} fill="#E67E50" className="flex-shrink-0" />
                {meetLat.toFixed(5)}, {meetLng.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={() => { setMeetLat(null); setMeetLng(null) }}
                disabled={isPending}
                className="text-[10px] f-body flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                Remove pin
              </button>
            </div>
          ) : (
            <p className="text-[10px] f-body text-center py-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Type a name + &ldquo;Find on map&rdquo;, or click the map to auto-fill
            </p>
          )}
        </div>
      </div>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <div>
        <label style={labelStyle}>Price *</label>

        <div className="relative">
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none"
            style={{ color: 'rgba(10,46,77,0.4)' }}
          >
            €
          </span>
          <input
            type="number" step="1" min="1"
            placeholder="1200"
            value={price}
            onChange={e => setPrice(e.target.value)}
            disabled={isPending}
            className="f-body"
            style={{ ...inputStyle, paddingLeft: '26px' }}
            aria-label="Price in EUR"
          />
        </div>

        {totalEur != null && (
          <p className="mt-1.5 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Angler pays €{totalEur} total for the group
          </p>
        )}
      </div>

      {/* ── Offer details ─────────────────────────────────────────────── */}
      <div>
        <label style={labelStyle}>Offer details *</label>
        <textarea
          rows={5}
          placeholder="Describe what's included: gear, meals, transport, accommodation, what to expect on the water…"
          value={offerDetails}
          onChange={e => setOfferDetails(e.target.value)}
          disabled={isPending}
          className="f-body resize-none"
          style={{ ...inputStyle, lineHeight: '1.6' }}
        />
      </div>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error != null && (
        <p className="text-sm f-body" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 rounded-2xl text-sm font-bold f-body transition-all hover:brightness-105 disabled:opacity-60"
        style={{ background: '#E67E50', color: 'white' }}
      >
        Preview offer →
      </button>
    </form>
  )
}
