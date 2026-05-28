'use client'

/**
 * OfferLocationMap — thin Client Component wrapper around LocationMap.
 *
 * next/dynamic with ssr: false must live in a Client Component.
 * This wrapper is imported directly (no dynamic()) from the Server Component
 * offer page — Next.js automatically defers it to the client bundle.
 */

import dynamic from 'next/dynamic'

const LocationMap = dynamic(
  () => import('./LocationMap').then(m => m.LocationMap),
  { ssr: false },
)

interface Props {
  lat:     number
  lng:     number
  zoom:    number
  geojson: object | null
}

export function OfferLocationMap({ lat, lng, zoom, geojson }: Props) {
  return <LocationMap lat={lat} lng={lng} zoom={zoom} geojson={geojson} />
}
