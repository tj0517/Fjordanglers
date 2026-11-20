'use client'

/**
 * The framed photo heroes (home, hubs, guides) leave the screen as the page scrolls (tj,
 * 2026-11-20): over the hero's own height the frame shrinks, tips back from its bottom edge and
 * rises a little faster than the page, so it goes away like a card rather than scrolling off as
 * a strip. The style is written straight to the element once per frame, without a re-render;
 * nothing moves with reduced motion.
 */

import { useEffect, useRef, type ReactNode } from 'react'

const SHRINK = 0.12  // scale lost by the time the hero has scrolled its own height
const TILT   = 14    // degrees
const RISE   = 0.15  // extra lift, as a share of the hero's height

export function ScrollAway({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el == null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const apply = () => {
      const h = el.offsetHeight
      const p = h > 0 ? Math.min(Math.max((window.scrollY - el.offsetTop) / h, 0), 1) : 0
      el.style.transform = p === 0
        ? ''
        : `perspective(1600px) translateY(${(-p * RISE * h).toFixed(1)}px) rotateX(${(p * TILT).toFixed(2)}deg) scale(${(1 - p * SHRINK).toFixed(4)})`
      el.style.opacity = p === 0 ? '' : String(1 - p * 0.35)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div ref={ref} data-scroll-away="" style={{ transformOrigin: '50% 100%', willChange: 'transform' }}>
      {children}
    </div>
  )
}
