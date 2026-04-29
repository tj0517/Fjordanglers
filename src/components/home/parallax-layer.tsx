'use client'

import { useEffect, useRef } from 'react'

/**
 * Wraps hero background layers and translates them at 35% scroll speed,
 * creating a parallax effect. The layer is 140% tall with -20% top offset
 * so there's always content to reveal during the scroll.
 */
export function ParallaxLayer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      el.style.transform = `translateY(${window.scrollY * 0.35}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0"
      style={{ top: '-20%', height: '140%', willChange: 'transform' }}
    >
      {children}
    </div>
  )
}
