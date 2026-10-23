'use client'

/**
 * The hub map itself (FA-1.66) — Leaflet, so it is loaded only through `./hub-map` with
 * `ssr: false` and never on a hub without pins.
 *
 * One FA pin per offer with coordinates, the view fitted to the pins. Hovering a pin opens
 * its popup (name, price, guide, link to the offer); clicking or tapping it selects the offer,
 * which scrolls the cards to it (tj, 2026-10-23: a phone has no hover, so a tap goes straight
 * to the card). The popup is a standalone layer, not bound to the marker — a bound popup
 * would also toggle on that click. Each hover mounts it afresh and a map click removes it;
 * Leaflet's own `popupclose` is not listened to, because React's dev remount fires it too.
 * Scroll-wheel zoom is off: the map sits in a page people scroll through.
 */

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { pinIcon } from '@/components/map/pin-icon'

export type HubMapPin = {
  slug:      string
  name:      string
  priceText: string
  guideName: string | null
  lat:       number
  lng:       number
}

function FitToPins({ pins }: { pins: HubMapPin[] }) {
  const map = useMap()

  useEffect(() => {
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 8, { animate: false })
      return
    }
    const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng] as L.LatLngTuple))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9, animate: false })
  }, [pins, map])

  return null
}

function MapClick({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick })
  return null
}

function PinPopup({ pin }: { pin: HubMapPin }) {
  return (
    <div style={{ width: '200px', fontFamily: 'DM Sans, sans-serif' }}>
      <p style={{ fontWeight: 700, fontSize: '14px', color: '#0A2E4D', margin: '0 0 4px' }}>{pin.name}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0A2E4D', margin: '0 0 4px' }}>{pin.priceText}</p>
      {pin.guideName != null && (
        <p style={{ fontSize: '12px', color: 'rgba(10,46,77,0.62)', margin: '0 0 10px' }}>with {pin.guideName}</p>
      )}
      <a
        href={`/experiences/${pin.slug}`}
        style={{ fontSize: '13px', fontWeight: 600, color: '#0A2E4D', textDecoration: 'underline' }}
      >
        View trip →
      </a>
    </div>
  )
}

export default function HubMapView({
  pins,
  onPinClick,
}: {
  pins:       HubMapPin[]
  onPinClick: (slug: string) => void
}) {
  const [hovered, setHovered] = useState<{ pin: HubMapPin; n: number } | null>(null)
  const hoverCount = useRef(0)

  const hover = (pin: HubMapPin) => {
    hoverCount.current += 1
    setHovered({ pin, n: hoverCount.current })
  }

  return (
    <MapContainer
      center={[pins[0].lat, pins[0].lng]}
      zoom={6}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
    >
      <FitToPins pins={pins} />
      <MapClick onClick={() => setHovered(null)} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {pins.map(pin => (
        <Marker
          key={pin.slug}
          position={[pin.lat, pin.lng]}
          icon={pinIcon()}
          eventHandlers={{
            mouseover: () => hover(pin),
            click:     () => onPinClick(pin.slug),
            keypress:  e => { if (e.originalEvent.key === 'Enter') onPinClick(pin.slug) },
          }}
        />
      ))}

      {hovered != null && (
        <Popup key={hovered.n} position={[hovered.pin.lat, hovered.pin.lng]} offset={[0, -12]} closeButton={false}>
          <PinPopup pin={hovered.pin} />
        </Popup>
      )}
    </MapContainer>
  )
}
