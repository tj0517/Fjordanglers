'use client'

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import Supercluster from 'supercluster'
import 'leaflet/dist/leaflet.css'
import type { ExperienceWithGuide, LocationSpot } from '@/types'

export type MapBounds = { north: number; south: number; east: number; west: number }

// ─── Supercluster point properties ────────────────────────────────────────────
type PointProps = {
  expId: string
  price: number | null
  bookingType: string | null
}

// ─── BoundsTracker ────────────────────────────────────────────────────────────
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

  useEffect(() => { fire(map) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

// ─── Icon factory functions ────────────────────────────────────────────────────

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

function inquiryIcon() {
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
    ">Custom</div>`,
    iconSize: [76, 28],
    iconAnchor: [38, 14],
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
    ">Custom</div>`,
    iconSize: [76, 28],
    iconAnchor: [38, 14],
    popupAnchor: [0, -18],
  })
}

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

// ─── Cluster icon — dark Fjord Blue pill with count ────────────────────────────
function clusterIcon(count: number) {
  // Scale the pill slightly for larger clusters
  const big = count >= 10
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #0A2E4D;
      color: white;
      border-radius: 20px;
      padding: ${big ? '6px 14px' : '5px 12px'};
      font-weight: 700;
      font-size: ${big ? '14px' : '13px'};
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 16px rgba(10,46,77,0.35), 0 0 0 3px rgba(10,46,77,0.12);
      white-space: nowrap;
      cursor: pointer;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 5px;
    ">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="4" r="2" fill="rgba(255,255,255,0.55)"/>
        <circle cx="9" cy="4" r="1.5" fill="rgba(255,255,255,0.38)"/>
        <circle cx="6" cy="8.5" r="1.5" fill="rgba(255,255,255,0.38)"/>
      </svg>
      ${count}
    </div>`,
    iconSize: [big ? 54 : 46, 28],
    iconAnchor: [big ? 27 : 23, 14],
  })
}

// ─── Icon resolver ─────────────────────────────────────────────────────────────
function resolveIcon(exp: ExperienceWithGuide, highlighted: boolean): L.DivIcon {
  if (highlighted) {
    return exp.booking_type === 'icelandic'
      ? inquiryIconHover()
      : popupIcon(exp.price_per_person_eur ?? 0)
  }
  if (exp.booking_type === 'icelandic') return inquiryIcon()
  return singlePriceIcon(exp.price_per_person_eur ?? 0)
}

// ─── Map click clearer ─────────────────────────────────────────────────────────
function MapClickClearer({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear })
  return null
}

// ─── Popup card ────────────────────────────────────────────────────────────────
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

// ─── Build supercluster GeoJSON points from experiences ────────────────────────
function buildPoints(
  experiences: ExperienceWithGuide[],
): Supercluster.PointFeature<PointProps>[] {
  const points: Supercluster.PointFeature<PointProps>[] = []

  for (const exp of experiences) {
    const spots = (exp.location_spots as unknown as LocationSpot[] | null) ?? []
    let lat: number | null = null
    let lng: number | null = null

    if (spots.length > 0) {
      lat = spots[0].lat
      lng = spots[0].lng
    } else if (exp.location_lat != null && exp.location_lng != null) {
      lat = exp.location_lat
      lng = exp.location_lng
    }

    if (lat == null || lng == null) continue

    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        expId: exp.id,
        price: exp.price_per_person_eur,
        bookingType: exp.booking_type,
      },
    })
  }

  return points
}

// ─── Cluster layer — primary markers + supercluster ────────────────────────────
// Owns supercluster index + cluster state.
// Re-clusters on map move/zoom and when experiences prop changes.

type ClusterLayerProps = {
  experiences: ExperienceWithGuide[]
  isHighlighted: (id: string) => boolean
  setMapHoveredId: (id: string | null) => void
  onMarkerClick: (e: L.LeafletMouseEvent, expId: string) => void
  showPopups: boolean
}

function ClusterLayer({
  experiences,
  isHighlighted,
  setMapHoveredId,
  onMarkerClick,
  showPopups,
}: ClusterLayerProps) {
  const map = useMap()

  // ClusterFeature uses AnyProps for its own cluster-level properties (from @types/supercluster)
  type AnyFeature =
    | Supercluster.ClusterFeature<Supercluster.AnyProps>
    | Supercluster.PointFeature<PointProps>

  const [clusters, setClusters] = useState<AnyFeature[]>([])
  const indexRef = useRef<Supercluster<PointProps> | null>(null)

  // O(1) lookup: expId → ExperienceWithGuide
  const expById = useMemo(
    () => new Map(experiences.map(e => [e.id, e])),
    [experiences],
  )

  // Re-query the current viewport from the index
  const updateClusters = useCallback(() => {
    const idx = indexRef.current
    if (idx == null) return
    const bounds = map.getBounds()
    const zoom   = Math.floor(map.getZoom())
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ]
    setClusters(idx.getClusters(bbox, zoom))
  }, [map])

  // Rebuild the index whenever experiences change
  useEffect(() => {
    const points = buildPoints(experiences)
    const idx = new Supercluster<PointProps>({ radius: 60, maxZoom: 14 })
    idx.load(points)
    indexRef.current = idx
    updateClusters()
  }, [experiences, updateClusters])

  // Re-cluster on map pan/zoom
  useMapEvents({ moveend: updateClusters, zoomend: updateClusters })

  return (
    <>
      {clusters.map(feature => {
        const [lng, lat] = feature.geometry.coordinates
        const props = feature.properties as (Supercluster.ClusterProperties & PointProps)

        // ── Cluster bubble ──────────────────────────────────────────────────
        if (props.cluster === true) {
          const clusterId = (feature as Supercluster.ClusterFeature<PointProps>).id as number
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={clusterIcon(props.point_count)}
              eventHandlers={{
                click: () => {
                  const zoom = Math.min(
                    indexRef.current!.getClusterExpansionZoom(clusterId),
                    16,
                  )
                  map.flyTo([lat, lng], zoom, { duration: 0.35 })
                },
              }}
            />
          )
        }

        // ── Individual price pill ───────────────────────────────────────────
        const { expId } = props
        const exp = expById.get(expId)
        if (exp == null) return null

        const highlighted = isHighlighted(expId)

        return (
          <Marker
            key={expId}
            position={[lat, lng]}
            icon={resolveIcon(exp, highlighted)}
            eventHandlers={{
              mouseover: () => setMapHoveredId(expId),
              mouseout:  () => setMapHoveredId(null),
              click:     (e) => onMarkerClick(e, expId),
            }}
          >
            {showPopups && (
              <Popup closeButton={false} className="fjord-popup">
                <ExpPopup exp={exp} />
              </Popup>
            )}
          </Marker>
        )
      })}
    </>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  experiences: ExperienceWithGuide[]
  onBoundsChange?: (bounds: MapBounds) => void
  hoveredExpId?: string | null
  onPinClick?: (id: string) => void
  showPopups?: boolean
}

// ─── Main MapView ──────────────────────────────────────────────────────────────
export default function MapView({
  experiences,
  onBoundsChange,
  hoveredExpId,
  onPinClick,
  showPopups = true,
}: Props) {
  const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
  const [pinnedAreaId, setPinnedAreaId] = useState<string | null>(null)

  // Memoised so ClusterLayer only re-renders when highlight state actually changes
  const isHighlighted = useCallback(
    (id: string) =>
      mapHoveredId === id ||
      (hoveredExpId != null && hoveredExpId === id) ||
      pinnedAreaId === id,
    [mapHoveredId, hoveredExpId, pinnedAreaId],
  )

  // Stable click handler: toggle pinnedAreaId + propagate to parent
  const handleMarkerClick = useCallback(
    (e: L.LeafletMouseEvent, expId: string) => {
      L.DomEvent.stopPropagation(e.originalEvent)
      setPinnedAreaId(prev => prev === expId ? null : expId)
      onPinClick?.(expId)
    },
    [onPinClick],
  )

  // Multi-spot experiences — secondary dots shown on hover
  const multiSpot = experiences
    .map(exp => ({ exp, spots: (exp.location_spots as unknown as LocationSpot[] | null) ?? [] }))
    .filter(x => x.spots.length > 1)

  return (
    <MapContainer
      center={[63.5, 2.0]}
      zoom={4}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      scrollWheelZoom
    >
      {onBoundsChange != null && <BoundsTracker onBoundsChange={onBoundsChange} />}

      {/* Clears pinned highlight when user clicks map background */}
      <MapClickClearer onClear={() => setPinnedAreaId(null)} />

      {/* CartoDB Voyager tile layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      {/* ── Secondary spot dots — shown on hover, no polygon connecting them ── */}
      {multiSpot.flatMap(({ exp, spots }) =>
        isHighlighted(exp.id)
          ? spots.slice(1).map((s, i) => (
              <Marker key={`${exp.id}-dot-${i}`} position={[s.lat, s.lng]} icon={dotIcon()}>
                {showPopups && (
                  <Popup closeButton={false} className="fjord-popup">
                    <ExpPopup exp={exp} />
                  </Popup>
                )}
              </Marker>
            ))
          : [],
      )}

      {/* ── Clustered primary markers — one per experience ── */}
      <ClusterLayer
        experiences={experiences}
        isHighlighted={isHighlighted}
        setMapHoveredId={setMapHoveredId}
        onMarkerClick={handleMarkerClick}
        showPopups={showPopups}
      />
    </MapContainer>
  )
}
