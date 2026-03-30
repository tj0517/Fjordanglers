'use client'

import { useState, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
  updateAccommodationImages,
} from '@/actions/accommodations'
import type { GuideAccommodationRow } from './page'
import { HelpWidget } from '@/components/ui/help-widget'
import { FieldTooltip } from '@/components/ui/field-tooltip'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Loader2, Plus, ExternalLink, Pencil, Trash2 } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES = ['cabin', 'hotel', 'hostel', 'lodge', 'apartment', 'other'] as const
type AccType = typeof TYPES[number]

const inputBase: React.CSSProperties = {
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.1)',
  color: '#0A2E4D',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full f-body"
      style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}
    >
      {type}
    </span>
  )
}

// ─── Image gallery strip ───────────────────────────────────────────────────────

function ImageStrip({
  images,
  onRemove,
  onAdd,
  isUploading,
}: {
  images: string[]
  onRemove: (url: string) => void
  onAdd: () => void
  isUploading: boolean
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      {images.map(url => (
        <div key={url} className="relative group flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="w-16 h-16 object-cover rounded-xl"
            style={{ border: '1px solid rgba(10,46,77,0.08)' }}
          />
          <button
            type="button"
            onClick={() => onRemove(url)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: '#DC2626', color: 'white', fontSize: '10px', lineHeight: 1 }}
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={isUploading}
        className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0 transition-colors"
        style={{
          background: isUploading ? 'rgba(10,46,77,0.03)' : 'rgba(230,126,80,0.08)',
          border: '1.5px dashed rgba(230,126,80,0.3)',
          color: isUploading ? 'rgba(10,46,77,0.3)' : '#E67E50',
          cursor: isUploading ? 'not-allowed' : 'pointer',
        }}
        aria-label="Add photo"
      >
        {isUploading ? (
          <Loader2 className="animate-spin" size={14} strokeWidth={2} />
        ) : (
          <>
            <Plus size={14} strokeWidth={1.8} />
            <span className="text-[8px] font-semibold f-body leading-none">Photo</span>
          </>
        )}
      </button>
    </div>
  )
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

type FormState = {
  name: string
  type: AccType
  description: string
  max_guests: string
  location_note: string
  link_url: string
}

const EMPTY_FORM: FormState = {
  name: '', type: 'cabin', description: '', max_guests: '', location_note: '', link_url: '',
}

function AccForm({
  guideId: _guideId,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  guideId: string
  initial?: FormState
  onSave: (form: FormState) => void
  onCancel?: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM)
  const set = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div
      className="relative p-5 rounded-2xl flex flex-col gap-4"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      {isPending && <LoadingOverlay />}
      {/* Name + Type row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Name *
            <FieldTooltip text="Display name of this accommodation — shown to anglers on your trip pages." />
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Riverside Cabin"
            className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none"
            style={inputBase}
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Type *
            <FieldTooltip text="Category of accommodation — helps anglers understand what kind of lodging to expect." />
          </label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value as AccType)}
            className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none appearance-none cursor-pointer"
            style={inputBase}
          >
            {TYPES.map(t => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
          Description
          <FieldTooltip text="Brief description — bedrooms, facilities, WiFi, kitchen. Shown on the trip page." />
        </label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          placeholder="e.g. Private cabin, 2 bedrooms, fully equipped kitchen, WiFi."
          className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none resize-none"
          style={inputBase}
        />
      </div>

      {/* Max guests + Location note */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Max guests
            <FieldTooltip text="Maximum number of anglers this accommodation can host at once." />
          </label>
          <input
            type="number"
            min={1}
            value={form.max_guests}
            onChange={e => set('max_guests', e.target.value)}
            placeholder="e.g. 4"
            className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none"
            style={inputBase}
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Location note
            <FieldTooltip text="Short note about proximity to the fishing location. Example: 5 min walk to river." />
          </label>
          <input
            type="text"
            value={form.location_note}
            onChange={e => set('location_note', e.target.value)}
            placeholder="e.g. 5 min walk to river"
            className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none"
            style={inputBase}
          />
        </div>
      </div>

      {/* Link URL */}
      <div>
        <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
          Booking / website link
          <FieldTooltip text="Optional direct booking or listing link (Airbnb, Booking.com, your website) — anglers can visit it for details." />
        </label>
        <input
          type="url"
          value={form.link_url}
          onChange={e => set('link_url', e.target.value)}
          placeholder="e.g. https://booking.com/..."
          className="w-full px-4 py-2.5 rounded-xl text-sm f-body outline-none"
          style={inputBase}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={isPending || form.name.trim() === ''}
          onClick={() => onSave(form)}
          className="px-5 py-2 rounded-xl text-sm font-semibold f-body transition-opacity disabled:opacity-50"
          style={{ background: '#0A2E4D', color: 'white' }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        {onCancel != null && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-sm f-body transition-colors"
            style={{ color: 'rgba(10,46,77,0.5)' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccommodationsManager({
  guideId,
  initialAccommodations,
}: {
  guideId: string
  initialAccommodations: GuideAccommodationRow[]
}) {
  const [accommodations, setAccommodations] = useState<GuideAccommodationRow[]>(initialAccommodations)
  const [showAdd, setShowAdd]               = useState(false)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [error, setError]                   = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()
  const [uploadingId, setUploadingId]       = useState<string | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const uploadTargetId                      = useRef<string | null>(null)

  // ── Image upload ─────────────────────────────────────────────────────────────

  function openFilePicker(accId: string) {
    uploadTargetId.current = accId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const accId = uploadTargetId.current
    if (files.length === 0 || accId == null) return
    // Reset input so same files can be re-selected
    e.target.value = ''

    setUploadingId(accId)
    setError(null)

    try {
      const supabase = createClient()

      const uploaded = await Promise.all(
        files.map(async file => {
          const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
          const path = `acc-images/${accId}/${crypto.randomUUID()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('guide-photos')
            .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
          if (uploadErr != null) return null
          return supabase.storage.from('guide-photos').getPublicUrl(path).data.publicUrl
        }),
      )

      const newUrls = uploaded.filter((u): u is string => u != null)
      if (newUrls.length === 0) { setError('Upload failed'); return }

      const acc = accommodations.find(a => a.id === accId)
      if (acc == null) return
      const newImages = [...(acc.images ?? []), ...newUrls]

      const res = await updateAccommodationImages(accId, newImages)
      if (!res.success) { setError(res.error); return }

      setAccommodations(prev => prev.map(a => a.id === accId ? { ...a, images: newImages } : a))
    } finally {
      setUploadingId(null)
      uploadTargetId.current = null
    }
  }

  function handleRemoveImage(accId: string, url: string) {
    const acc = accommodations.find(a => a.id === accId)
    if (acc == null) return
    const newImages = (acc.images ?? []).filter(u => u !== url)

    setError(null)
    startTransition(async () => {
      const res = await updateAccommodationImages(accId, newImages)
      if (!res.success) { setError(res.error); return }
      setAccommodations(prev => prev.map(a => a.id === accId ? { ...a, images: newImages } : a))
    })
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  function handleAdd(form: FormState) {
    setError(null)
    startTransition(async () => {
      const res = await createAccommodation({
        name:          form.name,
        type:          form.type,
        description:   form.description.trim() || null,
        max_guests:    form.max_guests !== '' ? parseInt(form.max_guests, 10) : null,
        location_note: form.location_note.trim() || null,
        link_url:      form.link_url.trim() || null,
      })
      if (!res.success) { setError(res.error); return }
      if (res.data != null) setAccommodations(prev => [...prev, res.data!])
      setShowAdd(false)
    })
  }

  function handleUpdate(id: string, form: FormState) {
    setError(null)
    startTransition(async () => {
      const res = await updateAccommodation(id, {
        name:          form.name,
        type:          form.type,
        description:   form.description.trim() || null,
        max_guests:    form.max_guests !== '' ? parseInt(form.max_guests, 10) : null,
        location_note: form.location_note.trim() || null,
        link_url:      form.link_url.trim() || null,
      })
      if (!res.success) { setError(res.error); return }
      setAccommodations(prev => prev.map(a => a.id === id ? {
        ...a,
        name:          form.name,
        type:          form.type,
        description:   form.description.trim() || null,
        max_guests:    form.max_guests !== '' ? parseInt(form.max_guests, 10) : null,
        location_note: form.location_note.trim() || null,
        link_url:      form.link_url.trim() || null,
      } : a))
      setEditingId(null)
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteAccommodation(id)
      if (!res.success) { setError(res.error); return }
      setAccommodations(prev => prev.filter(a => a.id !== id))
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error */}
      {error != null && (
        <div className="px-4 py-3 rounded-xl text-sm f-body" style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
          {error}
        </div>
      )}

      {/* Page help */}
      <div className="flex items-center gap-2">
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Accommodations linked to your experiences appear on trip pages.
        </p>
        <HelpWidget
          title="Accommodations"
          description="Add lodging options that you offer as part of your fishing experiences."
          items={[
            { icon: '🏠', title: 'Name & type', text: 'Give each accommodation a clear name and category so anglers know what to expect.' },
            { icon: '📝', title: 'Description', text: 'Describe bedrooms, facilities, kitchen, WiFi. Shown on your trip page when linked to an experience.' },
            { icon: '👥', title: 'Max guests', text: 'Maximum capacity — helps match accommodation availability with group size.' },
            { icon: '📍', title: 'Location note', text: 'Short note about distance to the fishing spot — e.g. "5 min walk to river".' },
            { icon: '🔗', title: 'Booking link', text: 'Optional link to a booking page (Airbnb, Booking.com) so anglers can see full details or reserve directly.' },
            { icon: '📸', title: 'Photos', text: 'Add photos after saving an accommodation — they appear in a gallery on your trip page.' },
          ]}
        />
      </div>

      {/* Add button / form */}
      {showAdd ? (
        <AccForm
          guideId={guideId}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          isPending={isPending}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold f-body transition-all self-start"
          style={{
            background: 'rgba(230,126,80,0.1)',
            color: '#E67E50',
            border: '1.5px dashed rgba(230,126,80,0.3)',
          }}
        >
          <Plus size={14} strokeWidth={1.8} />
          Add accommodation
        </button>
      )}

      {/* List */}
      {accommodations.length === 0 && !showAdd ? (
        <div
          className="py-12 text-center rounded-2xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.06)' }}
        >
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            No accommodations yet. Add your first one above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {accommodations.map(acc => (
            editingId === acc.id ? (
              <AccForm
                key={acc.id}
                guideId={guideId}
                initial={{
                  name:          acc.name,
                  type:          acc.type as AccType,
                  description:   acc.description ?? '',
                  max_guests:    acc.max_guests != null ? String(acc.max_guests) : '',
                  location_note: acc.location_note ?? '',
                  link_url:      acc.link_url ?? '',
                }}
                onSave={form => handleUpdate(acc.id, form)}
                onCancel={() => setEditingId(null)}
                isPending={isPending}
              />
            ) : (
              <div
                key={acc.id}
                className="flex items-start gap-4 px-5 py-4 rounded-2xl"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
                }}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{acc.name}</span>
                    <TypeBadge type={acc.type} />
                    {acc.max_guests != null && (
                      <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                        up to {acc.max_guests} guests
                      </span>
                    )}
                  </div>
                  {acc.description != null && (
                    <p className="text-xs f-body leading-relaxed mb-1" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {acc.description}
                    </p>
                  )}
                  {acc.location_note != null && (
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                      📍 {acc.location_note}
                    </p>
                  )}
                  {acc.link_url != null && (
                    <a
                      href={acc.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] f-body mt-0.5 underline underline-offset-2"
                      style={{ color: '#E67E50' }}
                    >
                      <ExternalLink size={9} strokeWidth={1.4} />
                      View listing
                    </a>
                  )}

                  {/* Image gallery */}
                  <ImageStrip
                    images={acc.images ?? []}
                    onRemove={url => handleRemoveImage(acc.id, url)}
                    onAdd={() => openFilePicker(acc.id)}
                    isUploading={uploadingId === acc.id}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingId(acc.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-black/5"
                    style={{ color: 'rgba(10,46,77,0.45)' }}
                    aria-label="Edit"
                  >
                    <Pencil size={13} strokeWidth={1.4} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(acc.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-red-50"
                    style={{ color: 'rgba(220,38,38,0.55)' }}
                    aria-label="Delete"
                  >
                    <Trash2 size={12} strokeWidth={1.4} />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
