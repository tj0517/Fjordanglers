'use client'

/**
 * ImageUpload — drag-and-drop image uploader backed by Supabase Storage.
 *
 * KEY BEHAVIOURS:
 *   1. Auto-compression — before uploading, the image is compressed client-side
 *      using the browser Canvas API.  A 12 MB phone photo is compressed to
 *      ~400–700 KB JPEG at 2000 px max dimension / 85% quality.
 *      Guides never need to resize or think about MB limits.
 *
 *   2. No external library — pure browser APIs (Canvas, Blob, FileReader).
 *
 *   3. Two-phase progress bar: "Compressing…" (0→30%) then "Uploading…" (30→100%).
 *
 *   4. Supports: JPEG, PNG, WebP (input).  Output is always JPEG after compression.
 *
 *   5. Soft size cap at 100 MB — only rejects truly absurd inputs (e.g. videos
 *      accidentally dropped on the zone).
 *
 * Upload target: Supabase Storage bucket 'guide-photos' (public CDN).
 */

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageUploadProps = {
  /** Label shown above the drop zone */
  label: string
  /** Currently saved URL (from DB). Shown as initial preview. */
  currentUrl?: string | null
  /** Aspect ratio hint — 'square' for avatars, 'wide' for covers */
  aspect?: 'square' | 'wide'
  /** Called with the new public URL after a successful upload */
  onUpload: (url: string) => void
  /** Optional extra hint shown below the zone */
  hint?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET         = 'guide-photos'
const MAX_INPUT_BYTES = 100 * 1024 * 1024   // 100 MB — safety net only
const ALLOWED_TYPES  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/** Max pixel dimension for the longest side after compression. */
const COMPRESS_MAX_DIM  = 2000
/** JPEG quality factor (0–1). 0.85 = high quality, ~1/10 of raw size. */
const COMPRESS_QUALITY  = 0.85

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * Compresses an image using the browser Canvas API.
 *
 *  • Resizes to COMPRESS_MAX_DIM on the longest side (preserves aspect ratio).
 *  • Outputs JPEG at COMPRESS_QUALITY.
 *  • Falls back to the original file if the browser fails to draw/encode.
 *
 * Runs entirely in the browser — no server round-trip, no external library.
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img    = new window.Image()
    const blobUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(blobUrl)

      let w = img.naturalWidth
      let h = img.naturalHeight

      // Resize only if the image is larger than the target dimension
      if (w > COMPRESS_MAX_DIM || h > COMPRESS_MAX_DIM) {
        if (w >= h) {
          h = Math.round(h * COMPRESS_MAX_DIM / w)
          w = COMPRESS_MAX_DIM
        } else {
          w = Math.round(w * COMPRESS_MAX_DIM / h)
          h = COMPRESS_MAX_DIM
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      if (ctx == null) { resolve(file); return }   // canvas not supported — rare

      ctx.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        (blob) => {
          if (blob == null) { resolve(file); return }
          // Rename to .jpg — the output is always JPEG regardless of input type
          const name = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        COMPRESS_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      resolve(file)   // fallback: upload original if browser can't decode
    }

    img.src = blobUrl
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random UUID-based storage path with .jpg extension. */
function buildStoragePath(): string {
  return `${crypto.randomUUID()}.jpg`
}

/** Validate file type and catch absurdly large inputs (e.g. videos). */
function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Unsupported format. Please upload a JPEG, PNG or WebP image.'
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Please upload an image under 100 MB.`
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageUpload({
  label,
  currentUrl,
  aspect = 'wide',
  onUpload,
  hint,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview,    setPreview]    = useState<string | null>(currentUrl ?? null)
  const [uploading,  setUploading]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [dragging,   setDragging]   = useState(false)

  // ── Core upload logic ──────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    setError(null)

    // 1. Validate type + sanity-check size
    const validErr = validateFile(file)
    if (validErr != null) { setError(validErr); return }

    // 2. Show local blob preview immediately
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setUploading(true)
    setProgress(5)
    setStatusText('Compressing…')

    try {
      // 3. Compress in browser (Canvas → JPEG, max 2000 px, 85% quality)
      const compressed = await compressImage(file)
      setProgress(30)
      setStatusText('Uploading…')

      // 4. Upload compressed file to Supabase Storage
      const supabase = createClient()
      const path     = buildStoragePath()

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, compressed, {
          cacheControl: '31536000',   // 1-year CDN cache — URL is content-addressed (UUID)
          upsert:       false,
          contentType:  'image/jpeg',
        })

      if (uploadError != null) {
        setError(uploadError.message)
        setPreview(currentUrl ?? null)
        setUploading(false)
        setProgress(0)
        setStatusText('')
        URL.revokeObjectURL(localPreview)
        return
      }

      setProgress(90)

      // 5. Retrieve permanent public CDN URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)

      setProgress(100)
      onUpload(publicUrl)

      // 6. Swap blob URL → permanent URL (avoid memory leak)
      setTimeout(() => {
        setPreview(publicUrl)
        URL.revokeObjectURL(localPreview)
        setProgress(0)
        setUploading(false)
        setStatusText('')
      }, 400)

    } catch (err) {
      console.error('[ImageUpload] Unexpected error:', err)
      setError('Upload failed. Please try again.')
      setPreview(currentUrl ?? null)
      setUploading(false)
      setProgress(0)
      setStatusText('')
    }
  }, [currentUrl, onUpload])

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file != null) void uploadFile(file)
    e.target.value = ''   // reset so same file can be re-selected
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file != null) void uploadFile(file)
  }

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = ()                      => setDragging(false)

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const zoneHeight   = aspect === 'square' ? '140px' : '120px'
  const previewClass = aspect === 'square' ? 'object-cover rounded-full' : 'object-cover'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Label */}
      <label
        className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
        style={{ color: 'rgba(10,46,77,0.55)' }}
      >
        {label}
      </label>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="relative overflow-hidden rounded-2xl transition-all cursor-pointer group"
        style={{
          height:     zoneHeight,
          border:     dragging
            ? '2px dashed #E67E50'
            : error != null
              ? '2px dashed rgba(239,68,68,0.4)'
              : '2px dashed rgba(10,46,77,0.13)',
          background: dragging
            ? 'rgba(230,126,80,0.05)'
            : preview != null
              ? 'transparent'
              : 'rgba(10,46,77,0.02)',
        }}
      >
        {/* Preview image */}
        {preview != null && (
          <Image
            src={preview}
            alt={label}
            fill
            className={previewClass}
            sizes="(max-width: 768px) 100vw, 720px"
            unoptimized={preview.startsWith('blob:')}
          />
        )}

        {/* Initial state (no image, not uploading) */}
        {preview == null && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(10,46,77,0.06)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="rgba(10,46,77,0.45)" strokeWidth="1.5">
                <rect x="2" y="4" width="14" height="10" rx="2" />
                <circle cx="6.5" cy="8" r="1" fill="rgba(10,46,77,0.45)" stroke="none" />
                <path d="M2 12l3.5-3 2.5 2 3-3 4 4" />
              </svg>
            </div>
            <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.45)' }}>
              <span className="font-semibold" style={{ color: '#E67E50' }}>Click to upload</span>
              {' '}or drag & drop
            </p>
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
              JPEG · PNG · WebP — any size, auto-compressed
            </p>
          </div>
        )}

        {/* Hover overlay (has image, not uploading) */}
        {preview != null && !uploading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: 'rgba(7,17,28,0.55)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M14 3l3 3-10 10H4v-3L14 3z" />
            </svg>
            <p className="text-white text-xs font-semibold f-body">Replace photo</p>
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(7,17,28,0.65)' }}
          >
            {/* Two-phase progress bar */}
            <div
              className="w-36 h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: '#E67E50' }}
              />
            </div>
            <p className="text-white text-xs f-body font-medium">
              {statusText}
            </p>
            {/* Show compressed size hint when compressing */}
            {statusText === 'Compressing…' && (
              <p className="text-white/50 text-[10px] f-body">
                Optimising for fast load…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {/* Error message */}
      {error != null && (
        <p className="mt-2 text-xs f-body flex items-center gap-1.5" style={{ color: '#DC2626' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="6" cy="6" r="5" />
            <line x1="6" y1="3.5" x2="6" y2="6.5" />
            <circle cx="6" cy="8.5" r="0.5" fill="currentColor" />
          </svg>
          {error}
        </p>
      )}

      {/* Custom hint */}
      {hint != null && error == null && (
        <p className="mt-2 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{hint}</p>
      )}

      {/* Success indicator */}
      {!uploading && preview != null && error == null && (
        <p className="mt-2 text-[11px] f-body flex items-center gap-1.5" style={{ color: '#16A34A' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6">
            <polyline points="1.5,5.5 4.5,8.5 9.5,2.5" />
          </svg>
          Uploaded
        </p>
      )}
    </div>
  )
}
