'use client'

/**
 * image-crop.tsx
 *
 * ImageCropModal  — drag + zoom crop modal with live card-shaped preview
 * CropPreview     — small static thumbnail of a saved crop
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { MapPin, LayoutGrid, X, ZoomOut, ZoomIn } from 'lucide-react'

// ─── CropPreview (static) ─────────────────────────────────────────────────────

export function CropPreview({
  url,
  aspect = 16 / 9,
  size   = 120,
  label,
}: {
  url:     string
  aspect?: number
  size?:   number
  label?:  string
}) {
  const w = size
  const h = Math.round(size / aspect)
  return (
    <div>
      {label != null && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] f-body mb-1.5"
          style={{ color: 'rgba(10,46,77,0.4)' }}>
          {label}
        </p>
      )}
      <div className="overflow-hidden flex-shrink-0" style={{
        width: w, height: h,
        borderRadius: aspect === 1 ? '50%' : '10px',
        background: 'rgba(10,46,77,0.06)',
        border: '1px solid rgba(10,46,77,0.1)',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Crop preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    </div>
  )
}

// ─── Shared preview helpers ───────────────────────────────────────────────────

const PREVIEW_W = 210
const CROP_VP   = 520   // crop viewport width used everywhere

type LivePreviewProps = {
  blobUrl:  string
  tx:       number
  ty:       number
  scale:    number
  naturalW: number
}

function LiveImg({ blobUrl, tx, ty, scale, naturalW, pScale }: LivePreviewProps & { pScale: number }) {
  const w = naturalW * scale * pScale
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt=""
      style={{
        position: 'absolute', left: tx * pScale, top: ty * pScale,
        width: w, height: 'auto', maxWidth: 'none',
        pointerEvents: 'none', userSelect: 'none',
      }}
      draggable={false}
    />
  )
}

// ─── LiveCardPreview ──────────────────────────────────────────────────────────
// Trip card shell — used for 16:9 cover / hero crops.

function LiveCardPreview({ blobUrl, tx, ty, scale, naturalW, aspect }: LivePreviewProps & { aspect: number }) {
  const pScale   = PREVIEW_W / CROP_VP
  const imgH     = Math.round(PREVIEW_W / aspect)   // exact crop area height at pScale
  return (
    <div style={{ width: PREVIEW_W }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] f-body mb-2 text-center"
        style={{ color: 'rgba(10,46,77,0.35)' }}>
        Card preview
      </p>
      <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#EDE6DB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
        <div className="relative overflow-hidden" style={{ height: imgH, background: '#111' }}>
          {blobUrl !== '' && <LiveImg blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={naturalW} pScale={pScale} />}
          <div className="absolute top-2 left-2">
            <div className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full f-body"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#0A2E4D' }}>All Levels</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-2">
            <span className="text-[8px] font-semibold f-body px-2.5 py-1 rounded-full"
              style={{ background: '#E67E50', color: '#fff' }}>View trip →</span>
          </div>
        </div>
        <div style={{ padding: '8px 10px 10px' }}>
          {/* Title */}
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(10,46,77,0.15)', marginBottom: 4, width: '80%' }} />
          {/* Location row — map pin + city */}
          <div className="flex items-center gap-1" style={{ marginBottom: 5 }}>
            <MapPin size={7} strokeWidth={2.2} style={{ color: 'rgba(10,46,77,0.35)' }} />
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(10,46,77,0.08)', width: '50%' }} />
          </div>
          {/* Guide */}
          <div className="flex items-center gap-1.5" style={{ marginBottom: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(10,46,77,0.12)', flexShrink: 0 }} />
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(10,46,77,0.08)', width: '45%' }} />
          </div>
          {/* Price */}
          <div style={{ height: 7, borderRadius: 3, background: 'rgba(10,46,77,0.1)', width: '35%' }} />
        </div>
      </div>
    </div>
  )
}

// ─── LiveGalleryPreview ───────────────────────────────────────────────────────
// Mini bento-grid shell — mirrors ExperienceGallery desktop layout.
// Used for gallery photo crops (aspect < 1.5).

function LiveGalleryPreview({ blobUrl, tx, ty, scale, naturalW, aspect }: LivePreviewProps & { aspect: number }) {
  // Bento: 2 cols (2fr + 1fr), 2 rows. Main photo spans both rows on the left.
  const GAP    = 2
  const COL1   = Math.round(PREVIEW_W * 2 / 3)   // main (large) column
  const COL2   = PREVIEW_W - COL1 - GAP           // secondary column
  const TOTAL_H = Math.round(COL1 / aspect)       // main photo height matches its aspect ratio
  const ROW_H  = Math.round((TOTAL_H - GAP) / 2)  // each secondary row

  // Scale live image to fit the main column
  const pScale = COL1 / CROP_VP

  return (
    <div style={{ width: PREVIEW_W }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] f-body mb-2 text-center"
        style={{ color: 'rgba(10,46,77,0.35)' }}>
        Gallery preview
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${COL1}px ${COL2}px`,
        gridTemplateRows: `${ROW_H}px ${ROW_H}px`,
        gap: GAP,
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}>
        {/* Main photo — live crop, spans both rows */}
        <div style={{ gridRow: '1 / 3', position: 'relative', overflow: 'hidden', background: '#111' }}>
          {blobUrl !== '' && <LiveImg blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={naturalW} pScale={pScale} />}
          {/* "All photos" chip */}
          <div className="absolute bottom-1.5 right-1.5">
            <div className="text-[7px] font-semibold px-1.5 py-0.5 rounded-full f-body flex items-center gap-1"
              style={{ background: 'rgba(10,46,77,0.6)', color: '#fff', backdropFilter: 'blur(4px)' }}>
              <LayoutGrid size={7} strokeWidth={2.5} />
              All photos
            </div>
          </div>
        </div>
        {/* Secondary slot 1 */}
        <div style={{ background: 'rgba(10,46,77,0.12)', borderRadius: 0 }} />
        {/* Secondary slot 2 */}
        <div style={{ background: 'rgba(10,46,77,0.08)' }} />
      </div>
    </div>
  )
}

// ─── LiveHeroPreview ──────────────────────────────────────────────────────────
// Simulates experience page hero: full-width banner, object-cover center bottom,
// gradient overlay, mock title at bottom-left.

function LiveHeroPreview({ blobUrl, tx, ty, scale, naturalW, aspect }: LivePreviewProps & { aspect: number }) {
  const pScale = PREVIEW_W / CROP_VP
  const HERO_H = Math.round(PREVIEW_W / aspect)   // 1:1 match with crop frame

  return (
    <div style={{ width: PREVIEW_W }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] f-body mb-2 text-center"
        style={{ color: 'rgba(10,46,77,0.35)' }}>
        Hero preview
      </p>
      <div style={{ borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        {/* Hero image */}
        <div className="relative" style={{ width: PREVIEW_W, height: HERO_H, background: '#07111C' }}>
          {blobUrl !== '' && <LiveImg blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={naturalW} pScale={pScale} />}
          {/* Gradient — bottom 65%, mirrors real page */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
            height: '65%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(4,12,22,0.55) 50%, rgba(4,12,22,0.88) 100%)',
          }} />
          {/* Mock title */}
          <div className="absolute bottom-0 left-0 px-2 pb-2">
            <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.2)', width: 55, marginBottom: 3 }} />
            <div style={{ height: 8, borderRadius: 3, background: 'rgba(255,255,255,0.55)', width: 110, marginBottom: 4 }} />
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.18)', width: 75 }} />
          </div>
        </div>
        {/* Page content band — shows the viewport below the hero */}
        <div style={{ background: '#F8FAFB', padding: '6px 10px 8px', borderTop: '1px solid rgba(10,46,77,0.06)' }}>
          <div className="flex gap-2">
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(10,46,77,0.1)', width: '30%' }} />
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(10,46,77,0.06)', width: '20%' }} />
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(10,46,77,0.06)', width: '15%' }} />
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(10,46,77,0.07)', width: '65%', marginTop: 5 }} />
        </div>
      </div>
    </div>
  )
}

// ─── ImageCropModal ───────────────────────────────────────────────────────────

export interface ImageCropModalProps {
  /** URL string (already uploaded) or a fresh File */
  src:       string | File
  /** width / height ratio, e.g. 16/9, 4/3, 1 */
  aspect:    number
  onConfirm: (cropped: File, previewUrl: string) => void
  onCancel:  () => void
}

export function ImageCropModal({ src, aspect, onConfirm, onCancel }: ImageCropModalProps) {
  const CROP_W = 520
  const CROP_H = Math.round(CROP_W / aspect)

  const imgRef   = useRef<HTMLImageElement>(null)
  const dragRef  = useRef<{ sx: number; sy: number; stx: number; sty: number } | null>(null)

  const [blobUrl,   setBlobUrl]  = useState('')
  const [loaded,    setLoaded]   = useState(false)
  const [scale,     setScale]    = useState(1)
  const [tx,        setTx]       = useState(0)
  const [ty,        setTy]       = useState(0)
  const [fitScale,  setFitScale] = useState(1)   // scale that exactly fills the frame
  const [minScale,  setMin]      = useState(1)   // slider minimum = fitScale * 0.3
  const [working,     setWorking]     = useState(false)
  const [previewMode, setPreviewMode] = useState<'hero' | 'card' | 'gallery'>(aspect >= 1.5 ? 'hero' : 'gallery')

  useEffect(() => {
    let revoke: (() => void) | null = null

    async function load() {
      if (typeof src === 'string') {
        // Fetch as blob to avoid canvas CORS taint when drawing a CDN URL
        try {
          const res  = await fetch(src)
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          revoke = () => URL.revokeObjectURL(url)
          setBlobUrl(url)
        } catch {
          // Fallback: use URL directly (canvas crop may fail for cross-origin)
          setBlobUrl(src)
        }
      } else {
        const url = URL.createObjectURL(src)
        revoke = () => URL.revokeObjectURL(url)
        setBlobUrl(url)
      }
    }

    void load()
    return () => revoke?.()
  }, [src])

  const clampPos = useCallback((newTx: number, newTy: number, s: number) => {
    const img = imgRef.current
    if (img == null) return { cx: newTx, cy: newTy }
    const iw = img.naturalWidth  * s
    const ih = img.naturalHeight * s
    // When image is smaller than the frame (zoomed out), center it
    const cx = iw >= CROP_W
      ? Math.min(0, Math.max(CROP_W - iw, newTx))
      : (CROP_W - iw) / 2
    const cy = ih >= CROP_H
      ? Math.min(0, Math.max(CROP_H - ih, newTy))
      : (CROP_H - ih) / 2
    return { cx, cy }
  }, [CROP_W, CROP_H])

  const handleLoad = useCallback(() => {
    const img = imgRef.current
    if (img == null) return
    const fit = Math.max(CROP_W / img.naturalWidth, CROP_H / img.naturalHeight)
    const { cx, cy } = clampPos(
      (CROP_W - img.naturalWidth  * fit) / 2,
      (CROP_H - img.naturalHeight * fit) / 2,
      fit,
    )
    setFitScale(fit)
    setMin(fit * 0.3)   // allow zooming out to ~30% of fill — shows full image
    setScale(fit); setTx(cx); setTy(cy); setLoaded(true)
  }, [CROP_W, CROP_H, clampPos])

  function onPtrDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty }
  }
  function onPtrMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current == null) return
    const { sx, sy, stx, sty } = dragRef.current
    const { cx, cy } = clampPos(stx + e.clientX - sx, sty + e.clientY - sy, scale)
    setTx(cx); setTy(cy)
  }
  function onPtrUp() { dragRef.current = null }

  function applyZoom(next: number) {
    const imgCx = (CROP_W / 2 - tx) / scale
    const imgCy = (CROP_H / 2 - ty) / scale
    const { cx, cy } = clampPos(CROP_W / 2 - imgCx * next, CROP_H / 2 - imgCy * next, next)
    setScale(next); setTx(cx); setTy(cy)
  }

  function handleConfirm() {
    const img = imgRef.current
    if (img == null) return
    setWorking(true)

    const nw    = img.naturalWidth
    const nh    = img.naturalHeight
    const srcX  = -tx / scale
    const srcY  = -ty / scale
    const srcW  = CROP_W / scale
    const srcH  = CROP_H / scale
    const OUT_W = Math.round(Math.min(srcW, 2400))
    const OUT_H = Math.round(OUT_W / aspect)

    const canvas = document.createElement('canvas')
    canvas.width = OUT_W; canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    if (ctx == null) { onCancel(); return }

    // Zoomed-out: image is smaller than the frame — letterbox with black
    if (srcX < 0 || srcY < 0 || srcX + srcW > nw || srcY + srcH > nh) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, OUT_W, OUT_H)
      // Clip source rect to image bounds
      const cX = Math.max(0, srcX)
      const cY = Math.max(0, srcY)
      const cW = Math.min(nw, srcX + srcW) - cX
      const cH = Math.min(nh, srcY + srcH) - cY
      if (cW > 0 && cH > 0) {
        const r  = OUT_W / srcW
        const dX = Math.round((cX - srcX) * r)
        const dY = Math.round((cY - srcY) * r)
        ctx.drawImage(img, cX, cY, cW, cH, dX, dY, Math.round(cW * r), Math.round(cH * r))
      }
    } else {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H)
    }

    canvas.toBlob(blob => {
      if (blob == null) { setWorking(false); onCancel(); return }
      const fileName = typeof src === 'string'
        ? `crop_${Date.now()}.jpg`
        : src.name.replace(/\.[^.]+$/, '_crop.jpg')
      const file       = new File([blob], fileName, { type: 'image/jpeg' })
      const previewUrl = canvas.toDataURL('image/jpeg', 0.7)
      onConfirm(file, previewUrl)
    }, 'image/jpeg', 0.94)
  }

  const imgDispW = loaded && imgRef.current != null ? imgRef.current.naturalWidth * scale : 0
  const natW     = imgRef.current?.naturalWidth ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
    >
      {/* Modal shell — two columns: crop + card preview */}
      <div
        className="flex gap-0 overflow-hidden"
        style={{
          background:   '#fff',
          borderRadius: '20px',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.4)',
          maxWidth:     'calc(100vw - 32px)',
          maxHeight:    'calc(100vh - 32px)',
        }}
      >
        {/* ── Left: crop viewport ── */}
        <div style={{ width: CROP_W + 48 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}>
            <div>
              <p className="font-semibold f-body" style={{ fontSize: '15px', color: '#0A2E4D' }}>
                Crop photo
              </p>
              <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Drag to reposition · slider to zoom
              </p>
            </div>
            <button type="button" onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              style={{ color: 'rgba(10,46,77,0.5)' }} aria-label="Cancel">
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>

          {/* Crop viewport */}
          <div className="px-6 pt-5 pb-3">
            <div
              className="relative overflow-hidden mx-auto select-none"
              style={{
                width: CROP_W, height: CROP_H,
                borderRadius: '12px',
                background: '#111',
                cursor: loaded ? 'grab' : 'default',
              }}
              onPointerDown={onPtrDown}
              onPointerMove={onPtrMove}
              onPointerUp={onPtrUp}
              onPointerLeave={onPtrUp}
            >
              {blobUrl !== '' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={blobUrl} alt="" onLoad={handleLoad}
                  style={{
                    position: 'absolute', left: tx, top: ty,
                    width: imgDispW || undefined, height: 'auto',
                    maxWidth: 'none',
                    display: loaded ? 'block' : 'none',
                    userSelect: 'none', pointerEvents: 'none',
                  }}
                  draggable={false}
                />
              )}

              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
                </div>
              )}

              {/* Rule-of-thirds */}
              {loaded && (
                <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.15 }}>
                  <div className="absolute inset-y-0" style={{ left: '33.33%', width: 1, background: '#fff' }} />
                  <div className="absolute inset-y-0" style={{ left: '66.66%', width: 1, background: '#fff' }} />
                  <div className="absolute inset-x-0" style={{ top: '33.33%', height: 1, background: '#fff' }} />
                  <div className="absolute inset-x-0" style={{ top: '66.66%', height: 1, background: '#fff' }} />
                </div>
              )}

              {/* Corner brackets */}
              {loaded && (['tl','tr','bl','br'] as const).map(c => {
                const t = c[0] === 't', b = c[0] === 'b'
                const l = c[1] === 'l', r = c[1] === 'r'
                return (
                  <div key={c} className="absolute w-5 h-5 pointer-events-none" style={{
                    top: t ? 8 : undefined, bottom: b ? 8 : undefined,
                    left: l ? 8 : undefined, right: r ? 8 : undefined,
                    borderTop:    t ? '2px solid rgba(255,255,255,0.75)' : undefined,
                    borderBottom: b ? '2px solid rgba(255,255,255,0.75)' : undefined,
                    borderLeft:   l ? '2px solid rgba(255,255,255,0.75)' : undefined,
                    borderRight:  r ? '2px solid rgba(255,255,255,0.75)' : undefined,
                  }} />
                )
              })}
            </div>
          </div>

          {/* Zoom slider */}
          {loaded && (
            <div className="px-6 pb-4 flex items-center gap-3">
              <ZoomOut size={14} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.4)' }} />
              <input type="range" min={minScale} max={fitScale * 3} step={minScale * 0.005}
                value={scale} onChange={e => applyZoom(Number(e.target.value))}
                className="flex-1" style={{ accentColor: '#E67E50' }} aria-label="Zoom" />
              <ZoomIn size={16} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.4)' }} />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
            <button type="button" onClick={onCancel}
              className="text-sm font-medium f-body px-5 py-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ color: 'rgba(10,46,77,0.6)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleConfirm} disabled={!loaded || working}
              className="text-sm font-semibold f-body px-6 py-2.5 rounded-full transition-opacity disabled:opacity-50"
              style={{ background: '#E67E50', color: '#fff' }}>
              {working ? 'Processing…' : 'Apply crop'}
            </button>
          </div>
        </div>

        {/* ── Right: live preview ── */}
        {loaded && (
          <div
            className="flex flex-col items-center gap-4"
            style={{
              width: PREVIEW_W + 48,
              background: 'rgba(10,46,77,0.03)',
              borderLeft: '1px solid rgba(10,46,77,0.07)',
              padding: '24px',
              overflowY: 'auto',
              alignSelf: 'stretch',
            }}
          >
            {/* Toggle */}
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'rgba(10,46,77,0.08)' }}>
              {(['hero', 'card', 'gallery'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className="px-3 py-1 rounded-lg text-[10px] font-semibold f-body transition-all capitalize"
                  style={previewMode === mode
                    ? { background: '#fff', color: '#0A2E4D', boxShadow: '0 1px 4px rgba(10,46,77,0.1)' }
                    : { color: 'rgba(10,46,77,0.4)' }
                  }
                >
                  {mode}
                </button>
              ))}
            </div>

            {previewMode === 'hero'
              ? <LiveHeroPreview    blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={natW} aspect={aspect} />
              : previewMode === 'card'
              ? <LiveCardPreview    blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={natW} aspect={aspect} />
              : <LiveGalleryPreview blobUrl={blobUrl} tx={tx} ty={ty} scale={scale} naturalW={natW} aspect={aspect} />
            }
          </div>
        )}
      </div>
    </div>
  )
}
