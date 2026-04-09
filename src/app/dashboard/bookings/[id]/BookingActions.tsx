'use client'

/**
 * GuideActionPanel — shown on the booking detail page for pending bookings.
 * Renders two highlighted CTAs (Accept green / Decline red).
 * When clicked, opens the respective full-screen overlay.
 */

import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import GuideConfirmFlow from './GuideConfirmFlow'
import GuideDeclineFlow from './GuideDeclineFlow'
import type { IcelandicPreferences } from '@/actions/bookings'

interface BlockedRange {
  date_start: string
  date_end: string
}

interface Props {
  bookingId:       string
  requestedDates:  string[]
  blockedRanges:   BlockedRange[]
  anglerName:      string
  experienceTitle: string
  guidePayout:     number
  totalEur:        number
  guests:          number
  source:          'direct' | 'inquiry'
  preferences:     IcelandicPreferences | null
}

type Overlay = 'none' | 'confirm' | 'decline'

export default function BookingActions({
  bookingId, requestedDates, blockedRanges,
  anglerName, experienceTitle, guidePayout, totalEur, guests,
  source, preferences,
}: Props) {
  const [overlay, setOverlay] = useState<Overlay>('none')

  return (
    <>
      {/* ── Action card ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border:     '1.5px solid rgba(230,126,80,0.35)',
          background: '#FFFBF7',
          boxShadow:  '0 2px 12px rgba(230,126,80,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(230,126,80,0.15)', background: 'rgba(230,126,80,0.06)' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: '#E67E50', animation: 'pulse 2s infinite' }}
          />
          <p className="text-xs font-bold uppercase tracking-wider f-body" style={{ color: '#E67E50' }}>
            Action required
          </p>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Review {anglerName}&rsquo;s request and let them know if you can take them on this trip.
          </p>

          {/* Accept */}
          <button
            type="button"
            onClick={() => setOverlay('confirm')}
            className="w-full py-3.5 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: '#22C55E',
              color:      '#fff',
              boxShadow:  '0 4px 14px rgba(34,197,94,0.3)',
            }}
          >
            <CheckCircle size={16} />
            Accept booking
          </button>

          {/* Decline */}
          <button
            type="button"
            onClick={() => setOverlay('decline')}
            className="w-full py-3 rounded-2xl text-sm font-semibold f-body flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(220,38,38,0.07)',
              color:      '#DC2626',
              border:     '1.5px solid rgba(220,38,38,0.2)',
            }}
          >
            <XCircle size={15} />
            Decline
          </button>
        </div>
      </div>

      {/* ── Overlays ── */}
      {overlay === 'confirm' && (
        <GuideConfirmFlow
          bookingId={bookingId}
          requestedDates={requestedDates}
          blockedRanges={blockedRanges}
          anglerName={anglerName}
          experienceTitle={experienceTitle}
          guidePayout={guidePayout}
          totalEur={totalEur}
          guests={guests}
          source={source}
          preferences={preferences}
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'decline' && (
        <GuideDeclineFlow
          bookingId={bookingId}
          anglerName={anglerName}
          onClose={() => setOverlay('none')}
        />
      )}
    </>
  )
}
