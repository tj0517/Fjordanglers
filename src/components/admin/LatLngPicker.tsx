'use client'

/**
 * LatLngPicker — admin map widget for setting experience_pages coordinates.
 *
 * Usage:
 *   <LatLngPicker lat={lat} lng={lng} onChange={(lat, lng) => { setLat(lat); setLng(lng) }} />
 *
 * - Click on the map to place / move the pin
 * - Drag the pin to fine-tune
 * - Edit lat/lng inputs directly
 * - "Clear pin" removes the coordinates
 */

import dynamic from 'next/dynamic'
import { useCallback } from 'react'
import { MapPin, X, ExternalLink } from 'lucide-react'

const LatLngPickerMap = dynamic(() => import('./LatLngPickerMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full flex items-center justify-center rounded-xl"
      style={{ height: '300px', background: 'linear-gradient(135deg, #E8EDF0 0%, #D4DDE3 100%)' }}
    >
      <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>Loading map…</p>
    </div>
  ),
})

// ─── Shared input styles ──────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  background: '#FDFAF7',
  border:     '1px solid rgba(10,46,77,0.12)',
  borderRadius: '10px',
  color:      '#0A2E4D',
  fontSize:   '13px',
  padding:    '8px 11px',
  outline:    'none',
  width:      '100%',
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LatLngPicker({ lat, lng, onChange }: Props) {
  const hasPin = lat != null && lng != null

  const handlePlace = useCallback(
    (newLat: number, newLng: number) => onChange(newLat, newLng),
    [onChange],
  )

  const handleLatInput = useCallback(
    (raw: string) => {
      const v = parseFloat(raw)
      onChange(isNaN(v) ? null : v, lng)
    },
    [lng, onChange],
  )

  const handleLngInput = useCallback(
    (raw: string) => {
      const v = parseFloat(raw)
      onChange(lat, isNaN(v) ? null : v)
    },
    [lat, onChange],
  )

  const handleClear = useCallback(() => onChange(null, null), [onChange])

  return (
    <div className="space-y-3">

      {/* Map */}
      <LatLngPickerMap lat={lat} lng={lng} onPlace={handlePlace} />

      {/* Hint */}
      <p className="text-[11px] f-body flex items-center gap-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
        <MapPin size={11} style={{ color: '#E67E50', flexShrink: 0 }} />
        Click anywhere on the map to place the pin, or drag the pin to move it.
      </p>

      {/* Lat / Lng inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1"
            style={{ color: 'rgba(10,46,77,0.45)' }}>
            Latitude
          </label>
          <input
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            placeholder="e.g. 63.4305"
            value={lat ?? ''}
            onChange={e => handleLatInput(e.target.value)}
            style={iStyle}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1"
            style={{ color: 'rgba(10,46,77,0.45)' }}>
            Longitude
          </label>
          <input
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            placeholder="e.g. 10.3951"
            value={lng ?? ''}
            onChange={e => handleLngInput(e.target.value)}
            style={iStyle}
          />
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasPin && (
          <>
            {/* Verify on Google Maps */}
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: '#E67E50' }}
            >
              <ExternalLink size={11} />
              Verify on Google Maps
            </a>

            {/* Clear */}
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-[11px] font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              <X size={11} />
              Clear pin
            </button>
          </>
        )}

        {!hasPin && (
          <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
            No pin set — experience won&apos;t appear on the map until a location is placed.
          </p>
        )}
      </div>

    </div>
  )
}
