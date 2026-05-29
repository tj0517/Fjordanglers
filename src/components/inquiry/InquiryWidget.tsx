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
import { ChevronLeft, ChevronRight, ChevronDown, X, Minus, Plus, Loader2, Check, Mail } from 'lucide-react'

function buildWhatsAppUrl(tripTitle: string, optionLabel?: string | null): string {
  const context = optionLabel ? `${tripTitle} — ${optionLabel}` : tripTitle
  const text = encodeURIComponent(
    `Hi! I have a question about "${context}". Can you help me plan this trip?`
  )
  return `https://wa.me/48698936563?text=${text}`
}

const EMAIL_URL =
  'mailto:contact@fjordanglers.com?subject=Question%20about%20a%20guided%20fishing%20trip'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InquiryWidgetProps {
  tripId:               string
  tripTitle:            string
  maxGuests?:           number
  blockedRanges?:       Array<{ date_start: string; date_end: string }>
  selectedOptionLabel?: string | null
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
  selectedOptionLabel,
  onClose,
}: {
  tripId:               string
  tripTitle:            string
  maxGuests:            number
  blockedRanges:        Array<{ date_start: string; date_end: string }>
  selectedOptionLabel?: string | null
  onClose:              () => void
}) {
  const [step,          setStep]          = useState<Step>('calendar')
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [country,      setCountry]      = useState('')
  const [partySize,    setPartySize]    = useState(1)
  const [message,      setMessage]      = useState('')
  const [phone,        setPhone]        = useState('')

  const [attribution,      setAttribution]      = useState('')
  const [attributionOpen,  setAttributionOpen]  = useState(false)

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
          selected_option: selectedOptionLabel ?? null,
          attribution:     attribution.trim() || null,
          angler_phone:    phone.trim() || null,
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
  }, [canSubmit, tripId, firstName, lastName, email, country, selectedDates, partySize, message, phone, selectedOptionLabel])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
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
                      'We confirm availability within 24 hours',
                      'No payment required to send an inquiry',
                      'Deposit link only sent after availability confirmed',
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

                    {/* Trip name + selected option + selected dates summary */}
                    <div className="mb-4 px-3.5 py-3 rounded-xl"
                      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5"
                        style={{ color: 'rgba(10,46,77,0.38)' }}>
                        {tripTitle}
                      </p>
                      {selectedOptionLabel && (
                        <p className="text-xs font-semibold f-body mb-1.5 flex items-center gap-1.5"
                          style={{ color: '#E67E50' }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                            style={{ background: '#E67E50' }} />
                          {selectedOptionLabel}
                        </p>
                      )}
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

                    {/* Phone */}
                    <div className="mb-3">
                      <label className={labelCls}>WhatsApp number</label>
                      <p className="text-[10px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        We&apos;ll use it to quickly discuss the details of your trip on WhatsApp.
                      </p>
                      <input type="tel" value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+48 123 456 789"
                        className={inputCls}
                        style={inputStyle}
                        autoComplete="tel" />
                    </div>

                    {/* Country */}
                    <div className="mb-3">
                      <label className={labelCls}>Country</label>
                      <input type="text" value={country}
                        onChange={e => setCountry(e.target.value)}
                        placeholder="Germany"
                        className={inputCls}
                        style={inputStyle}
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
                      <label className={labelCls}>Your trip</label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="What matters most to you on this trip? (species, technique, group size, dates flexibility...)"
                        rows={3}
                        maxLength={1000}
                        className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                        style={inputStyle}
                      />
                    </div>

                    {/* Attribution */}
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setAttributionOpen(o => !o)}
                        className="flex items-center gap-1.5 transition-opacity hover:opacity-70 mb-2"
                      >
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          How did you hear about us?{' '}
                          <span style={{ color: 'rgba(10,46,77,0.25)' }}>(optional)</span>
                        </span>
                        <ChevronDown
                          size={11}
                          style={{
                            color: 'rgba(10,46,77,0.3)',
                            transform: attributionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                          }}
                        />
                      </button>
                      {attributionOpen && (
                        <div className="flex flex-wrap gap-1.5">
                          {(['Instagram', 'Google', 'Friend', 'Already knew the guide', 'Other'] as const).map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAttribution(a => a === opt ? '' : opt)}
                              className="px-3 py-1.5 rounded-full text-xs f-body font-medium transition-all"
                              style={attribution === opt
                                ? { background: 'rgba(10,46,77,0.1)', color: '#0A2E4D', border: '1.5px solid rgba(10,46,77,0.22)' }
                                : { background: 'transparent', color: 'rgba(10,46,77,0.38)', border: '1px solid rgba(10,46,77,0.12)' }
                              }
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
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

                    {/* WhatsApp CTA */}
                    <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                      <p className="text-[11px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
                        💬 Prefer to message?
                      </p>
                      <a
                        href={buildWhatsAppUrl(tripTitle, selectedOptionLabel)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-semibold f-body"
                        style={{ color: '#E67E50', textDecoration: 'none' }}
                      >
                        Ask on WhatsApp →
                      </a>
                      <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.3)' }}>
                        Usually replies within a few hours
                      </p>
                    </div>

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
  maxGuests            = 12,
  blockedRanges        = [],
  selectedOptionLabel,
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
          {selectedOptionLabel && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(230,126,80,0.22)', border: '1px solid rgba(230,126,80,0.35)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
              <span className="text-xs font-semibold f-body" style={{ color: '#E67E50' }}>
                {selectedOptionLabel}
              </span>
            </div>
          )}
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

        {/* Not sure yet? */}
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] f-body pt-4 pb-3 text-center"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            Not sure yet? Talk to us
          </p>
          <div className="flex gap-2">
            <a
              href={buildWhatsAppUrl(tripTitle, selectedOptionLabel)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold f-body transition-all hover:brightness-110"
              style={{ background: 'rgba(37,211,102,0.14)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)', textDecoration: 'none' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
            <a
              href={EMAIL_URL}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold f-body transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}
            >
              <Mail size={13} />
              Email us
            </a>
          </div>
        </div>
      </div>

      {/* ── Modal portal ── */}
      {mounted && isOpen && createPortal(
        <InquiryModal
          tripId={tripId}
          tripTitle={tripTitle}
          maxGuests={maxGuests}
          blockedRanges={blockedRanges}
          selectedOptionLabel={selectedOptionLabel}
          onClose={closeModal}
        />,
        document.body,
      )}
    </>
  )
}

// ─── MobileInquiryBar ─────────────────────────────────────────────────────────

export function MobileInquiryBar({ tripId: _tripId, pricePerPerson }: { tripId: string; pricePerPerson?: number | null }) {
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
      <div className="flex items-center gap-4">
        {/* Price side */}
        <div className="flex-1 min-w-0">
          {pricePerPerson != null ? (
            <>
              <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>From</p>
              <p className="font-bold f-body leading-tight" style={{ color: '#0A2E4D', fontSize: '18px' }}>
                €{pricePerPerson}
                <span className="text-xs font-normal ml-1" style={{ color: 'rgba(10,46,77,0.42)' }}>/person</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold f-body leading-tight" style={{ color: '#0A2E4D' }}>Free to enquire</p>
              <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>No payment now</p>
            </>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleClick}
          className="flex-shrink-0 flex items-center justify-center px-6 py-3.5 rounded-2xl font-bold text-white f-body"
          style={{ background: '#E67E50', fontSize: '15px', boxShadow: '0 4px 20px rgba(230,126,80,0.4)' }}
        >
          Send Inquiry →
        </button>
      </div>
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
