'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  images: string[]
  name: string
}

export function AccommodationGallery({ images, name }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const close = useCallback(() => setLightboxIndex(null), [])
  const prev  = useCallback(() => setLightboxIndex(i => i == null ? null : (i - 1 + images.length) % images.length), [images.length])
  const next  = useCallback(() => setLightboxIndex(i => i == null ? null : (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (lightboxIndex == null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, close, prev, next])

  if (images.length === 0) return null

  // ── Photo grid ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="overflow-hidden" style={{ height: '260px' }}>
        {images.length === 1 && (
          <button
            className="w-full h-full block relative overflow-hidden group"
            onClick={() => setLightboxIndex(0)}
            aria-label="Open photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[0]}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        )}

        {images.length === 2 && (
          <div className="flex h-full gap-0.5">
            {images.map((url, i) => (
              <button
                key={url}
                className="relative flex-1 h-full overflow-hidden group"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {images.length >= 3 && (
          <div className="flex h-full gap-0.5">
            {/* Large left */}
            <button
              className="relative h-full overflow-hidden group"
              style={{ width: '60%' }}
              onClick={() => setLightboxIndex(0)}
              aria-label="Open photo 1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>

            {/* Stacked right */}
            <div className="flex flex-col gap-0.5" style={{ width: '40%' }}>
              <button
                className="relative overflow-hidden group"
                style={{ height: '50%' }}
                onClick={() => setLightboxIndex(1)}
                aria-label="Open photo 2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[1]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>

              <button
                className="relative overflow-hidden group"
                style={{ height: '50%' }}
                onClick={() => setLightboxIndex(2)}
                aria-label={images.length > 3 ? `Show all ${images.length} photos` : 'Open photo 3'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[2]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                {images.length > 3 && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(10,46,77,0.55)', backdropFilter: 'blur(2px)' }}
                  >
                    <span className="flex items-center gap-2 text-white font-semibold text-[13px] f-body">
                      <LayoutGrid size={15} strokeWidth={2} />
                      All {images.length} photos
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxIndex != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(3,8,15,0.94)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          {/* Counter */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm f-body select-none">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Close */}
          <button
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lightboxIndex}
              src={images[lightboxIndex]}
              alt={`${name} — photo ${lightboxIndex + 1}`}
              className="block rounded-3xl"
              style={{ maxWidth: 'min(90vw, 1200px)', maxHeight: '85vh', width: 'auto', height: 'auto' }}
            />
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="Next photo"
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((url, i) => (
                <button
                  key={url}
                  onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                  className="relative overflow-hidden rounded-lg transition-all flex-shrink-0"
                  style={{
                    width: '52px', height: '36px',
                    opacity: i === lightboxIndex ? 1 : 0.4,
                    border: i === lightboxIndex ? '2px solid #E67E50' : '2px solid transparent',
                  }}
                  aria-label={`Go to photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
