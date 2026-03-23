'use client'

/**
 * BookingDateStep — Step 1 of the classic booking flow.
 *
 * Angler picks:
 *   • One or more date periods  (single days or ranges via MultiPeriodPicker)
 *   • Group size                (1 … maxGuests)
 *
 * On "Continue", expands all periods to individual ISO dates and navigates to
 * /book/[expId]?dates=2026-06-14,2026-06-15,...&guests=2
 *
 * Identical calendar UX to the icelandic inquiry form.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import {
  MultiPeriodPicker,
  expandPeriods,
  periodTotalDays,
  type Period,
  type BlockedRange,
} from '@/components/trips/multi-period-picker'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE = 0.05

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  expId:              string
  pricePerPerson:     number
  maxGuests:          number
  initialGuests:      number
  availabilityConfig: AvailConfigRow | null
  blockedDates:       BlockedRange[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingDateStep({
  expId,
  pricePerPerson,
  maxGuests,
  initialGuests,
  availabilityConfig,
  blockedDates,
}: Props) {
  const router = useRouter()

  const [periods,   setPeriods]   = useState<Period[]>([])
  const [groupSize, setGroupSize] = useState(Math.min(initialGuests, maxGuests))

  // ── Derived price ────────────────────────────────────────────────────────
  const totalDays = periodTotalDays(periods)
  const subtotal  = Math.round(pricePerPerson * groupSize * totalDays * 100) / 100
  const fee       = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
  const total     = Math.round((subtotal + fee) * 100) / 100

  // ── Continue ─────────────────────────────────────────────────────────────
  function handleContinue() {
    if (periods.length === 0) return
    const dates = expandPeriods(periods)
    router.push(`/book/${expId}?dates=${dates.join(',')}&guests=${groupSize}`)
  }

  return (
    <div
      className="p-6 sm:p-8"
      style={{
        background:   '#FDFAF7',
        borderRadius: '28px',
        border:       '1px solid rgba(10,46,77,0.09)',
        boxShadow:    '0 4px 24px rgba(10,46,77,0.07)',
      }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        Step 1 of 2
      </p>
      <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-1">
        Choose your dates
      </h2>
      <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Pick a date range or individual days — then set your group size.
      </p>

      {/* ── Calendar ────────────────────────────────────────────────────────── */}
      <MultiPeriodPicker
        periods={periods}
        onChange={setPeriods}
        availabilityConfig={availabilityConfig}
        blockedDates={blockedDates}
      />

      {/* ── Group size stepper ──────────────────────────────────────────────── */}
      <div className="mt-6">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Anglers
        </p>
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.12)' }}
        >
          <button
            type="button"
            onClick={() => setGroupSize(n => Math.max(1, n - 1))}
            disabled={groupSize <= 1}
            aria-label="Remove angler"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
          >
            <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
              <rect x="0" y="0.5" width="12" height="1.2" rx="0.6" fill="currentColor" />
            </svg>
          </button>

          <div className="flex items-center gap-2 select-none">
            <span className="text-lg font-bold f-display" style={{ color: '#0A2E4D', lineHeight: 1 }}>
              {groupSize}
            </span>
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)', lineHeight: 1 }}>
              {groupSize === 1 ? 'angler' : 'anglers'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setGroupSize(n => Math.min(maxGuests, n + 1))}
            disabled={groupSize >= maxGuests}
            aria-label="Add angler"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            style={{ background: '#E67E50', color: '#fff' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="5.1" y="0" width="1.8" height="12" rx="0.9" fill="currentColor" />
              <rect x="0" y="5.1" width="12" height="1.8" rx="0.9" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Live price estimate ──────────────────────────────────────────────── */}
      {periods.length > 0 && (
        <div
          className="mt-5 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
              €{pricePerPerson} × {groupSize} {groupSize === 1 ? 'angler' : 'anglers'} × {totalDays} {totalDays === 1 ? 'day' : 'days'}
            </span>
            <span className="text-[11px] font-semibold f-body" style={{ color: '#0A2E4D' }}>
              €{subtotal}
            </span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
              Service fee (5%)
            </span>
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.48)' }}>
              €{fee}
            </span>
          </div>
          <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '10px' }} />
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>
              Estimate
            </p>
            <div className="text-right">
              <p className="font-bold f-display" style={{ fontSize: '28px', color: '#0A2E4D', lineHeight: 1 }}>
                €{total}
              </p>
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                incl. fees · no payment now
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={periods.length === 0}
        className="mt-5 w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed f-body"
        style={{ background: '#E67E50' }}
      >
        {periods.length === 0 ? (
          'Select dates to continue'
        ) : (
          <>
            Continue — {totalDays} {totalDays === 1 ? 'day' : 'days'} selected
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h8M8 4l3 3-3 3" />
            </svg>
          </>
        )}
      </button>

      <p className="text-center text-xs mt-3 f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
        No payment now — guide confirms within 24 h, then you pay a 30% deposit.
      </p>
    </div>
  )
}
