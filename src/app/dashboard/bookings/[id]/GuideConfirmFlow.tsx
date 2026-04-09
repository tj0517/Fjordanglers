'use client'

/**
 * GuideConfirmFlow — modal for responding to a booking/inquiry request.
 *
 * Direct bookings (source='direct'):
 *   - Single-step form. Calendar pre-filled with angler dates; guide can edit.
 *   - Price auto-recalculates with date changes.
 *   - Inline date-change warning banner if dates differ.
 *
 * Icelandic inquiries (source='inquiry'):
 *   - Two-column layout on md+: calendar on left, offer details form on right.
 *   - Guide picks dates, sets price, river/beat section, what's included,
 *     meeting location, and message — then sends directly (no review step).
 */

import { useState, useTransition, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, MapPin, Calendar,
  MessageSquare, Loader2, Pencil, Euro, Users, Clock,
  Fish, CheckSquare,
} from 'lucide-react'
import { confirmBooking } from '@/actions/bookings'
import type { IcelandicPreferences } from '@/actions/bookings'
import { INQUIRY_PRESET_FIELDS } from '@/types'

const MeetingMapPicker = dynamic(() => import('./MeetingMapPicker'), { ssr: false })

// ─── Constants ────────────────────────────────────────────────────────────────

const INCLUDED_OPTIONS = [
  { id: 'tackle',    label: 'Tackle & rods' },
  { id: 'flies',     label: 'Flies & bait' },
  { id: 'waders',    label: 'Waders & boots' },
  { id: 'lunch',     label: 'Lunch included' },
  { id: 'transport', label: 'Transfer from town' },
  { id: 'license',   label: 'River license' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlockedRange {
  date_start: string
  date_end: string
}

export interface GuideConfirmFlowProps {
  bookingId:       string
  requestedDates:  string[]
  blockedRanges:   BlockedRange[]
  anglerName:      string
  experienceTitle: string
  guidePayout:     number
  totalEur:        number
  guests:          number
  source:          'direct' | 'inquiry'
  preferences:     IcelandicPreferences | null
  onClose:         () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string { return new Date().toISOString().slice(0, 10) }

function isBlocked(date: string, ranges: BlockedRange[]): boolean {
  return ranges.some(r => date >= r.date_start && date <= r.date_end)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── CalendarGrid — single-month interactive grid ─────────────────────────────

interface CalendarGridProps {
  year:         number
  month:        number
  today:        string
  selectedSet:  Set<string>
  anglerSet:    Set<string>
  blockedRanges: BlockedRange[]
  isInquiry:    boolean
  editingDates: boolean
  onToggle:     (date: string) => void
}

function CalendarGrid({
  year, month, today, selectedSet, anglerSet, blockedRanges,
  isInquiry, editingDates, onToggle,
}: CalendarGridProps) {
  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMo   = new Date(year, month + 1, 0).getDate()
  const offset     = (firstDay + 6) % 7
  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ]

  return (
    <>
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold f-body py-1"
            style={{ color: 'rgba(10,46,77,0.28)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />
          const d        = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast   = d < today
          const blocked  = isBlocked(d, blockedRanges)
          const selected = selectedSet.has(d)
          const isToday  = d === today
          const isAngler = anglerSet.has(d)
          const clickable = (isInquiry || editingDates) && (selected || (!isPast && !blocked))

          return (
            <button
              key={d}
              type="button"
              disabled={isPast && !selected}
              onClick={() => clickable ? onToggle(d) : undefined}
              className="aspect-square flex items-center justify-center rounded-md text-sm f-body transition-all"
              style={{
                background: selected   ? '#E67E50'
                  : blocked            ? 'rgba(220,38,38,0.07)'
                  : isAngler           ? 'rgba(6,182,212,0.18)'
                  : isPast             ? 'transparent'
                  : 'rgba(22,163,74,0.08)',
                color: selected   ? '#fff'
                  : blocked       ? 'rgba(220,38,38,0.45)'
                  : isAngler      ? '#0E7490'
                  : isPast        ? 'rgba(10,46,77,0.2)'
                  : '#0A2E4D',
                fontWeight:     selected ? '700' : isToday ? '700' : isAngler ? '600' : '400',
                border:         isToday && !selected ? '1.5px solid rgba(10,46,77,0.2)' : '1.5px solid transparent',
                boxShadow:      selected ? '0 2px 8px rgba(230,126,80,0.35)' : 'none',
                cursor:         clickable ? 'pointer' : 'default',
                textDecoration: blocked && !selected ? 'line-through' : 'none',
                fontSize:       '13px',
              }}
              aria-label={d}
              aria-pressed={selected}
            >
              {day}
            </button>
          )
        })}
      </div>
    </>
  )
}

// ─── GuideConfirmFlow ─────────────────────────────────────────────────────────

export default function GuideConfirmFlow({
  bookingId, requestedDates, blockedRanges,
  anglerName, experienceTitle, guidePayout, totalEur, guests,
  source, preferences, onClose,
}: GuideConfirmFlowProps) {
  const router = useRouter()
  const today  = isoToday()

  const isInquiry = source === 'inquiry'

  // ── Angler's inquiry data ─────────────────────────────────────────────
  const anglerPeriods      = preferences?.periods ?? []
  const durationPreference = preferences?.durationPreference ?? null
  const customAnswers      = preferences?.customAnswers ?? {}

  const anglerAnswerLines = useMemo(() => {
    return INQUIRY_PRESET_FIELDS
      .filter(f => {
        const ans = customAnswers[f.id]
        return ans != null && ans.trim() !== ''
      })
      .map(f => ({ label: f.label, answer: customAnswers[f.id]! }))
  }, [customAnswers])

  const anglerSet = useMemo(() => new Set(requestedDates), [requestedDates])

  // ── Date state ───────────────────────────────────────────────────────
  const [editingDates, setEditingDates] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>(() =>
    isInquiry ? [] : [...requestedDates].sort()
  )

  const firstDate = isInquiry
    ? (anglerPeriods[0]?.from ?? today)
    : (requestedDates[0] ?? today)

  const [viewYear, setViewYear]   = useState(() => new Date(firstDate + 'T00:00:00').getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(firstDate + 'T00:00:00').getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  function toggleDate(d: string) {
    setSelectedDates(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  // ── Location state ───────────────────────────────────────────────────
  const [locationText, setLocationText] = useState('')
  const [locationLat, setLocationLat]   = useState<number | null>(null)
  const [locationLng, setLocationLng]   = useState<number | null>(null)
  const [showMap, setShowMap]           = useState(false)

  // ── Offer-specific state ─────────────────────────────────────────────
  const [message,       setMessage]       = useState('')
  const [offeredPrice,  setOfferedPrice]  = useState('')
  const [riverSection,  setRiverSection]  = useState('')
  const [included,      setIncluded]      = useState<string[]>([])

  // ── Step + submission ────────────────────────────────────────────────
  // Direct bookings: keep 2-step (review shows date-change warning).
  // Inquiry: single step — send directly.
  const [step, setStep]              = useState<'form' | 'review'>('form')
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Price calc (direct) ──────────────────────────────────────────────
  const originalDays  = requestedDates.length || 1
  const currentDays   = selectedDates.length  || 1
  const dailyTotal    = totalEur   / originalDays
  const dailyPayout   = guidePayout / originalDays
  const updatedTotal  = dailyTotal  * currentDays
  const updatedPayout = dailyPayout * currentDays

  const datesChanged = useMemo(() => {
    if (isInquiry) return false
    const orig = [...requestedDates].sort()
    const curr = [...selectedDates].sort()
    return JSON.stringify(orig) !== JSON.stringify(curr)
  }, [isInquiry, requestedDates, selectedDates])

  const parsedOfferedPrice = parseFloat(offeredPrice.replace(',', '.')) || 0

  const canProceed = selectedDates.length > 0 && (!isInquiry || parsedOfferedPrice > 0)

  // ── Submit ───────────────────────────────────────────────────────────
  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await confirmBooking(bookingId, {
        message,
        meetingLocation: locationText,
        meetingLat:      locationLat ?? undefined,
        meetingLng:      locationLng ?? undefined,
        selectedDates,
        offeredPriceEur: isInquiry ? parsedOfferedPrice : updatedTotal,
        riverSection:    isInquiry ? riverSection : undefined,
        included:        isInquiry ? included : undefined,
      })
      if (!result.success) { setError(result.error); return }
      onClose()
      router.refresh()
    })
  }

  // ── Shared styles ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: '#fff',
    border:     '1.5px solid rgba(10,46,77,0.12)',
    color:      '#0A2E4D',
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(10,46,77,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Dialog — wider for inquiry two-column layout */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-6">
        <div
          className={`relative w-full flex flex-col pointer-events-auto rounded-t-3xl sm:rounded-3xl overflow-hidden ${isInquiry ? 'sm:max-w-[860px]' : 'sm:max-w-[620px]'}`}
          style={{
            background: '#F3EDE4',
            maxHeight:  '92vh',
            boxShadow:  '0 24px 64px rgba(10,46,77,0.25)',
          }}
        >

          {/* ── Header ── */}
          <div
            className="flex-shrink-0 flex items-center h-14 px-4"
            style={{
              background:     'rgba(243,237,228,0.96)',
              backdropFilter: 'blur(12px)',
              borderBottom:   '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <button
              type="button"
              onClick={() => (step === 'review' && !isInquiry) ? setStep('form') : onClose()}
              className="flex items-center gap-1.5 text-sm f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.6)' }}
            >
              <ChevronLeft size={16} />
              {step === 'review' && !isInquiry ? 'Back to edit' : 'Cancel'}
            </button>
            <div className="flex-1" />
            <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
              {isInquiry ? 'Build your offer' : (step === 'form' ? 'Confirm Booking' : 'Review & Send')}
            </span>
            <div className="flex-1" />
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">
            <div className="px-4 pt-5 pb-8">

              {/* ── Trip summary chip ── */}
              <div
                className="rounded-2xl bg-white flex items-center gap-3 p-4 mb-5"
                style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isInquiry ? 'rgba(6,182,212,0.12)' : 'rgba(34,197,94,0.1)' }}
                >
                  <Fish size={18} style={{ color: isInquiry ? '#0891B2' : '#22C55E' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                    {isInquiry ? 'Inquiry from' : 'Booking from'} {anglerName}
                  </p>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    {experienceTitle} · {guests} {guests === 1 ? 'angler' : 'anglers'}
                    {durationPreference != null && ` · ${durationPreference}`}
                  </p>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  INQUIRY MODE — two-column layout (calendar left, form right)
              ═══════════════════════════════════════════════════════════ */}
              {isInquiry && (
                <div className="md:grid md:grid-cols-[1fr_300px] gap-4 flex flex-col">

                  {/* ── LEFT: angler prefs + calendar ── */}
                  <div className="flex flex-col gap-4 min-w-0">

                    {/* Angler preferences */}
                    {(anglerAnswerLines.length > 0 || durationPreference != null) && (
                      <div
                        className="rounded-2xl bg-white overflow-hidden"
                        style={{ border: '1px solid rgba(6,182,212,0.2)' }}
                      >
                        <div className="px-4 py-3 flex items-center gap-2"
                          style={{ borderBottom: '1px solid rgba(6,182,212,0.1)', background: 'rgba(6,182,212,0.04)' }}>
                          <Users size={12} style={{ color: '#0891B2' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                            style={{ color: '#0891B2' }}>
                            Angler&apos;s preferences
                          </p>
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2">
                          {durationPreference != null && (
                            <div className="flex items-center gap-2">
                              <Clock size={11} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
                              <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                                Duration:
                              </span>
                              <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
                                {durationPreference}
                              </span>
                            </div>
                          )}
                          {anglerAnswerLines.map(({ label, answer }) => (
                            <div key={label} className="flex items-start gap-2">
                              <span className="text-[11px] f-body mt-px flex-shrink-0"
                                style={{ color: 'rgba(10,46,77,0.4)', minWidth: 110 }}>
                                {label}
                              </span>
                              <span className="text-[11px] font-medium f-body" style={{ color: '#0A2E4D' }}>
                                {answer}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Calendar */}
                    <div
                      className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                    >
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <Calendar size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>
                          Select trip days
                        </p>
                        {selectedDates.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold f-body px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>
                            {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected
                          </span>
                        )}
                      </div>
                      <div className="px-4 pb-4 pt-3">
                        {/* Hint */}
                        <p className="text-[11px] f-body mb-3 px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(6,182,212,0.07)', color: 'rgba(10,46,77,0.6)' }}>
                          Teal = angler&apos;s requested dates. Click to confirm individual days.
                        </p>

                        {/* Month nav */}
                        <div className="flex items-center justify-between mb-3">
                          <button type="button" onClick={prevMonth}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(10,46,77,0.06)' }}>
                            <ChevronLeft size={14} style={{ color: '#0A2E4D' }} />
                          </button>
                          <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</p>
                          <button type="button" onClick={nextMonth}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(10,46,77,0.06)' }}>
                            <ChevronRight size={14} style={{ color: '#0A2E4D' }} />
                          </button>
                        </div>

                        <CalendarGrid
                          year={viewYear} month={viewMonth} today={today}
                          selectedSet={selectedSet} anglerSet={anglerSet}
                          blockedRanges={blockedRanges}
                          isInquiry={true} editingDates={false}
                          onToggle={toggleDate}
                        />

                        {/* Legend */}
                        <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap"
                          style={{ borderTop: '1px solid rgba(10,46,77,0.05)' }}>
                          {[
                            { bg: '#E67E50', label: 'Selected' },
                            { bg: 'rgba(6,182,212,0.2)',   border: 'rgba(6,182,212,0.4)',   label: 'Angler requested' },
                            { bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.3)',   label: 'Available' },
                            { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.15)',  label: 'Blocked' },
                          ].map(({ bg, border, label }) => (
                            <div key={label} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ background: bg, border: border ? `1px solid ${border}` : 'none' }} />
                              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* ── RIGHT: offer details form ── */}
                  <div className="flex flex-col gap-3">

                    {/* Price */}
                    <div className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}>
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <Euro size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>Offer price</p>
                        <span className="ml-1 text-[9px] f-body px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>Required</span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[11px] f-body mb-2" style={{ color: 'rgba(10,46,77,0.5)' }}>
                          Total for {guests} {guests === 1 ? 'angler' : 'anglers'}
                          {selectedDates.length > 0 && `, ${selectedDates.length} day${selectedDates.length !== 1 ? 's' : ''}`}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>€</span>
                          <input
                            type="number" min="1" step="1" placeholder="e.g. 1 200"
                            value={offeredPrice}
                            onChange={e => setOfferedPrice(e.target.value)}
                            className="flex-1 px-3 py-2.5 rounded-xl text-xl font-bold f-display outline-none"
                            style={{ ...inputStyle, maxWidth: 160 }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* River / Beat section */}
                    <div className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <Fish size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>River / Beat section</p>
                        <span className="ml-auto text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>optional</span>
                      </div>
                      <div className="px-4 py-3">
                        <input
                          type="text"
                          value={riverSection}
                          onChange={e => setRiverSection(e.target.value)}
                          placeholder="e.g. Laxá í Aðaldal, Beat 3"
                          className="w-full px-3 py-2 rounded-xl text-sm f-body outline-none"
                          style={inputStyle}
                          onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                        />
                      </div>
                    </div>

                    {/* What's included */}
                    <div className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <CheckSquare size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>What&apos;s included</p>
                        <span className="ml-auto text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>optional</span>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {INCLUDED_OPTIONS.map(opt => {
                            const active = included.includes(opt.label)
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setIncluded(prev =>
                                  prev.includes(opt.label) ? prev.filter(x => x !== opt.label) : [...prev, opt.label]
                                )}
                                className="text-[11px] f-body font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{
                                  background: active ? '#E67E50' : 'rgba(10,46,77,0.05)',
                                  color:      active ? '#fff'    : 'rgba(10,46,77,0.55)',
                                  border:     active ? '1.5px solid rgba(230,126,80,0.4)' : '1.5px solid transparent',
                                  boxShadow:  active ? '0 1px 4px rgba(230,126,80,0.22)' : 'none',
                                }}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Meeting point */}
                    <div className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <MapPin size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>Meeting point</p>
                        <span className="ml-auto text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>optional</span>
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-2">
                        <input
                          type="text"
                          value={locationText}
                          onChange={e => setLocationText(e.target.value)}
                          placeholder="e.g. Parking at Trollfjord bridge"
                          className="w-full px-3 py-2 rounded-xl text-sm f-body outline-none"
                          style={inputStyle}
                          onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowMap(m => !m)}
                          className="flex items-center gap-1.5 text-xs font-medium f-body w-fit"
                          style={{ color: '#E67E50' }}
                        >
                          <MapPin size={12} />
                          {showMap ? 'Close map' : 'Pin on map'}
                        </button>
                        {locationLat != null && (
                          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                            📍 {locationLat.toFixed(5)}, {locationLng?.toFixed(5)}
                          </p>
                        )}
                        {showMap && (
                          <MeetingMapPicker
                            lat={locationLat}
                            lng={locationLng}
                            onChange={(lat, lng) => { setLocationLat(lat); setLocationLng(lng) }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Message */}
                    <div className="rounded-2xl bg-white overflow-hidden"
                      style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
                      <div className="px-4 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                        <MessageSquare size={13} style={{ color: '#E67E50' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>Message to angler</p>
                        <span className="ml-auto text-[9px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>optional</span>
                      </div>
                      <div className="px-4 py-3">
                        <textarea
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          rows={3}
                          placeholder="Tell the angler what to expect, what to bring, any tips…"
                          className="w-full px-3 py-2 rounded-xl text-sm f-body outline-none resize-none"
                          style={{ ...inputStyle, lineHeight: '1.55' }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                        />
                      </div>
                    </div>

                    {/* Error */}
                    {error != null && (
                      <div className="rounded-xl px-4 py-3 text-sm f-body"
                        style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}>
                        {error}
                      </div>
                    )}

                    {/* Send CTA */}
                    <button
                      type="button"
                      disabled={!canProceed || isPending}
                      onClick={handleSubmit}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2 transition-all"
                      style={{
                        background: canProceed ? '#E67E50' : 'rgba(10,46,77,0.07)',
                        color:      canProceed ? '#fff'    : 'rgba(10,46,77,0.3)',
                        boxShadow:  canProceed ? '0 4px 14px rgba(230,126,80,0.3)' : 'none',
                        opacity:    isPending ? 0.75 : 1,
                      }}
                    >
                      {isPending && <Loader2 size={16} className="animate-spin" />}
                      {isPending
                        ? 'Sending offer…'
                        : !canProceed
                          ? selectedDates.length === 0
                            ? 'Select dates to continue'
                            : 'Enter offer price to continue'
                          : `→ Send offer to ${anglerName}`
                      }
                    </button>

                    <p className="text-[10px] f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
                      The angler will receive your offer by email and must accept before the trip is confirmed.
                    </p>

                  </div>{/* end right col */}

                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  DIRECT BOOKING MODE — single-column form + review step
              ═══════════════════════════════════════════════════════════ */}
              {!isInquiry && step === 'form' && (
                <div className="flex flex-col gap-4 max-w-[580px] mx-auto">

                  {/* Calendar */}
                  <div
                    className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <div className="px-5 py-4 flex items-center justify-between gap-3"
                      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} style={{ color: '#E67E50' }} />
                        <p className="text-xs font-bold uppercase tracking-wider f-body"
                          style={{ color: 'rgba(10,46,77,0.45)' }}>Trip dates</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingDates(e => !e)}
                        className="flex items-center gap-1.5 text-sm font-semibold f-body px-3.5 py-2 rounded-xl transition-all"
                        style={{
                          background: editingDates ? 'rgba(220,38,38,0.07)' : 'rgba(230,126,80,0.12)',
                          color:  editingDates ? '#DC2626' : '#C05621',
                          border: `1.5px solid ${editingDates ? 'rgba(220,38,38,0.2)' : 'rgba(230,126,80,0.3)'}`,
                        }}
                      >
                        <Pencil size={13} />
                        {editingDates ? 'Done editing' : 'Change dates'}
                      </button>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      {editingDates && (
                        <p className="text-xs f-body mb-3 px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(230,126,80,0.08)', color: 'rgba(10,46,77,0.6)' }}>
                          Tap dates to add or remove. {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected.
                        </p>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={prevMonth}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(10,46,77,0.06)' }}>
                          <ChevronLeft size={14} style={{ color: '#0A2E4D' }} />
                        </button>
                        <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</p>
                        <button type="button" onClick={nextMonth}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(10,46,77,0.06)' }}>
                          <ChevronRight size={14} style={{ color: '#0A2E4D' }} />
                        </button>
                      </div>
                      <CalendarGrid
                        year={viewYear} month={viewMonth} today={today}
                        selectedSet={selectedSet} anglerSet={anglerSet}
                        blockedRanges={blockedRanges}
                        isInquiry={false} editingDates={editingDates}
                        onToggle={toggleDate}
                      />
                      <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap"
                        style={{ borderTop: '1px solid rgba(10,46,77,0.05)' }}>
                        {[
                          { bg: '#E67E50', label: 'Confirmed' },
                          { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.3)', label: 'Available' },
                          { bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.15)', label: 'Blocked' },
                        ].map(({ bg, border, label }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm"
                              style={{ background: bg, border: border ? `1px solid ${border}` : 'none' }} />
                            <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div
                    className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <div className="px-5 py-4 flex items-center gap-2"
                      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                      <Euro size={14} style={{ color: '#E67E50' }} />
                      <p className="text-xs font-bold uppercase tracking-wider f-body"
                        style={{ color: 'rgba(10,46,77,0.45)' }}>Pricing</p>
                      {datesChanged && (
                        <span className="ml-auto text-[10px] font-semibold f-body px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>Updated</span>
                      )}
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex justify-between text-sm f-body">
                        <span style={{ color: 'rgba(10,46,77,0.5)' }}>
                          Trip total{datesChanged && ` (${currentDays} day${currentDays !== 1 ? 's' : ''})`}
                        </span>
                        <span style={{ color: '#0A2E4D' }}>{fmtEur(updatedTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm f-body pt-2"
                        style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                        <span className="font-semibold" style={{ color: '#0A2E4D' }}>Your payout</span>
                        <span className="font-bold" style={{ color: '#0A2E4D' }}>{fmtEur(updatedPayout)}</span>
                      </div>
                      {datesChanged && (
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          Original: {fmtEur(totalEur)} trip · {fmtEur(guidePayout)} payout ({originalDays} day{originalDays !== 1 ? 's' : ''})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meeting point */}
                  <div
                    className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <div className="px-5 py-4 flex items-center gap-2"
                      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                      <MapPin size={14} style={{ color: '#E67E50' }} />
                      <p className="text-xs font-bold uppercase tracking-wider f-body"
                        style={{ color: 'rgba(10,46,77,0.45)' }}>Meeting point</p>
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>(optional)</span>
                    </div>
                    <div className="px-5 pb-5 pt-4 flex flex-col gap-3">
                      <input
                        type="text"
                        value={locationText}
                        onChange={e => setLocationText(e.target.value)}
                        placeholder="e.g. Parking lot at Trollfjord bridge, GPS 68.12 N 15.45 E"
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm f-body outline-none"
                        style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                      />
                      <button type="button" onClick={() => setShowMap(m => !m)}
                        className="flex items-center gap-1.5 text-sm font-medium f-body w-fit"
                        style={{ color: '#E67E50' }}>
                        <MapPin size={13} />
                        {showMap ? 'Close map' : 'Open map to pin exact location'}
                      </button>
                      {locationLat != null && (
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                          📍 Pinned: {locationLat.toFixed(5)}, {locationLng?.toFixed(5)}
                        </p>
                      )}
                      {showMap && (
                        <MeetingMapPicker
                          lat={locationLat} lng={locationLng}
                          onChange={(lat, lng) => { setLocationLat(lat); setLocationLng(lng) }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  <div
                    className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <div className="px-5 py-4 flex items-center gap-2"
                      style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                      <MessageSquare size={14} style={{ color: '#E67E50' }} />
                      <p className="text-xs font-bold uppercase tracking-wider f-body"
                        style={{ color: 'rgba(10,46,77,0.45)' }}>Message to angler</p>
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>(optional)</span>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Welcome! I'll meet you at the fishing spot. Bring warm layers and your fishing license..."
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm f-body outline-none resize-none"
                        style={{ ...inputStyle, lineHeight: '1.55' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canProceed}
                    onClick={() => setStep('review')}
                    className="w-full py-4 rounded-2xl text-sm font-bold f-body transition-all"
                    style={{
                      background: canProceed ? '#22C55E' : 'rgba(10,46,77,0.07)',
                      color:      canProceed ? '#fff'    : 'rgba(10,46,77,0.3)',
                      boxShadow:  canProceed ? '0 4px 14px rgba(34,197,94,0.28)' : 'none',
                    }}
                  >
                    {!canProceed ? 'Select at least one date' : 'Review & Send →'}
                  </button>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  DIRECT BOOKING — Review step
              ═══════════════════════════════════════════════════════════ */}
              {!isInquiry && step === 'review' && (
                <div className="flex flex-col gap-4 max-w-[580px] mx-auto">
                  <div
                    className="rounded-2xl bg-white p-5"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider f-body mb-4"
                      style={{ color: '#E67E50' }}>
                      {datesChanged ? 'Offer summary — review before sending' : 'Confirmation summary — review before sending'}
                    </p>

                    {datesChanged && (
                      <div
                        className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2.5"
                        style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}
                      >
                        <span className="text-base leading-none flex-shrink-0" aria-hidden>⚠️</span>
                        <div>
                          <p className="text-xs font-semibold f-body" style={{ color: '#92400E' }}>
                            You&apos;re proposing new dates
                          </p>
                          <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(146,64,14,0.75)' }}>
                            The angler requested different dates. They&apos;ll need to approve your
                            proposed dates before the booking is confirmed.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="text-xs font-medium f-body mb-2" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {datesChanged ? 'Proposed dates' : 'Confirmed dates'} ({selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDates.map(d => (
                          <span key={d}
                            className="text-xs px-3 py-1.5 rounded-lg f-body font-medium"
                            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>
                            {fmtDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                      <p className="text-xs font-medium f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>Your payout</p>
                      <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                        {fmtEur(updatedPayout)}
                      </p>
                    </div>

                    {locationText.trim() !== '' && (
                      <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                        <p className="text-xs font-medium f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>Meeting point</p>
                        <p className="text-sm f-body" style={{ color: '#0A2E4D' }}>{locationText}</p>
                      </div>
                    )}

                    {message.trim() !== '' && (
                      <div className="pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                        <p className="text-xs font-medium f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>Your message</p>
                        <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>
                          &ldquo;{message}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {error != null && (
                    <div className="rounded-xl px-4 py-3 text-sm f-body"
                      style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleSubmit}
                    className="w-full py-4 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2"
                    style={{
                      background: datesChanged ? '#E67E50' : '#22C55E',
                      color:      '#fff',
                      boxShadow:  datesChanged
                        ? '0 4px 14px rgba(230,126,80,0.3)'
                        : '0 4px 14px rgba(34,197,94,0.28)',
                      opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    {isPending && <Loader2 size={16} className="animate-spin" />}
                    {isPending
                      ? (datesChanged ? 'Sending offer...' : 'Sending confirmation...')
                      : datesChanged
                        ? '→ Send date proposal to angler'
                        : '✓ Confirm booking'
                    }
                  </button>

                  <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {datesChanged
                      ? 'The angler will receive your proposed dates and must approve before the booking is confirmed.'
                      : 'The booking is confirmed immediately. The angler will receive a confirmation email.'
                    }
                  </p>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
