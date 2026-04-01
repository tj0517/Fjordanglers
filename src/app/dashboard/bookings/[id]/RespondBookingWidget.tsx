'use client'

import { useState, useEffect } from 'react'
import BookingRespondForm, { type BookingRespondFormProps } from './respond/BookingRespondForm'
import { fmtShort } from './respond/RespondCalendar'
import { Info, X } from 'lucide-react'

type Props = Omit<BookingRespondFormProps, 'mode'>

export default function RespondBookingWidget(props: Props) {
  const [open, setOpen] = useState(false)
  const { anglerName, anglerCountry, guests, totalEur, windowFrom, anglerRequestedDates, durationOption } = props

  // Lock body scroll when open
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

  // `requested_dates` now contains ALL expanded individual dates in the window.
  // The last element is the window end — same logic as BookingRespondForm.deriveWindowTo.
  const windowTo =
    anglerRequestedDates && anglerRequestedDates.length > 1
      ? anglerRequestedDates[anglerRequestedDates.length - 1] !== windowFrom
          ? anglerRequestedDates[anglerRequestedDates.length - 1]
          : null
      : null

  const dateLabel = windowTo
    ? `${fmtShort(windowFrom)} – ${fmtShort(windowTo)}`
    : `${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`

  return (
    <>
      {/* ── Trigger banner ──────────────────────────────────────────────────── */}
      <div
        style={{
          background:   '#FDFAF7',
          borderRadius: '20px',
          border:       '1.5px solid rgba(230,126,80,0.28)',
          boxShadow:    '0 2px 16px rgba(10,46,77,0.06)',
          overflow:     'hidden',
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(230,126,80,0.08)', borderBottom: '1px solid rgba(230,126,80,0.15)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(230,126,80,0.18)' }}
            >
              <Info size={15} strokeWidth={1.8} style={{ color: '#E67E50' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                New booking request — awaiting your response
              </p>
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Accept or decline to notify the angler
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold f-body text-white flex-shrink-0 transition-all hover:brightness-110 active:scale-95"
            style={{ background: '#E67E50' }}
          >
            Respond →
          </button>
        </div>

        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-[12px] f-body font-semibold" style={{ color: '#0A2E4D' }}>
            {anglerName}
            {anglerCountry ? (
              <span className="font-normal" style={{ color: 'rgba(10,46,77,0.5)' }}> · {anglerCountry}</span>
            ) : null}
          </span>
          <Dot />
          <span className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {guests} {guests === 1 ? 'guest' : 'guests'}
          </span>
          <Dot />
          <span className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {dateLabel}
          </span>
          <Dot />
          <span className="text-[12px] f-body font-bold" style={{ color: '#16A34A' }}>
            €{totalEur}
          </span>
        </div>
      </div>

      {/* ── Modal dialog ────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop — separate element, no backdropFilter to avoid blur bleeding onto the panel */}
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(7,17,28,0.65)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog panel — above backdrop, pointer-events-none wrapper centres it without catching clicks */}
          <div
            className="fixed inset-0 z-[51] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
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
                  Respond to booking
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

function Dot() {
  return (
    <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 9, lineHeight: 1 }}>●</span>
  )
}
