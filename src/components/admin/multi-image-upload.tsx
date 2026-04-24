'use client'

/**
 * MultiImageUpload — grid-based photo uploader for guide galleries.
 *
 * Features:
 *  - "From Gallery" tab: pick from guide's existing photos (no re-upload).
 *    Clicking a photo toggles it in/out of the selection. No duplicate uploads.
 *  - "Upload New" tab: multi-file select, optional crop modal per file.
 *  - guideId prop: new uploads land in {guideId}/{uuid}.ext for organised storage.
 *  - Up to `max` photos total, first = cover.
 *  - Per-photo progress while uploading, remove button on thumbnails.
 */

import { useRef, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ImageCropModal } from '@/components/ui/image-crop'
import { Check, Crop, X, Loader2, ImageIcon, Images } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GalleryImage = {
  url: string
  is_cover: boolean
  sort_order: number
}

type PendingItem = {
  id: string
  preview: string
  progress: number
}

type Props = {
  label?: string
  /** Images already saved in DB (pre-fill for edit mode). */
  initial?: GalleryImage[]
  /** Hard cap on total photos. Default: 5. */
  max?: number
  /**
   * When set, opens a crop modal for each new photo before uploading.
   * Pass `width / height` ratio, e.g. `4 / 3`, `1`, `16 / 9`.
   */
  cropAspect?: number
  /** Called with the current list whenever it changes. */
  onChange: (images: GalleryImage[]) => void
  /**
   * Guide's existing photo URLs (from guide_photos table).
   * When provided, shows a "From Gallery" tab so FA can pick photos
   * without re-uploading. Clicking toggles them in/out of the selection.
   */
  pickFrom?: string[]
  /**
   * Guide's ID. New uploads are stored at {guideId}/{uuid}.ext so files
   * are organised per guide in the bucket.
   */
  guideId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET        = 'guide-photos'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_MB        = 25

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(file: File, guideId?: string): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) return null
  if (file.size > MAX_MB * 1024 * 1024) return null

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const uuid = crypto.randomUUID()
  // Organised path: {guideId}/{uuid}.ext — or flat {uuid}.ext if no guideId
  const path = guideId != null ? `${guideId}/${uuid}.${ext}` : `${uuid}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })

  if (error != null) return null

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MultiImageUpload({
  label    = 'Gallery',
  initial  = [],
  max      = 5,
  cropAspect,
  onChange,
  pickFrom,
  guideId,
}: Props) {
  const hasGallery = pickFrom != null && pickFrom.length > 0

  const [committed, setCommitted] = useState<GalleryImage[]>(initial)
  const [pending,   setPending]   = useState<PendingItem[]>([])
  const [cropQueue,  setCropQueue]  = useState<File[]>([])
  const [recropItem, setRecropItem] = useState<{ idx: number; url: string } | null>(null)
  // Default to gallery tab when guide photos are available
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload'>(
    hasGallery ? 'gallery' : 'upload',
  )

  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = committed.length + pending.length
  const canAdd     = totalCount < max

  // Set of committed URLs for O(1) lookup in the gallery picker
  const committedUrls = useMemo(() => new Set(committed.map(g => g.url)), [committed])

  // ── Gallery picker: toggle a photo in/out ────────────────────────────────
  const toggleGalleryPhoto = useCallback((url: string) => {
    const curPendingCount = pending.length
    setCommitted(prev => {
      const has = prev.some(g => g.url === url)
      if (has) {
        // Remove — re-index sort_order + is_cover
        const updated = prev
          .filter(g => g.url !== url)
          .map((g, i) => ({ ...g, is_cover: i === 0, sort_order: i }))
        onChange(updated)
        return updated
      }
      // Add — only if under max
      if (prev.length + curPendingCount >= max) return prev
      const updated: GalleryImage[] = [
        ...prev,
        { url, is_cover: prev.length === 0, sort_order: prev.length },
      ]
      onChange(updated)
      return updated
    })
  }, [onChange, pending, max])

  // ── Upload a single new file ──────────────────────────────────────────────
  const uploadAndAdd = useCallback(async (file: File) => {
    const pendingId   = crypto.randomUUID()
    const previewBlob = URL.createObjectURL(file)

    setPending(prev => [...prev, { id: pendingId, preview: previewBlob, progress: 15 }])
    setPending(prev => prev.map(p => p.id === pendingId ? { ...p, progress: 45 } : p))

    const url = await uploadFile(file, guideId)
    URL.revokeObjectURL(previewBlob)

    if (url != null) {
      setCommitted(prev => {
        const updated: GalleryImage[] = [
          ...prev,
          { url, is_cover: prev.length === 0, sort_order: prev.length },
        ]
        onChange(updated)
        return updated
      })
    }
    setPending(prev => prev.filter(p => p.id !== pendingId))
  }, [guideId, onChange])

  // ── Replace a committed photo with a re-cropped version ──────────────────
  const replaceCommitted = useCallback(async (idx: number, file: File) => {
    const pendingId   = crypto.randomUUID()
    const previewBlob = URL.createObjectURL(file)

    setPending(prev => [...prev, { id: pendingId, preview: previewBlob, progress: 15 }])
    setPending(prev => prev.map(p => p.id === pendingId ? { ...p, progress: 45 } : p))

    const url = await uploadFile(file, guideId)
    URL.revokeObjectURL(previewBlob)

    if (url != null) {
      setCommitted(prev => {
        const updated = prev.map((img, i) => i === idx ? { ...img, url } : img)
        onChange(updated)
        return updated
      })
    }
    setPending(prev => prev.filter(p => p.id !== pendingId))
  }, [guideId, onChange])

  // ── File picker ───────────────────────────────────────────────────────────
  const handleFiles = useCallback((files: FileList) => {
    const slotsLeft = max - committed.length - pending.length
    const toProcess = Array.from(files).slice(0, Math.max(0, slotsLeft))
    if (toProcess.length === 0) return

    if (cropAspect != null) {
      setCropQueue(prev => [...prev, ...toProcess])
    } else {
      void Promise.all(toProcess.map(f => uploadAndAdd(f)))
    }
  }, [committed.length, max, pending.length, cropAspect, uploadAndAdd])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files != null && e.target.files.length > 0) handleFiles(e.target.files)
    e.target.value = ''
  }

  const removeImage = (idx: number) => {
    setCommitted(prev => {
      const updated = prev
        .filter((_, i) => i !== idx)
        .map((img, i) => ({ ...img, is_cover: i === 0, sort_order: i }))
      onChange(updated)
      return updated
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Header: label + tab switcher ─────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <label
          className="block text-xs font-semibold uppercase tracking-[0.16em] f-body"
          style={{ color: 'rgba(10,46,77,0.55)' }}
        >
          {label}
          <span
            className="ml-2 font-normal normal-case tracking-normal text-[10px]"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            ({committed.length + pending.length}/{max} · first photo = cover)
          </span>
        </label>

        {/* Tab bar — only when guide photos are available */}
        {hasGallery && (
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(10,46,77,0.06)' }}>
            {(['gallery', 'upload'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold f-body transition-all"
                style={activeTab === tab
                  ? { background: '#fff', color: '#0A2E4D', boxShadow: '0 1px 3px rgba(10,46,77,0.1)' }
                  : { color: 'rgba(10,46,77,0.4)' }
                }
              >
                {tab === 'gallery'
                  ? <><Images size={11} /> Guide gallery ({pickFrom!.length})</>
                  : <><ImageIcon size={11} /> Upload new</>
                }
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Gallery picker tab ───────────────────────────────────── */}
      {activeTab === 'gallery' && hasGallery && (
        <div
          className="rounded-2xl p-3"
          style={{ border: '1.5px solid rgba(10,46,77,0.1)', background: 'rgba(10,46,77,0.015)' }}
        >
          {/* Selection status */}
          <div className="flex items-center justify-between mb-3 px-0.5 flex-wrap gap-2">
            <p className="text-[11px] font-semibold f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Click to add · click again to remove
            </p>
            {committed.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#E67E50' }}>
                  <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />
                </div>
                <p className="text-[11px] font-bold f-body" style={{ color: '#E67E50' }}>
                  {committed.length} selected{committed.length >= max ? ' · max reached' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Photo grid */}
          <div className="flex flex-wrap gap-2">
            {pickFrom!.map((url, i) => {
              const selected = committedUrls.has(url)
              const atMax    = !selected && committed.length + pending.length >= max

              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggleGalleryPhoto(url)}
                  disabled={atMax}
                  className="relative overflow-hidden flex-shrink-0 transition-all"
                  style={{
                    width:      88,
                    height:     72,
                    borderRadius: '12px',
                    border:     selected
                      ? '2.5px solid #E67E50'
                      : '2px solid rgba(10,46,77,0.1)',
                    boxShadow:  selected ? '0 0 0 3px rgba(230,126,80,0.15)' : 'none',
                    opacity:    atMax ? 0.35 : 1,
                    cursor:     atMax ? 'not-allowed' : 'pointer',
                    transform:  selected ? 'scale(1.03)' : 'scale(1)',
                  }}
                  aria-label={`${selected ? 'Remove' : 'Add'} photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {/* Selected overlay + checkmark */}
                  {selected && (
                    <div
                      className="absolute inset-0 flex items-end justify-end p-1.5"
                      style={{ background: 'rgba(230,126,80,0.15)' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: '#E67E50', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                      >
                        <Check size={10} strokeWidth={2.5} style={{ color: '#fff' }} />
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-[10px] f-body mt-3" style={{ color: 'rgba(10,46,77,0.35)' }}>
            These are the guide&apos;s existing photos — no re-upload needed.
            To add new photos, switch to the &quot;Upload new&quot; tab.
          </p>
        </div>
      )}

      {/* ── Upload tab: committed grid + pending + add button ────── */}
      {activeTab === 'upload' && (
        <div className="flex flex-wrap gap-3">

          {/* Committed thumbnails */}
          {committed.map((img, idx) => (
            <div
              key={img.url}
              className="relative overflow-hidden rounded-2xl flex-shrink-0 group"
              style={{ width: 96, height: 96 }}
            >
              <Image src={img.url} alt={`Photo ${idx + 1}`} fill sizes="96px" className="object-cover" />

              {img.is_cover && (
                <div
                  className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full f-body"
                  style={{ background: '#E67E50', color: '#fff' }}
                >
                  Cover
                </div>
              )}

              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(7,17,28,0.6)' }}
              >
                {cropAspect != null && (
                  <button
                    type="button"
                    onClick={() => setRecropItem({ idx, url: img.url })}
                    className="flex items-center gap-1 text-[10px] font-semibold f-body px-2 py-1 rounded-full transition-colors hover:bg-white/20"
                    style={{ color: '#fff' }}
                    aria-label="Crop photo"
                  >
                    <Crop size={10} strokeWidth={2.2} /> Crop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="flex items-center gap-1 text-[10px] font-semibold f-body px-2 py-1 rounded-full transition-colors hover:bg-white/20"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                  aria-label="Remove photo"
                >
                  <X size={8} strokeWidth={1.8} /> Remove
                </button>
              </div>
            </div>
          ))}

          {/* Pending (uploading) thumbnails */}
          {pending.map(item => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-2xl flex-shrink-0"
              style={{ width: 96, height: 96, background: 'rgba(10,46,77,0.06)' }}
            >
              <Image
                src={item.preview}
                alt="Uploading…"
                fill
                sizes="96px"
                className="object-cover opacity-40"
                unoptimized
              />
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: 'rgba(7,17,28,0.45)' }}
              >
                <Loader2 className="animate-spin" size={20} strokeWidth={2.2} style={{ color: '#E67E50' }} />
                <div
                  className="rounded-full overflow-hidden"
                  style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.2)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.progress}%`, background: '#E67E50' }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* "Add photos" button */}
          {canAdd && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl flex-shrink-0 transition-all f-body"
              style={{
                width:  96,
                height: 96,
                border: '2px dashed rgba(10,46,77,0.15)',
                color:  'rgba(10,46,77,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E67E50'; e.currentTarget.style.color = '#E67E50' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.15)'; e.currentTarget.style.color = 'rgba(10,46,77,0.4)' }}
              aria-label="Add photos"
            >
              <ImageIcon size={22} strokeWidth={1.5} />
              <span className="text-[10px] font-medium">Add photos</span>
            </button>
          )}
        </div>
      )}

      {/* ── Small committed strip shown below gallery picker ────── */}
      {activeTab === 'gallery' && committed.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-2"
            style={{ color: 'rgba(10,46,77,0.38)' }}>
            Selected photos
          </p>
          <div className="flex flex-wrap gap-2">
            {committed.map((img, idx) => (
              <div
                key={img.url}
                className="relative overflow-hidden rounded-xl flex-shrink-0 group"
                style={{ width: 64, height: 52 }}
              >
                <Image src={img.url} alt={`Photo ${idx + 1}`} fill sizes="64px" className="object-cover" />
                {img.is_cover && (
                  <div
                    className="absolute top-0.5 left-0.5 text-[8px] font-bold px-1 py-0.5 rounded-full f-body"
                    style={{ background: '#E67E50', color: '#fff' }}
                  >
                    Cover
                  </div>
                )}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(7,17,28,0.55)' }}
                >
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.85)' }}
                    aria-label="Remove"
                  >
                    <X size={10} strokeWidth={2} style={{ color: '#fff' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden multi-file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        onChange={handleChange}
        className="hidden"
      />

      {/* Helper text */}
      {committed.length > 0 ? (
        <p className="mt-2 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {committed.length} photo{committed.length !== 1 ? 's' : ''} saved · first photo is the cover image
        </p>
      ) : activeTab === 'upload' && pending.length === 0 ? (
        <p className="mt-2 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
          JPEG · PNG · WebP — max {MAX_MB} MB each · up to {max} photos · select multiple at once
        </p>
      ) : null}

      {/* Crop modal — new file from queue */}
      {cropQueue[0] != null && cropAspect != null && (
        <ImageCropModal
          src={cropQueue[0]}
          aspect={cropAspect}
          onConfirm={(croppedFile) => {
            setCropQueue(prev => prev.slice(1))
            void uploadAndAdd(croppedFile)
          }}
          onCancel={() => setCropQueue(prev => prev.slice(1))}
        />
      )}

      {/* Crop modal — re-crop already-uploaded photo */}
      {recropItem != null && cropAspect != null && (
        <ImageCropModal
          src={recropItem.url}
          aspect={cropAspect}
          onConfirm={(croppedFile) => {
            const { idx } = recropItem
            setRecropItem(null)
            void replaceCommitted(idx, croppedFile)
          }}
          onCancel={() => setRecropItem(null)}
        />
      )}

    </div>
  )
}
