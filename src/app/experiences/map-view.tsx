'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ExperienceWithGuide } from '@/types'

// ─── Approximate fishing locations per country ────────────────────────────────
const FISHING_LOCS: Record<string, [number, number][]> = {
  Norway: [
    [60.39, 5.32],   // Bergen fjords
    [69.65, 18.96],  // Tromsø Arctic
    [62.47, 6.15],   // Ålesund
    [58.97, 5.73],   // Stavanger fjords
    [63.43, 10.39],  // Trondheim
    [61.22, 7.10],   // Sognefjord
    [70.66, 23.68],  // Alta salmon river
  ],
  Sweden: [
    [57.71, 11.97],  // Gothenburg archipelago
    [65.58, 22.15],  // Luleå
    [63.18, 14.64],  // Östersund
    [68.35, 18.82],  // Kiruna
    [59.33, 18.07],  // Stockholm archipelago
    [56.89, 14.80],  // Småland lakes
    [66.83, 20.23],  // Gällivare
  ],
  Finland: [
    [61.50, 24.96],  // Tampere lakes
    [63.10, 27.68],  // Savonlinna
    [65.02, 25.47],  // Oulu river
    [68.90, 27.03],  // Inari salmon
    [60.17, 24.94],  // Helsinki coast
    [64.22, 27.73],  // Kainuu wilderness
    [67.99, 24.57],  // Rovaniemi
  ],
}

function getCoords(exp: ExperienceWithGuide): [number, number] | null {
  const country = exp.location_country
  if (country == null) return null
  const locs = FISHING_LOCS[country]
  if (locs == null) return null
  const seed = exp.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = locs[seed % locs.length]
  // deterministic small offset so pins don't stack
  const dlat = ((seed % 13) - 6) * 0.06
  const dlng = ((seed % 9) - 4) * 0.10
  return [base[0] + dlat, base[1] + dlng]
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

type Props = { experiences: ExperienceWithGuide[] }

export default function MapView({ experiences }: Props) {
  const pins = experiences
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
      {/* CartoDB Voyager — free, modern, no API key */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />

      {pins.map(({ exp, coords }) => (
        <Marker
          key={exp.id}
          position={coords}
          icon={priceIcon(exp.price_per_person_eur ?? 0)}
          eventHandlers={{
            mouseover: e => { e.target.setIcon(popupIcon(exp.price_per_person_eur ?? 0)) },
            mouseout:  e => { e.target.setIcon(priceIcon(exp.price_per_person_eur ?? 0)) },
          }}
        >
          <Popup
            closeButton={false}
            className="fjord-popup"
          >
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
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0A2E4D' }}>
                  €{exp.price_per_person_eur}
                  <span style={{ fontWeight: 400, fontSize: '11px', color: 'rgba(10,46,77,0.4)' }}>/pp</span>
                </span>
                <a
                  href={`/experiences/${exp.id}`}
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
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
