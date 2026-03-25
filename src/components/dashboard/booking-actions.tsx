'use client'

/**
 * BookingActions — guide response panel for pending classic bookings.
 *
 * Three states:
 *  idle      → two buttons: "Accept" and "Decline"
 *  accepting → form: pick confirmed date + optional note to angler
 *  declining → form: reason (recommended, not required)
 */

import { useTransition, useState } from 'react'
import { acceptBooking, declineBooking } from '@/actions/bookings'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  bookingId:      string
  /** Angler's availability window start — stored as booking_date on creation */
  windowFrom:     string
  /** Human-readable duration label e.g. "Full day" or "3 days" */
  durationOption: string | null
}

type Panel = 'idle' | 'accepting' | 'declining'
type Done  = 'accepted' | 'declined' | null

// ─── Shared style helpers ────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width:        '100%',
  background:   'rgba(10,46,77,0.04)',
  border:       '1.5px solid rgba(10,46,77,0.12)',
  borderRadius: '14px',
  padding:      '11px 14px',
  fontSize:     '14px',
  color:        '#0A2E4D',
  outline:      'none',
  fontFamily:   'inherit',
  transition:   'border-color 0.15s',
}

const LABEL: React.CSSProperties = {
  display:       'block',
  fontSize:      '10px',
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color:         'rgba(10,46,77,0.45)',
  marginBottom:  '6px',
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14" height="14" viewBox="0 0 14 14"
      fill="none" stroke="currentColor" strokeWidth="2"
    >
      <circle cx="7" cy="7" r="5.5" strokeOpacity="0.25" />
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <button
        type="button"
        onClick={onClick}
        className="w-6 h-6 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
        style={{ background: 'rgba(10,46,77,0.07)' }}
        aria-label="Back"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#0A2E4D" strokeWidth="1.8">
          <polyline points="7,1 3,5 7,9" />
        </svg>
      </button>
      <p
        className="text-[11px] uppercase tracking-[0.2em] f-body"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        {label}
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingActions({ bookingId, windowFrom, durationOption }: Props) {
  const [panel, setPanel] = useState<Panel>('idle')
  const [done,  setDone]  = useState<Done>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  // Accept form
  const [confirmedDate, setConfirmedDate] = useState(windowFrom)
  const [guideNote,     setGuideNote]     = useState('')

  // Decline form
  const [declineReason,      setDeclineReason]      = useState('')
  const [proposeAlternatives, setProposeAlternatives] = useState(false)
  const [altFrom,             setAltFrom]             = useState('')
  const [altTo,               setAltTo]               = useState('')

  function resetError() { setError(null) }

  function handleAccept() {
    resetError()
    start(async () => {
      const result = await acceptBooking(bookingId, {
        confirmedDateFrom: confirmedDate || undefined,
        guideNote:         guideNote.trim() || undefined,
      })
      if (result.error) setError(result.error)
      else              setDone('accepted')
    })
  }

  function handleDecline() {
    resetError()
    start(async () => {
      const alts =
        proposeAlternatives && altFrom && altTo
          ? { from: altFrom, to: altTo }
          : undefined
      const result = await declineBooking(bookingId, declineReason.trim() || undefined, alts)
      if (result.error) setError(result.error)
      else              setDone('declined')
    })
  }

  // ── Done: accepted ───────────────────────────────────────────────────────────

  if (done === 'accepted') {
    return (
      <div
        className="flex items-center gap-3 px-4 py-4 rounded-2xl"
        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10" cy="10" r="8.5" />
          <path d="M6.5 10l2.5 2.5 4.5-4.5" />
        </svg>
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#16A34A' }}>
            Booking accepted!
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Angler has been notified and sent a deposit payment link.
          </p>
        </div>
      </div>
    )
  }

  // ── Done: declined ───────────────────────────────────────────────────────────

  if (done === 'declined') {
    return (
      <div
        className="flex items-center gap-3 px-4 py-4 rounded-2xl"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="9" cy="9" r="7.5" />
          <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" />
        </svg>
        <div>
          <p className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
            Booking declined
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Angler has been notified.
          </p>
        </div>
      </div>
    )
  }

  // ── Idle: two buttons ────────────────────────────────────────────────────────

  if (panel === 'idle') {
    return (
      <div className="flex flex-col gap-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Your response
        </p>
        <div className="flex gap-2.5">
          {/* Accept — primary CTA */}
          <button
            type="button"
            onClick={() => setPanel('accepting')}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-105 active:scale-[0.98]"
            style={{
              background: 'rgba(74,222,128,0.12)',
              color:      '#15803D',
              border:     '1px solid rgba(74,222,128,0.3)',
            }}
          >
            Accept →
          </button>

          {/* Decline — secondary */}
          <button
            type="button"
            onClick={() => setPanel('declining')}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold f-body transition-all hover:opacity-80 active:scale-[0.98]"
            style={{
              background: 'transparent',
              color:      '#DC2626',
              border:     '1px solid rgba(239,68,68,0.25)',
            }}
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  // ── Accepting: confirm date + optional note ──────────────────────────────────

  if (panel === 'accepting') {
    const windowDateFormatted = (() => {
      try {
        return new Date(`${windowFrom}T12:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      } catch {
        return windowFrom
      }
    })()

    return (
      <div className="flex flex-col gap-4">
        <BackButton onClick={() => { setPanel('idle'); resetError() }} label="Confirm & Accept" />

        {/* ── Confirmed date ──────────────────────────────────────────────── */}
        <div>
          <label style={LABEL}>
            Confirmed trip date <span style={{ color: '#E67E50' }}>*</span>
          </label>
          <input
            type="date"
            value={confirmedDate}
            min={windowFrom}
            onChange={e => setConfirmedDate(e.target.value)}
            className="f-body"
            style={INPUT}
          />
          <p className="text-[11px] mt-1.5 f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            Angler&apos;s window starts {windowDateFormatted}
            {durationOption != null && (
              <> · <span style={{ color: 'rgba(10,46,77,0.55)' }}>{durationOption}</span></>
            )}
          </p>
        </div>

        {/* ── Note to angler ──────────────────────────────────────────────── */}
        <div>
          <label style={LABEL}>
            Message to angler{' '}
            <span style={{ color: 'rgba(10,46,77,0.35)', textTransform: 'lowercase', letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            rows={3}
            value={guideNote}
            onChange={e => setGuideNote(e.target.value)}
            placeholder="Meeting point, what to bring, parking details, access road…"
            className="f-body resize-none"
            style={{ ...INPUT, height: 'auto' }}
          />
          <p className="text-[11px] mt-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Sent as a chat message — angler will see it on their booking page.
          </p>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error != null && (
          <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
        )}

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending || !confirmedDate}
          className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: '#16A34A' }}
        >
          {isPending ? <><Spinner /> Accepting…</> : 'Confirm & Accept →'}
        </button>
      </div>
    )
  }

  // ── Declining: reason + optional alternative dates ───────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <BackButton onClick={() => { setPanel('idle'); resetError() }} label="Decline this booking" />

      {/* ── Reason ─────────────────────────────────────────────────────────── */}
      <div>
        <label style={LABEL}>
          Reason{' '}
          <span style={{ color: 'rgba(10,46,77,0.35)', textTransform: 'lowercase', letterSpacing: 0 }}>
            (recommended)
          </span>
        </label>
        <textarea
          rows={3}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder="e.g., Fully booked on those dates, river access closed for the season…"
          className="f-body resize-none"
          style={{ ...INPUT, height: 'auto' }}
        />
        <p className="text-[11px] mt-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Shown to the angler so they can plan accordingly.
        </p>
      </div>

      {/* ── Propose alternative dates ─────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1.5px solid ${proposeAlternatives ? 'rgba(37,99,235,0.25)' : 'rgba(10,46,77,0.1)'}`, transition: 'border-color 0.15s' }}
      >
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setProposeAlternatives(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
          style={{ background: proposeAlternatives ? 'rgba(37,99,235,0.05)' : 'rgba(10,46,77,0.02)' }}
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke={proposeAlternatives ? '#2563EB' : 'rgba(10,46,77,0.45)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
              <line x1="5" y1="1" x2="5" y2="4" />
              <line x1="11" y1="1" x2="11" y2="4" />
              <line x1="2" y1="6.5" x2="14" y2="6.5" />
              <rect x="5" y="9" width="2" height="2" rx="0.4" fill="currentColor" stroke="none" />
              <rect x="9" y="9" width="2" height="2" rx="0.4" fill="currentColor" stroke="none" />
            </svg>
            <span
              className="text-sm font-semibold f-body"
              style={{ color: proposeAlternatives ? '#1D4ED8' : '#0A2E4D' }}
            >
              Propose alternative dates
            </span>
          </div>

          {/* Toggle pill */}
          <div
            className="relative flex-shrink-0"
            style={{
              width: 36, height: 20,
              background: proposeAlternatives ? '#2563EB' : 'rgba(10,46,77,0.15)',
              borderRadius: 99,
              transition: 'background 0.2s',
            }}
          >
            <div
              style={{
                position:   'absolute',
                top:        2, left: 2,
                width:      16, height: 16,
                background: '#fff',
                borderRadius: '50%',
                boxShadow:  '0 1px 4px rgba(0,0,0,0.15)',
                transform:  proposeAlternatives ? 'translateX(16px)' : 'translateX(0)',
                transition: 'transform 0.2s',
              }}
            />
          </div>
        </button>

        {/* Expanded: date pickers */}
        {proposeAlternatives && (
          <div
            className="px-4 pb-4 pt-3 flex flex-col gap-3"
            style={{ borderTop: '1px solid rgba(37,99,235,0.1)' }}
          >
            <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Pick dates when you&apos;re actually available — the angler will receive a message from
              you with a link to send a new booking request for those dates.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ ...LABEL, color: 'rgba(37,99,235,0.7)' }}>Available from</label>
                <input
                  type="date"
                  value={altFrom}
                  onChange={e => {
                    setAltFrom(e.target.value)
                    if (altTo && e.target.value > altTo) setAltTo(e.target.value)
                  }}
                  className="f-body"
                  style={{ ...INPUT, borderColor: altFrom ? 'rgba(37,99,235,0.3)' : 'rgba(10,46,77,0.12)' }}
                />
              </div>
              <div>
                <label style={{ ...LABEL, color: 'rgba(37,99,235,0.7)' }}>Available to</label>
                <input
                  type="date"
                  value={altTo}
                  min={altFrom || undefined}
                  onChange={e => setAltTo(e.target.value)}
                  className="f-body"
                  style={{ ...INPUT, borderColor: altTo ? 'rgba(37,99,235,0.3)' : 'rgba(10,46,77,0.12)' }}
                />
              </div>
            </div>

            {/* Preview of auto-message */}
            {altFrom && altTo && (
              <div
                className="px-3 py-3 rounded-xl"
                style={{ background: 'rgba(37,99,235,0.04)', border: '1px dashed rgba(37,99,235,0.2)' }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 f-body"
                  style={{ color: 'rgba(37,99,235,0.6)' }}
                >
                  Message preview
                </p>
                <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.6)', whiteSpace: 'pre-line' }}>
                  {declineReason.trim()
                    ? `Unfortunately those dates don't work for me — ${declineReason.trim().replace(/\.$/, '')}.\n\n`
                    : `Unfortunately I'm unable to take the booking for those dates.\n\n`
                  }📅 I&apos;m available on: {altFrom}{altTo !== altFrom ? ` – ${altTo}` : ''}{'\n\n'}Feel free to send a new booking request for those dates, or message me here if you'd like to discuss other options.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error != null && (
        <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* ── Warning before submit ─────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2.5 px-3 py-3 rounded-xl"
        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
          <path d="M7 1L13.06 11H.94L7 1z" />
          <line x1="7" y1="5.5" x2="7" y2="8" />
          <circle cx="7" cy="9.5" r="0.5" fill="#DC2626" />
        </svg>
        <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(180,30,30,0.8)' }}>
          This will notify the angler. No payment will be charged.
        </p>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleDecline}
        disabled={isPending || (proposeAlternatives && (!altFrom || !altTo))}
        className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#DC2626' }}
      >
        {isPending
          ? <><Spinner /> Declining…</>
          : proposeAlternatives && altFrom && altTo
            ? 'Decline & Send Alternative Dates →'
            : 'Decline Booking'
        }
      </button>
    </div>
  )
}
