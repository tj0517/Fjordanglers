'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ExperienceWithGuide, LocationSpot } from '@/types'

export type MapBounds = { north: number; south: number; east: number; west: number }

function BoundsTracker({ onBoundsChange }: { onBoundsChange: (b: MapBounds) => void }) {
  const fire = useCallback(
    (map: ReturnType<typeof useMap>) => {
      const b = map.getBounds()
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    },
    [onBoundsChange],
  )

  const map = useMapEvents({
    moveend() { fire(map) },
    zoomend()  { fire(map) },
  })

  // Fire initial bounds so the card list is immediately in sync with the map
  // viewport — without this, bounds stays null until the first user interaction.
  useEffect(() => { fire(map) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function getCoords(exp: ExperienceWithGuide): [number, number] | null {
  if (exp.location_lat != null && exp.location_lng != null) {
    return [exp.location_lat, exp.location_lng]
  }
  return null
}

function priceIcon(price: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: white;
      color: #0A2E4D;
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 12px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">€${price}</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}

// Single-pin variant — plain white pill, no orange border
function singlePriceIcon(price: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: white;
      color: #0A2E4D;
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 12px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">€${price}</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}

// Area variant — white bg + subtle salmon ring signals "this covers a territory"
function areaPriceIcon(price: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: white;
      color: #0A2E4D;
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 12px rgba(0,0,0,0.14), 0 0 0 2px rgba(230,126,80,0.35);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">€${price}</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}

function popupIcon(price: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #E67E50;
      color: white;
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 16px rgba(230,126,80,0.5), 0 0 0 3px rgba(230,126,80,0.2);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">€${price}</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}


// ─── Inquiry pill for "price on request" experiences ─────────────────────────
function inquiryIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: white;
      color: rgba(10,46,77,0.55);
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 12px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">Req.</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}

function inquiryIconHover() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #0A2E4D;
      color: white;
      border-radius: 20px;
      padding: 5px 12px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 16px rgba(10,46,77,0.35);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
    ">Req.</div>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
    popupAnchor: [0, -18],
  })
}

// ─── Small dot icon for secondary spots ───────────────────────────────────────
function dotIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px;
      background: #E67E50;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 6px rgba(230,126,80,0.5);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  })
}

// ─── Area polygon overlay — hidden by default, shown only on marker hover ─────
function AreaOverlay({ exp, visible }: { exp: ExperienceWithGuide; visible: boolean }) {
  const map  = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)

  // Create the layer once, initially fully transparent
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const area = exp.location_area as any
    if (area == null) return
    const layer = L.geoJSON(area, {
      style: { color: '#E67E50', fillColor: '#E67E50', fillOpacity: 0, weight: 0, opacity: 0 },
    })
    layer.addTo(map)
    layerRef.current = layer
    return () => {
      map.removeLayer(layer)
      layerRef.current = null
    }
  }, [exp.id, map])

  // Toggle visibility whenever `visible` changes — no re-mount needed
  useEffect(() => {
    const layer = layerRef.current
    if (layer == null) return
    if (visible) {
      layer.setStyle({ fillOpacity: 0.11, weight: 1.5, opacity: 0.5 })
    } else {
      layer.setStyle({ fillOpacity: 0, weight: 0, opacity: 0 })
    }
  }, [visible])

  return null
}

// ─── Hint control — "hover / click a pin to see fishing area" ─────────────────
function AreaHoverHint() {
  const map = useMap()
  useEffect(() => {
    const container = L.DomUtil.create('div', '')
    container.innerHTML = `
      <div style="
        background: rgba(255,255,255,0.93);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 7px 11px;
        display: flex;
        align-items: center;
        gap: 7px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(10,46,77,0.06);
        pointer-events: none;
        user-select: none;
      ">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.5 1.5L13 4.75V10.25L7.5 13.5L2 10.25V4.75L7.5 1.5Z"
            stroke="#E67E50" stroke-width="1.4" stroke-linejoin="round"
            fill="rgba(230,126,80,0.12)" stroke-dasharray="2.5 1.5"/>
        </svg>
        <span style="
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          color: rgba(10,46,77,0.65);
          white-space: nowrap;
          line-height: 1;
        ">Hover to preview area · click pin to lock it</span>
      </div>
    `
    L.DomEvent.disableClickPropagation(container)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HintControl = L.Control.extend({ onAdd: () => container }) as any
    const ctrl = new HintControl({ position: 'bottomleft' })
    ctrl.addTo(map)
    return () => { ctrl.remove() }
  }, [map])
  return null
}

// ─── Clears pinnedAreaId when user clicks the map background ──────────────────
function MapClickClearer({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear })
  return null
}

// ─── Filled polygon overlay for multi-spot experiences ────────────────────────
function SpotsAreaOverlay({ spots, visible }: { spots: LocationSpot[]; visible: boolean }) {
  const map = useMap()
  const layerRef = useRef<L.Polygon | null>(null)

  useEffect(() => {
    if (spots.length < 2) return
    const poly = L.polygon(
      spots.map(s => [s.lat, s.lng] as [number, number]),
      { color: '#E67E50', fillColor: '#E67E50', fillOpacity: 0, weight: 0, opacity: 0 },
    )
    poly.addTo(map)
    layerRef.current = poly
    return () => { map.removeLayer(poly); layerRef.current = null }
  }, [spots, map])

  useEffect(() => {
    const p = layerRef.current
    if (p == null) return
    if (visible) {
      p.setStyle({ fillOpacity: 0.10, weight: 1.5, opacity: 0.45 })
    } else {
      p.setStyle({ fillOpacity: 0, weight: 0, opacity: 0 })
    }
  }, [visible])

  return null
}

type Props = {
  experiences: ExperienceWithGuide[]
  onBoundsChange?: (bounds: MapBounds) => void
  /** ID of the experience card being hovered in the listing panel */
  hoveredExpId?: string | null
}

// ─── Icon resolver — single source of truth ───────────────────────────────────
// Both card-hover (hoveredExpId from parent) and map-hover (mapHoveredId local)
// flow through here so the icon is always consistent.
// isSingle = true  → transparent pill with orange border (no background)
// isSingle = false → white pill with orange ring (area / multi-spot)
function resolveIcon(
  exp: ExperienceWithGuide,
  highlighted: boolean,
  isSingle: boolean,
): L.DivIcon {
  if (highlighted) {
    return exp.booking_type === 'icelandic'
      ? inquiryIconHover()
      : popupIcon(exp.price_per_person_eur ?? 0)
  }
  if (exp.booking_type === 'icelandic') return inquiryIcon()
  return isSingle
    ? singlePriceIcon(exp.price_per_person_eur ?? 0)
    : areaPriceIcon(exp.price_per_person_eur ?? 0)
}

// Shared popup content
function ExpPopup({ exp }: { exp: ExperienceWithGuide }) {
  return (
    <div style={{ width: '220px', fontFamily: 'DM Sans, sans-serif' }}>
      {exp.images[0]?.url != null && (
        <img
          src={exp.images[0].url}
          alt={exp.title}
          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px', marginBottom: '10px' }}
        />
      )}
      <p style={{ fontWeight: 700, fontSize: '14px', color: '#0A2E4D', margin: '0 0 4px' }}>
        {exp.title}
      </p>
      <p style={{ fontSize: '12px', color: 'rgba(10,46,77,0.5)', margin: '0 0 8px' }}>
        {exp.location_country} · {exp.fish_types.slice(0, 2).join(', ')}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {exp.booking_type === 'icelandic' ? (
          <span style={{ fontSize: '13px', color: 'rgba(10,46,77,0.5)', fontStyle: 'italic' }}>
            Price on request
          </span>
        ) : (
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0A2E4D' }}>
            €{exp.price_per_person_eur}
            <span style={{ fontWeight: 400, fontSize: '11px', color: 'rgba(10,46,77,0.4)' }}>/pp</span>
          </span>
        )}
        <a
          href={`/trips/${exp.id}`}
          style={{
            background: '#E67E50', color: 'white',
            borderRadius: '12px', padding: '5px 12px',
            fontSize: '12px', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View →
        </a>
      </div>
    </div>
  )
}

export default function MapView({ experiences, onBoundsChange, hoveredExpId }: Props) {
  // mapHoveredId — tracks which pin the mouse is over on the map.
  // Combined with hoveredExpId (card hover) via isHighlighted() below.
  // Replaces all previous direct e.target.setIcon() calls — icon is now
  // fully reactive so both hover sources work through a single code path.
  const [mapHoveredId,  setMapHoveredId]  = useState<string | null>(null)
  // pinnedAreaId — ID of the area-type experience whose polygon is "locked"
  // visible after a click. Stays until the same pin is clicked again or the
  // user clicks the map background.
  const [pinnedAreaId,  setPinnedAreaId]  = useState<string | null>(null)

  // An experience pin is visually highlighted if:
  //   • hovered on map, OR
  //   • its card is hovered in the listing panel, OR
  //   • its area has been pinned by a click
  const isHighlighted = (id: string) =>
    mapHoveredId === id ||
    (hoveredExpId != null && hoveredExpId === id) ||
    pinnedAreaId === id

  const multiSpot = experiences
    .map(exp => ({ exp, spots: (exp.location_spots as unknown as LocationSpot[] | null) ?? [] }))
    .filter(x => x.spots.length > 0)

  const withArea = experiences.filter(exp => {
    const spots = (exp.location_spots as unknown as LocationSpot[] | null) ?? []
    return spots.length === 0 && exp.location_area != null
  })

  const singlePin = experiences
    .filter(exp => {
      const spots = (exp.location_spots as unknown as LocationSpot[] | null) ?? []
      return spots.length === 0 && exp.location_area == null
    })
    .map(exp => ({ exp, coords: getCoords(exp) }))
    .filter((x): x is { exp: ExperienceWithGuide; coords: [number, number] } => x.coords != null)

  return (
    <MapContainer
      center={[63.5, 14.0]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      scrollWheelZoom
    >
      {onBoundsChange != null && <BoundsTracker onBoundsChange={onBoundsChange} />}

      {/* Clears pinned area when user clicks map background */}
      <MapClickClearer onClear={() => setPinnedAreaId(null)} />

      {/* Hint badge */}
      {experiences.length > 0 && <AreaHoverHint />}

      {/* CartoDB Voyager — free, modern, no API key */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      {/* ─── Area experiences — polygon hidden until highlighted ────────── */}
      {withArea.map(exp => {
        const coords  = getCoords(exp)
        const highlighted = isHighlighted(exp.id)
        return (
          <span key={exp.id}>
            {/* Area overlay visible when this experience is highlighted from
                either the map marker hover OR a card hover in the listing */}
            <AreaOverlay exp={exp} visible={highlighted} />
            {coords != null && (
              <Marker
                position={coords}
                icon={resolveIcon(exp, highlighted, false)}
                eventHandlers={{
                  mouseover: () => setMapHoveredId(exp.id),
                  mouseout:  () => setMapHoveredId(null),
                  // Toggle pinned area: click same pin to unpin, click another to switch
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent)
                    setPinnedAreaId(prev => prev === exp.id ? null : exp.id)
                  },
                }}
              >
                <Popup closeButton={false} className="fjord-popup">
                  <ExpPopup exp={exp} />
                </Popup>
              </Marker>
            )}
          </span>
        )
      })}

      {/* ─── Single-pin experiences ─────────────────────────────────────── */}
      {singlePin.map(({ exp, coords }) => (
        <span key={exp.id}>
          <Marker
            position={coords}
            icon={resolveIcon(exp, isHighlighted(exp.id), true)}
            eventHandlers={{
              mouseover: () => setMapHoveredId(exp.id),
              mouseout:  () => setMapHoveredId(null),
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent)
                setPinnedAreaId(prev => prev === exp.id ? null : exp.id)
              },
            }}
          >
            <Popup closeButton={false} className="fjord-popup">
              <ExpPopup exp={exp} />
            </Popup>
          </Marker>
        </span>
      ))}

      {/* ─── Multi-spot experiences ─────────────────────────────────────── */}
      {multiSpot.map(({ exp, spots }) => (
        <span key={exp.id}>
          <SpotsAreaOverlay spots={spots} visible={isHighlighted(exp.id)} />
          {/* Primary spot — price bubble, highlights from both hover sources */}
          <Marker
            position={[spots[0].lat, spots[0].lng]}
            icon={resolveIcon(exp, isHighlighted(exp.id), false)}
            eventHandlers={{
              mouseover: () => setMapHoveredId(exp.id),
              mouseout:  () => setMapHoveredId(null),
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent)
                setPinnedAreaId(prev => prev === exp.id ? null : exp.id)
              },
            }}
          >
            <Popup closeButton={false} className="fjord-popup">
              <ExpPopup exp={exp} />
            </Popup>
          </Marker>
          {/* Secondary spots — dots visible only when price pin is hovered/highlighted */}
          {isHighlighted(exp.id) && spots.slice(1).map((s, i) => (
            <Marker key={i} position={[s.lat, s.lng]} icon={dotIcon()}>
              <Popup closeButton={false} className="fjord-popup">
                <ExpPopup exp={exp} />
              </Popup>
            </Marker>
          ))}
        </span>
      ))}

    </MapContainer>
  )
}
