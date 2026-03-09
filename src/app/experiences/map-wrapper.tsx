'use client'

import dynamic from 'next/dynamic'
import type { ExperienceWithGuide } from '@/types'

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full"
      style={{ background: 'linear-gradient(135deg, #E8EDF0 0%, #D4DDE3 100%)' }}
    />
  ),
})

export default function MapWrapper({ experiences }: { experiences: ExperienceWithGuide[] }) {
  return <MapView experiences={experiences} />
}
