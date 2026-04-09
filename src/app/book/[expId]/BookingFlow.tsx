'use client'

/**
 * BookingFlow — Single-column two-step checkout at /book/[expId].
 *
 * Layout mirrors a clean mobile-first booking UX:
 *   [Experience card]
 *   [Step card — changes between step 1 and step 2]
 *
 * Step 1: Package selector + full interactive calendar + guests + price + CTA
 * Step 2: Compact order summary + auth form (unauthenticated) / contact form (authenticated)
 */

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Minus, Plus, CheckCircle, Loader2, AlertCircle, MapPin } from 'lucide-react'
import { signIn, signUp } from '@/actions/auth'
import { createDirectBooking } from '@/actions/bookings'
import type { DurationOptionPayload } from '@/actions/experiences'

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

interface ExperienceData {
  id: string
  title: string
  price_per_person_eur: number
  max_guests: number
  duration_options: DurationOptionPayload[] | null
}

export interface BookingFlowProps {
  experience: ExperienceData
  guideName: string
  guideAvatarUrl: string | null
  locationCity: string | null
  locationCountry: string | null
  commissionRate: number
  blockedRanges: BlockedRange[]
  initialUser: InitialUser | null
  initialDatesStr: string
  initialPkgLabel: string
  initialGuests: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function isBlocked(date: string, ranges: BlockedRange[]): boolean {
  return ranges.some(r => date >= r.date_start && date <= r.date_end)
}

function expandRange(start: string, numDays: number): string[] {
  const result: string[] = []
  const base = new Date(start + 'T00:00:00')
  for (let i = 0; i < numDays; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    // Use local date parts — toISOString() returns UTC which is the wrong day for UTC+ zones
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    result.push(`${y}-${m}-${dd}`)
  }
  return result
}

function isRangeBlocked(start: string, numDays: number, ranges: BlockedRange[]): boolean {
  return expandRange(start, numDays).some(d => isBlocked(d, ranges))
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

const COUNTRY_NAMES: Record<string, string> = {
  NO: 'Norway', SE: 'Sweden', DK: 'Denmark', FI: 'Finland', IS: 'Iceland',
}

// ─── BookingFlow ──────────────────────────────────────────────────────────────

export function BookingFlow({
  experience,
  guideName,
  guideAvatarUrl,
  locationCity,
  locationCountry,
  commissionRate: _commissionRate,
  blockedRanges,
  initialUser,
  initialDatesStr,
  initialPkgLabel,
  initialGuests,
}: BookingFlowProps) {
  const router = useRouter()
  const today  = isoToday()

  // ── Booking state ────────────────────────────────────────────────────────
  const packages = experience.duration_options as DurationOptionPayload[] | null

  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    if (!initialDatesStr) return []
    const dates = initialDatesStr.split(',').filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    if (dates.length === 0) return []
    // For multi-day fixed packages, rebuild the consecutive range from the first date
    const pkg = packages != null && initialPkgLabel
      ? (packages.find(p => p.label === initialPkgLabel) ?? packages[0])
      : packages?.[0] ?? null
    if (pkg?.days != null && pkg.days > 1) return expandRange(dates[0], pkg.days)
    return dates
  })

  const [selectedPkg, setSelectedPkg] = useState<DurationOptionPayload | null>(() => {
    if (packages == null || packages.length === 0) return null
    if (initialPkgLabel) return packages.find(p => p.label === initialPkgLabel) ?? packages[0]
    return packages[0]
  })

  const [guests, setGuests] = useState(() =>
    Math.max(1, Math.min(initialGuests, experience.max_guests))
  )

  // ── Calendar view ─────────────────────────────────────────────────────────
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDates.length > 0) return new Date(selectedDates[0] + 'T00:00:00').getFullYear()
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDates.length > 0) return new Date(selectedDates[0] + 'T00:00:00').getMonth()
    return new Date().getMonth()
  })

  // ── Step + form state ─────────────────────────────────────────────────────
  const [step, setStep]               = useState<1 | 2>(1)
  const [currentUser, setCurrentUser] = useState<InitialUser | null>(initialUser)
  const [message, setMessage]         = useState('')
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  // ── Auth form ─────────────────────────────────────────────────────────────
  const [authTab, setAuthTab]           = useState<'login' | 'register'>('login')
  const [authName, setAuthName]         = useState('')
  const [authEmail, setAuthEmail]       = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError]       = useState<string | null>(null)

  // ── Multi-day detection ────────────────────────────────────────────────────
  const pkgDays    = selectedPkg?.days ?? null
  const isMultiDay = pkgDays != null && pkgDays > 1

  // ── Price ─────────────────────────────────────────────────────────────────
  // For fixed-duration packages, always use pkg.days — not selectedDates.length
  const days = isMultiDay ? pkgDays : (selectedDates.length > 0 ? selectedDates.length : 1)

  const subtotalEur = useMemo(() => {
    if (selectedPkg != null) {
      // Multi-day package: price_eur is the total for the whole package, not per-day
      const pricingDays = isMultiDay ? 1 : days
      return calcSubtotal(selectedPkg, guests, pricingDays)
    }
    return experience.price_per_person_eur * guests * days
  }, [selectedPkg, guests, days, isMultiDay, experience.price_per_person_eur])

  const serviceFeeEur = calcServiceFee(subtotalEur)
  const totalEur      = subtotalEur + serviceFeeEur

  // ── Date helpers ──────────────────────────────────────────────────────────
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  function toggleDate(d: string) {
    setSelectedDates(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  function handleDateSelect(d: string) {
    if (isMultiDay) {
      // Click current start → deselect; click new date → auto-fill consecutive range
      if (selectedDates[0] === d) setSelectedDates([])
      else setSelectedDates(expandRange(d, pkgDays!))
    } else {
      toggleDate(d)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // ── Calendar cells ────────────────────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const offset      = (firstDay + 6) % 7 // Monday = 0
    return [
      ...Array<null>(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
  }, [viewYear, viewMonth])

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    startTransition(async () => {
      const result = authTab === 'login'
        ? await signIn(authEmail, authPassword)
        : await signUp(authName, authEmail, authPassword)
      if ('error' in result) { setAuthError(result.error); return }
      setCurrentUser({ id: '', email: authEmail, name: authName })
    })
  }

  function handleSubmit() {
    if (selectedDates.length === 0) return
    startTransition(async () => {
      const sorted = [...selectedDates].sort()
      const result = await createDirectBooking({
        experienceId:    experience.id,
        bookingDate:     sorted[0],
        dateTo:          sorted[sorted.length - 1],
        requestedDates:  sorted,
        guests,
        packageLabel:    selectedPkg?.label ?? null,
        totalEur:        subtotalEur,
        specialRequests: message.trim() || null,
      })
      if (result.success) {
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({ event: 'form_submit' })
        if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout')
        setSuccessBookingId(result.bookingId)
      } else {
        setErrorMsg(result.error)
      }
    })
  }

  // ── Labels ────────────────────────────────────────────────────────────────
  const dateLabel =
    selectedDates.length === 0
      ? 'No dates selected'
      : selectedDates.length === 1
        ? fmtDate(selectedDates[0])
        : `${fmtDateShort(selectedDates[0])} – ${fmtDateShort(selectedDates[selectedDates.length - 1])} · ${selectedDates.length} days`

  const fromPrice = selectedPkg
    ? selectedPkg.pricing_type === 'per_person' ? `€${selectedPkg.price_eur}/pp`
      : selectedPkg.pricing_type === 'per_boat'   ? `€${selectedPkg.price_eur} flat`
      : `€${selectedPkg.price_eur}+`
    : `€${experience.price_per_person_eur}/pp`

  const location = [locationCity, locationCountry ? COUNTRY_NAMES[locationCountry] ?? locationCountry : null]
    .filter(Boolean).join(', ')

  // ── Input style helper ────────────────────────────────────────────────────
  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl text-sm f-body outline-none transition-all'
  const inputStyle = { background: '#F8FAFB', border: '1.5px solid rgba(10,46,77,0.12)', color: '#0A2E4D' }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#F3EDE4', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 flex items-center px-4 h-14"
        style={{
          background: 'rgba(243,237,228,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.07)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm f-body transition-opacity hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.65)' }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      </header>

      {/* ── Content ── */}
      <div className="max-w-[520px] mx-auto px-4 pt-5 pb-16">

        {/* ── Experience card ── */}
        <div
          className="rounded-2xl bg-white flex items-center gap-3 p-4 mb-4"
          style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
        >
          {/* Avatar */}
          {guideAvatarUrl != null ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={guideAvatarUrl}
              alt={guideName}
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(10,46,77,0.08)' }}
            >
              <span className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
                {guideName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>{guideName}</p>
            <p className="text-sm font-bold f-display leading-tight truncate" style={{ color: '#0A2E4D' }}>
              {experience.title}
            </p>
            {location && (
              <p className="text-xs f-body mt-0.5 flex items-center gap-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                <MapPin size={10} /> {location}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>From</p>
            <p className="text-base font-bold f-display" style={{ color: '#E67E50' }}>{fromPrice}</p>
          </div>
        </div>

        {/* ── SUCCESS ── */}
        {successBookingId != null && (
          <div
            className="rounded-3xl bg-white p-8 text-center"
            style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(22,163,74,0.1)' }}
            >
              <CheckCircle size={32} style={{ color: '#16A34A' }} />
            </div>
            <h2 className="text-2xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>Request sent!</h2>
            <p className="text-sm f-body mb-1" style={{ color: 'rgba(10,46,77,0.65)' }}>
              Your request has been sent to <strong>{guideName}</strong>.
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Check your email — the guide will respond within 48 hours.
            </p>
            <p className="text-[11px] font-mono f-body mb-6" style={{ color: 'rgba(10,46,77,0.3)' }}>
              Ref: {successBookingId.slice(0, 8).toUpperCase()}
            </p>
            <button
              type="button"
              onClick={() => router.push('/account/bookings')}
              className="w-full py-3.5 rounded-2xl text-sm font-bold f-body"
              style={{ background: '#0A2E4D', color: '#fff' }}
            >
              View my bookings →
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {successBookingId == null && errorMsg != null && (
          <div
            className="rounded-3xl bg-white p-6"
            style={{ border: '1px solid rgba(220,38,38,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} style={{ color: '#DC2626' }} />
              <span className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>Something went wrong</span>
            </div>
            <p className="text-sm f-body mb-4" style={{ color: 'rgba(10,46,77,0.6)' }}>{errorMsg}</p>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold f-body"
              style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
            >
              ← Try again
            </button>
          </div>
        )}

        {/* ── STEP 1 ── */}
        {successBookingId == null && errorMsg == null && step === 1 && (
          <div
            className="rounded-3xl bg-white overflow-hidden"
            style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
          >
            {/* Step heading */}
            <div className="px-6 pt-6 pb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] f-body mb-1.5"
                style={{ color: '#E67E50' }}>
                Step 1 of 2
              </p>
              <h2 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                Choose your dates
              </h2>
            </div>

            {/* ── Package selection ── */}
            {packages != null && packages.length > 0 && (
              <>
                <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
                <div className="px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] f-body mb-3"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Package
                  </p>
                  <div className="space-y-2">
                    {packages.map(pkg => {
                      const isSelected = selectedPkg?.label === pkg.label
                      const priceStr = pkg.pricing_type === 'per_person' ? `€${pkg.price_eur}`
                        : pkg.pricing_type === 'per_boat' ? `€${pkg.price_eur}`
                        : `€${pkg.price_eur}`
                      const pricingLabel = pkg.pricing_type === 'per_person' ? 'per person'
                        : pkg.pricing_type === 'per_boat' ? 'per boat' : 'per group'
                      const durStr = pkg.hours != null ? `${pkg.hours} h`
                        : pkg.days != null ? `${pkg.days} day${pkg.days > 1 ? 's' : ''}` : ''

                      return (
                        <button
                          key={pkg.label}
                          type="button"
                          onClick={() => { setSelectedPkg(pkg); setSelectedDates([]) }}
                          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all text-left"
                          style={{
                            background: isSelected ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                            border: `1px solid ${isSelected ? '#0A2E4D' : 'rgba(10,46,77,0.08)'}`,
                            boxShadow: isSelected ? '0 4px 12px rgba(10,46,77,0.2)' : 'none',
                          }}
                        >
                          <div>
                            <p className="text-sm font-bold f-display"
                              style={{ color: isSelected ? '#fff' : '#0A2E4D' }}>
                              {pkg.label}
                            </p>
                            {durStr && (
                              <p className="text-xs f-body mt-0.5"
                                style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.45)' }}>
                                {durStr}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold f-display"
                              style={{ color: isSelected ? '#E67E50' : '#0A2E4D' }}>
                              {priceStr}
                            </p>
                            <p className="text-[10px] f-body"
                              style={{ color: isSelected ? 'rgba(255,255,255,0.45)' : 'rgba(10,46,77,0.4)' }}>
                              {pricingLabel}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Calendar ── */}
            <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
            <div className="px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] f-body mb-1 f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                {isMultiDay ? 'Start date' : 'Dates'}
              </p>
              {isMultiDay && (
                <p className="text-xs f-body mb-4" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  Pick when you want to start — the trip runs for {pkgDays} consecutive days
                </p>
              )}

              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} style={{ color: '#0A2E4D' }} />
                </button>

                <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>{monthName}</p>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} style={{ color: '#0A2E4D' }} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-semibold f-body py-1"
                    style={{ color: 'rgba(10,46,77,0.28)' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calendarCells.map((day, i) => {
                  if (day == null) return <div key={`e-${i}`} />

                  const d           = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isPast      = d < today
                  const blocked     = isBlocked(d, blockedRanges)
                  const rangeWouldBlock = isMultiDay && !blocked && !isPast && isRangeBlocked(d, pkgDays!, blockedRanges)
                  const disabled    = isPast || blocked || rangeWouldBlock
                  const isRangeStart = isMultiDay && selectedDates[0] === d
                  const isRangeIn   = isMultiDay && selectedSet.has(d) && !isRangeStart
                  const selected    = selectedSet.has(d)
                  const isToday     = d === today
                  const available   = !disabled

                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && handleDateSelect(d)}
                      className="aspect-square flex items-center justify-center rounded-md relative transition-all text-sm f-body"
                      style={{
                        background:
                          isRangeStart ? '#0A2E4D'
                          : isRangeIn  ? 'rgba(10,46,77,0.10)'
                          : selected   ? '#E67E50'
                          : available  ? 'rgba(22,163,74,0.08)'
                          : 'rgba(10,46,77,0.03)',
                        color:
                          disabled     ? 'rgba(10,46,77,0.2)'
                          : isRangeStart ? '#fff'
                          : isRangeIn  ? '#0A2E4D'
                          : selected   ? '#fff'
                          : '#0A2E4D',
                        fontWeight:  isRangeStart || selected ? '700' : isToday ? '700' : '400',
                        cursor:      disabled ? 'not-allowed' : 'pointer',
                        border:      isToday && !selected && !isRangeStart && !isRangeIn ? '1.5px solid rgba(10,46,77,0.25)' : '1.5px solid transparent',
                        boxShadow:   isRangeStart ? '0 2px 8px rgba(10,46,77,0.25)' : selected ? '0 2px 8px rgba(230,126,80,0.35)' : 'none',
                        borderRadius: isRangeStart ? '8px' : isRangeIn ? '4px' : '6px',
                      }}
                      aria-label={d}
                      aria-pressed={selected || isRangeStart}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Selection count + clear */}
              <div className="flex items-center justify-between mt-4 pt-3"
                style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {selectedDates.length === 0
                    ? isMultiDay
                      ? `Tap a start date · ${pkgDays} days auto-selected`
                      : 'Tap dates to select'
                    : isMultiDay
                      ? `${fmtDateShort(selectedDates[0])} → ${fmtDateShort(selectedDates[selectedDates.length - 1])}`
                      : `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected`}
                </span>
                {selectedDates.length > 0 && (
                  <button type="button" onClick={() => setSelectedDates([])}
                    className="text-sm f-body font-semibold"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* ── Anglers stepper ── */}
            <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
            <div className="px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] f-body mb-3"
                style={{ color: 'rgba(10,46,77,0.4)' }}>
                Anglers
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setGuests(g => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
                  style={{
                    background: guests <= 1 ? 'rgba(10,46,77,0.04)' : 'rgba(10,46,77,0.08)',
                    color: guests <= 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
                  }}
                  aria-label="Remove angler"
                >
                  <Minus size={14} />
                </button>
                <span className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>
                  {guests} {guests === 1 ? 'angler' : 'anglers'}
                </span>
                <button
                  type="button"
                  onClick={() => setGuests(g => Math.min(experience.max_guests, g + 1))}
                  disabled={guests >= experience.max_guests}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
                  style={{
                    background: guests >= experience.max_guests ? 'rgba(10,46,77,0.04)' : 'rgba(10,46,77,0.08)',
                    color: guests >= experience.max_guests ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
                  }}
                  aria-label="Add angler"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* ── Price + CTA ── */}
            <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
            <div className="px-6 py-5">
              {/* Price rows */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm f-body">
                  <span style={{ color: 'rgba(10,46,77,0.5)' }}>
                    {selectedPkg != null
                      ? `${selectedPkg.label}${selectedPkg.pricing_type === 'per_person' ? ` × ${guests}` : ''}${!isMultiDay && days > 1 ? ` × ${days}d` : ''}`
                      : `€${experience.price_per_person_eur}/pp × ${guests} × ${days}d`
                    }
                  </span>
                  <span style={{ color: '#0A2E4D' }}>{fmtEur(subtotalEur)}</span>
                </div>
                <div className="flex justify-between text-sm f-body">
                  <span style={{ color: 'rgba(10,46,77,0.5)' }}>
                    Service fee (5%{serviceFeeEur >= 50 ? ', capped' : ''})
                  </span>
                  <span style={{ color: '#0A2E4D' }}>+{fmtEur(serviceFeeEur)}</span>
                </div>
                <div
                  className="flex justify-between text-base font-bold f-body pt-3"
                  style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
                >
                  <span style={{ color: '#0A2E4D' }}>Estimated total</span>
                  <span style={{ color: '#E67E50' }}>{fmtEur(totalEur)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={selectedDates.length === 0}
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl text-sm font-bold f-body transition-all"
                style={{
                  background:  selectedDates.length > 0 ? '#E67E50' : 'rgba(10,46,77,0.07)',
                  color:       selectedDates.length > 0 ? '#fff'    : 'rgba(10,46,77,0.3)',
                  boxShadow:   selectedDates.length > 0 ? '0 4px 14px rgba(230,126,80,0.3)' : 'none',
                  cursor:      selectedDates.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                {selectedDates.length > 0 ? 'Continue →' : 'Select dates to continue'}
              </button>

              {/* Trust signals */}
              <div className="mt-4 space-y-1.5">
                {[
                  'No card or payment needed to request',
                  'Guide confirms or declines within 48 hours',
                  'Pay directly with the guide after confirmation',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgba(10,46,77,0.25)' }} />
                    <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {successBookingId == null && errorMsg == null && step === 2 && (
          <div
            className="rounded-3xl bg-white overflow-hidden"
            style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
          >
            {/* Heading */}
            <div className="px-6 pt-6 pb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] f-body mb-1.5"
                style={{ color: '#E67E50' }}>
                Step 2 of 2
              </p>
              <h2 className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                {currentUser != null ? 'Almost there' : 'Sign in to continue'}
              </h2>
            </div>

            {/* Compact order summary */}
            <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
            <div className="px-6 py-4">
              <div
                className="rounded-2xl px-4 py-3 flex items-start justify-between"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {isMultiDay ? (
                      <span
                        className="text-xs f-body font-semibold px-2 py-1 rounded-md"
                        style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>
                        {fmtDateShort(selectedDates[0])} → {fmtDateShort(selectedDates[selectedDates.length - 1])} · {pkgDays} days
                      </span>
                    ) : (
                      selectedDates.map(d => (
                        <span key={d}
                          className="text-xs f-body font-semibold px-2 py-1 rounded-md"
                          style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>
                          {fmtDateShort(d)}
                        </span>
                      ))
                    )}
                  </div>
                  {selectedPkg != null && (
                    <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>{selectedPkg.label}</p>
                  )}
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    {guests} {guests === 1 ? 'angler' : 'anglers'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-base font-bold f-body" style={{ color: '#E67E50' }}>{fmtEur(totalEur)}</p>
                  <button type="button" onClick={() => setStep(1)}
                    className="text-[11px] f-body mt-0.5"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>
                    Edit ←
                  </button>
                </div>
              </div>
            </div>

            {/* Form area */}
            <div style={{ height: '1px', background: 'rgba(10,46,77,0.06)' }} />
            <div className="px-6 pb-6 pt-5">
              {currentUser == null ? (
                // ── Auth form ──
                <>
                  <div
                    className="flex rounded-xl p-0.5 mb-5"
                    style={{ background: 'rgba(10,46,77,0.06)' }}
                  >
                    {(['login', 'register'] as const).map(tab => (
                      <button key={tab} type="button"
                        onClick={() => { setAuthTab(tab); setAuthError(null) }}
                        className="flex-1 text-xs font-medium py-2 rounded-lg transition-all f-body"
                        style={authTab === tab
                          ? { background: '#0A2E4D', color: '#fff', fontWeight: '600', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                          : { color: 'rgba(10,46,77,0.5)' }}>
                        {tab === 'login' ? 'Sign in' : 'Create account'}
                      </button>
                    ))}
                  </div>

                  {authError != null && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-xs f-body mb-4"
                      style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}
                    >
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 f-body"
                          style={{ color: 'rgba(10,46,77,0.6)' }}>Full name</label>
                        <input type="text" autoComplete="name" required value={authName}
                          onChange={e => setAuthName(e.target.value)}
                          placeholder="Your name"
                          className={inputCls} style={inputStyle}
                          onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 f-body"
                        style={{ color: 'rgba(10,46,77,0.6)' }}>Email address</label>
                      <input type="email" autoComplete="email" required value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputCls} style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 f-body"
                        style={{ color: 'rgba(10,46,77,0.6)' }}>Password</label>
                      <input type="password"
                        autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                        required value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        placeholder={authTab === 'login' ? '········' : 'Min 8 characters'}
                        className={inputCls} style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')} />
                    </div>
                    <button type="submit" disabled={isPending}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold f-body mt-1 flex items-center justify-center gap-2"
                      style={{
                        background: '#E67E50', color: '#fff',
                        boxShadow: '0 4px 14px rgba(230,126,80,0.28)',
                        opacity: isPending ? 0.7 : 1,
                      }}>
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {authTab === 'login' ? 'Sign in & continue →' : 'Create account & continue →'}
                    </button>
                  </form>
                </>
              ) : (
                // ── Contact form (logged in) ──
                <>
                  {/* User info */}
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
                    style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
                  >
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                        {currentUser.name || currentUser.email}
                      </p>
                      <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {currentUser.email}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 ml-3" style={{ background: '#16A34A' }} />
                  </div>

                  {/* Message */}
                  <div className="mb-5">
                    <label className="block text-xs font-semibold mb-1.5 f-body"
                      style={{ color: 'rgba(10,46,77,0.6)' }}>
                      Message to guide{' '}
                      <span style={{ fontWeight: '400', color: 'rgba(10,46,77,0.35)' }}>(optional)</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={4}
                      placeholder="Introduce yourself, describe your experience level, any special needs…"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm f-body outline-none resize-none transition-all"
                      style={{ ...inputStyle, lineHeight: '1.55' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#E67E50')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                    />
                  </div>

                  <button type="button" disabled={isPending} onClick={handleSubmit}
                    className="w-full py-4 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2"
                    style={{
                      background: '#E67E50', color: '#fff',
                      boxShadow: '0 4px 14px rgba(230,126,80,0.28)',
                      opacity: isPending ? 0.7 : 1,
                    }}>
                    {isPending && <Loader2 size={14} className="animate-spin" />}
                    Send Booking Request →
                  </button>

                  <p className="text-[11px] f-body text-center mt-3"
                    style={{ color: 'rgba(10,46,77,0.35)' }}>
                    No payment now — booking fee is due after the guide confirms your dates.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
