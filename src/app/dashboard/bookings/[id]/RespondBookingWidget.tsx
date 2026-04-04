'use client'

import { useState, useEffect } from 'react'
import BookingRespondForm, { type BookingRespondFormProps } from './respond/BookingRespondForm'
import { fmtShort } from './respond/RespondCalendar'
import { Check, X } from 'lucide-react'

type Props = Omit<BookingRespondFormProps, 'mode'>

export default function RespondBookingWidget(props: Props) {
  const [open, setOpen] = useState(false)
  const [initialAction, setInitialAction] = useState<'accept' | 'decline' | null>(null)

  const {
    anglerName, anglerCountry, guests, totalEur,
    windowFrom, anglerRequestedDates, durationOption, specialRequests,
  } = props

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /** Open modal pre-seeded to the chosen action — skips the two-card choice phase. */
  function openWith(action: 'accept' | 'decline') {
    setInitialAction(action)
    setOpen(true)
  }

  // `requested_dates` holds all expanded individual dates in the angler's window.
  // Last element = window end — same logic as BookingRespondForm.deriveWindowTo.
  const windowTo =
    anglerRequestedDates && anglerRequestedDates.length > 1
      ? anglerRequestedDates[anglerRequestedDates.length - 1] !== windowFrom
          ? anglerRequestedDates[anglerRequestedDates.length - 1]
          : null
      : null

  const dateLabel = windowTo
    ? `${fmtShort(windowFrom)} – ${fmtShort(windowTo)}`
    : `${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`

  // Modal header label reflects which button opened it.
  // (If user clicks Back inside the form the label stays — that's intentional:
  //  the two ActionCards below let them switch to the other action.)
  const modalSubLabel =
    initialAction === 'accept' ? 'Accept booking'
    : initialAction === 'decline' ? 'Decline booking'
    : 'Respond to booking'

  return (
    <>
      {/* ── Trigger card ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background:   '#E67E50',
          borderRadius: '20px',
          overflow:     'hidden',
          boxShadow:    '0 4px 20px rgba(230,126,80,0.35)',
        }}
      >
        {/* Label + summary */}
        <div className="px-5 pt-4 pb-4">
          <p
            className="text-[10px] uppercase tracking-[0.22em] font-bold f-body mb-2"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            New booking request
          </p>

          <p className="text-sm font-semibold f-body leading-snug" style={{ color: '#fff' }}>
            {anglerName}
            {anglerCountry ? (
              <span className="font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {' · '}{anglerCountry}
              </span>
            ) : null}
          </p>

          <p className="text-[12px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {guests} {guests === 1 ? 'guest' : 'guests'}
            {' · '}{dateLabel}
            {' · '}<span className="font-semibold" style={{ color: '#fff' }}>€{totalEur}</span>
          </p>

          {specialRequests != null && specialRequests.length > 0 && (
            <p
              className="mt-2 text-[11px] f-body leading-snug line-clamp-2"
              style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}
            >
              &ldquo;{specialRequests}&rdquo;
            </p>
          )}
        </div>

        {/* Hairline separator */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />

        {/* Action row */}
        <div className="flex">
          <button
            type="button"
            onClick={() => openWith('accept')}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold f-body transition-all hover:bg-white/10 active:scale-[0.98]"
            style={{
              color:       '#fff',
              borderRight: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <Check size={13} strokeWidth={2.5} />
            Accept
          </button>
          <button
            type="button"
            onClick={() => openWith('decline')}
            className="flex-1 flex items-center justify-center py-3.5 text-sm font-semibold f-body transition-all hover:bg-white/10 active:scale-[0.98]"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Decline
          </button>
        </div>
      </div>

      {/* ── Modal dialog ──────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop — separate element, no backdropFilter to avoid blur bleeding onto the panel */}
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(7,17,28,0.65)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog panel — pointer-events-none wrapper centres it without catching clicks */}
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <div
              className="relative w-full max-w-[960px] max-h-[92dvh] flex flex-col pointer-events-auto"
              style={{
                background:   '#FDFAF7',
                borderRadius: 28,
                overflow:     'hidden',
                boxShadow:    '0 24px 80px rgba(10,46,77,0.28)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div
                className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
              >
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
                    style={{ color: 'rgba(10,46,77,0.38)' }}
                  >
                    {modalSubLabel}
                  </p>
                  <h2 className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
                    {anglerName}
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.06]"
                  aria-label="Close"
                  style={{ color: 'rgba(10,46,77,0.5)' }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Scrollable body — min-h-0 is required for overflow-y to work in flex */}
              <div className="overflow-y-auto flex-1 min-h-0">
                <BookingRespondForm
                  {...props}
                  initialAction={initialAction}
                  mode="page"
                  onClose={() => setOpen(false)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
