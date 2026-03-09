'use client'

/**
 * LocationPickerMap — Leaflet map for placing/dragging a pin.
 *
 * Features:
 *  • Click anywhere on the map to place or move the pin
 *  • Drag the pin to fine-tune the position
 *  • When parent calls onChange (e.g. from geocoding), map flies smoothly to the new coords
 *
 * Must be loaded via dynamic import with { ssr: false }.
 * Uses CartoDB Voyager tiles — free, no API key.
 */

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Custom salmon-orange teardrop pin ────────────────────────────────────────
// Created lazily so L is available (client-only module).
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
// Skips the very first render so the static `center` prop handles the initial view.
function FlyToUpdater({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map    = useMap()
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 13, { duration: 1.1 })
    }
  }, [lat, lng, map])

  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export type LocationPickerMapProps = {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export default function LocationPickerMap({ lat, lng, onChange }: LocationPickerMapProps) {
  const center: [number, number] =
    lat != null && lng != null ? [lat, lng] : [63.5, 14.0]
  const zoom = lat != null ? 12 : 5

  return (
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
      <ClickHandler onChange={onChange} />
      <FlyToUpdater lat={lat} lng={lng} />
      {lat != null && lng != null && (
        <Marker
          position={[lat, lng]}
          icon={getPinIcon()}
          draggable
          eventHandlers={{
            dragend(e) {
              const pos = (e.target as L.Marker).getLatLng()
              onChange(
                parseFloat(pos.lat.toFixed(6)),
                parseFloat(pos.lng.toFixed(6)),
              )
            },
          }}
        />
      )}
    </MapContainer>
  )
}
