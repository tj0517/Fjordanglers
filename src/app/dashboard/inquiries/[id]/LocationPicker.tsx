'use client'

/**
 * LocationPicker — interactive Leaflet map for selecting a pin or area.
 *
 * Modes:
 *   Pin  — click anywhere on the map to drop an orange marker.
 *   Area — activate leaflet-draw rectangle tool to select a bounding area.
 *
 * Geocoding uses Nominatim (free, no API key) with a 600ms debounce.
 * When an area is drawn, the centroid is also set as the pin (so the
 * offer page always has valid lat/lng to centre on).
 *
 * Dynamically imported (ssr: false) from OfferBuilder to avoid SSR issues.
 */

import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import { Search, MapPin, Square, X } from 'lucide-react'
import type { GeoJsonObject, Feature, Polygon } from 'geojson'

// ─── Fix Leaflet default icon (Next.js / webpack issue) ──────────────────────

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// Orange branded marker
const orangeMarker = typeof window !== 'undefined'
  ? L.divIcon({
      className: '',
      html: `<div style="
        width:16px;height:16px;
        background:#E67E50;
        border:2.5px solid #fff;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.35)
      "></div>`,
      iconSize:   [16, 16],
      iconAnchor: [8, 16],
    })
  : null

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Places/moves the pin on map click in pin mode. */
function PinClickHandler({
  enabled,
  onPin,
}: {
  enabled: boolean
  onPin: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click: (e) => {
      if (enabled) onPin(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Smoothly flies to new coordinates when triggered. */
function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 })
  }, [lat, lng, zoom, map])
  return null
}

/** Adds leaflet-draw rectangle control to the map. */
function DrawAreaControl({
  enabled,
  onDrawn,
}: {
  enabled: boolean
  onDrawn: (geojson: Feature<Polygon>, centroidLat: number, centroidLng: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L_any = L as any
    if (typeof L_any.Control?.Draw === 'undefined') return

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L_any.Control.Draw({
      position: 'topright',
      edit: { featureGroup: drawnItems, edit: false, remove: false },
      draw: {
        polygon:      false,
        polyline:     false,
        circle:       false,
        circlemarker: false,
        marker:       false,
        rectangle: {
          shapeOptions: { color: '#E67E50', fillOpacity: 0.12, weight: 2 },
        },
      },
    })
    map.addControl(drawControl)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleCreated(e: any) {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      const geojson = e.layer.toGeoJSON() as Feature<Polygon>
      const bounds  = (e.layer as L.Rectangle).getBounds()
      const center  = bounds.getCenter()
      onDrawn(geojson, center.lat, center.lng)
    }

    map.on(L_any.Draw.Event.CREATED, handleCreated)

    return () => {
      map.off(L_any.Draw.Event.CREATED, handleCreated)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [enabled, map, onDrawn])

  return null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export interface Props {
  lat: number | null
  lng: number | null
  zoom: number
  geojson: object | null
  onPin:   (lat: number, lng: number, zoom: number) => void
  onArea:  (geojson: Feature<Polygon>, lat: number, lng: number) => void
  onClear: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationPicker({ lat, lng, zoom, geojson, onPin, onArea, onClear }: Props) {
  const [mode,      setMode]      = useState<'pin' | 'area'>('pin')
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function geocode(q: string) {
    if (q.trim().length < 3) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=en`,
        { headers: { 'User-Agent': 'FjordAnglers/1.0' } },
      )
      const data = await res.json() as NominatimResult[]
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void geocode(v), 600)
  }

  function selectResult(r: NominatimResult) {
    const rlat = parseFloat(r.lat)
    const rlng = parseFloat(r.lon)
    setResults([])
    setQuery(r.display_name.split(',').slice(0, 2).join(','))
    setFlyTarget({ lat: rlat, lng: rlng, zoom: 10 })
    onPin(rlat, rlng, 10)
  }

  const handlePin = useCallback((plat: number, plng: number) => {
    onPin(plat, plng, zoom || 10)
  }, [onPin, zoom])

  const handleArea = useCallback((gj: Feature<Polygon>, clat: number, clng: number) => {
    onArea(gj, clat, clng)
  }, [onArea])

  const defaultCenter: [number, number] = [65, 14] // centre of Scandinavia
  const mapCenter: [number, number]     = lat != null && lng != null ? [lat, lng] : defaultCenter

  return (
    <div className="mt-3 rounded-xl overflow-hidden"
      style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}>

      {/* ── Controls bar ── */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.08)' }}>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden flex-shrink-0"
          style={{ border: '1px solid rgba(10,46,77,0.1)' }}>
          {(['pin', 'area'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold f-body transition-colors"
              style={{
                background: mode === m ? '#0A2E4D' : 'transparent',
                color:      mode === m ? '#fff'    : 'rgba(10,46,77,0.5)',
              }}
            >
              {m === 'pin'
                ? <><MapPin size={10} /> Pin</>
                : <><Square size={10} /> Area</>}
            </button>
          ))}
        </div>

        {/* Geocoding search */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.12)' }}>
            <Search size={11} style={{ color: 'rgba(10,46,77,0.4)', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setResults([]) }}
              placeholder="Search place…"
              className="flex-1 text-xs f-body outline-none bg-transparent min-w-0"
              style={{ color: '#0A2E4D' }}
            />
            {searching && (
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent flex-shrink-0"
                style={{ borderColor: '#E67E50', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
            )}
          </div>

          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-[9999] mt-1 rounded-xl shadow-lg overflow-hidden"
              style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }}>
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-3 py-2.5 text-xs f-body transition-colors"
                  style={{
                    color:        '#0A2E4D',
                    borderBottom: i < results.length - 1 ? '1px solid rgba(10,46,77,0.05)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,46,77,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear */}
        {(lat != null || geojson != null) && (
          <button
            type="button"
            onClick={() => { onClear(); setQuery('') }}
            className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
            title="Clear location"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── Map ── */}
      <div style={{ height: 260, cursor: mode === 'pin' ? 'crosshair' : 'default' }}>
        <MapContainer
          center={mapCenter}
          zoom={zoom || 5}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {lat != null && lng != null && orangeMarker != null && (
            <Marker position={[lat, lng]} icon={orangeMarker} />
          )}

          {geojson != null && (
            <GeoJSON
              data={geojson as GeoJsonObject}
              style={{ color: '#E67E50', weight: 2, fillOpacity: 0.12 }}
            />
          )}

          {flyTarget != null && (
            <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} zoom={flyTarget.zoom} />
          )}

          <PinClickHandler enabled={mode === 'pin'} onPin={handlePin} />
          <DrawAreaControl enabled={mode === 'area'} onDrawn={handleArea} />
        </MapContainer>
      </div>

      {/* ── Status bar ── */}
      {(lat != null || geojson != null) && (
        <div className="px-3 py-1.5"
          style={{ background: 'rgba(10,46,77,0.03)', borderTop: '1px solid rgba(10,46,77,0.06)' }}>
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {geojson != null
              ? `📐 Area selected${lat != null ? ` · centred ${lat.toFixed(3)}, ${lng?.toFixed(3)}` : ''}`
              : `📍 ${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
          </p>
        </div>
      )}

      {/* Mode hint */}
      {lat == null && geojson == null && (
        <div className="px-3 py-1.5"
          style={{ background: 'rgba(10,46,77,0.03)', borderTop: '1px solid rgba(10,46,77,0.06)' }}>
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
            {mode === 'pin' ? '👆 Click the map to place a pin' : '⬜ Use the rectangle tool (top right) to draw an area'}
          </p>
        </div>
      )}
    </div>
  )
}
