'use client'

/**
 * Thin client boundary for ExperienceLocationMap.
 *
 * `next/dynamic` with `ssr: false` is only allowed inside Client Components.
 * This file owns the dynamic import so the Server Component page.tsx can
 * import this wrapper without triggering the "ssr:false in Server Component" error.
 */

import dynamic from 'next/dynamic'

const ExperienceLocationMap = dynamic(
  () => import('./experience-location-map'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full animate-pulse"
        style={{ background: '#EDE6DB', borderRadius: '24px' }}
      />
    ),
  },
)

export { ExperienceLocationMap }
