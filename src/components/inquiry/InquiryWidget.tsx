'use client'

/**
 * InquiryWidget — trip page inquiry entry point.
 *
 * Renders a compact CTA card in the right column. Clicking "Send Inquiry" opens
 * a modal with a two-step flow:
 *   Step 1 — Multi-date calendar: angler picks one or more preferred dates.
 *             Guide's blocked dates are shown as unavailable.
 *   Step 2 — Contact form: name, email, country, party size, optional message.
 *
 * MobileInquiryBar (fixed bottom bar) dispatches a custom DOM event
 * 'open-inquiry-modal' which InquiryWidget listens to — no shared state in the
 * trips page required.
 *
 * On submit: POST /api/inquiries with requested_dates[] (sorted YYYY-MM-DD).
 * Success: confirmation inside the modal. No Stripe redirect.
 *
 * CTA: "Send Inquiry" — NEVER "Book Now", "Reserve", or "Pay".
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Minus, Plus, Loader2, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InquiryWidgetProps {
  tripId:        string
  tripTitle:     string
  maxGuests?:    number
  blockedRanges?: Array<{ date_start: string; date_end: string }>
}

type Step        = 'calendar' | 'form'
type SubmitState = 'idle' | 'loading' | 'success' | 'error'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function buildBlockedSet(ranges: Array<{ date_start: string; date_end: string }>): Set<string> {
  const set = new Set<string>()
  for (const r of ranges) {
    const end = new Date(r.date_end   + 'T12:00:00')
    let   cur = new Date(r.date_start + 'T12:00:00')
    let safety = 0
    while (cur <= end && safety < 365) {
      set.add(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      )
      cur.setDate(cur.getDate() + 1)
      safety++
    }
  }
  return set
}

// ─── InlineMultiCalendar ──────────────────────────────────────────────────────

function InlineMultiCalendar({
  selectedDates,
  blockedSet,
  onToggle,
}: {
  selectedDates: string[]
  blockedSet:    Set<string>
  onToggle:      (date: string) => void
}) {
  const today = isoToday()
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offset      = (firstDay + 6) % 7

  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(10,46,77,0.4)', background: 'rgba(10,46,77,0.05)' }}
          aria-label="Previous month">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</span>
        <button type="button" onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(10,46,77,0.4)', background: 'rgba(10,46,77,0.05)' }}
          aria-label="Next month">
          <ChevronRight size={15} />
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
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} />

          const d          = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast     = d < today
          const blocked    = blockedSet.has(d)
          const disabled   = isPast || blocked
          const isSelected = selectedDates.includes(d)

          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggle(d)}
              className="aspect-square flex items-center justify-center rounded-lg transition-all f-body"
              style={{
                background: isSelected
                  ? '#E67E50'
                  : blocked && !isPast
                    ? 'rgba(10,46,77,0.04)'
                    : 'transparent',
                color: isPast
                  ? 'rgba(10,46,77,0.15)'
                  : blocked
                    ? 'rgba(10,46,77,0.2)'
                    : isSelected
                      ? '#fff'
                      : '#0A2E4D',
                cursor:         disabled ? 'not-allowed' : 'pointer',
                fontWeight:     isSelected ? '700' : '400',
                fontSize:       '12px',
                boxShadow:      isSelected ? '0 2px 6px rgba(230,126,80,0.35)' : 'none',
                textDecoration: blocked && !isPast ? 'line-through' : 'none',
              }}
              aria-label={`${d}${blocked ? ' — unavailable' : ''}${isSelected ? ' — selected' : ''}`}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── InquiryModal ─────────────────────────────────────────────────────────────

function InquiryModal({
  tripId,
  tripTitle,
  maxGuests,
  blockedRanges,
  onClose,
}: {
  tripId:        string
  tripTitle:     string
  maxGuests:     number
  blockedRanges: Array<{ date_start: string; date_end: string }>
  onClose:       () => void
}) {
  const [step,          setStep]          = useState<Step>('calendar')
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [country,      setCountry]      = useState('')
  const [partySize,    setPartySize]    = useState(1)
  const [message,      setMessage]      = useState('')

  const [submitState,  setSubmitState]  = useState<SubmitState>('idle')
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [hasAttempted, setHasAttempted] = useState(false)

  const blockedSet = useMemo(() => buildBlockedSet(blockedRanges), [blockedRanges])

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const toggleDate = useCallback((date: string) => {
    setSelectedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date].sort()
    )
  }, [])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit  = (
    firstName.trim() !== '' &&
    lastName.trim()  !== '' &&
    emailValid &&
    country.trim()   !== '' &&
    selectedDates.length > 0
  )

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttempted(true)
    if (!canSubmit) return

    setSubmitState('loading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/inquiries', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id:         tripId,
          angler_name:     `${firstName.trim()} ${lastName.trim()}`,
          angler_email:    email.trim(),
          angler_country:  country.trim(),
          requested_dates: selectedDates,
          party_size:      partySize,
          message:         message.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setSubmitState('success')
    } catch (err) {
      console.error('[InquiryModal] submit error:', err)
      setSubmitState('error')
      setErrorMsg(
        err instanceof Error ? err.message : 'Something went wrong — please try again.',
      )
    }
  }, [canSubmit, tripId, firstName, lastName, email, country, selectedDates, partySize, message])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,46,77,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card */}
      <div
        className="relative w-full sm:max-w-md bg-white flex flex-col"
        style={{
          borderRadius: '24px 24px 0 0',
          maxHeight: '92dvh',
          boxShadow: '0 -8px 48px rgba(10,46,77,0.25)',
          ...(typeof window !== 'undefined' && window.innerWidth >= 640 ? {
            borderRadius: '24px',
            maxHeight: '90dvh',
          } : {}),
        }}
      >
        {/* ── Success state ── */}
        {submitState === 'success' ? (
          <div className="flex flex-col items-center text-center px-8 py-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ background: 'rgba(230,126,80,0.12)' }}>
              <Check size={32} style={{ color: '#E67E50' }} strokeWidth={2.5} />
            </div>
            <p className="text-xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>
              Inquiry sent!
            </p>
            <p className="text-sm f-body leading-relaxed mb-6" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Your inquiry has been received by FjordAnglers.
              We&apos;ll be in touch within 24 hours.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-bold f-body"
              style={{ background: '#0A2E4D', color: '#fff' }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* ── Modal header ── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              <div>
                {step === 'form' ? (
                  <button
                    type="button"
                    onClick={() => { setStep('calendar'); setHasAttempted(false) }}
                    className="flex items-center gap-1 text-xs f-body mb-1 transition-opacity hover:opacity-60"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    <ChevronLeft size={13} />
                    Back
                  </button>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5"
                    style={{ color: '#E67E50' }}>
                    Free to enquire
                  </p>
                )}
                <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
                  {step === 'calendar' ? 'Select your dates' : 'Your details'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1">

              {step === 'calendar' ? (
                /* ── Step 1: Calendar ── */
                <div className="px-5 pt-4 pb-5">

                  <InlineMultiCalendar
                    selectedDates={selectedDates}
                    blockedSet={blockedSet}
                    onToggle={toggleDate}
                  />

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: '#E67E50' }} />
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Selected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(10,46,77,0.05)', border: '1px solid rgba(10,46,77,0.1)' }} />
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Unavailable</span>
                    </div>
                  </div>

                  {/* Selected date chips */}
                  {selectedDates.length > 0 && (
                    <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-2"
                        style={{ color: 'rgba(10,46,77,0.38)' }}>Selected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDates.map(d => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold f-body"
                            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.3)' }}
                          >
                            {fmtDateShort(d)}
                            <button
                              type="button"
                              onClick={() => toggleDate(d)}
                              style={{ color: 'rgba(230,126,80,0.6)', lineHeight: 1 }}
                              aria-label={`Remove ${d}`}
                            >
                              <X size={10} strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continue button */}
                  <button
                    type="button"
                    disabled={selectedDates.length === 0}
                    onClick={() => setStep('form')}
                    className="w-full py-3.5 rounded-xl text-sm font-bold f-body transition-all"
                    style={{
                      background: selectedDates.length > 0 ? '#E67E50' : 'rgba(10,46,77,0.07)',
                      color:      selectedDates.length > 0 ? '#fff' : 'rgba(10,46,77,0.25)',
                      cursor:     selectedDates.length > 0 ? 'pointer' : 'not-allowed',
                      boxShadow:  selectedDates.length > 0 ? '0 4px 14px rgba(230,126,80,0.3)' : 'none',
                    }}
                  >
                    {selectedDates.length === 0
                      ? 'Select at least one date'
                      : `Continue with ${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} →`
                    }
                  </button>

                  {/* Trust signals */}
                  <div className="space-y-1.5 mt-4">
                    {[
                      'No payment required to send an inquiry',
                      'FA reviews & confirms with the guide within 24h',
                      'Deposit link sent only after availability confirmed',
                    ].map(text => (
                      <div key={text} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#E67E50', opacity: 0.6 }} />
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              ) : (
                /* ── Step 2: Form ── */
                <form onSubmit={handleSubmit} noValidate>
                  <div className="px-5 pt-4 pb-6 space-y-0">

                    {/* Trip name + selected dates summary */}
                    <div className="mb-4 px-3.5 py-3 rounded-xl"
                      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5"
                        style={{ color: 'rgba(10,46,77,0.38)' }}>
                        {tripTitle}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedDates.map(d => (
                          <span
                            key={d}
                            className="text-xs font-semibold f-body px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}
                          >
                            {fmtDateShort(d)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className={labelCls}>First name</label>
                        <input type="text" value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          placeholder="Erik"
                          className={inputCls}
                          style={{ ...inputStyle, border: hasAttempted && firstName.trim() === '' ? '1.5px solid rgba(239,68,68,0.6)' : inputStyle.border }}
                          autoComplete="given-name" />
                      </div>
                      <div>
                        <label className={labelCls}>Last name</label>
                        <input type="text" value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          placeholder="Andersen"
                          className={inputCls}
                          style={{ ...inputStyle, border: hasAttempted && lastName.trim() === '' ? '1.5px solid rgba(239,68,68,0.6)' : inputStyle.border }}
                          autoComplete="family-name" />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="mb-3">
                      <label className={labelCls}>Email</label>
                      <input type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputCls}
                        style={{ ...inputStyle, border: hasAttempted && !emailValid ? '1.5px solid rgba(239,68,68,0.6)' : inputStyle.border }}
                        autoComplete="email" />
                    </div>

                    {/* Country */}
                    <div className="mb-3">
                      <label className={labelCls}>Country</label>
                      <input type="text" value={country}
                        onChange={e => setCountry(e.target.value)}
                        placeholder="Germany"
                        className={inputCls}
                        style={{ ...inputStyle, border: hasAttempted && country.trim() === '' ? '1.5px solid rgba(239,68,68,0.6)' : inputStyle.border }}
                        autoComplete="country-name" />
                    </div>

                    {/* Party size */}
                    <div className="mb-3">
                      <label className={labelCls}>Anglers</label>
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={inputStyle}>
                        <button type="button"
                          onClick={() => setPartySize(p => Math.max(1, p - 1))}
                          disabled={partySize <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: partySize <= 1 ? 'transparent' : 'rgba(10,46,77,0.08)', color: partySize <= 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D', cursor: partySize <= 1 ? 'not-allowed' : 'pointer' }}
                          aria-label="Remove angler">
                          <Minus size={13} />
                        </button>
                        <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
                          {partySize} {partySize === 1 ? 'angler' : 'anglers'}
                        </span>
                        <button type="button"
                          onClick={() => setPartySize(p => Math.min(maxGuests, p + 1))}
                          disabled={partySize >= maxGuests}
                          className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: partySize >= maxGuests ? 'transparent' : 'rgba(10,46,77,0.08)', color: partySize >= maxGuests ? 'rgba(10,46,77,0.2)' : '#0A2E4D', cursor: partySize >= maxGuests ? 'not-allowed' : 'pointer' }}
                          aria-label="Add angler">
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="mb-4">
                      <label className={labelCls}>
                        Message{' '}
                        <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Any specific preferences, questions, or details about your trip…"
                        rows={3}
                        maxLength={1000}
                        className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                        style={inputStyle}
                      />
                    </div>

                    {/* Error */}
                    {submitState === 'error' && errorMsg != null && (
                      <div className="mb-3 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <p className="text-[12px] f-body" style={{ color: '#DC2626', margin: 0 }}>{errorMsg}</p>
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={submitState === 'loading'}
                      className="w-full py-3.5 rounded-xl text-sm font-bold f-body transition-all flex items-center justify-center gap-2"
                      style={{
                        background: submitState === 'loading' ? 'rgba(230,126,80,0.6)' : '#E67E50',
                        color:      '#fff',
                        cursor:     submitState === 'loading' ? 'not-allowed' : 'pointer',
                        boxShadow:  submitState === 'loading' ? 'none' : '0 4px 14px rgba(230,126,80,0.3)',
                      }}
                    >
                      {submitState === 'loading' ? (
                        <><Loader2 size={14} className="animate-spin" /> Sending…</>
                      ) : (
                        'Send Inquiry →'
                      )}
                    </button>

                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── InquiryWidget (compact card) ─────────────────────────────────────────────

export function InquiryWidget({
  tripId,
  tripTitle,
  maxGuests     = 12,
  blockedRanges = [],
}: InquiryWidgetProps) {
  const [isOpen,   setIsOpen]   = useState(false)
  const [mounted,  setMounted]  = useState(false)

  // Needed for createPortal (SSR-safe)
  useEffect(() => { setMounted(true) }, [])

  // Listen for 'open-inquiry-modal' dispatched by MobileInquiryBar
  useEffect(() => {
    const handle = () => setIsOpen(true)
    window.addEventListener('open-inquiry-modal', handle)
    return () => window.removeEventListener('open-inquiry-modal', handle)
  }, [])

  const openModal  = useCallback(() => setIsOpen(true),  [])
  const closeModal = useCallback(() => setIsOpen(false), [])

  return (
    <>
      {/* ── Compact CTA card ── */}
      <div className="rounded-3xl overflow-hidden" style={card}>

        {/* Trip identity */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Book this trip
          </p>
          <p className="text-lg font-bold f-display leading-snug" style={{ color: '#FFFFFF' }}>
            {tripTitle}
          </p>
        </div>

        {/* How it works */}
        <div className="px-5 pt-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            How it works
          </p>
          <div className="space-y-2.5">
            {([
              ['1', 'Send a free inquiry'],
              ['2', 'FA confirms availability'],
              ['3', 'Secure with a deposit'],
            ] as [string, string][]).map(([num, title]) => (
              <div key={num} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(230,126,80,0.25)', color: '#E67E50' }}>
                  <span className="text-[10px] font-bold f-body">{num}</span>
                </div>
                <p className="text-sm font-semibold f-body" style={{ color: '#FFFFFF' }}>{title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pt-4 pb-5">
          <button
            type="button"
            onClick={openModal}
            className="w-full py-3.5 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: '#E67E50',
              color:      '#fff',
              boxShadow:  '0 4px 14px rgba(230,126,80,0.4)',
            }}
          >
            Send Inquiry →
          </button>

          <p className="text-center text-[11px] f-body mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Free to enquire · no payment now · reply within 24h
          </p>
        </div>
      </div>

      {/* ── Modal portal ── */}
      {mounted && isOpen && createPortal(
        <InquiryModal
          tripId={tripId}
          tripTitle={tripTitle}
          maxGuests={maxGuests}
          blockedRanges={blockedRanges}
          onClose={closeModal}
        />,
        document.body,
      )}
    </>
  )
}

// ─── MobileInquiryBar ─────────────────────────────────────────────────────────

export function MobileInquiryBar({ tripId: _tripId }: { tripId: string }) {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-inquiry-modal'))
  }, [])

  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-5"
      style={{
        background:           'rgba(243,237,228,0.97)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:            '1px solid rgba(10,46,77,0.1)',
        boxShadow:            '0 -8px 32px rgba(0,0,0,0.1)',
        paddingTop:           '14px',
        paddingBottom:        'calc(14px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mb-2">
        <p className="text-base font-bold f-body leading-tight" style={{ color: '#0A2E4D' }}>
          Interested? Send an inquiry
        </p>
        <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
          Free to request · no payment now
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center w-full py-4 rounded-2xl font-bold text-white f-body"
        style={{ background: '#E67E50', fontSize: '16px', boxShadow: '0 4px 20px rgba(230,126,80,0.4)' }}
      >
        Send Inquiry →
      </button>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#0A2E4D',
  border:     '1px solid rgba(255,255,255,0.08)',
  boxShadow:  '0 8px 32px rgba(10,46,77,0.3)',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(10,46,77,0.04)',
  border:     '1.5px solid rgba(10,46,77,0.1)',
  color:      '#0A2E4D',
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all'

const labelCls =
  'text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1 block text-[rgba(10,46,77,0.42)]'
