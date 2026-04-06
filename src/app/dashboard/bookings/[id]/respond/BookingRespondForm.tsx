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
 * Accept path: form → review screen → confirm (with loading screen while in-flight).
 * Decline path: form → confirm (with loading screen while in-flight).
 */

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { acceptBooking, declineBooking } from '@/actions/bookings'
import RespondCalendar, { fmtDate, fmtShort } from './RespondCalendar'
import type { WeeklySchedule, BlockedRange } from './RespondCalendar'
import { Calendar, Check, MapPin, X } from 'lucide-react'

const LocationPickerMap = dynamic(
  () => import('@/components/trips/location-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 220, borderRadius: 12, background: 'rgba(10,46,77,0.04)' }}
        className="animate-pulse"
      />
    ),
  },
)

// Country → approximate centre coordinates for map initialisation
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  NO: [65.5, 13.5],
  SE: [63.0, 16.0],
  DK: [56.0, 10.0],
  FI: [64.5, 26.0],
  IS: [65.0, -18.5],
  HR: [45.5, 16.5],
  PL: [52.0, 19.0],
  DE: [51.0, 10.0],
  FR: [46.5,  2.5],
  GB: [54.0,  -2.0],
  ES: [40.5,  -3.7],
}

// Full country name → ISO code (as stored in experience.location_country)
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'Norway':         'NO',
  'Sweden':         'SE',
  'Finland':        'FI',
  'Denmark':        'DK',
  'Iceland':        'IS',
  'Croatia':        'HR',
  'Germany':        'DE',
  'Poland':         'PL',
  'France':         'FR',
  'United Kingdom': 'GB',
  'Spain':          'ES',
  'Austria':        'AT',
  'Czech Republic': 'CZ',
  'Slovakia':       'SK',
  'Slovenia':       'SI',
  'Romania':        'RO',
}

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
  /**
   * 'direct' — angler booked a specific experience with fixed dates & price.
   *            Dates are pre-selected and locked. Price is not editable.
   * 'inquiry' — angler sent a request with a date window. Guide picks dates & price.
   */
  bookingSource:         'direct' | 'inquiry'
  /**
   * Pre-select which action the guide clicked on the trigger card.
   * When set, the form skips the action-choice phase and opens directly.
   */
  initialAction?:        'accept' | 'decline' | null
  /** Guide's operating country ISO code (e.g. 'NO') — fallback for the location map centre. */
  guideCountry?:         string
  /**
   * Full country name from experience.location_country (e.g. 'Iceland').
   * When provided, takes priority over guideCountry for centering the map.
   */
  tripLocationCountry?:  string | null
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

// ─── BookingReviewRow — used in the accept review screen ─────────────────────

function BookingReviewRow({
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

export default function BookingRespondForm({
  bookingId, anglerName, anglerEmail: _e, anglerCountry,
  experienceTitle, experienceId: _ei, coverUrl: _c,
  windowFrom, anglerRequestedDates, durationOption,
  guests, totalEur, depositEur, pricePerPersonEur,
  specialRequests, guideWeeklySchedules, blockedDates,
  bookingSource, initialAction = null, guideCountry, tripLocationCountry,
}: BookingRespondFormProps) {
  // ── Derive request-booking metadata ──────────────────────────────────────
  const effectiveWindowTo = deriveWindowTo(windowFrom, anglerRequestedDates)
  const effectiveNumDays  = deriveNumDays(durationOption)
  const isRequestBooking  = effectiveWindowTo != null
  const isDirect          = bookingSource === 'direct'

  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Action state — seed from initialAction to skip the choice phase ───────
  const [action, setAction] = useState<'accept' | 'decline' | null>(initialAction ?? null)

  // ── Accept form state ─────────────────────────────────────────────────────
  //
  // Direct bookings: dates are pre-selected from the angler's request and locked.
  // Inquiry bookings: guide picks dates from the availability window.
  const initialConfirmedDays: string[] = isDirect
    ? (anglerRequestedDates && anglerRequestedDates.length > 0
        ? anglerRequestedDates
        : [windowFrom])
    : []

  const [confirmedDays, setConfirmedDays] = useState<string[]>(initialConfirmedDays)
  const [guideNote,     setGuideNote]     = useState('')
  const [error,         setError]         = useState<string | null>(null)

  // Price input — only used for inquiry bookings (direct price is fixed / not editable).
  // Shows the guide's trip price WITHOUT the 5% service fee — that fee is charged to the
  // angler on top and is not the guide's concern.
  function computeDefaultPrice(numDays: number): number {
    if (pricePerPersonEur != null && pricePerPersonEur > 0 && guests > 0) {
      return Math.round(pricePerPersonEur * guests * numDays)
    }
    return totalEur
  }
  const initialDays = effectiveNumDays ?? 1
  const [priceInput, setPriceInput]  = useState<string>(String(computeDefaultPrice(initialDays)))
  const priceManuallyEdited          = useRef(false)

  useEffect(() => {
    if (isDirect) return                      // price is locked for direct bookings
    if (priceManuallyEdited.current) return
    if (confirmedDays.length > 0) {
      setPriceInput(String(computeDefaultPrice(confirmedDays.length)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedDays.length])

  // ── Location state (accept form) ─────────────────────────────────────────
  const [locationText, setLocationText] = useState('')
  // Map starts centred on the trip's country (from experience.location_country, full name).
  // Falls back to the guide's operating country (ISO code), then to Scandinavia default.
  const tripCountryCentre: [number, number] | null =
    tripLocationCountry != null
      ? (COUNTRY_CENTERS[COUNTRY_NAME_TO_ISO[tripLocationCountry] ?? ''] ?? null)
      : null
  const guideCountryCentre: [number, number] | null =
    guideCountry != null ? (COUNTRY_CENTERS[guideCountry] ?? null) : null
  const [meetLat, setMeetLat] = useState<number | null>(null)
  const [meetLng, setMeetLng] = useState<number | null>(null)
  const [isRevGeocoding, setIsRevGeocoding] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  // Initial map centre (no pin yet — just flies there on first render)
  const mapDefaultCenter: [number, number] =
    tripCountryCentre ?? guideCountryCentre ?? [63.5, 14.0]

  // Accept form review step: 'form' → fill in details, 'review' → preview before sending
  const [step, setStep] = useState<'form' | 'review'>('form')

  // ── Decline form state ────────────────────────────────────────────────────
  const [declineReason, setDeclineReason] = useState('')
  const [proposeAlts,   setProposeAlts]   = useState(false)
  const [altFrom,       setAltFrom]       = useState<string | null>(null)
  const [altTo,         setAltTo]         = useState<string | null>(null)

  function goBack() {
    setAction(null)
    setStep('form')
    setError(null)
    setConfirmedDays(initialConfirmedDays)
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
      let customTotalEur: number | undefined
      if (isDirect) {
        // Direct bookings: do NOT pass customTotalEur.
        // acceptBooking() uses the confirmedDays array to recalculate price from
        // experience.price_per_person_eur × guests × confirmedDays.length (+ 5% service fee).
        //
        // REASON: computeDefaultPrice() returns the SUBTOTAL (no service fee). If we passed
        // that as customTotalEur, acceptBooking() would treat it as the angler-facing TOTAL
        // and strip the fee again (÷1.05), causing total_eur to drop ~5%. That was the bug.
        customTotalEur = undefined
      } else {
        const parsedPrice = parseFloat(priceInput)
        customTotalEur = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined
      }
      const r = await acceptBooking(bookingId, {
        confirmedDays:  confirmedDays.length > 0 ? confirmedDays : undefined,
        guideNote:      guideNote.trim() || undefined,
        customTotalEur,
        locationText:   locationText.trim() || undefined,
        meetingLat:     meetLat ?? undefined,
        meetingLng:     meetLng ?? undefined,
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

  // ── Reverse geocode: map click → fill location text box ──────────────────

  async function handleReverseGeocode(lat: number, lng: number) {
    setIsRevGeocoding(true)
    try {
      // zoom=16 returns specific features (lake, river names) instead of provinces/states
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=16`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
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
      // Priority: data.name is the specific feature at this zoom (lake/river name),
      // then explicit water body fields, then nearest settlement as fallback.
      const locationName =
        (data.name && data.name.length > 0 ? data.name : null) ??
        addr.river ?? addr.stream ?? addr.waterway ?? addr.natural ?? addr.lake ?? addr.reservoir ??
        addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.municipality ?? null
      if (locationName) setLocationText(locationName)
    } catch {
      // Silent — pin is still placed, just no text auto-fill
    } finally {
      setIsRevGeocoding(false)
    }
  }

  /** Validate accept form, then advance to review step. */
  function handlePreviewAccept() {
    setError(null)
    setStep('review')
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 0. Loading screen ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        <div
          className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{ borderColor: 'rgba(230,126,80,0.18)', borderTopColor: '#E67E50' }}
        />
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
          {action === 'decline' ? 'Declining booking…' : 'Accepting booking…'}
        </p>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── 1. Action choice phase ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (action === null) {
    const dateLabel = isRequestBooking
      ? `${fmtShort(windowFrom)} – ${fmtShort(effectiveWindowTo!)}`
      : anglerRequestedDates && anglerRequestedDates.length > 1
        ? `${anglerRequestedDates.length} dates from ${fmtShort(windowFrom)}`
        : fmtShort(windowFrom)

    return (
      <div className="px-5 py-5 max-w-[580px] mx-auto">

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
              <span className="font-bold">Requested period:</span>{' '}
              {fmtShort(windowFrom)} – {fmtShort(effectiveWindowTo!)}
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
  // ── 2a. Accept — review screen ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'accept' && step === 'review') {
    const reviewPrice = isDirect
      ? (confirmedDays.length > 0 ? computeDefaultPrice(confirmedDays.length) : totalEur)
      : (parseFloat(priceInput) || totalEur)
    const hasLocation = locationText.trim().length > 0 || meetLat != null
    const hasNote     = guideNote.trim().length > 0

    return (
      <div className="flex flex-col px-6 py-5 mx-auto" style={{ maxWidth: 600 }}>

        {/* Header */}
        <div className="pb-4 mb-1" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
          <p
            className="text-[11px] uppercase tracking-[0.22em] f-body mb-1"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            Review before confirming
          </p>
          <p className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
            Check the booking details, then accept.
          </p>
        </div>

        {/* Trip dates */}
        <BookingReviewRow label="Trip dates">
          {confirmedDays.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {confirmedDays.map(d => (
                <span
                  key={d}
                  className="text-[11px] f-body font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(22,163,74,0.1)',
                    color: '#16A34A',
                    border: '1px solid rgba(22,163,74,0.25)',
                  }}
                >
                  {new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Not specified</p>
          )}
        </BookingReviewRow>

        {/* Price */}
        <BookingReviewRow label="Total">
          <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>€{reviewPrice}</p>
          {depositEur != null && depositEur > 0 && (
            <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              Booking fee: €{depositEur}
            </p>
          )}
        </BookingReviewRow>

        {/* Location */}
        {hasLocation && (
          <BookingReviewRow label="Location">
            {locationText.trim() && (
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                {locationText.trim()}
              </p>
            )}
            {meetLat != null && meetLng != null && (
              <p
                className="text-[11px] f-body font-mono mt-0.5"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                <MapPin size={10} strokeWidth={0} fill="#E67E50" className="inline mr-1 relative -top-px" />
                {meetLat.toFixed(4)}, {meetLng.toFixed(4)}
              </p>
            )}
          </BookingReviewRow>
        )}

        {/* Note */}
        {hasNote && (
          <BookingReviewRow label="Your message" last>
            <p
              className="text-sm f-body leading-relaxed whitespace-pre-wrap"
              style={{ color: 'rgba(10,46,77,0.7)' }}
            >
              {guideNote.trim()}
            </p>
          </BookingReviewRow>
        )}

        {!hasLocation && !hasNote && (
          <div className="h-2" /> /* spacing when no optional rows */
        )}

        {error != null && <ErrorBanner message={error} />}

        <div className="flex items-center gap-3 pt-4 pb-2">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-110"
            style={{ background: '#16A34A' }}
          >
            ✓ Accept booking
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── 2b. Accept form — dark-panel + form (OfferModal style) ────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (action === 'accept') {
    const whenLabel = isRequestBooking
      ? `${fmtShort(windowFrom)} – ${fmtShort(effectiveWindowTo!)}`
      : anglerRequestedDates && anglerRequestedDates.length > 1
        ? `${anglerRequestedDates.length} dates from ${fmtShort(windowFrom)}`
        : fmtShort(windowFrom)

    return (
      <div className="flex flex-col sm:flex-row min-h-[420px]">

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
          </PanelSection>

          {/* Group */}
          <PanelSection title="Group">
            <PanelRow value={`${guests} ${guests === 1 ? 'angler' : 'anglers'}`} />
            <PanelRow value={experienceTitle} muted />
          </PanelSection>

          {/* Trip value */}
          <PanelSection title="Trip value">
            <PanelRow value={`€${totalEur}`} />
            {depositEur != null && depositEur > 0 && (
              <PanelRow
                value={`€${depositEur} booking fee`}
                muted
              />
            )}
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

          {isDirect ? (
            <>
              {/* Direct booking — dates shown on calendar, pre-selected but guide can adjust */}
              <div>
                <p style={labelStyle}>
                  Confirm trip dates
                  <span
                    className="ml-1 normal-case tracking-normal font-normal"
                    style={{ color: 'rgba(10,46,77,0.35)' }}
                  >
                    — pre-selected from angler's request, you can adjust
                  </span>
                </p>
                <RespondCalendar
                  calMode="multi"
                  anglerWindowFrom={windowFrom}
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

              {/* Dynamic price — updates as guide selects/deselects days */}
              <div>
                <p style={labelStyle}>Trip total</p>
                <div
                  className="flex items-baseline gap-2.5 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(10,46,77,0.03)',
                    border:     '1.5px solid rgba(10,46,77,0.09)',
                  }}
                >
                  <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                    €{confirmedDays.length > 0 ? computeDefaultPrice(confirmedDays.length) : totalEur}
                  </p>
                  {pricePerPersonEur != null && guests > 0 && confirmedDays.length > 0 && (
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      €{pricePerPersonEur}/day × {guests} {guests === 1 ? 'guest' : 'guests'} × {confirmedDays.length} {confirmedDays.length === 1 ? 'day' : 'days'}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Inquiry booking — guide picks exact dates and sets price */}

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
            </>
          )}

          {/* ── Location ─────────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>
              Location / river
              {guideCountry && (
                <span
                  className="ml-2 normal-case tracking-normal font-normal px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)', fontSize: '10px' }}
                >
                  {guideCountry}
                </span>
              )}
            </label>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="e.g. Alta River, Gaula, Lake Mjøsa…"
                value={locationText}
                onChange={e => setLocationText(e.target.value)}
                disabled={isPending}
                className="f-body"
                style={{ ...inputStyle, paddingRight: isRevGeocoding ? '34px' : undefined }}
              />
              {isRevGeocoding && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 animate-spin pointer-events-none"
                  style={{ borderColor: 'rgba(10,46,77,0.15)', borderTopColor: '#0A2E4D' }}
                />
              )}
            </div>
            {/* Map toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMapExpanded(e => !e)}
                className="flex items-center gap-1.5 text-xs f-body font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#E67E50' }}
              >
                <MapPin size={13} strokeWidth={2} />
                {mapExpanded ? 'Hide map' : 'Set location on map'}
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  stroke="currentColor" strokeWidth="1.8"
                  style={{ transition: 'transform 0.2s', transform: mapExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="2,3 5,7 8,3" />
                </svg>
              </button>
              {meetLat != null && meetLng != null && (
                <>
                  <span className="text-[10px] f-body font-mono" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    {meetLat.toFixed(4)}, {meetLng.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMeetLat(null); setMeetLng(null) }}
                    disabled={isPending}
                    className="text-[10px] f-body hover:opacity-70 transition-opacity"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    ✕ remove
                  </button>
                </>
              )}
            </div>

            {/* Collapsible map */}
            {mapExpanded && (
              <div className="rounded-2xl overflow-hidden mt-2" style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}>
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
                <div
                  className="px-3 py-2"
                  style={{ background: 'rgba(10,46,77,0.02)', borderTop: '1px solid rgba(10,46,77,0.06)' }}
                >
                  <p className="text-[10px] f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {meetLat != null && meetLng != null
                      ? 'Drag the pin to fine-tune the location'
                      : 'Click anywhere on the map to place a pin — location name fills in automatically'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Message — same for both direct and inquiry */}
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
              onClick={handlePreviewAccept}
              className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm f-body transition-all hover:brightness-110"
              style={{ background: '#16A34A' }}
            >
              Preview →
            </button>
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-3.5 rounded-2xl text-sm f-body font-semibold transition-colors hover:opacity-70"
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
    <div className="px-5 py-5 max-w-[580px] flex flex-col gap-4">

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
