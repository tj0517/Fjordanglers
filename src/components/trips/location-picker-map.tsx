'use client'

/**
 * LocationPickerMap — Leaflet map for placing/dragging a pin, drawing a polygon area,
 * or placing multiple named spots (multi-spot mode).
 *
 * Modes:
 *  • 'pin'   — Click anywhere to place/move a pin; drag to fine-tune.
 *  • 'area'  — Freehand polygon drawing via leaflet-draw.
 *  • 'spots' — Click to add named fishing spots; list below map for rename/remove.
 *
 * Must be loaded via dynamic import with { ssr: false }.
 * Uses CartoDB Voyager tiles — free, no API key.
 */

import { memo, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import type * as GeoJSON from 'geojson'
import type { LocationSpot } from '@/types'

// ─── Custom salmon-orange teardrop pin ────────────────────────────────────────
let _pinIcon: L.DivIcon | null = null
function getPinIcon(): L.DivIcon {
  if (_pinIcon == null) {
    _pinIcon = L.divIcon({
      className: '',
      html: `<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14C0 21.732 5.6 29.4 14 38C22.4 29.4 28 21.732 28 14C28 6.268 21.732 0 14 0Z" fill="#E67E50" filter="drop-shadow(0 2px 6px rgba(230,126,80,0.55))"/>
        <circle cx="14" cy="14" r="5.5" fill="white"/>
      </svg>`,
      iconSize:   [28, 38],
      iconAnchor: [14, 38],
    })
  }
  return _pinIcon
}

// ─── Click anywhere → place / move the pin ────────────────────────────────────
function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6)),
      )
    },
  })
  return null
}

// ─── Fly to new coords when parent updates them (e.g. after geocoding) ─────────
function FlyToUpdater({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map     = useMap()
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 13, { duration: 1.1 })
    }
  }, [lat, lng, map])

  return null
}

// ─── DrawControl — imperative leaflet-draw setup ──────────────────────────────
function DrawControl({
  existingArea,
  onAreaChange,
}: {
  existingArea: GeoJSON.Polygon | null | undefined
  onAreaChange: (area: GeoJSON.Polygon | null) => void
}) {
  const map = useMap()

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    if (existingArea != null) {
      const layer = L.geoJSON(existingArea as GeoJSON.GeoJsonObject, {
        style: { color: '#E67E50', fillColor: '#E67E50', fillOpacity: 0.15, weight: 2 },
      })
      layer.eachLayer(l => drawnItems.addLayer(l))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DrawControlClass = (L.Control as any).Draw
    const drawControl = new DrawControlClass({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: '#E67E50', fillColor: '#E67E50', fillOpacity: 0.15 },
        },
        rectangle: {
          shapeOptions: { color: '#E67E50', fillColor: '#E67E50', fillOpacity: 0.15 },
        },
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
    })
    map.addControl(drawControl)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onCreated(e: any) {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      onAreaChange(e.layer.toGeoJSON().geometry as GeoJSON.Polygon)
    }
    function onDeleted() { onAreaChange(null) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.CREATED, onCreated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.DELETED, onDeleted)

    return () => {
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((L as any).Draw.Event.CREATED, onCreated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((L as any).Draw.Event.DELETED, onDeleted)
    }
  }, []) // run once on mount

  return null
}

// ─── SpotsClickHandler — click to add a spot ──────────────────────────────────
function SpotsClickHandler({
  onAdd,
}: {
  onAdd: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onAdd(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6)),
      )
    },
  })
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export type LocationPickerMapProps = {
  mode: 'pin' | 'area' | 'spots'
  // Pin mode
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  /** Initial map centre when no pin is placed yet (no marker rendered at this position). */
  defaultCenter?: [number, number]
  // Area mode
  area?: GeoJSON.Polygon | null
  onAreaChange?: (area: GeoJSON.Polygon | null) => void
  // Spots mode
  spots?: LocationSpot[]
  onSpotsChange?: (spots: LocationSpot[]) => void
}

function LocationPickerMap({
  mode, lat, lng, onChange, defaultCenter, area, onAreaChange, spots = [], onSpotsChange,
}: LocationPickerMapProps) {
  const center: [number, number] =
    spots.length > 0
      ? [spots[0].lat, spots[0].lng]
      : lat != null && lng != null ? [lat, lng]
      : defaultCenter ?? [63.5, 14.0]
  const zoom = mode === 'spots'
    ? (spots.length > 0 ? 10 : 5)
    : (lat != null ? 12 : defaultCenter != null ? 6 : 5)

  const markerEventHandlers = useMemo(() => ({
    dragend(e: L.LeafletEvent) {
      const pos = (e.target as L.Marker).getLatLng()
      onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)))
    },
  }), [onChange])

  function handleAddSpot(lat: number, lng: number) {
    if (onSpotsChange == null) return
    const next = [...spots, { lat, lng, name: `Spot ${spots.length + 1}` }]
    onSpotsChange(next)
  }

  function handleRemoveSpot(i: number) {
    if (onSpotsChange == null) return
    const next = spots.filter((_, idx) => idx !== i)
    onSpotsChange(next)
  }

  function handleRenameSpot(i: number, name: string) {
    if (onSpotsChange == null) return
    const next = spots.map((s, idx) => idx === i ? { ...s, name } : s)
    onSpotsChange(next)
  }

  return (
    <div>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '280px' }}
        scrollWheelZoom={false}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        {mode === 'pin' && (
          <>
            <ClickHandler onChange={onChange} />
            <FlyToUpdater lat={lat} lng={lng} />
            {lat != null && lng != null && (
              <Marker
                position={[lat, lng]}
                icon={getPinIcon()}
                draggable
                eventHandlers={markerEventHandlers}
              />
            )}
          </>
        )}
        {mode === 'area' && (
          <DrawControl
            existingArea={area}
            onAreaChange={onAreaChange ?? (() => {})}
          />
        )}
        {mode === 'spots' && (
          <>
            <SpotsClickHandler onAdd={handleAddSpot} />
            {spots.map((s, i) => (
              <Marker key={i} position={[s.lat, s.lng]} icon={getPinIcon()} />
            ))}
          </>
        )}
      </MapContainer>

      {/* ─── Spots list ───────────────────────────────────────────────────── */}
      {mode === 'spots' && (
        <div className="mt-3 space-y-2">
          {spots.length === 0 && (
            <p className="text-xs f-body text-center py-3" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Click on the map to add fishing spots
            </p>
          )}
          {spots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold w-5 text-center f-body" style={{ color: '#E67E50' }}>
                {i + 1}
              </span>
              <input
                type="text"
                value={s.name}
                onChange={e => handleRenameSpot(i, e.target.value)}
                className="flex-1 text-sm rounded-lg px-3 py-1.5 border f-body"
                style={{ borderColor: 'rgba(10,46,77,0.14)', color: '#0A2E4D', background: '#F8FAFB' }}
                placeholder="Spot name"
              />
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveSpot(i)}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-red-50 f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(LocationPickerMap)
