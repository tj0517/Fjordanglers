'use client'

/**
 * IcelandicInquireForm — two-step Icelandic Flow enquiry form.
 *
 * Step 1 — Availability + group size:
 *   Interactive calendar (same UnifiedCalendar as the widget, but inline/full-width).
 *   Dates are pre-populated from URL params. Angler can adjust freely.
 *   Guests stepper.  Continue → button advances to step 2.
 *
 * Step 2 — Details + submit:
 *   Small summary pill (dates + guests) with "Edit" back to step 1.
 *   Guide-configured custom fields (from inquiry_form_config).
 *   Notes.
 *   Auth form (if not signed in) OR submit button.
 */

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Plus, Minus, CalendarDays, Check, Mail } from 'lucide-react'
import { signIn, signUp } from '@/actions/auth'
import { createIcelandicInquiry } from '@/actions/bookings'
import type { IcelandicFormConfig, InquiryFieldStatus, InquiryPresetFieldDef } from '@/types'
import { INQUIRY_PRESET_FIELDS } from '@/types'
import {
  type Period,
  buildBlockedSet,
  rangesOverlap,
  fmtDate,
  fmtDateShort,
  fmtPeriod,
} from '@/components/trips/icelandic-inquiry-widget'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthTab = 'login' | 'register'

interface Props {
  experience: {
    id:                  string
    title:               string
    max_guests:          number
    inquiry_form_config: IcelandicFormConfig | null
    /** Species that can be caught on this trip — rendered as multi-select chips. */
    targetSpecies:       string[]
    /** Fishing methods offered on this trip — rendered as single-select pills. */
    fishingMethods:      string[]
  }
  guide: {
    id:         string
    full_name:  string
    avatar_url: string | null
  }
  initialPeriods:       Array<{ from: string; to: string }>
  initialGuests:        number
  initialDurationDays:  number
  initialUser:          { id: string; email: string; name: string } | null
  backHref:             string
  blockedRanges:        Array<{ date_start: string; date_end: string }>
}

// ─── IcelandicInquireForm ─────────────────────────────────────────────────────

export function IcelandicInquireForm({
  experience, guide, initialPeriods, initialGuests, initialDurationDays,
  initialUser, backHref, blockedRanges,
}: Props) {

  // ── Active enquiry fields from guide config ────────────────────────────
  const fieldStatusMap: Record<string, InquiryFieldStatus> = {}
  for (const f of experience.inquiry_form_config?.fields ?? []) {
    fieldStatusMap[f.id] = f.status
  }
  const customFields: Array<InquiryPresetFieldDef & { required: boolean }> =
    INQUIRY_PRESET_FIELDS
      .filter(f => (fieldStatusMap[f.id] ?? 'excluded') !== 'excluded')
      .map(f => ({ ...f, required: fieldStatusMap[f.id] === 'included' }))

  // ── Step ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Calendar state (step 1) ───────────────────────────────────────────
  const blockedSet = useMemo(() => buildBlockedSet(blockedRanges), [blockedRanges])

  const [periods,     setPeriods]     = useState<Period[]>(() =>
    initialPeriods.map(p => ({ key: crypto.randomUUID(), from: p.from, to: p.to }))
  )
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [hoverDate,   setHoverDate]   = useState<string | null>(null)

  function handleDayClick(date: string) {
    if (pendingFrom === null) {
      const toRemove = periods.find(p => p.from === date || p.to === date)
      if (toRemove != null) {
        setPeriods(prev => prev.filter(p => p.key !== toRemove.key))
        return
      }
      if (periods.some(p => date > p.from && date < p.to)) return
      setPendingFrom(date)
      setHoverDate(null)
    } else if (pendingFrom === date) {
      const overlaps = periods.some(p => rangesOverlap(date, date, p.from, p.to))
      if (!overlaps) {
        setPeriods(prev => [...prev, { key: crypto.randomUUID(), from: date, to: date }])
      }
      setPendingFrom(null)
      setHoverDate(null)
    } else {
      const from = pendingFrom <= date ? pendingFrom : date
      const to   = pendingFrom <= date ? date : pendingFrom
      const overlaps = periods.some(p => rangesOverlap(from, to, p.from, p.to))
      if (!overlaps) {
        setPeriods(prev => [...prev, { key: crypto.randomUUID(), from, to }])
      }
      setPendingFrom(null)
      setHoverDate(null)
    }
  }

  // ── Calendar 2-month navigation ───────────────────────────────────────
  // Compute "today" once at mount using local date components (avoids UTC off-by-one).
  const [todayStr] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [calViewYear,  setCalViewYear]  = useState(() => new Date().getFullYear())
  const [calViewMonth, setCalViewMonth] = useState(() => new Date().getMonth())

  const calRightMonth = calViewMonth === 11 ? 0             : calViewMonth + 1
  const calRightYear  = calViewMonth === 11 ? calViewYear + 1 : calViewYear

  function prevCalNav() {
    if (calViewMonth === 0) { setCalViewYear(y => y - 1); setCalViewMonth(11) }
    else setCalViewMonth(m => m - 1)
  }
  function nextCalNav() {
    if (calViewMonth === 11) { setCalViewYear(y => y + 1); setCalViewMonth(0) }
    else setCalViewMonth(m => m + 1)
  }

  // Preview range endpoints while the user is dragging a selection
  const [calPStart, calPEnd] = useMemo((): [string | null, string | null] => {
    if (pendingFrom == null || hoverDate == null) return [null, null]
    return pendingFrom <= hoverDate ? [pendingFrom, hoverDate] : [hoverDate, pendingFrom]
  }, [pendingFrom, hoverDate])

  const calPreviewConflict = useMemo(
    () => calPStart != null && calPEnd != null
      && periods.some(p => rangesOverlap(calPStart!, calPEnd!, p.from, p.to)),
    [calPStart, calPEnd, periods],
  )

  /** Renders a single month grid for the inline 2-month step-1 calendar. */
  function renderCalMonthGrid(year: number, month: number, monthLabel: string) {
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const offset      = (firstDay + 6) % 7   // Mon = 0
    const cells: Array<number | null> = [
      ...Array<null>(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    return (
      <>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {['M','T','W','T','F','S','S'].map((h, i) => (
            <div key={i} className="text-center text-[10px] font-bold f-body py-0.5"
              style={{ color: 'rgba(10,46,77,0.28)' }}>{h}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, idx) => {
            if (day == null) return <div key={`e-${idx}`} />
            const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isPast     = d < todayStr
            const isBlocked  = blockedSet.has(d)
            const isDisabled = isPast || isBlocked

            const isStart = periods.some(p => p.from === d)
            const isEnd   = periods.some(p => p.to   === d)
            const isInner = periods.some(p => d > p.from && d < p.to)
            const isEdge  = isStart || isEnd

            const isPendingFrom = pendingFrom === d
            const isPreviewEdge = !isEdge && calPStart != null && (d === calPStart || d === calPEnd)
            const isInPreview   = !isEdge && !isInner
              && calPStart != null && calPEnd != null && d > calPStart && d < calPEnd

            let bg = 'rgba(22,163,74,0.13)', color = 'rgba(10,46,77,0.75)', fw = '600'
            let opacity = 1
            let radius = '7px', shadow = 'none', textDecoration = 'none'
            const cursor = isDisabled ? 'not-allowed' : 'pointer'

            if (isPast)               { bg = 'transparent'; color = '#0A2E4D'; fw = '400'; opacity = 0.22 }
            if (isBlocked && !isPast) {
              bg = 'rgba(10,46,77,0.06)'; color = 'rgba(10,46,77,0.28)'; fw = '400'
              textDecoration = 'line-through'
            }
            if (isInner)  { bg = 'rgba(230,126,80,0.14)'; color = '#C05E33'; fw = '500'; textDecoration = 'none' }
            if (isEdge)   { bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'; shadow = '0 2px 8px rgba(230,126,80,0.4)'; textDecoration = 'none' }
            if (isInPreview) {
              bg = calPreviewConflict ? 'rgba(239,68,68,0.07)' : 'rgba(230,126,80,0.12)'
              color = calPreviewConflict ? 'rgba(239,68,68,0.55)' : '#E67E50'
              fw = '500'; textDecoration = 'none'
            }
            if (isPreviewEdge) {
              bg    = calPreviewConflict ? 'rgba(239,68,68,0.22)' : 'rgba(230,126,80,0.45)'
              color = calPreviewConflict ? 'rgba(200,30,30,0.9)'  : '#fff'
              fw = '700'; radius = '8px'; textDecoration = 'none'
              shadow = calPreviewConflict ? 'none' : '0 2px 6px rgba(230,126,80,0.22)'
            }
            if (isPendingFrom) {
              bg = '#E67E50'; color = '#fff'; fw = '700'; radius = '8px'
              shadow = '0 3px 10px rgba(230,126,80,0.38)'; textDecoration = 'none'
            }

            return (
              <button
                key={d}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && handleDayClick(d)}
                onMouseEnter={() => !isDisabled && setHoverDate(d)}
                onMouseLeave={() => setHoverDate(null)}
                className={`aspect-square flex items-center justify-center text-[11px] f-body transition-all${isPendingFrom && hoverDate == null ? ' animate-pulse' : ''}`}
                style={{ background: bg, color, fontWeight: fw, opacity, borderRadius: radius, boxShadow: shadow, cursor, textDecoration }}
                aria-label={`${day} ${monthLabel}`}
                aria-pressed={isEdge || isInner || isPendingFrom}
              >
                {day}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Guests ────────────────────────────────────────────────────────────
  const [guests, setGuests] = useState(initialGuests)

  // ── Duration preference ───────────────────────────────────────────────
  const [durationDays, setDurationDays] = useState(initialDurationDays)

  // ── Step 2 form state ─────────────────────────────────────────────────
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [notes,         setNotes]         = useState('')

  // ── Auth state ────────────────────────────────────────────────────────
  const [currentUser,  setCurrentUser]  = useState(initialUser)
  const [authTab,      setAuthTab]      = useState<AuthTab>('login')
  const [authName,     setAuthName]     = useState('')
  const [authEmail,    setAuthEmail]    = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError,    setAuthError]    = useState<string | null>(null)

  // ── Submission state ──────────────────────────────────────────────────
  const [submitted,          setSubmitted]          = useState(false)
  const [inquiryId,          setInquiryId]          = useState<string | null>(null)
  const [submitError,        setSubmitError]        = useState<string | null>(null)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [isPending,          startTransition]       = useTransition()

  // ── Validation ────────────────────────────────────────────────────────
  const missingReq    = customFields.filter(f => f.required && !customAnswers[f.id]?.trim())
  const canSubmit     = periods.length > 0 && missingReq.length === 0 && currentUser != null && !isPending
  // Button is clickable as long as user is logged in and dates are selected; clicking
  // while form is incomplete sets hasAttemptedSubmit and shows the error list.
  const canClickSubmit = periods.length > 0 && currentUser != null && !isPending

  // ── Auth handler ──────────────────────────────────────────────────────
  function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    startTransition(async () => {
      const res = authTab === 'login'
        ? await signIn(authEmail, authPassword)
        : await signUp(authName, authEmail, authPassword)
      if ('error' in res) { setAuthError(res.error); return }
      setCurrentUser({ id: '', email: authEmail, name: authName })
    })
  }

  // ── Submit ────────────────────────────────────────────────────────────
  function handleSubmit() {
    setHasAttemptedSubmit(true)
    if (!canSubmit) return
    const fieldLabels: Record<string, string> = {}
    customFields.forEach(f => { fieldLabels[f.id] = f.label })
    startTransition(async () => {
      setSubmitError(null)
      const res = await createIcelandicInquiry({
        experienceId:       experience.id,
        periods:            periods.map(p => ({ from: p.from, to: p.to })),
        individualDates:    [],
        guests,
        customAnswers,
        fieldLabels,
        notes:              notes.trim() || null,
        durationPreference: `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`,
      })
      if (res.success) {
        setInquiryId(res.inquiryId)
        setSubmitted(true)
      } else {
        setSubmitError(res.error)
      }
    })
  }

  // ── Availability summary label ────────────────────────────────────────
  const availSummary = periods.length === 0
    ? 'No dates selected'
    : periods.length === 1
      ? fmtPeriod(periods[0])
      : `${periods.length} periods`

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS
  // ─────────────────────────────────────────────────────────────────────────
  if (submitted) {
    const ref = inquiryId != null ? inquiryId.slice(0, 8).toUpperCase() : null

    return (
      <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

        {/* ── Top bar ── */}
        <div
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{
            background:     'rgba(243,237,228,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom:   '1px solid rgba(10,46,77,0.07)',
          }}
        >
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm f-body font-medium transition-opacity hover:opacity-70"
            style={{ color: 'rgba(10,46,77,0.6)' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <span className="text-sm f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
            {experience.title}
          </span>
        </div>

        {/* ── Card ── */}
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-24">
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: '#0A2E4D',
              boxShadow:  '0 16px 48px rgba(10,46,77,0.28)',
            }}
          >
            {/* Header */}
            <div className="px-7 pt-8 pb-6 text-center">
              {/* Green circle check */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.25)' }}
              >
                <Check size={28} strokeWidth={2.5} style={{ color: '#4ade80' }} />
              </div>

              <p className="text-xs font-semibold f-body uppercase tracking-widest mb-2"
                style={{ color: 'rgba(255,255,255,0.45)' }}>
                Enquiry sent
              </p>
              <h1 className="text-2xl font-bold f-display" style={{ color: '#FFFFFF' }}>
                {guide.full_name} will be in touch
              </h1>
              <p className="text-sm f-body leading-relaxed mt-3"
                style={{ color: 'rgba(255,255,255,0.6)' }}>
                Your enquiry has been sent. {guide.full_name} will review your availability
                and get back to you with dates, pricing, and trip details.
              </p>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

            {/* Details */}
            <div className="px-7 py-5 flex flex-col gap-3">
              {/* Reference */}
              {ref != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Reference
                  </span>
                  <span
                    className="text-xs font-bold f-body font-mono px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)' }}
                  >
                    #{ref}
                  </span>
                </div>
              )}
              {/* Email note */}
              <div className="flex items-start gap-2.5 mt-1">
                <Mail size={14} strokeWidth={1.75} style={{ color: '#4ade80' }} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  A confirmation has been sent to your email address.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

            {/* Actions */}
            <div className="px-7 py-6 flex flex-col gap-3">
              <Link
                href="/account/bookings"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold f-body transition-all"
                style={{
                  background: '#E67E50',
                  color:      '#FFFFFF',
                  boxShadow:  '0 4px 16px rgba(230,126,80,0.35)',
                }}
              >
                View my enquiries →
              </Link>
              <Link
                href={backHref}
                className="flex items-center justify-center w-full py-3 rounded-2xl text-sm font-semibold f-body transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color:      'rgba(255,255,255,0.65)',
                }}
              >
                Back to trip
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 px-4 py-3"
        style={{ background: 'rgba(243,237,228,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
        <div className="max-w-[720px] mx-auto flex items-center gap-4">
          {step === 2 ? (
            <button type="button" onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm f-body font-medium transition-colors hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.55)' }}>
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <Link href={backHref}
              className="flex items-center gap-1 text-sm f-body font-medium transition-colors hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.55)', textDecoration: 'none' }}>
              <ChevronLeft size={16} />
              Back to trip
            </Link>
          )}
          <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.2)' }}>›</span>
          <span className="text-sm f-body font-semibold truncate" style={{ color: '#0A2E4D' }}>
            {experience.title}
          </span>
          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {([1, 2] as const).map(s => (
              <div key={s} className="w-5 h-1.5 rounded-full transition-all"
                style={{ background: s === step ? '#E67E50' : 'rgba(10,46,77,0.15)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[720px] mx-auto px-4 pt-8 pb-24">

        {/* ── Guide header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ border: '2px solid rgba(10,46,77,0.08)' }}>
            {guide.avatar_url != null ? (
              <Image src={guide.avatar_url} alt={guide.full_name}
                width={56} height={56} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xl f-display"
                style={{ background: '#0A2E4D' }}>
                {guide.full_name[0]}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] f-body mb-0.5"
              style={{ color: '#E67E50' }}>Enquiry to</p>
            <h1 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
              {guide.full_name}
            </h1>
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{experience.title}</p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  STEP 1 — Availability + group size                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-5">

            {/* Calendar — two months side by side on sm+, stacked on mobile */}
            <section className="p-4 sm:p-6 rounded-3xl" style={sectionCard}>
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={14} style={{ color: '#E67E50', flexShrink: 0 }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
                  style={{ color: '#E67E50' }}>When are you available?</p>
              </div>
              <p className="text-xs f-body mb-5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Select one or more date ranges. The guide will confirm which dates work best.
              </p>

              {/* Always-visible instruction banner — no layout shift */}
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl mb-4"
                style={{
                  background: pendingFrom != null ? 'rgba(230,126,80,0.10)' : 'rgba(10,46,77,0.04)',
                  border:     pendingFrom != null ? '1px solid rgba(230,126,80,0.22)' : '1px solid rgba(10,46,77,0.07)',
                }}>
                <span className="text-sm flex-shrink-0 mt-px leading-none">
                  {pendingFrom != null ? '📍' : '💡'}
                </span>
                <p className="text-[11px] f-body leading-snug"
                  style={{ color: pendingFrom != null ? '#C05E33' : 'rgba(10,46,77,0.5)' }}>
                  {pendingFrom != null
                    ? `From ${fmtDateShort(pendingFrom)} — click an end date, or the same date for a single day`
                    : 'Click any date to start. Click the same date twice for a single day, or a second date for a range.'}
                </p>
              </div>

              {/* Shared month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={prevCalNav}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }}
                  aria-label="Previous months">
                  <ChevronLeft size={15} />
                </button>
                <p className="text-sm font-bold f-body text-center" style={{ color: '#0A2E4D' }}>
                  {new Date(calViewYear, calViewMonth, 1).toLocaleDateString('en-GB', { month: 'long' })}
                  {' – '}
                  {new Date(calRightYear, calRightMonth, 1).toLocaleDateString('en-GB', { month: 'long' })}
                  {' '}
                  {calViewYear === calRightYear ? calViewYear : `${calViewYear} – ${calRightYear}`}
                </p>
                <button type="button" onClick={nextCalNav}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }}
                  aria-label="Next months">
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Two-month grid — side by side on sm+, stacked on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-xs font-bold f-body mb-2 text-center" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {new Date(calViewYear, calViewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  {renderCalMonthGrid(calViewYear, calViewMonth,
                    new Date(calViewYear, calViewMonth, 1).toLocaleDateString('en-GB', { month: 'long' }))}
                </div>
                <div>
                  <p className="text-xs font-bold f-body mb-2 text-center" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {new Date(calRightYear, calRightMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  {renderCalMonthGrid(calRightYear, calRightMonth,
                    new Date(calRightYear, calRightMonth, 1).toLocaleDateString('en-GB', { month: 'long' }))}
                </div>
              </div>

              {/* Clear all footer */}
              {periods.length > 0 && pendingFrom == null && (
                <div className="flex justify-end mt-3 pt-3"
                  style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                  <button type="button"
                    onClick={() => { setPeriods([]); setPendingFrom(null); setHoverDate(null) }}
                    className="text-[10px] f-body font-semibold"
                    style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Clear all
                  </button>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-5 mt-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(22,163,74,0.35)' }} />
                  <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: '#E67E50' }} />
                  <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm"
                    style={{ background: 'rgba(10,46,77,0.07)', border: '1px solid rgba(10,46,77,0.1)' }} />
                  <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Unavailable</span>
                </div>
              </div>
            </section>

            {/* Group size */}
            <section className="p-6 rounded-3xl" style={sectionCard}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
                style={{ color: '#E67E50' }}>Group size</p>
              <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1.5px solid rgba(10,46,77,0.10)' }}>
                <button type="button" onClick={() => setGuests(g => Math.max(1, g - 1))} disabled={guests <= 1}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                  style={{ background: guests <= 1 ? 'transparent' : 'rgba(10,46,77,0.08)', color: guests <= 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D', cursor: guests <= 1 ? 'not-allowed' : 'pointer' }}
                  aria-label="Remove angler">
                  <Minus size={15} />
                </button>
                <div className="text-center">
                  <span className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>{guests}</span>
                  <span className="text-sm f-body ml-2" style={{ color: 'rgba(10,46,77,0.55)' }}>{guests === 1 ? 'angler' : 'anglers'}</span>
                </div>
                <button type="button" onClick={() => setGuests(g => Math.min(g + 1, experience.max_guests))} disabled={guests >= experience.max_guests}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                  style={{ background: guests >= experience.max_guests ? 'transparent' : 'rgba(10,46,77,0.08)', color: guests >= experience.max_guests ? 'rgba(10,46,77,0.2)' : '#0A2E4D', cursor: guests >= experience.max_guests ? 'not-allowed' : 'pointer' }}
                  aria-label="Add angler">
                  <Plus size={15} />
                </button>
              </div>
              <p className="text-xs f-body mt-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Max {experience.max_guests} anglers for this experience.
              </p>
            </section>

            {/* Trip duration preference */}
            <section className="p-6 rounded-3xl" style={sectionCard}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                style={{ color: '#E67E50' }}>How long is your ideal trip?</p>
              <p className="text-xs f-body mb-4" style={{ color: 'rgba(10,46,77,0.45)' }}>
                This helps the guide plan the right experience. You can always discuss this with the guide.
              </p>
              <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1.5px solid rgba(10,46,77,0.10)' }}>
                <button
                  type="button"
                  onClick={() => setDurationDays(d => Math.max(1, d - 1))}
                  disabled={durationDays <= 1}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                  style={{
                    background: durationDays <= 1 ? 'transparent' : 'rgba(10,46,77,0.08)',
                    color:      durationDays <= 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
                    cursor:     durationDays <= 1 ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="Fewer days">
                  <Minus size={15} />
                </button>
                <div className="text-center">
                  <span className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                    {durationDays}
                  </span>
                  <span className="text-sm f-body ml-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
                    {durationDays === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDurationDays(d => Math.min(30, d + 1))}
                  disabled={durationDays >= 30}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                  style={{
                    background: durationDays >= 30 ? 'transparent' : 'rgba(10,46,77,0.08)',
                    color:      durationDays >= 30 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
                    cursor:     durationDays >= 30 ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="More days">
                  <Plus size={15} />
                </button>
              </div>
            </section>

            {/* Continue */}
            {periods.length > 0 ? (
              <button type="button" onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl text-base font-bold text-white f-body transition-all"
                style={{ background: '#E67E50', boxShadow: '0 6px 20px rgba(230,126,80,0.32)' }}>
                Continue → {guests} {guests === 1 ? 'angler' : 'anglers'}, {availSummary}
              </button>
            ) : (
              <div className="w-full py-4 rounded-2xl text-base font-bold text-center f-body"
                style={{ background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.28)', cursor: 'not-allowed' }}>
                Select at least one date to continue
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  STEP 2 — Custom fields + notes + auth/submit                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-6">

            {/* Availability + guests summary */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.18)' }}>
              <CalendarDays size={15} style={{ color: '#E67E50', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                  {availSummary}
                </span>
                <span className="text-sm f-body mx-2" style={{ color: 'rgba(10,46,77,0.3)' }}>·</span>
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  {guests} {guests === 1 ? 'angler' : 'anglers'}
                </span>
                <span className="text-sm f-body mx-2" style={{ color: 'rgba(10,46,77,0.3)' }}>·</span>
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  {durationDays} {durationDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <button type="button" onClick={() => setStep(1)}
                className="text-xs font-semibold f-body flex-shrink-0 transition-opacity hover:opacity-70"
                style={{ color: '#E67E50' }}>
                Edit
              </button>
            </div>

            {/* Custom fields */}
            {customFields.length > 0 && (
              <section className="p-6 rounded-3xl" style={sectionCard}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                  style={{ color: '#E67E50' }}>About your trip</p>
                <p className="text-xs f-body mb-5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  Help {guide.full_name} prepare the perfect experience for you.
                </p>
                <div className="flex flex-col gap-5">
                  {customFields.map(field => {
                    // Multi-chip: species from the trip — shown when guide has species data
                    const isSpeciesField = field.id === 'target_species' && experience.targetSpecies.length > 0
                    // Single-select: fishing methods from the trip — overrides preset options when available
                    const isFishingMethodField = field.id === 'fishing_method' && experience.fishingMethods.length > 0
                    // Pill select: any 'select' field NOT already handled above
                    const isPillSelect = !isFishingMethodField && field.type === 'select' && field.options != null

                    return (
                      <div key={field.id}>
                        <label
                          htmlFor={!isPillSelect && !isSpeciesField && !isFishingMethodField ? `field-${field.id}` : undefined}
                          className="block text-sm font-semibold mb-2 f-body"
                          style={{ color: '#0A2E4D' }}
                        >
                          {field.label}
                          {field.required && <span style={{ color: '#E67E50' }}> *</span>}
                        </label>

                        {/* ── Textarea ── */}
                        {field.type === 'textarea' ? (
                          <textarea
                            id={`field-${field.id}`}
                            rows={3}
                            placeholder={field.placeholder ?? ''}
                            value={customAnswers[field.id] ?? ''}
                            onChange={e => setCustomAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                            className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none resize-none transition-all"
                            style={fieldStyle}
                            onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')}
                          />

                        ) : isSpeciesField ? (
                          /* ── Multi-chip: target species from the trip ── */
                          <div className="flex flex-wrap gap-2" role="group" aria-label={field.label}>
                            {experience.targetSpecies.map(sp => {
                              const selectedList = (customAnswers[field.id] ?? '')
                                .split(',').map(s => s.trim()).filter(Boolean)
                              const isSelected = selectedList.includes(sp)
                              return (
                                <button
                                  key={sp}
                                  type="button"
                                  onClick={() => {
                                    const cur = (customAnswers[field.id] ?? '')
                                      .split(',').map(s => s.trim()).filter(Boolean)
                                    const next = isSelected
                                      ? cur.filter(x => x !== sp)
                                      : [...cur, sp]
                                    setCustomAnswers(p => ({ ...p, [field.id]: next.join(', ') }))
                                  }}
                                  className="px-4 py-2 rounded-2xl text-sm f-body font-medium transition-all"
                                  style={{
                                    background: isSelected ? '#E67E50' : 'rgba(10,46,77,0.06)',
                                    color:      isSelected ? '#fff'    : '#0A2E4D',
                                    border:     `1.5px solid ${isSelected ? '#E67E50' : 'rgba(10,46,77,0.10)'}`,
                                    boxShadow:  isSelected ? '0 2px 8px rgba(230,126,80,0.25)' : 'none',
                                  }}
                                >
                                  {sp}
                                </button>
                              )
                            })}
                          </div>

                        ) : isFishingMethodField ? (
                          /* ── Fishing methods from the trip (multi-select pills) ── */
                          <div className="flex flex-wrap gap-2" role="group" aria-label={field.label}>
                            {experience.fishingMethods.map(method => {
                              const selectedList = (customAnswers[field.id] ?? '')
                                .split(',').map(s => s.trim()).filter(Boolean)
                              const isSelected = selectedList.includes(method)
                              return (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() => {
                                    const cur = (customAnswers[field.id] ?? '')
                                      .split(',').map(s => s.trim()).filter(Boolean)
                                    const next = isSelected
                                      ? cur.filter(x => x !== method)
                                      : [...cur, method]
                                    setCustomAnswers(p => ({ ...p, [field.id]: next.join(', ') }))
                                  }}
                                  className="px-4 py-2 rounded-2xl text-sm f-body font-medium transition-all"
                                  style={{
                                    background: isSelected ? '#E67E50' : 'rgba(10,46,77,0.06)',
                                    color:      isSelected ? '#fff'    : '#0A2E4D',
                                    border:     `1.5px solid ${isSelected ? '#E67E50' : 'rgba(10,46,77,0.10)'}`,
                                    boxShadow:  isSelected ? '0 2px 8px rgba(230,126,80,0.25)' : 'none',
                                  }}
                                >
                                  {method}
                                </button>
                              )
                            })}
                          </div>

                        ) : isPillSelect ? (
                          /* ── Single-select pill buttons — no dropdown ── */
                          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={field.label}>
                            {field.options!.map(opt => {
                              const isSelected = customAnswers[field.id] === opt
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  onClick={() => setCustomAnswers(p => ({
                                    ...p,
                                    [field.id]: p[field.id] === opt ? '' : opt,
                                  }))}
                                  className="px-4 py-2 rounded-2xl text-sm f-body font-medium transition-all"
                                  style={{
                                    background: isSelected ? '#E67E50' : 'rgba(10,46,77,0.06)',
                                    color:      isSelected ? '#fff'    : '#0A2E4D',
                                    border:     `1.5px solid ${isSelected ? '#E67E50' : 'rgba(10,46,77,0.10)'}`,
                                    boxShadow:  isSelected ? '0 2px 8px rgba(230,126,80,0.25)' : 'none',
                                  }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>

                        ) : (
                          /* ── Text input (fallback for target_species without trip data, or free text) ── */
                          <input
                            id={`field-${field.id}`}
                            type="text"
                            placeholder={field.placeholder ?? ''}
                            value={customAnswers[field.id] ?? ''}
                            onChange={e => setCustomAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                            className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none transition-all"
                            style={fieldStyle}
                            onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Notes */}
            <section className="p-6 rounded-3xl" style={sectionCard}>
              <label htmlFor="notes"
                className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                style={{ color: '#E67E50' }}>
                Additional notes{' '}
                <span className="normal-case tracking-normal font-normal" style={{ color: 'rgba(10,46,77,0.35)', fontSize: '11px' }}>
                  — optional
                </span>
              </label>
              <p className="text-xs f-body mb-4" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Anything else the guide should know — special requests, accessibility needs, etc.
              </p>
              <textarea id="notes" rows={3}
                placeholder="e.g. We're celebrating a birthday, one member is a wheelchair user, we prefer morning sessions…"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none resize-none transition-all"
                style={fieldStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')} />
            </section>

            {/* Auth or Submit */}
            <section className="p-6 rounded-3xl" style={sectionCard}>
              {currentUser == null ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
                    style={{ color: '#E67E50' }}>Sign in to send your enquiry</p>
                  <p className="text-sm f-body mb-5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    You need a FjordAnglers account to contact guides.
                  </p>

                  <div className="flex rounded-xl p-1 mb-4"
                    style={{ background: 'rgba(10,46,77,0.06)' }} role="tablist">
                    {(['login', 'register'] as AuthTab[]).map(tab => (
                      <button key={tab} type="button" role="tab"
                        aria-selected={authTab === tab}
                        onClick={() => { setAuthTab(tab); setAuthError(null) }}
                        className="flex-1 text-sm font-semibold py-2 rounded-lg transition-all f-body"
                        style={authTab === tab
                          ? { background: '#fff', color: '#0A2E4D', boxShadow: '0 1px 6px rgba(10,46,77,0.1)' }
                          : { color: 'rgba(10,46,77,0.45)' }}>
                        {tab === 'login' ? 'Sign in' : 'Create account'}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAuth} className="flex flex-col gap-3">
                    {authTab === 'register' && (
                      <input type="text" autoComplete="name" required value={authName}
                        onChange={e => setAuthName(e.target.value)} placeholder="Full name"
                        className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none transition-all"
                        style={fieldStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')} />
                    )}
                    <input type="email" autoComplete="email" required value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)} placeholder="Email address"
                      className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none transition-all"
                      style={fieldStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')} />
                    <input type="password"
                      autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                      required minLength={authTab === 'register' ? 8 : undefined}
                      value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                      placeholder={authTab === 'register' ? 'Password (min. 8 characters)' : '••••••••'}
                      className="w-full rounded-2xl px-4 py-3 text-sm f-body outline-none transition-all"
                      style={fieldStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.14)')} />

                    {authError != null && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm f-body" role="alert"
                        style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <AlertCircle size={14} className="flex-shrink-0" /> {authError}
                      </div>
                    )}

                    <button type="submit" disabled={isPending}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold text-white f-body mt-1 transition-all"
                      style={{ background: isPending ? 'rgba(230,126,80,0.65)' : '#E67E50', boxShadow: isPending ? 'none' : '0 4px 14px rgba(230,126,80,0.28)' }}>
                      {isPending
                        ? <span className="flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            {authTab === 'login' ? 'Signing in…' : 'Creating account…'}
                          </span>
                        : authTab === 'login' ? 'Sign in & continue →' : 'Create account & continue →'
                      }
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Periods</span>
                      <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{periods.length} window{periods.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Group size</span>
                      <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{guests} {guests === 1 ? 'angler' : 'anglers'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                      <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>Price</span>
                      <span className="text-sm font-bold f-body" style={{ color: '#E67E50' }}>On request</span>
                    </div>
                  </div>

                  {hasAttemptedSubmit && missingReq.length > 0 && (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4 text-sm f-body"
                      style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>Please fill in required fields: {missingReq.map(f => f.label).join(', ')}</span>
                    </div>
                  )}

                  {submitError != null && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm f-body"
                      style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <AlertCircle size={14} className="flex-shrink-0" /> {submitError}
                    </div>
                  )}

                  <button type="button" onClick={handleSubmit} disabled={!canClickSubmit}
                    className="w-full py-4 rounded-2xl text-base font-bold text-white f-body transition-all"
                    style={{
                      background:  canClickSubmit ? '#E67E50' : 'rgba(10,46,77,0.12)',
                      color:       canClickSubmit ? '#fff'    : 'rgba(10,46,77,0.28)',
                      cursor:      canClickSubmit ? 'pointer' : 'not-allowed',
                      boxShadow:   canClickSubmit ? '0 6px 20px rgba(230,126,80,0.32)' : 'none',
                    }}>
                    {isPending
                      ? <span className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Sending enquiry…
                        </span>
                      : 'Send Enquiry →'
                    }
                  </button>

                  <p className="text-[11px] f-body text-center mt-3" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    No payment required now — {guide.full_name} will respond with an offer.
                  </p>
                </>
              )}
            </section>

            {/* Trust signals */}
            <div className="flex flex-col gap-2.5 px-2">
              {[
                { icon: '🔒', text: 'No payment now — you only pay when you confirm a trip.' },
                { icon: '💬', text: 'The guide reviews your enquiry and responds with a personalised offer.' },
                { icon: '✅', text: "You're in full control — agree on details before confirming." },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>{text}</p>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionCard: React.CSSProperties = {
  background: '#FDFAF7',
  border:     '1px solid rgba(10,46,77,0.07)',
  boxShadow:  '0 2px 16px rgba(10,46,77,0.04)',
}

const fieldStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border:     '1.5px solid rgba(10,46,77,0.14)',
  color:      '#0A2E4D',
}
