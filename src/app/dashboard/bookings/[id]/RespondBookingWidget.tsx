'use client'

import { useState } from 'react'
import BookingRespondForm, { type BookingRespondFormProps } from './respond/BookingRespondForm'
import { fmtShort } from './respond/RespondCalendar'

type Props = Omit<BookingRespondFormProps, 'mode'>

export default function RespondBookingWidget(props: Props) {
  const [open, setOpen] = useState(false)
  const { anglerName, anglerCountry, guests, totalEur, windowFrom, anglerRequestedDates, durationOption } = props

  // Derive window-to date (request booking) if encoded in requested_dates[1]
  const windowTo =
    anglerRequestedDates && anglerRequestedDates.length === 2 && anglerRequestedDates[1] !== windowFrom
      ? anglerRequestedDates[1]
      : null

  const dateLabel = windowTo
    ? `${fmtShort(windowFrom)} – ${fmtShort(windowTo)}`
    : anglerRequestedDates && anglerRequestedDates.length > 1
      ? `${anglerRequestedDates.length} dates from ${fmtShort(windowFrom)}`
      : `${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`

  return (
    <>
      {/* ── Compact trigger banner ──────────────────────────────────────────── */}
      <div
        style={{
          background:   '#FDFAF7',
          borderRadius: '20px',
          border:       '1.5px solid rgba(230,126,80,0.28)',
          boxShadow:    '0 2px 16px rgba(10,46,77,0.06)',
          overflow:     'hidden',
        }}
      >
        {/* Orange header */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(230,126,80,0.08)', borderBottom: '1px solid rgba(230,126,80,0.15)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(230,126,80,0.18)' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
                   stroke="#E67E50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.5 1.5C4.186 1.5 1.5 4.186 1.5 7.5S4.186 13.5 7.5 13.5 13.5 10.814 13.5 7.5 10.814 1.5 7.5 1.5z"/>
                <line x1="7.5" y1="5" x2="7.5" y2="8.5"/>
                <circle cx="7.5" cy="10.5" r="0.6" fill="#E67E50" stroke="none"/>
              </svg>
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

        {/* Summary row */}
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

      {/* ── Full-page overlay ───────────────────────────────────────────────── */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          {/* Blurred backdrop — click to close */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10,46,77,0.6)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Scrollable wrapper */}
          <div
            style={{
              position: 'relative', zIndex: 1,
              height: '100%', overflowY: 'auto',
              display: 'flex', justifyContent: 'center',
              padding: '28px 16px 80px',
            }}
          >
            {/* Modal card — stop backdrop-click propagation */}
            <div
              style={{
                width: '100%', maxWidth: '1040px',
                background: '#FDFAF7',
                borderRadius: '28px',
                boxShadow: '0 40px 120px rgba(10,46,77,0.3), 0 8px 32px rgba(10,46,77,0.12)',
                height: 'fit-content',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* ✕ Close button */}
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70 hover:scale-105 z-10"
                style={{ background: 'rgba(10,46,77,0.08)' }}
                aria-label="Close respond panel"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
                     stroke="#0A2E4D" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="1" y1="1" x2="10" y2="10" />
                  <line x1="10" y1="1" x2="1" y2="10" />
                </svg>
              </button>

              {/* The form itself — mode="page" so all phases render inline (no double overlay) */}
              <BookingRespondForm
                {...props}
                mode="page"
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Dot() {
  return (
    <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 9, lineHeight: 1 }}>●</span>
  )
}
