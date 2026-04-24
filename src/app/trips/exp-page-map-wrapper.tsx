'use client'

import dynamic from 'next/dynamic'
import type { ExpPage } from './exp-page-map-section'
import type { MapBounds } from './exp-page-map-view'

const ExpPageMapView = dynamic(() => import('./exp-page-map-view'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full"
      style={{ background: 'linear-gradient(135deg, #E8EDF0 0%, #D4DDE3 100%)' }}
    />
  ),
})

export default function ExpPageMapWrapper({
  pages,
  onBoundsChange,
  hoveredPageId,
  onPinClick,
  showPopups,
  countries,
}: {
  pages: ExpPage[]
  onBoundsChange?: (bounds: MapBounds) => void
  hoveredPageId?: string | null
  onPinClick?: (id: string) => void
  showPopups?: boolean
  countries?: string[]
}) {
  return (
    <ExpPageMapView
      pages={pages}
      onBoundsChange={onBoundsChange}
      hoveredPageId={hoveredPageId}
      onPinClick={onPinClick}
      showPopups={showPopups}
      countries={countries}
    />
  )
}
