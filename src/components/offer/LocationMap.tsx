'use client'

/**
 * LocationMap — read-only Leaflet map shown on the angler-facing offer page.
 *
 * Shows the FA sygnet pin (and optional area polygon) on an OpenStreetMap base.
 * Scroll-wheel zoom is disabled so the angler doesn't accidentally zoom
 * when scrolling through the offer page.
 *
 * Dynamically imported with ssr: false from the offer page Server Component.
 */

import 'leaflet/dist/leaflet.css'

import { MapContainer, TileLayer, Marker, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { pinIcon } from '@/components/map/pin-icon'

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

const sygnetMarker = typeof window !== 'undefined' ? pinIcon() : null

interface Props {
  lat:     number
  lng:     number
  zoom:    number
  geojson: object | null
}

export function LocationMap({ lat, lng, zoom, geojson }: Props) {
  // `isolate`: Leaflet gives its panes z-index 200–700 and its controls 1000. Without a
  // stacking context of its own the map competed with the page's layers and was drawn over
  // them (on v2 S11: the mobile booking bar z-40 and the inquiry wizard z-50). Here, all of
  // Leaflet's z-index stays inside the map, on every page that shows it.
  return (
    <div className="isolate rounded-xl overflow-hidden mt-4"
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

        {sygnetMarker != null && (
          <Marker position={[lat, lng]} icon={sygnetMarker} />
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
