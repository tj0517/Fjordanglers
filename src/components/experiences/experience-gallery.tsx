'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (!a.is_cover && b.is_cover) return 1
    return 0
  })

  const close = useCallback(() => setLightboxIndex(null), [])
  const prev = useCallback(() =>
    setLightboxIndex(i => (i == null ? null : (i - 1 + sorted.length) % sorted.length)), [sorted.length])
  const next = useCallback(() =>
    setLightboxIndex(i => (i == null ? null : (i + 1) % sorted.length)), [sorted.length])

  useEffect(() => {
    if (lightboxIndex == null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, close, prev, next])

  if (sorted.length === 0) return null

  const [main, ...rest] = sorted
  const grid = rest.slice(0, 4)
  const extra = sorted.length - 5

  // 4 thumbnails → 3-column grid (main=50% + 2 right cols of 25% each)
  // 1-2 thumbnails → 2-column grid (main + single right column)
  const wideGrid = grid.length >= 3

  return (
    <>
      {/* ─── GRID ──────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl mb-12" style={{ height: '480px' }}>

        {sorted.length === 1 ? (
          <button
            onClick={() => setLightboxIndex(0)}
            className="relative w-full h-full block group overflow-hidden rounded-3xl"
          >
            <Image src={main.url} alt={title} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ) : (
          <div
            className="grid h-full overflow-hidden rounded-3xl"
            style={{
              gap: '3px',
              gridTemplateColumns: wideGrid ? '2fr 1fr 1fr' : '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
            }}
          >
            {/* Main image — left column, spans both rows */}
            <button
              onClick={() => setLightboxIndex(0)}
              className="relative overflow-hidden group rounded-tl-3xl rounded-bl-3xl"
              style={{ gridRow: '1 / 3' }}
            >
              <Image
                src={main.url}
                alt={title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>

            {/* Thumbnails — auto-placed into the right column(s) */}
            {grid.map((img, i) => {
              // Assign outer corner radii to the cells that land on the grid's outer corners
              // wideGrid (3 cols): i=1 → top-right, i=3 → bottom-right
              // 2-col:             i=0 → top-right, last → bottom-right
              let cornerClass = ''
              if (wideGrid) {
                if (i === 1) cornerClass = 'rounded-tr-3xl'
                if (i === 3) cornerClass = 'rounded-br-3xl'
              } else {
                if (i === 0 && grid.length === 1) cornerClass = 'rounded-tr-3xl rounded-br-3xl'
                else if (i === 0) cornerClass = 'rounded-tr-3xl'
                else if (i === grid.length - 1) cornerClass = 'rounded-br-3xl'
              }

              return (
                <button
                  key={img.id}
                  onClick={() => setLightboxIndex(i + 1)}
                  className={`relative overflow-hidden group ${cornerClass}`}
                >
                  <Image
                    src={img.url}
                    alt={`${title} photo ${i + 2}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                  {i === grid.length - 1 && extra > 0 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(5,12,22,0.58)', backdropFilter: 'blur(2px)' }}
                    >
                      <span className="text-white font-bold text-xl f-display">+{extra + 1}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* "Show all photos" button */}
        {sorted.length > 1 && (
          <button
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-4 right-4 flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full transition-all hover:brightness-95 active:scale-[0.97] f-body"
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.12)',
              color: '#0A2E4D',
              boxShadow: '0 2px 12px rgba(10,46,77,0.12)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            Show all {sorted.length} photos
          </button>
        )}
      </div>

      {/* ─── LIGHTBOX ──────────────────────────────────────────────── */}
      {lightboxIndex != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(3,8,15,0.94)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          {/* Counter */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm f-body">
            {lightboxIndex + 1} / {sorted.length}
          </div>

          {/* Close */}
          <button
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Prev */}
          {sorted.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Image — overflow-hidden + rounded-3xl clips to rounded corners */}
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{ width: 'min(90vw, 1100px)', height: 'min(80vh, 720px)' }}
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={sorted[lightboxIndex].url.replace(/w=\d+&h=\d+/, 'w=1600&h=1200')}
              alt={`${title} photo ${lightboxIndex + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 1100px) 90vw, 1100px"
            />
          </div>

          {/* Next */}
          {sorted.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Thumbnail strip */}
          {sorted.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {sorted.map((img, i) => (
                <button
                  key={img.id}
                  onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                  className="relative overflow-hidden rounded-lg transition-all"
                  style={{
                    width: '52px',
                    height: '36px',
                    opacity: i === lightboxIndex ? 1 : 0.4,
                    border: i === lightboxIndex ? '2px solid #E67E50' : '2px solid transparent',
                  }}
                >
                  <Image src={img.url} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
