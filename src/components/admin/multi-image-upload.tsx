'use client'

/**
 * MultiImageUpload — grid-based photo uploader for guide galleries.
 *
 * Features:
 *  - Multi-file select: click "Add photos" → browser file picker opens (multiple)
 *  - Optional cropAspect: shows crop modal for each file before upload, one by one
 *  - Uploads in parallel up to `max` photos total
 *  - Per-photo progress spinner while uploading
 *  - Remove button on each thumbnail
 *  - Crop button on committed thumbnails (re-crop already uploaded)
 *  - First photo always gets is_cover=true
 *  - Calls onChange(images) whenever the committed list changes
 */

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ImageCropModal } from '@/components/ui/image-crop'
import { Crop, X, Loader2, ImageIcon } from 'lucide-react'

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
   * When set, opens a crop modal for each new photo before uploading,
   * and shows a "Crop" button on committed thumbnails.
   * Pass `width / height` ratio, e.g. `4 / 3`, `1`, `16 / 9`.
   */
  cropAspect?: number
  /** Called with the current list whenever it changes. */
  onChange: (images: GalleryImage[]) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET        = 'guide-photos'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_MB        = 25

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) return null
  if (file.size > MAX_MB * 1024 * 1024) return null

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

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
  label   = 'Gallery',
  initial = [],
  max     = 5,
  cropAspect,
  onChange,
}: Props) {
  const [committed, setCommitted] = useState<GalleryImage[]>(initial)
  const [pending,   setPending]   = useState<PendingItem[]>([])
  // Queue of raw files waiting to be cropped (one modal shown at a time)
  const [cropQueue,  setCropQueue]  = useState<File[]>([])
  // Re-crop an already-committed photo
  const [recropItem, setRecropItem] = useState<{ idx: number; url: string } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = committed.length + pending.length
  const canAdd     = totalCount < max

  // ── Upload a single cropped/plain file and add to committed ────────────────
  const uploadAndAdd = useCallback(async (file: File) => {
    const pendingId   = crypto.randomUUID()
    const previewBlob = URL.createObjectURL(file)

    setPending(prev => [...prev, { id: pendingId, preview: previewBlob, progress: 15 }])

    setPending(prev => prev.map(p => p.id === pendingId ? { ...p, progress: 45 } : p))
    const url = await uploadFile(file)
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
  }, [onChange])

  // ── Replace a committed photo with a re-cropped version ───────────────────
  const replaceCommitted = useCallback(async (idx: number, file: File) => {
    const pendingId   = crypto.randomUUID()
    const previewBlob = URL.createObjectURL(file)

    setPending(prev => [...prev, { id: pendingId, preview: previewBlob, progress: 15 }])
    setPending(prev => prev.map(p => p.id === pendingId ? { ...p, progress: 45 } : p))
    const url = await uploadFile(file)
    URL.revokeObjectURL(previewBlob)

    if (url != null) {
      setCommitted(prev => {
        const updated = prev.map((img, i) => i === idx ? { ...img, url } : img)
        onChange(updated)
        return updated
      })
    }
    setPending(prev => prev.filter(p => p.id !== pendingId))
  }, [onChange])

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFiles = useCallback((files: FileList) => {
    const slotsLeft = max - committed.length - pending.length
    const toProcess = Array.from(files).slice(0, Math.max(0, slotsLeft))
    if (toProcess.length === 0) return

    if (cropAspect != null) {
      // Queue for crop modals (shown one by one)
      setCropQueue(prev => [...prev, ...toProcess])
    } else {
      // Upload directly in parallel
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
      {/* Label */}
      <label
        className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
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

      {/* Thumbnail grid */}
      <div className="flex flex-wrap gap-3">

        {/* Committed (uploaded) thumbnails */}
        {committed.map((img, idx) => (
          <div
            key={img.url}
            className="relative overflow-hidden rounded-2xl flex-shrink-0 group"
            style={{ width: 96, height: 96 }}
          >
            <Image
              src={img.url}
              alt={`Photo ${idx + 1}`}
              fill
              sizes="96px"
              className="object-cover"
            />

            {/* Cover badge on first photo */}
            {img.is_cover && (
              <div
                className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full f-body"
                style={{ background: '#E67E50', color: '#fff' }}
              >
                Cover
              </div>
            )}

            {/* Hover overlay with Crop + Remove */}
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
                  <Crop size={10} strokeWidth={2.2} />
                  Crop
                </button>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="flex items-center gap-1 text-[10px] font-semibold f-body px-2 py-1 rounded-full transition-colors hover:bg-white/20"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                aria-label="Remove photo"
              >
                <X size={8} strokeWidth={1.8} />
                Remove
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
              <div className="rounded-full overflow-hidden" style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.progress}%`, background: '#E67E50' }} />
              </div>
            </div>
          </div>
        ))}

        {/* "Add photos" button — shown while slots remain */}
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
      ) : pending.length === 0 ? (
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
