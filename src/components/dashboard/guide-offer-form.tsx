'use client'

import { useState, useTransition, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { sendOfferByGuide } from '@/actions/inquiries'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
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

  function isAnglerPeriod(iso: string): boolean {
    return anglerAllPeriods.some(p => iso >= p.from && iso <= p.to)
  }

  function isAnglerWindow(iso: string): boolean {
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
            const inAnglerWindow = !isPast && !inAnglerPeriod && isAnglerWindow(iso)

            // Background tint on the outer cell (angler's dates hint)
            let outerBg = 'transparent'
            if (inAnglerPeriod) outerBg = 'rgba(59,130,246,0.09)'
            else if (inAnglerWindow) outerBg = 'rgba(59,130,246,0.04)'

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
              inAnglerWindow ? "Within angler's window" :
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
}: GuideOfferFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Multi-day selection — array of ISO date strings, sorted asc
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [singleDayDuration, setSingleDayDuration] = useState<'half_day' | 'full_day'>('full_day')

  // Fields
  const [assignedRiver, setAssignedRiver] = useState('')
  const [offerDetails,  setOfferDetails]  = useState('')

  // Pricing — flat fee for the group
  const [price, setPrice] = useState('')

  const priceNum = parseFloat(price)
  const totalEur = !isNaN(priceNum) && priceNum > 0 ? priceNum : null

  // Meeting point
  const [showMap, setShowMap] = useState(false)
  const [meetLat, setMeetLat] = useState<number | null>(null)
  const [meetLng, setMeetLng] = useState<number | null>(null)

  const numSelectedDays = selectedDays.length
  const isSingleDay     = numSelectedDays === 1

  // Derive from/to for the action (min/max of selected days)
  const offerDateFrom = selectedDays.length > 0 ? selectedDays[0]! : null
  const offerDateTo   = selectedDays.length > 0 ? selectedDays[selectedDays.length - 1]! : null

  function handleSubmit(e: React.FormEvent) {
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

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
      {isPending && <LoadingOverlay rounded="rounded-none" />}

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
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs f-body font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(230,126,80,0.1)', color: '#C4622A' }}
              >
                <Clock size={10} strokeWidth={1.6} />
                {numSelectedDays === 1 ? '1 day' : `${numSelectedDays} days`}
              </span>

              {/* Half/full day selector only for single-day picks */}
              {isSingleDay && (
                <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  — select duration:
                </span>
              )}
            </div>

            {isSingleDay && (
              <div className="flex gap-2">
                {([
                  { value: 'full_day' as const, label: 'Full day', sub: '~8 hrs' },
                  { value: 'half_day' as const, label: 'Half day', sub: '~4 hrs' },
                ] as const).map(opt => {
                  const on = singleDayDuration === opt.value
                  return (
                    <button
                      key={opt.value} type="button"
                      onClick={() => setSingleDayDuration(opt.value)}
                      disabled={isPending}
                      className="flex flex-col items-start px-3 py-2.5 rounded-xl transition-all flex-1"
                      style={{
                        background: on ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                        border: on ? '1.5px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
                      }}
                    >
                      <span className="text-[12px] font-bold f-body" style={{ color: on ? 'white' : '#0A2E4D' }}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] f-body mt-0.5" style={{ color: on ? 'rgba(255,255,255,0.55)' : 'rgba(10,46,77,0.4)' }}>
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

      {/* ── River / location ─────────────────────────────────────────── */}
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

      {/* ── Meeting point (toggleable map) ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p style={{ ...labelStyle, marginBottom: 0 }}>
            Meeting point
            <span className="ml-1 normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>
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
          <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}>
            <LocationPickerMap
              mode="pin"
              lat={meetLat}
              lng={meetLng}
              onChange={(lat, lng) => { setMeetLat(lat); setMeetLng(lng) }}
            />
            {meetLat != null && meetLng != null ? (
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-3"
                style={{ background: 'rgba(10,46,77,0.03)', borderTop: '1px solid rgba(10,46,77,0.07)' }}
              >
                <span className="text-[11px] f-body font-mono truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {meetLat.toFixed(5)}, {meetLng.toFixed(5)}
                </span>
                <button type="button" onClick={() => { setMeetLat(null); setMeetLng(null) }} disabled={isPending}
                  className="text-[10px] f-body flex-shrink-0 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(10,46,77,0.4)' }}>
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-[10px] f-body text-center py-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Click the map to place a meeting point pin
              </p>
            )}
          </div>
        )}

        {!showMap && meetLat != null && meetLng != null && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <MapPin size={13} strokeWidth={0} fill="#E67E50" className="flex-shrink-0" />
            <span className="text-[11px] f-body font-mono" style={{ color: 'rgba(10,46,77,0.55)' }}>
              {meetLat.toFixed(4)}, {meetLng.toFixed(4)}
            </span>
            <button type="button" onClick={() => { setMeetLat(null); setMeetLng(null) }} disabled={isPending}
              className="ml-auto text-[10px] f-body hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(10,46,77,0.35)' }}>
              ×
            </button>
          </div>
        )}
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
        {isPending ? 'Sending…' : 'Send Offer to Angler →'}
      </button>
    </form>
  )
}
