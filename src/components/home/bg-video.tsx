'use client'

import { useEffect, useRef } from 'react'

export function BgVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (v == null) return
    v.muted = true
    v.play().catch(() => {})
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      className={className}
      style={{ pointerEvents: 'none' }}
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
