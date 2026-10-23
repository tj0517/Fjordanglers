'use client'

/**
 * The map section of a country hub (FA-1.66): where in the country FA guides fish, one pin
 * per offer with coordinates. The page renders it only when there is at least one pin, and
 * Leaflet loads with `ssr: false` (as on `/trips`), so a hub without pins never asks for it.
 *
 * A pin click hands the offer's slug to the hub's selection; the cards scroll to it.
 */

import dynamic from 'next/dynamic'
import { useHubSelection } from './hub-selection'
import type { HubMapPin } from './hub-map-view'

const HubMapView = dynamic(() => import('./hub-map-view'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full" style={{ background: 'linear-gradient(135deg, #E8EDF0 0%, #D4DDE3 100%)' }} />
  ),
})

export default function HubMap({ pins }: { pins: HubMapPin[] }) {
  const selection = useHubSelection()

  return (
    <section data-block="map" aria-label="Where our guides fish" className="mt-8 lg:mt-12">
      <div
        className="relative isolate h-[min(60vh,420px)] overflow-hidden rounded-2xl lg:h-[440px]"
        style={{ background: '#E8EDF0', boxShadow: '0 1px 2px rgba(10,46,77,0.06), 0 12px 32px -12px rgba(10,46,77,0.14)' }}
        data-testid="hub-map"
      >
        <HubMapView pins={pins} onPinClick={slug => selection?.select(slug)} />
      </div>
      <p className="mt-2 text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.62)' }}>
        Where our guides fish. Tap a pin to see the trip.
      </p>
    </section>
  )
}
