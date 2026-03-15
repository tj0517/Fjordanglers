'use client'

/**
 * ExperienceLocationMap — read-only Leaflet map for the experience detail page.
 *
 * Supports three display modes:
 *  • Single pin — when only lat/lng are set
 *  • Area polygon — when location_area (GeoJSON.Polygon) is set
 *  • Multi-spot — when location_spots ([{lat, lng, name}]) is set:
 *      renders labeled pins + dashed polyline, auto-fits bounds
 *
 * Must be loaded via dynamic import with { ssr: false }.
 */

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type * as GeoJSON from 'geojson'
import type { LocationSpot } from '@/types'

// ─── Salmon teardrop pin ───────────────────────────────────────────────────────
let _pin: L.DivIcon | null = null
function getPin(): L.DivIcon {
  if (_pin != null) return _pin
  _pin = L.divIcon({
    className: '',
    html: `<svg width="22" height="30" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(230,126,80,0.50)"/>
      </filter>
      <path d="M14 0C6.268 0 0 6.268 0 14C0 21.732 5.6 29.4 14 38C22.4 29.4 28 21.732 28 14C28 6.268 21.732 0 14 0Z"
            fill="#E67E50" filter="url(#s)"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
      <circle cx="14" cy="14" r="3"   fill="#E67E50"/>
    </svg>`,
    iconSize:   [22, 30],
    iconAnchor: [11, 30],
  })
  return _pin
}

// ─── Area overlay + auto-fit ──────────────────────────────────────────────────
function AreaLayer({ area }: { area: GeoJSON.Polygon }) {
  const map = useMap()
  useEffect(() => {
    const layer = L.geoJSON(area, {
      style: {
        color: '#E67E50',
        fillColor: '#E67E50',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '5 4',
      },
    })
    layer.addTo(map)
    map.fitBounds(layer.getBounds(), { padding: [32, 32] })
    return () => { map.removeLayer(layer) }
  }, [area, map])
  return null
}

// ─── Multi-spot polyline connector + auto-fit ─────────────────────────────────
function SpotsConnector({ spots }: { spots: LocationSpot[] }) {
  const map = useMap()
  useEffect(() => {
    if (spots.length < 2) return
    const latlngs = spots.map(s => [s.lat, s.lng] as [number, number])
    const line = L.polyline(latlngs, {
      color: '#E67E50',
      weight: 2,
      dashArray: '6 5',
      opacity: 0.65,
    })
    line.addTo(map)
    map.fitBounds(line.getBounds(), { padding: [40, 40] })
    return () => { map.removeLayer(line) }
  }, [spots, map])
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  lat: number
  lng: number
  area?: GeoJSON.Polygon | null
  spots?: LocationSpot[] | null
}

export default function ExperienceLocationMap({ lat, lng, area, spots }: Props) {
  const hasSpots = spots != null && spots.length > 0

  const center: [number, number] =
    hasSpots ? [spots[0].lat, spots[0].lng] : [lat, lng]
  const zoom = hasSpots ? 9 : area != null ? 8 : 11

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      zoomControl
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />

      {/* Multi-spot mode */}
      {hasSpots && (
        <>
          <SpotsConnector spots={spots} />
          {spots.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lng]} icon={getPin()}>
              <Tooltip permanent direction="top" offset={[0, -32]} opacity={1}>
                <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'DM Sans, sans-serif', color: '#0A2E4D' }}>
                  {s.name}
                </span>
              </Tooltip>
            </Marker>
          ))}
        </>
      )}

      {/* Area mode */}
      {!hasSpots && area != null && <AreaLayer area={area} />}

      {/* Single-pin mode */}
      {!hasSpots && area == null && (
        <Marker position={[lat, lng]} icon={getPin()} />
      )}
    </MapContainer>
  )
}
