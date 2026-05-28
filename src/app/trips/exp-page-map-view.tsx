'use client'

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import Supercluster from 'supercluster'
import 'leaflet/dist/leaflet.css'
import type { ExpPage } from './exp-page-map-section'

export type MapBounds = { north: number; south: number; east: number; west: number }

// ─── Supercluster point properties ────────────────────────────────────────────
type PointProps = {
  pageId: string
  slug: string
  price: number
}

// ─── Area color palette ───────────────────────────────────────────────────────
// Distinct colors for overlapping area polygons so users can tell them apart.
const AREA_PALETTE = [
  '#E67E50', // Salmon Orange
  '#0A2E4D', // Fjord Blue
]

// ─── Country bounding boxes ───────────────────────────────────────────────────
const COUNTRY_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'Norway':  [[57.5,  4.0],  [71.5, 31.5]],
  'Sweden':  [[55.0, 10.5],  [69.5, 24.5]],
  'Denmark': [[54.5,  7.5],  [58.0, 15.5]],
  'Finland': [[59.5, 18.5],  [70.5, 31.5]],
  'Iceland': [[63.0, -25.5], [66.8, -12.5]],
}

function computeCountryBounds(countries: string[]): L.LatLngBoundsExpression | null {
  let swLat = Infinity, swLng = Infinity, neLat = -Infinity, neLng = -Infinity
  let found = false
  for (const c of countries) {
    const b = COUNTRY_BOUNDS[c]
    if (b == null) continue
    found = true
    swLat = Math.min(swLat, b[0][0]); swLng = Math.min(swLng, b[0][1])
    neLat = Math.max(neLat, b[1][0]); neLng = Math.max(neLng, b[1][1])
  }
  return found ? [[swLat, swLng], [neLat, neLng]] : null
}

function collectPoints(pages: ExpPage[]): L.LatLngTuple[] {
  const pts: L.LatLngTuple[] = []
  for (const p of pages) {
    if (p.location_lat != null && p.location_lng != null)
      pts.push([p.location_lat, p.location_lng])
  }
  return pts
}

// ─── Area polygon layer ────────────────────────────────────────────────────────
// Only renders polygons for pages whose pin is currently shown as an individual
// marker (not merged into a cluster). This prevents visual clutter when zoomed out.
// Pages with an area but no lat/lng (no clusterable pin) are always shown.
function AreaLayer({
  pages,
  areaColors,
  visibleIds,
}: {
  pages: ExpPage[]
  areaColors: Record<string, string>
  visibleIds: Set<string>
}) {
  const areas = useMemo(
    () => pages.filter(p => {
      if (p.location_area == null) return false
      // No lat/lng → can't be in a cluster → always visible
      if (p.location_lat == null) return true
      return visibleIds.has(p.id)
    }),
    [pages, visibleIds],
  )
  if (areas.length === 0) return null
  return (
    <>
      {areas.map(p => {
        const polygon = p.location_area as import('geojson').Polygon
        const positions = polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
        const color = areaColors[p.id] ?? AREA_PALETTE[0]
        return (
          <Polygon
            key={p.id}
            positions={positions}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.10,
              weight: 1.5,
              opacity: 0.55,
              dashArray: '5 4',
            }}
          />
        )
      })}
    </>
  )
}

// ─── MapPositioner ────────────────────────────────────────────────────────────
function MapPositioner({ pages, countries }: { pages: ExpPage[]; countries: string[] }) {
  const map = useMap()
  const mounted = useRef(false)

  useEffect(() => {
    const isFirst = !mounted.current
    mounted.current = true

    if (countries.length > 0) {
      const b = computeCountryBounds(countries)
      if (b) {
        if (isFirst) {
          map.fitBounds(b as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 8, animate: false })
        } else {
          map.flyToBounds(b as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 8, duration: 0.5 })
        }
      }
      return
    }

    // Single page: fit to area polygon, or center on lat/lng
    if (pages.length === 1) {
      const p = pages[0]
      const area = p.location_area as import('geojson').Polygon | null
      if (area?.coordinates?.[0]) {
        const latlngs = area.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
        const bounds = L.latLngBounds(latlngs)
        if (isFirst) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: false })
        else map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 13, duration: 0.5 })
      } else if (p.location_lat != null && p.location_lng != null) {
        if (isFirst) map.setView([p.location_lat, p.location_lng], 9, { animate: false })
        else map.flyTo([p.location_lat, p.location_lng], 9, { duration: 0.5 })
      }
      return
    }

    const pts = collectPoints(pages)
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 7, animate: !isFirst })
    }
  }, [pages, countries, map])

  return null
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

// ─── Map click clearer ────────────────────────────────────────────────────────
function MapClickClearer({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear })
  return null
}

// ─── Pin icons ────────────────────────────────────────────────────────────────

// Standard pin (no area)
function pinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 30px; height: 30px;
      background: #0A2E4D;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 2px 10px rgba(10,46,77,0.40);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    ">
      <img src="/brand/sygnet.png" style="width:17px;height:17px;object-fit:contain;" draggable="false"/>
    </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -18],
  })
}

// Pin with a colored outer ring — visually connects it to its area polygon
function pinIconWithArea(areaColor: string) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        border:2.5px solid ${areaColor};opacity:0.65;
        box-shadow:0 0 0 1px ${areaColor}22;
      "></div>
      <div style="
        position:absolute;inset:4px;
        background:#0A2E4D;border-radius:50%;
        border:2px solid white;
        box-shadow:0 2px 10px rgba(10,46,77,0.40);
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;overflow:hidden;
      ">
        <img src="/brand/sygnet.png" style="width:14px;height:14px;object-fit:contain;" draggable="false"/>
      </div>
    </div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
  })
}

// Highlighted / hovered pin (no area)
function pinIconHover() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 38px; height: 38px;
      background: #E67E50;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 3px 18px rgba(230,126,80,0.65);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    ">
      <img src="/brand/sygnet-black.png" style="width:21px;height:21px;object-fit:contain;opacity:0.85;" draggable="false"/>
    </div>`,
    iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22],
  })
}

// Highlighted pin with area color ring
function pinIconHoverWithArea(areaColor: string) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:44px;height:44px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        border:2.5px solid ${areaColor};opacity:0.7;
      "></div>
      <div style="
        position:absolute;inset:3px;
        background:#E67E50;border-radius:50%;
        border:3px solid white;
        box-shadow:0 3px 18px rgba(230,126,80,0.65);
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;overflow:hidden;
      ">
        <img src="/brand/sygnet-black.png" style="width:18px;height:18px;object-fit:contain;opacity:0.85;" draggable="false"/>
      </div>
    </div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
  })
}

function clusterIcon(count: number) {
  const big = count >= 10
  return L.divIcon({
    className: '',
    html: `<div style="
      background: #0A2E4D; color: white;
      border-radius: 20px;
      padding: ${big ? '6px 14px' : '5px 12px'};
      font-weight: 700; font-size: ${big ? '14px' : '13px'};
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 2px 16px rgba(10,46,77,0.35), 0 0 0 3px rgba(10,46,77,0.12);
      white-space: nowrap; cursor: pointer; line-height: 1.2;
      display: flex; align-items: center; gap: 5px;
    ">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="4" r="2" fill="rgba(255,255,255,0.55)"/>
        <circle cx="9" cy="4" r="1.5" fill="rgba(255,255,255,0.38)"/>
        <circle cx="6" cy="8.5" r="1.5" fill="rgba(255,255,255,0.38)"/>
      </svg>
      ${count}
    </div>`,
    iconSize: [big ? 54 : 46, 28], iconAnchor: [big ? 27 : 23, 14],
  })
}

// ─── Popup card ───────────────────────────────────────────────────────────────
function ExpPagePopup({ page }: { page: ExpPage }) {
  const gallery = (page.gallery_image_urls as string[] | null) ?? []
  const imgUrl  = gallery[0] ?? page.hero_image_url

  return (
    <div style={{ width: '220px', fontFamily: 'DM Sans, sans-serif' }}>
      {imgUrl != null && (
        <img
          src={imgUrl}
          alt={page.experience_name}
          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px', marginBottom: '10px' }}
        />
      )}
      <p style={{ fontWeight: 700, fontSize: '14px', color: '#0A2E4D', margin: '0 0 4px' }}>
        {page.experience_name}
      </p>
      <p style={{ fontSize: '12px', color: 'rgba(10,46,77,0.5)', margin: '0 0 8px' }}>
        {page.region}, {page.country}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0A2E4D' }}>
          {page.price_type === 'request' ? 'Price on request' : page.price_type === 'flat' ? `from €${page.price_from} for the group` : `from €${page.price_from} / person`}
        </span>
        <a
          href={`/experiences/${page.slug}`}
          style={{
            background: '#E67E50', color: 'white',
            borderRadius: '12px', padding: '5px 12px',
            fontSize: '12px', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Inquire →
        </a>
      </div>
    </div>
  )
}

// ─── Build supercluster points ─────────────────────────────────────────────────
function buildPoints(pages: ExpPage[]): Supercluster.PointFeature<PointProps>[] {
  const points: Supercluster.PointFeature<PointProps>[] = []
  for (const page of pages) {
    if (page.location_lat == null || page.location_lng == null) continue
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [page.location_lng, page.location_lat] },
      properties: { pageId: page.id, slug: page.slug, price: page.price_from },
    })
  }
  return points
}

// ─── Cluster layer ─────────────────────────────────────────────────────────────
type ClusterLayerProps = {
  pages: ExpPage[]
  isHighlighted: (id: string) => boolean
  setMapHoveredId: (id: string | null) => void
  onMarkerClick: (e: L.LeafletMouseEvent, pageId: string) => void
  showPopups: boolean
  areaColors: Record<string, string>
  onIndividualIdsChange: (ids: Set<string>) => void
}

function ClusterLayer({
  pages,
  isHighlighted,
  setMapHoveredId,
  onMarkerClick,
  showPopups,
  areaColors,
  onIndividualIdsChange,
}: ClusterLayerProps) {
  const map = useMap()

  type AnyFeature =
    | Supercluster.ClusterFeature<Supercluster.AnyProps>
    | Supercluster.PointFeature<PointProps>

  const [clusters, setClusters] = useState<AnyFeature[]>([])
  const indexRef = useRef<Supercluster<PointProps> | null>(null)

  const pageById = useMemo(() => new Map(pages.map(p => [p.id, p])), [pages])

  const updateClusters = useCallback(() => {
    const idx = indexRef.current
    if (idx == null) return
    const bounds = map.getBounds()
    const zoom   = Math.floor(map.getZoom())
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ]
    const next = idx.getClusters(bbox, zoom)
    setClusters(next)

    // Tell the parent which pages are currently visible as individual pins
    // so AreaLayer can hide polygons for clustered pages.
    const individualIds = new Set<string>()
    for (const f of next) {
      const props = f.properties as (Supercluster.ClusterProperties & PointProps)
      if (props.cluster !== true) individualIds.add(props.pageId)
    }
    onIndividualIdsChange(individualIds)
  }, [map, onIndividualIdsChange])

  useEffect(() => {
    const points = buildPoints(pages)
    const idx = new Supercluster<PointProps>({ radius: 60, maxZoom: 14 })
    idx.load(points)
    indexRef.current = idx
    updateClusters()
  }, [pages, updateClusters])

  useMapEvents({ moveend: updateClusters, zoomend: updateClusters })

  return (
    <>
      {clusters.map(feature => {
        const [lng, lat] = feature.geometry.coordinates
        const props = feature.properties as (Supercluster.ClusterProperties & PointProps)

        if (props.cluster === true) {
          const clusterId = (feature as Supercluster.ClusterFeature<PointProps>).id as number
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={clusterIcon(props.point_count)}
              eventHandlers={{
                click: () => {
                  const zoom = Math.min(indexRef.current!.getClusterExpansionZoom(clusterId), 16)
                  map.flyTo([lat, lng], zoom, { duration: 0.35 })
                },
              }}
            />
          )
        }

        const { pageId } = props
        const page = pageById.get(pageId)
        if (page == null) return null

        const highlighted = isHighlighted(pageId)
        const areaColor = areaColors[pageId]
        const icon = areaColor != null
          ? (highlighted ? pinIconHoverWithArea(areaColor) : pinIconWithArea(areaColor))
          : (highlighted ? pinIconHover() : pinIcon())

        return (
          <Marker
            key={pageId}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{
              mouseover: () => setMapHoveredId(pageId),
              mouseout:  () => setMapHoveredId(null),
              click:     (e) => onMarkerClick(e, pageId),
            }}
          >
            {showPopups && (
              <Popup closeButton={false} className="fjord-popup">
                <ExpPagePopup page={page} />
              </Popup>
            )}
          </Marker>
        )
      })}
    </>
  )
}

// ─── Main MapView ──────────────────────────────────────────────────────────────
type Props = {
  pages: ExpPage[]
  onBoundsChange?: (bounds: MapBounds) => void
  hoveredPageId?: string | null
  onPinClick?: (id: string) => void
  showPopups?: boolean
  countries?: string[]
  interactive?: boolean
}

export default function ExpPageMapView({
  pages,
  onBoundsChange,
  hoveredPageId,
  onPinClick,
  showPopups = true,
  countries = [],
  interactive = true,
}: Props) {
  const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId]         = useState<string | null>(null)
  const [individualIds, setIndividualIds] = useState<Set<string>>(new Set())

  // Assign a distinct color to each experience that has an area polygon.
  // Colors stay stable as long as the pages array reference is stable.
  const areaColors = useMemo(() => {
    const map: Record<string, string> = {}
    let i = 0
    for (const p of pages) {
      if (p.location_area != null) {
        map[p.id] = AREA_PALETTE[i % AREA_PALETTE.length]
        i++
      }
    }
    return map
  }, [pages])

  const isHighlighted = useCallback(
    (id: string) =>
      mapHoveredId === id ||
      (hoveredPageId != null && hoveredPageId === id) ||
      pinnedId === id,
    [mapHoveredId, hoveredPageId, pinnedId],
  )

  const handleMarkerClick = useCallback(
    (e: L.LeafletMouseEvent, pageId: string) => {
      L.DomEvent.stopPropagation(e.originalEvent)
      setPinnedId(prev => prev === pageId ? null : pageId)
      onPinClick?.(pageId)
    },
    [onPinClick],
  )

  const handleIndividualIdsChange = useCallback((ids: Set<string>) => {
    setIndividualIds(ids)
  }, [])

  return (
    <MapContainer
      center={[63.5, 2.0]}
      zoom={4}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
    >
      <MapPositioner pages={pages} countries={countries} />
      {onBoundsChange != null && <BoundsTracker onBoundsChange={onBoundsChange} />}
      <MapClickClearer onClear={() => setPinnedId(null)} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      {/* Area polygons — hidden when their pin is inside a cluster */}
      <AreaLayer pages={pages} areaColors={areaColors} visibleIds={individualIds} />

      <ClusterLayer
        pages={pages}
        isHighlighted={isHighlighted}
        setMapHoveredId={setMapHoveredId}
        onMarkerClick={handleMarkerClick}
        showPopups={showPopups}
        areaColors={areaColors}
        onIndividualIdsChange={handleIndividualIdsChange}
      />
    </MapContainer>
  )
}
