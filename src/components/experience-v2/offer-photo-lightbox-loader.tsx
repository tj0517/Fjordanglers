'use client'

/**
 * What the photo cards (./offer-story-block.tsx, ./offer-species-card.tsx) import for their lightbox
 * (FA-1.92). The lightbox itself (./offer-photo-lightbox.tsx — the dialog popup, its focus trap and the
 * full-size photo) is not part of the page's first-load JS: it is fetched after hydration, and it
 * renders nothing until its dialog opens, so nothing on first paint waits for it.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'

export const PhotoLightbox = dynamic(
  () => import('./offer-photo-lightbox').then(m => m.PhotoLightbox),
  { ssr: false },
)

/** Which photo the lightbox shows; `reset()` goes in the trigger's onClick, so every opening starts at the cover. */
export function useLightboxIndex(count: number) {
  const [index, setIndex] = useState(0)
  return {
    index,
    reset: () => setIndex(0),
    step:  (by: number) => setIndex(current => (current + by + count) % count),
  }
}
