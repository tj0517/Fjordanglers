'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function HeroVideoCta({ videoSrc }: { videoSrc: string }) {
  const [open, setOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) {
      videoRef.current?.pause()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Play button trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 mt-5 group"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        aria-label="Watch video"
      >
        <span
          className="flex items-center justify-center w-11 h-11 rounded-full transition-transform group-hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.30)' }}
        >
          {/* Play triangle */}
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <path d="M1 1.5L13 8L1 14.5V1.5Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="f-body text-sm font-medium" style={{ color: 'rgba(255,255,255,0.70)' }}>
          Watch the film
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ background: 'rgba(4,10,20,0.88)', zIndex: 9999, backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full"
            style={{ maxWidth: '900px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/20"
              style={{ top: '-44px', right: 0, background: 'rgba(255,255,255,0.10)', border: 'none', cursor: 'pointer', color: '#fff' }}
              aria-label="Close video"
            >
              <X size={18} />
            </button>

            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              controls
              playsInline
              className="w-full"
              style={{ borderRadius: '16px', display: 'block' }}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
          </div>
        </div>
      )}
    </>
  )
}
