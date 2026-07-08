'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getReviewUploadUrl } from '@/actions/review-media'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadItem {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  publicUrl?: string
  errorMsg?: string
  previewUrl?: string   // blob URL for images only
  isVideo: boolean
}

interface Props {
  token: string
  /** Called every time the set of successfully-uploaded URLs changes. */
  onChange: (urls: string[]) => void
  /** True while any file is still uploading — parent can gate the submit button. */
  onBusyChange: (busy: boolean) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewMediaUpload({ token, onChange, onBusyChange }: Props) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Notify parent whenever upload state changes
  useEffect(() => {
    const doneUrls = items.filter(i => i.status === 'done' && i.publicUrl != null).map(i => i.publicUrl!)
    onChange(doneUrls)
    const busy = items.some(i => i.status === 'queued' || i.status === 'uploading')
    onBusyChange(busy)
  }, [items, onChange, onBusyChange])

  // Revoke preview blob URLs when items are removed
  useEffect(() => {
    return () => {
      items.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }, [])

  const uploadFile = useCallback(async (item: UploadItem) => {
    patchItem(item.id, { status: 'uploading' })

    const result = await getReviewUploadUrl(token, item.file.name, item.file.type)

    if ('error' in result) {
      patchItem(item.id, { status: 'error', errorMsg: result.error })
      return
    }

    // Direct browser → Supabase Storage upload via signed URL (no size limit on our side)
    try {
      const res = await fetch(result.signedUrl, {
        method: 'PUT',
        body: item.file,
        headers: { 'Content-Type': item.file.type },
      })
      if (res.ok) {
        patchItem(item.id, { status: 'done', publicUrl: result.publicUrl })
      } else {
        patchItem(item.id, { status: 'error', errorMsg: `Upload failed (HTTP ${res.status}).` })
      }
    } catch {
      patchItem(item.id, { status: 'error', errorMsg: 'Network error. Please try again.' })
    }
  }, [token, patchItem])

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      isVideo: file.type.startsWith('video/'),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setItems(prev => [...prev, ...newItems])
    newItems.forEach(item => uploadFile(item))
  }, [uploadFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files))
      e.target.value = '' // reset so same file can be re-added after removal
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files))
  }

  const handleRemove = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(i => i.id !== id)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        style={{
          border: `2px dashed ${dragging ? '#E67E50' : '#d4d4d4'}`,
          borderRadius: '12px',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(230,126,80,0.04)' : '#fafafa',
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
        <p style={{ fontSize: '15px', margin: '0 0 4px', color: '#555' }}>
          📷 Drop photos & videos here
        </p>
        <p style={{ fontSize: '12px', margin: 0, color: '#aaa' }}>
          or <span style={{ color: '#E67E50', textDecoration: 'underline' }}>browse files</span>
          {' '}— any format, full quality, no size limit
        </p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: item.status === 'error'
                  ? 'rgba(220,38,38,0.06)'
                  : item.status === 'done'
                    ? 'rgba(16,185,129,0.06)'
                    : '#f5f5f4',
                border: item.status === 'error'
                  ? '1px solid rgba(220,38,38,0.2)'
                  : item.status === 'done'
                    ? '1px solid rgba(16,185,129,0.2)'
                    : '1px solid transparent',
              }}
            >
              {/* Thumbnail or icon */}
              {item.previewUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '6px',
                  background: '#e5e5e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}>
                  🎬
                </div>
              )}

              {/* Name + size */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: '0 0 2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#111',
                }}>
                  {item.file.name}
                </p>
                <p style={{ fontSize: '11px', margin: 0, color: '#888' }}>
                  {fmtSize(item.file.size)}
                  {item.status === 'error' && item.errorMsg != null && (
                    <span style={{ color: '#dc2626', marginLeft: 6 }}>— {item.errorMsg}</span>
                  )}
                </p>
              </div>

              {/* Status badge */}
              <div style={{ flexShrink: 0, fontSize: '12px' }}>
                {item.status === 'queued'    && <span style={{ color: '#aaa' }}>Queued…</span>}
                {item.status === 'uploading' && <span style={{ color: '#E67E50' }}>Uploading…</span>}
                {item.status === 'done'      && <span style={{ color: '#16a34a', fontSize: '16px' }}>✓</span>}
                {item.status === 'error'     && (
                  <button
                    type="button"
                    onClick={() => uploadFile(item)}
                    style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Retry
                  </button>
                )}
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#bbb',
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
