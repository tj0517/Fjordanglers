'use client'

/**
 * BookingRespondForm — guide accepts or declines a pending direct booking.
 *
 * Layout:
 *  • Action choice → two big Accept / Decline cards (narrow, centred)
 *  • Accept form   → two-column layout matching OfferModal:
 *                    dark left panel with booking brief + form on the right
 *  • Decline form  → single-column form (reason + optional alternatives)
 *
 * No review step — both paths submit directly.
 */

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { acceptBooking, declineBooking } from '@/actions/bookings'
import RespondCalendar, { fmtDate, fmtShort } from './RespondCalendar'
import type { WeeklySchedule, BlockedRange } from './RespondCalendar'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Calendar, Check, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingRespondFormProps = {
  bookingId:             string
  anglerName:            string
  anglerEmail:           string
  anglerCountry:         string | null
  experienceTitle:       string
  experienceId:          string | null
  coverUrl:              string | null
  windowFrom:            string
  /** All dates the angler originally requested (from requested_dates column) */
  anglerRequestedDates?: string[]
  durationOption:        string | null
  guests:                number
  totalEur:              number
  depositEur:            number | null
  pricePerPersonEur:     number | null
  specialRequests:       string | null
  guideWeeklySchedules:  WeeklySchedule[]
  blockedDates:          BlockedRange[]
  /** Kept for backward compat — unused; modal is managed by RespondBookingWidget */
  mode?:                 'page' | 'inline'
  /** Kept for backward compat — unused in new design */
  onClose?:              () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * When booking came via "Send request", `requested_dates` contains every
 * individual date in the angler's availability window (expanded from the
 * selected periods). The first element is `windowFrom`; the last is `windowTo`.
 *
 * Returns null for single-date (direct) bookings where length <= 1.
 */
function deriveWindowTo(windowFrom: string, requestedDates?: string[]): string | null {
  if (!requestedDates || requestedDates.length <= 1) return null
  const candidate = requestedDates[requestedDates.length - 1]
  return candidate !== windowFrom ? candidate : null
}

function deriveNumDays(durationOption: string | null): number | null {
  if (!durationOption) return null
  const m = durationOption.match(/(\d+)\s*days?/i)
  return m ? parseInt(m[1], 10) : null
}

// ─── Shared form styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.12)',
  borderRadius: '12px', padding: '10px 13px', fontSize: '14px', color: '#0A2E4D', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '0.18em',
  color: 'rgba(10,46,77,0.45)', marginBottom: '6px',
}

// ─── Dark left panel sub-components ──────────────────────────────────────────

function PanelSection({
  title, children, last = false,
}: {
  title: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div
      className="px-5 py-4 flex flex-col gap-2 flex-shrink-0"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
    >
      <p
        className="text-[9px] uppercase tracking-[0.24em] font-bold f-body"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function PanelRow({ value, muted = false }: { value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="w-1 h-1 rounded-full flex-shrink-0 mt-[6px]"
        style={{ background: muted ? 'rgba(255,255,255,0.2)' : 'rgba(230,126,80,0.7)' }}
      />
      <p
        className="text-[12px] f-body leading-snug"
        style={{ color: muted ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.78)' }}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm f-body"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }}
    >
      {message}
    </div>
  )
}

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({
  variant, title, description, cta, onClick,
}: {
  variant: 'accept' | 'decline'
  title: string
  description: string
  cta: string
  onClick: () => void
}) {
  const isAcc = variant === 'accept'
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-6 rounded-3xl transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: isAcc ? 'rgba(22,163,74,0.05)' : 'rgba(239,68,68,0.04)',
        border: `2px solid ${isAcc ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.15)'}`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: isAcc ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.1)' }}
      >
        {isAcc
          ? <Check size={20} strokeWidth={2.2} style={{ color: '#16A34A' }} />
          : <X     size={20} strokeWidth={2.2} style={{ color: '#DC2626' }} />}
      </div>
      <h3
        className="text-base font-bold f-display mb-1.5"
        style={{ color: isAcc ? '#16A34A' : '#B91C1C' }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] f-body leading-relaxed mb-4"
        style={{ color: 'rgba(10,46,77,0.6)' }}
      >
        {description}
      </p>
      <span
        className="text-sm font-semibold f-body"
        style={{ color: isAcc ? '#16A34A' : '#B91C1C' }}
      >
        {cta}
      </span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingRespondForm({
  bookingId, anglerName, anglerEmail: _e, anglerCountry,
  experienceTitle, experienceId: _ei, coverUrl: _c,
  windowFrom, anglerRequestedDates, durationOption,
  guests, totalEur, depositEur, pricePerPersonEur,
  specialRequests, guideWeeklySchedules, blockedDates,
}: BookingRespondFormProps) {
  // ── Derive request-booking metadata ──────────────────────────────────────
  const effectiveWindowTo = deriveWindowTo(windowFrom, anglerRequestedDates)
  const effectiveNumDays  = deriveNumDays(durationOption)
  const isRequestBooking  = effectiveWindowTo != null

  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Action state (no phase wizard) ───────────────────────────────────────
  const [action, setAction] = useState<'accept' | 'decline' | null>(null)

  // ── Accept form state ─────────────────────────────────────────────────────
  const [confirmedDays, setConfirmedDays] = useState<string[]>([])
  const [guideNote,     setGuideNote]     = useState('')
  const [error,         setError]         = useState<string | null>(null)

  // Price — auto-calculated from days × price/person × guests (+5% service)
  function computeDefaultPrice(numDays: number): number {
    if (pricePerPersonEur != null && pricePerPersonEur > 0 && guests > 0) {
      return Math.round(pricePerPersonEur * guests * numDays * 1.05)
    }
    return totalEur
  }
  const initialDays = effectiveNumDays ?? 1
  const [priceInput, setPriceInput]  = useState<string>(String(computeDefaultPrice(initialDays)))
  const priceManuallyEdited          = useRef(false)

  useEffect(() => {
    if (priceManuallyEdited.current) return
    if (confirmedDays.length > 0) {
      setPriceInput(String(computeDefaultPrice(confirmedDays.length)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedDays.length])

  // ── Decline form state ────────────────────────────────────────────────────
  const [declineReason, setDeclineReason] = useState('')
  const [proposeAlts,   setProposeAlts]   = useState(false)
  const [altFrom,       setAltFrom]       = useState<string | null>(null)
  const [altTo,         setAltTo]         = useState<string | null>(null)

  function goBack() {
    setAction(null)
    setError(null)
    setConfirmedDays([])
    setGuideNote('')
    setDeclineReason('')
    setProposeAlts(false)
    setAltFrom(null)
    setAltTo(null)
    priceManuallyEdited.current = false
    setPriceInput(String(computeDefaultPrice(initialDays)))
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const parsedPrice = parseFloat(priceInput)
      const r = await acceptBooking(bookingId, {
        confirmedDays:  confirmedDays.length > 0 ? confirmedDays : undefined,
        guideNote:      guideNote.trim() || undefined,
        customTotalEur: !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
      })
      if (r.error) { setError(r.error); return }
      router.push(`/dashboard/bookings/${bookingId}?responded=true`)
    })
  }

  function handleDecline() {
    setError(null)
    if (proposeAlts && (!altFrom || !altTo)) {
      setError('Please select both start and end dates for the alternative period.')
      return
    }
    startTransition(async () => {
      const r = await declineBooking(
        bookingId,
        declineReason.trim() || undefined,
        proposeAlts && altFrom && altTo ? { from: altFrom, to: altTo } : undefined,
      )
      if (r.error) { setError(r.error); return }
      router.push(`/dashboard/bookings/${bookingId}?responded=true`)
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 1. Action choice phase ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (action === null) {
    const dateLabel = isRequestBooking
      ? `${fmtShort(windowFrom)} – ${fmtShort(effectiveWindowTo!)}${effectiveNumDays ? ` · ${effectiveNumDays} days` : ''}`
      : anglerRequestedDates && anglerRequestedDates.length > 1
        ? `${anglerRequestedDates.length} dates from ${fmtShort(windowFrom)}`
        : `${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`

    return (
      <div className="px-5 py-5 max-w-[580px]">

        <div className="mb-5">
          <p
            className="text-[11px] uppercase tracking-[0.22em] f-body mb-1"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            New booking request
          </p>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {experienceTitle} · {guests} {guests === 1 ? 'guest' : 'guests'} · {dateLabel} · €{totalEur}
          </p>
        </div>

        {/* Availability window chip — request bookings only */}
        {isRequestBooking && (
          <div
            className="mb-5 flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.16)' }}
          >
            <Calendar size={13} strokeWidth={1.5} className="shrink-0" style={{ color: '#2563EB' }} />
            <p className="text-[12px] f-body" style={{ color: '#2563EB' }}>
              <span className="font-bold">Availability window:</span>{' '}
              {fmtShort(windowFrom)} – {fmtShort(effectiveWindowTo!)}
              {effectiveNumDays != null && (
                <span className="font-semibold">
                  {' '}· wants <strong>{effectiveNumDays} {effectiveNumDays === 1 ? 'day' : 'days'}</strong>
                </span>
              )}
            </p>
          </div>
        )}

        {/* Special requests preview */}
        {specialRequests != null && (
          <div
            className="mb-5 p-4 rounded-2xl"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
          >
            <p
              className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body font-bold"
              style={{ color: 'rgba(59,130,246,0.7)' }}
            >
              Special requests
            </p>
            <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>
              {specialRequests}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard
            variant="accept"
            title="Accept booking"
            description="Confirm you can take this trip. Pick the exact dates and add a personal note."
            cta="Accept & set date →"
            onClick={() => { setAction('accept'); setError(null) }}
          />
          <ActionCard
            variant="decline"
            title="Decline booking"
            description="Can't take this trip. Explain why and propose alternative dates."
            cta="Decline & respond →"
            onClick={() => { setAction('decline'); setError(null) }}
          />
        </div>

      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 2. Accept form — dark-panel + form (OfferModal style) ─────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'accept') {
    const whenLabel = isRequestBooking
      ? `${fmtShort(windowFrom)} – ${fmtShort(effectiveWindowTo!)}`
      : anglerRequestedDates && anglerRequestedDates.length > 1
        ? `${anglerRequestedDates.length} dates from ${fmtShort(windowFrom)}`
        : fmtShort(windowFrom)

    const tripDaysLabel = isRequestBooking && effectiveNumDays
      ? `wants ${effectiveNumDays} ${effectiveNumDays === 1 ? 'day' : 'days'}`
      : durationOption ?? null

    return (
      <div className="relative flex flex-col sm:flex-row min-h-[420px]">
        {isPending && <LoadingOverlay rounded="rounded-none" />}

        {/* ── LEFT: dark brief panel (desktop only) ──────────────────────── */}
        <div
          className="hidden sm:flex flex-col flex-shrink-0 overflow-y-auto"
          style={{
            width:       300,
            background:  '#07192A',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Angler identity */}
          <div
            className="px-5 py-5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold f-display mb-3"
              style={{ background: '#E67E50', color: 'white' }}
            >
              {anglerName[0]?.toUpperCase() ?? '?'}
            </div>
            <p className="text-[15px] font-bold f-display leading-snug" style={{ color: 'white' }}>
              {anglerName}
            </p>
            {anglerCountry && (
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {anglerCountry}
              </p>
            )}
          </div>

          {/* When */}
          <PanelSection title="When">
            <PanelRow value={whenLabel} />
            {tripDaysLabel && <PanelRow value={tripDaysLabel} muted />}
          </PanelSection>

          {/* Group */}
          <PanelSection title="Group">
            <PanelRow value={`${guests} ${guests === 1 ? 'angler' : 'anglers'}`} />
            <PanelRow value={experienceTitle} muted />
          </PanelSection>

          {/* Trip value */}
          <PanelSection title="Trip value">
            <PanelRow value={`€${totalEur}`} />
            {depositEur != null && <PanelRow value={`€${depositEur} deposit (40%)`} muted />}
          </PanelSection>

          {/* Special requests */}
          {specialRequests != null && (
            <PanelSection title="Special requests" last>
              <p
                className="text-[12px] f-body leading-relaxed whitespace-pre-wrap"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {specialRequests}
              </p>
            </PanelSection>
          )}
        </div>

        {/* ── RIGHT: form ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 min-h-0">

          {/* Calendar — date picker */}
          <div>
            <p style={labelStyle}>
              {isRequestBooking ? 'Select exact days from window' : 'Confirm trip days'}
              <span
                className="ml-1 normal-case tracking-normal font-normal"
                style={{ color: 'rgba(10,46,77,0.35)' }}
              >
                {isRequestBooking
                  ? '— click days within the angler\'s window'
                  : '(optional — click to select, click again to deselect)'}
              </span>
            </p>
            <RespondCalendar
              calMode="multi"
              anglerWindowFrom={windowFrom}
              anglerWindowTo={effectiveWindowTo}
              anglerNumDays={effectiveNumDays}
              anglerDates={anglerRequestedDates}
              weeklySchedules={guideWeeklySchedules}
              blockedDates={blockedDates}
              selectedDays={confirmedDays}
              onMultiChange={setConfirmedDays}
              disabled={isPending}
            />
            {confirmedDays.length > 0 && (
              <div
                className="mt-2 flex items-center gap-1.5 text-xs f-body font-semibold px-2.5 py-1 rounded-full w-fit"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}
              >
                <Check size={10} strokeWidth={1.8} />
                {confirmedDays.length} day{confirmedDays.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Total price (angler pays) *</label>
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                €
              </span>
              <input
                type="number" step="1" min="1"
                value={priceInput}
                onChange={e => { setPriceInput(e.target.value); priceManuallyEdited.current = true }}
                disabled={isPending}
                className="f-body"
                style={{ ...inputStyle, paddingLeft: '26px' }}
                aria-label="Total price in EUR"
              />
            </div>
            {pricePerPersonEur != null && confirmedDays.length > 0 && (
              <p className="mt-1.5 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Based on {confirmedDays.length} day{confirmedDays.length !== 1 ? 's' : ''} × €{pricePerPersonEur}/person × {guests} pax
              </p>
            )}
          </div>

          {/* Message */}
          <div>
            <label style={labelStyle}>
              Message to angler
              <span
                className="ml-1 normal-case tracking-normal font-normal"
                style={{ color: 'rgba(10,46,77,0.35)' }}
              >
                (optional)
              </span>
            </label>
            <textarea
              rows={3}
              placeholder="Add details: what to bring, meeting point, schedule…"
              value={guideNote}
              onChange={e => setGuideNote(e.target.value)}
              disabled={isPending}
              className="f-body resize-none"
              style={{ ...inputStyle, height: 'auto' }}
            />
          </div>

          {error != null && <ErrorBanner message={error} />}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1 pb-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={isPending}
              className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#16A34A' }}
            >
              {isPending ? 'Accepting…' : '✓ Accept booking'}
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={isPending}
              className="px-5 py-3.5 rounded-2xl text-sm f-body font-semibold transition-colors hover:opacity-70 disabled:opacity-40"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              Back
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 3. Decline form ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="relative px-5 py-5 max-w-[580px] flex flex-col gap-4">
      {isPending && <LoadingOverlay rounded="rounded-[28px]" />}

      {/* Decline reason */}
      <div>
        <label style={labelStyle}>
          Reason for declining
          <span
            className="ml-1 normal-case tracking-normal font-normal"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            (optional)
          </span>
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Already booked for those dates…"
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          disabled={isPending}
          className="f-body resize-none"
          style={{ ...inputStyle, height: 'auto' }}
        />
      </div>

      {/* Propose alternatives toggle */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p style={{ ...labelStyle, marginBottom: 4 }}>Propose alternative dates</p>
            <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              Show the angler when you ARE available — an automatic message will be sent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setProposeAlts(v => !v)
              if (proposeAlts) { setAltFrom(null); setAltTo(null) }
            }}
            disabled={isPending}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5"
            style={{ background: proposeAlts ? '#1B4F72' : 'rgba(10,46,77,0.15)' }}
            aria-pressed={proposeAlts}
          >
            <span
              className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: proposeAlts ? 'translateX(24px)' : 'translateX(4px)' }}
            />
          </button>
        </div>

        {proposeAlts && (
          <div className="flex flex-col gap-4">
            <RespondCalendar
              calMode="range"
              anglerWindowFrom={windowFrom}
              anglerWindowTo={effectiveWindowTo}
              anglerNumDays={effectiveNumDays}
              anglerDates={anglerRequestedDates}
              weeklySchedules={guideWeeklySchedules}
              blockedDates={blockedDates}
              selectedFrom={altFrom}
              selectedTo={altTo}
              onChange={(f, t) => { setAltFrom(f); setAltTo(t) }}
              disabled={isPending}
            />

            {altFrom != null && altTo != null && (
              <div
                className="p-4 rounded-xl"
                style={{ background: 'rgba(27,79,114,0.04)', border: '1.5px dashed rgba(27,79,114,0.22)' }}
              >
                <p style={{ ...labelStyle, marginBottom: '8px', color: 'rgba(27,79,114,0.65)' }}>
                  Auto-message preview
                </p>
                <p
                  className="text-[12px] f-body leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'rgba(10,46,77,0.65)' }}
                >
                  {declineReason.trim()
                    ? `Unfortunately those dates don't work for me — ${declineReason.trim().replace(/\.$/, '')}.\n\n`
                    : `Unfortunately I'm unable to take the booking for those dates.\n\n`}
                  {'📅 I\'m available on: '}
                  {altFrom === altTo ? fmtDate(altFrom) : `${fmtDate(altFrom)} – ${fmtDate(altTo)}`}
                  {'\n\nFeel free to send a new booking request or message me here.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error != null && <ErrorBanner message={error} />}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecline}
          disabled={isPending}
          className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#DC2626' }}
        >
          {isPending ? 'Declining…' : '✗ Decline booking'}
        </button>
        <button
          type="button"
          onClick={goBack}
          disabled={isPending}
          className="px-5 py-3.5 rounded-2xl text-sm f-body font-semibold transition-colors hover:opacity-70 disabled:opacity-40"
          style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
        >
          Back
        </button>
      </div>
    </div>
  )
}
