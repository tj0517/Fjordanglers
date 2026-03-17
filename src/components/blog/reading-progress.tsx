'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const pct = Math.round(progress * 100)
  const trackH = 260

  return (
    <div
      className="fixed hidden lg:flex flex-col items-center gap-3"
      style={{ right: '2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 40 }}
    >
      {/* Track */}
      <div
        style={{
          width: '3px',
          height: `${trackH}px`,
          background: 'rgba(10,46,77,0.1)',
          borderRadius: '99px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${pct}%`,
            background: 'linear-gradient(to bottom, #E67E50, #c4623a)',
            borderRadius: '99px',
            transition: 'height 0.1s linear',
          }}
        />
      </div>

      {/* Percentage label */}
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: pct > 0 ? '#E67E50' : 'rgba(10,46,77,0.25)',
          letterSpacing: '0.05em',
          transition: 'color 0.2s',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pct}%
      </span>
    </div>
  )
}
