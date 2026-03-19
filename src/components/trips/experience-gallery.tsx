'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { heroFull, cardThumb, gallerySlide } from '@/lib/image'

interface GalleryImage {
  id: string
  url: string
  is_cover: boolean
}

interface Props {
  images: GalleryImage[]
  title: string
}

export function ExperienceGallery({ images, title }: Props) {
  const [current, setCurrent] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (!a.is_cover && b.is_cover) return 1
    return 0
  })

  const close = useCallback(() => setLightboxIndex(null), [])
  const prev  = useCallback(() => setLightboxIndex(i => (i == null ? null : (i - 1 + sorted.length) % sorted.length)), [sorted.length])
  const next  = useCallback(() => setLightboxIndex(i => (i == null ? null : (i + 1) % sorted.length)), [sorted.length])

  const slidePrev = () => setCurrent(i => (i - 1 + sorted.length) % sorted.length)
  const slideNext = () => setCurrent(i => (i + 1) % sorted.length)

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

  if (sorted.length === 0) return null

  // Bento slots: cover + up to 4 secondary
  const cover     = sorted[0]
  const secondary = sorted.slice(1, 5)
  const hasMore   = sorted.length > 5

  return (
    <>
      {/* ─── DESKTOP BENTO GRID ────────────────────────────────────── */}
      <div className="hidden md:block mb-8 select-none">
        <div
          className="overflow-hidden rounded-3xl"
          style={{
            display: 'grid',
            gridTemplateColumns: secondary.length === 0 ? '1fr' : secondary.length <= 2 ? '2fr 1fr' : '2fr 1fr 1fr',
            gridTemplateRows: secondary.length <= 1 ? '460px' : '230px 230px',
            gap: '4px',
            height: '460px',
          }}
        >
          {/* Cover — always spans both rows */}
          <button
            className="relative overflow-hidden group"
            style={{ gridRow: secondary.length <= 1 ? '1' : '1 / 3' }}
            onClick={() => setLightboxIndex(0)}
            aria-label="Open photo"
          >
            <Image
              src={heroFull(cover.url) ?? cover.url}
              alt={`${title} — cover photo`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              priority
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>

          {/* Secondary images */}
          {secondary.map((img, i) => {
            const isLast = i === secondary.length - 1 && (hasMore || sorted.length > 5)
            return (
              <button
                key={img.id}
                className="relative overflow-hidden group"
                onClick={() => setLightboxIndex(i + 1)}
                aria-label={`Open photo ${i + 2}`}
              >
                <Image
                  src={cardThumb(img.url) ?? img.url}
                  alt={`${title} — photo ${i + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                {/* "Show all" overlay on last tile */}
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(10,46,77,0.55)', backdropFilter: 'blur(2px)' }}>
                    <span className="flex items-center gap-2 text-white font-semibold text-[13px] f-body">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                      </svg>
                      All {sorted.length} photos
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── MOBILE CAROUSEL ───────────────────────────────────────── */}
      <div className="md:hidden mb-8 select-none">

        {/* Main slide */}
        <div className="relative overflow-hidden rounded-3xl mb-3" style={{ height: '300px' }}>
          <button
            className="w-full h-full block group"
            onClick={() => setLightboxIndex(current)}
            aria-label="Open photo"
          >
            <Image
              key={sorted[current].id}
              src={heroFull(sorted[current].url) ?? sorted[current].url}
              alt={`${title} — photo ${current + 1}`}
              fill
              className="object-cover"
              priority={current === 0}
            />
          </button>

          {sorted.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); slidePrev() }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#0A2E4D' }}
                aria-label="Previous photo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); slideNext() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#0A2E4D' }}
                aria-label="Next photo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}

          <div
            className="absolute bottom-3 left-3 text-xs font-semibold px-3 py-1.5 rounded-full f-body"
            style={{ background: 'rgba(0,0,0,0.52)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)' }}
          >
            {current + 1} / {sorted.length}
          </div>
        </div>

        {sorted.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 w-full" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            {sorted.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setCurrent(i)}
                className="relative flex-shrink-0 overflow-hidden rounded-xl"
                style={{
                  width: '72px', height: '52px',
                  opacity: i === current ? 1 : 0.55,
                  outline: i === current ? '2px solid #E67E50' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
                aria-label={`Go to photo ${i + 1}`}
              >
                <Image src={cardThumb(img.url) ?? img.url} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── LIGHTBOX ──────────────────────────────────────────────── */}
      {lightboxIndex != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(3,8,15,0.94)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm f-body">
            {lightboxIndex + 1} / {sorted.length}
          </div>

          <button
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {sorted.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}

          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={sorted[lightboxIndex].id}
              src={gallerySlide(sorted[lightboxIndex].url) ?? sorted[lightboxIndex].url}
              alt={`${title} photo ${lightboxIndex + 1}`}
              className="block rounded-3xl"
              style={{ maxWidth: 'min(90vw, 1200px)', maxHeight: '85vh', width: 'auto', height: 'auto' }}
            />
          </div>

          {sorted.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {sorted.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {sorted.map((img, i) => (
                <button
                  key={img.id}
                  onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                  className="relative overflow-hidden rounded-lg transition-all"
                  style={{
                    width: '52px', height: '36px',
                    opacity: i === lightboxIndex ? 1 : 0.4,
                    border: i === lightboxIndex ? '2px solid #E67E50' : '2px solid transparent',
                  }}
                >
                  <Image src={cardThumb(img.url) ?? img.url} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
