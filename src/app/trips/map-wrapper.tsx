'use client'

import dynamic from 'next/dynamic'
import type { ExperienceWithGuide } from '@/types'

type MapBounds = { north: number; south: number; east: number; west: number }

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full"
      style={{ background: 'linear-gradient(135deg, #E8EDF0 0%, #D4DDE3 100%)' }}
    />
  ),
})

export default function MapWrapper({
  experiences,
  onBoundsChange,
  hoveredExpId,
  onPinClick,
  showPopups,
  countries,
}: {
  experiences: ExperienceWithGuide[]
  onBoundsChange?: (bounds: MapBounds) => void
  hoveredExpId?: string | null
  onPinClick?: (id: string) => void
  showPopups?: boolean
  countries?: string[]
}) {
  return (
    <MapView
      experiences={experiences}
      onBoundsChange={onBoundsChange}
      hoveredExpId={hoveredExpId}
      onPinClick={onPinClick}
      showPopups={showPopups}
      countries={countries}
    />
  )
}
