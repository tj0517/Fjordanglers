'use client'

/**
 * LocationMap — read-only Leaflet map shown on the angler-facing offer page.
 *
 * Shows an orange pin (and optional area polygon) on an OpenStreetMap base.
 * Scroll-wheel zoom is disabled so the angler doesn't accidentally zoom
 * when scrolling through the offer page.
 *
 * Dynamically imported with ssr: false from the offer page Server Component.
 */

import 'leaflet/dist/leaflet.css'

import { MapContainer, TileLayer, Marker, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import type { GeoJsonObject } from 'geojson'

// Fix Leaflet default icon
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const orangeMarker = typeof window !== 'undefined'
  ? L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;
        background:#E67E50;
        border:3px solid #fff;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 12px rgba(0,0,0,0.3)
      "></div>`,
      iconSize:   [20, 20],
      iconAnchor: [10, 20],
    })
  : null

interface Props {
  lat:     number
  lng:     number
  zoom:    number
  geojson: object | null
}

export function LocationMap({ lat, lng, zoom, geojson }: Props) {
  return (
    <div className="rounded-xl overflow-hidden mt-4"
      style={{ height: 280, border: '1.5px solid rgba(10,46,77,0.1)' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl
        scrollWheelZoom={false}
        dragging
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {orangeMarker != null && (
          <Marker position={[lat, lng]} icon={orangeMarker} />
        )}

        {geojson != null && (
          <GeoJSON
            data={geojson as GeoJsonObject}
            style={{ color: '#E67E50', weight: 2, fillOpacity: 0.12 }}
          />
        )}
      </MapContainer>
    </div>
  )
}
