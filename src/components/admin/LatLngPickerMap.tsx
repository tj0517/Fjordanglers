'use client'

/**
 * LatLngPickerMap — inner Leaflet component.
 *
 * Dynamically imported (SSR=false) via LatLngPicker.tsx.
 * Click anywhere on the map to place / move the pin.
 * The marker is also draggable.
 */

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Custom pin icon (matches the site's brand) ───────────────────────────────

function pinIcon(active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${active ? 38 : 32}px;
      height: ${active ? 38 : 32}px;
      background: ${active ? '#E67E50' : '#0A2E4D'};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 3px 16px ${active ? 'rgba(230,126,80,0.6)' : 'rgba(10,46,77,0.4)'};
      cursor: grab;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    ">
      <img src="/brand/sygnet${active ? '-black' : ''}.png"
        style="width:${active ? 20 : 16}px;height:${active ? 20 : 16}px;object-fit:contain;${active ? 'opacity:0.85;' : ''}"
        draggable="false"/>
    </div>`,
    iconSize:    [active ? 38 : 32, active ? 38 : 32],
    iconAnchor:  [active ? 19 : 16, active ? 19 : 16],
    popupAnchor: [0, -24],
  })
}

// ─── Click handler ────────────────────────────────────────────────────────────

function ClickHandler({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(
        Math.round(e.latlng.lat * 1e6) / 1e6,
        Math.round(e.latlng.lng * 1e6) / 1e6,
      )
    },
  })
  return null
}

// ─── Fly-to helper when lat/lng changes from outside ─────────────────────────

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map     = useMap()
  const prevRef = useRef<string>('')
  useEffect(() => {
    if (lat == null || lng == null) return
    const key = `${lat},${lng}`
    if (prevRef.current === key) return
    prevRef.current = key
    map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { duration: 0.5 })
  }, [lat, lng, map])
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  lat: number | null
  lng: number | null
  onPlace: (lat: number, lng: number) => void
}

export default function LatLngPickerMap({ lat, lng, onPlace }: Props) {
  const hasPin = lat != null && lng != null

  return (
    <MapContainer
      center={hasPin ? [lat!, lng!] : [63.5, 14.0]}
      zoom={hasPin ? 8 : 4}
      style={{ width: '100%', height: '300px', borderRadius: '12px', cursor: 'crosshair' }}
      zoomControl
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      <ClickHandler onPlace={onPlace} />
      <FlyTo lat={lat} lng={lng} />

      {hasPin && (
        <Marker
          position={[lat!, lng!]}
          icon={pinIcon(true)}
          draggable
          eventHandlers={{
            dragend(e) {
              const ll = (e.target as L.Marker).getLatLng()
              onPlace(
                Math.round(ll.lat * 1e6) / 1e6,
                Math.round(ll.lng * 1e6) / 1e6,
              )
            },
          }}
        />
      )}
    </MapContainer>
  )
}
