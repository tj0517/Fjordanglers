'use client'

/**
 * MultiImageUpload — grid-based photo uploader for guide galleries.
 *
 * Features:
 *  - Multi-file select: click "Add photos" → browser file picker opens (multiple)
 *  - Uploads in parallel up to `max` photos total
 *  - Per-photo progress spinner while uploading
 *  - Remove button on each thumbnail (updates sort_order + is_cover on the fly)
 *  - First photo always gets is_cover=true
 *  - Calls onChange(images) whenever the committed list changes
 */

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

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
  onChange,
}: Props) {
  const [committed, setCommitted] = useState<GalleryImage[]>(initial)
  const [pending,   setPending]   = useState<PendingItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = committed.length + pending.length
  const canAdd     = totalCount < max

  // ── File handler ───────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList) => {
    const slotsLeft = max - committed.length - pending.length
    const toUpload  = Array.from(files).slice(0, Math.max(0, slotsLeft))
    if (toUpload.length === 0) return

    // Create local preview entries immediately
    const newPending: PendingItem[] = toUpload.map(f => ({
      id:       crypto.randomUUID(),
      preview:  URL.createObjectURL(f),
      progress: 15,
    }))
    setPending(prev => [...prev, ...newPending])

    // Upload all in parallel
    await Promise.all(
      toUpload.map(async (file, i) => {
        const item = newPending[i]

        // Bump progress to show activity
        setPending(prev =>
          prev.map(p => p.id === item.id ? { ...p, progress: 45 } : p),
        )

        const url = await uploadFile(file)

        // Clean up blob URL
        URL.revokeObjectURL(item.preview)

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

        // Remove from pending regardless of success/fail
        setPending(prev => prev.filter(p => p.id !== item.id))
      }),
    )
  }, [committed.length, max, onChange, pending.length])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files != null && e.target.files.length > 0) {
      void handleFiles(e.target.files)
    }
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
            className="relative overflow-hidden rounded-2xl flex-shrink-0"
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

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              aria-label="Remove photo"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" />
                <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" />
              </svg>
            </button>
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
            {/* Upload progress overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(7,17,28,0.45)' }}
            >
              <svg
                className="animate-spin"
                width="20" height="20" viewBox="0 0 20 20" fill="none"
                stroke="#E67E50" strokeWidth="2.2"
              >
                <circle cx="10" cy="10" r="7" strokeOpacity="0.2" />
                <path d="M10 3a7 7 0 017 7" strokeLinecap="round" />
              </svg>
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
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#E67E50'
              e.currentTarget.style.color = '#E67E50'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(10,46,77,0.15)'
              e.currentTarget.style.color = 'rgba(10,46,77,0.4)'
            }}
            aria-label="Add photos"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="5" width="18" height="13" rx="2.5" />
              <circle cx="7.5" cy="10" r="1.5" />
              <path d="M2 15l5-5 3.5 3.5 3-3 5.5 5.5" />
            </svg>
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
    </div>
  )
}
