'use client'

/**
 * MeetingMapPicker — Leaflet-based interactive map.
 * Dynamically imported (ssr: false) from GuideConfirmFlow.
 * Click anywhere to drop/move the salmon-orange pin.
 */

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export default function MeetingMapPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (containerRef.current == null || mapRef.current != null) return

    const defaultLat  = lat ?? 65.5
    const defaultLng  = lng ?? 14.5
    const defaultZoom = lat != null ? 12 : 5

    import('leaflet').then(({ default: L }) => {
      if (containerRef.current == null) return

      const map = L.map(containerRef.current, {
        center:      [defaultLat, defaultLng],
        zoom:        defaultZoom,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      const pinIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:#E67E50;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
        iconSize:   [20, 20],
        iconAnchor: [10, 10],
        className:  '',
      })

      if (lat != null && lng != null) {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        if (markerRef.current != null) {
          markerRef.current.setLatLng([clickLat, clickLng])
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon: pinIcon }).addTo(map)
        }
        onChange(clickLat, clickLng)
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current != null) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        height:       '280px',
        borderRadius: '12px',
        overflow:     'hidden',
        border:       '1.5px solid rgba(10,46,77,0.1)',
      }}
    />
  )
}
