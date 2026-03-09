'use client'

/**
 * ExperienceForm — shared form for creating / editing an experience.
 *
 * Used from:
 *   /admin/guides/[id]/experiences/new  → context='admin', mode='create'
 *   /dashboard/experiences/new          → context='guide', mode='create'
 *   /dashboard/experiences/[id]/edit    → context='guide', mode='edit', expId provided
 *
 * Security is enforced server-side in createExperience / updateExperience actions.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/admin/image-upload'
import {
  createExperience,
  updateExperience,
  type ExperiencePayload,
  type ImageInput,
} from '@/actions/experiences'

// ─── Constants ────────────────────────────────────────────────────────────────

const FISH_OPTIONS = [
  'Salmon', 'Sea Trout', 'Brown Trout', 'Arctic Char', 'Rainbow Trout',
  'Grayling', 'Pike', 'Perch', 'Zander', 'Whitefish',
  'Cod', 'Halibut', 'Sea Bass', 'Catfish', 'Burbot',
]

const DIFFICULTY_OPTIONS = [
  { value: 'beginner',     label: 'All levels',    color: '#16A34A', bg: 'rgba(74,222,128,0.12)' },
  { value: 'intermediate', label: 'Intermediate',  color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  { value: 'expert',       label: 'Expert only',   color: '#DC2626', bg: 'rgba(239,68,68,0.12)' },
] as const

const TECHNIQUES = [
  'Fly fishing', 'Lure fishing', 'Bait fishing', 'Ice fishing',
  'Trolling', 'Spin fishing', 'Jigging', 'Sea fishing',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExperienceFormDefaults = {
  title?: string
  description?: string
  fish_types?: string[]
  technique?: string
  difficulty?: 'beginner' | 'intermediate' | 'expert' | null
  catch_and_release?: boolean
  duration_type?: 'hours' | 'days'
  duration_value?: string
  max_guests?: string
  price_per_person_eur?: string
  location_country?: string
  location_city?: string
  meeting_point?: string
  what_included?: string[]
  what_excluded?: string[]
  published?: boolean
  images?: Array<{ url: string; is_cover: boolean; sort_order: number }>
}

type Props = {
  guideId: string
  mode: 'create' | 'edit'
  expId?: string
  defaultValues?: ExperienceFormDefaults
  /** Where to go on success. Defaults based on context. */
  successPath: string
  /** Optional label to show in the form title */
  guideName?: string
  context: 'admin' | 'guide'
}

// ─── Micro-components ─────────────────────────────────────────────────────────

const inputBase = {
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.1)',
  color: '#0A2E4D',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
        {label}
        {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all"
      style={{ ...inputBase, ...(props.style ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-none"
      style={{ ...inputBase, ...(props.style ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="p-8 mb-5 rounded-3xl"
      style={{
        background: '#FDFAF7',
        border: '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
      }}
    >
      <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-1">{title}</h3>
      {subtitle != null && (
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-5">{subtitle}</p>
      )}
      {subtitle == null && <div className="mb-5" />}
      {children}
    </div>
  )
}

function Pill({
  label, active, onClick, activeColor, activeBg,
}: {
  label: string
  active: boolean
  onClick: () => void
  activeColor?: string
  activeBg?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-all f-body"
      style={
        active
          ? { background: activeBg ?? '#0A2E4D', color: activeColor ?? '#fff' }
          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)', border: '1px solid rgba(10,46,77,0.1)' }
      }
    >
      {label}
    </button>
  )
}

// ─── TagList — for what_included / what_excluded ──────────────────────────────

function TagList({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[]
  onAdd: (item: string) => void
  onRemove: (i: number) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed !== '' && !items.includes(trimmed)) {
      onAdd(trimmed)
      setInput('')
    }
  }

  return (
    <div>
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 rounded-2xl text-sm f-body outline-none transition-all"
          style={inputBase}
          onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all hover:brightness-105 f-body"
          style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
        >
          Add
        </button>
      </div>
      {/* Tags */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {items.map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-[#0A2E4D]/40 hover:text-[#DC2626] transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExperienceForm({
  guideId,
  mode,
  expId,
  defaultValues: dv = {},
  successPath,
  guideName,
  context,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Basic ────────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(dv.title ?? '')
  const [description, setDescription] = useState(dv.description ?? '')

  // ── Fishing ─────────────────────────────────────────────────────────────
  const [fishTypes,       setFishTypes]       = useState<string[]>(dv.fish_types ?? [])
  const [technique,       setTechnique]       = useState(dv.technique ?? '')
  const [difficulty,      setDifficulty]      = useState<'beginner' | 'intermediate' | 'expert' | null>(dv.difficulty ?? null)
  const [catchAndRelease, setCatchAndRelease] = useState(dv.catch_and_release ?? false)

  // ── Pricing & Logistics ──────────────────────────────────────────────────
  const [durationType,  setDurationType]  = useState<'hours' | 'days'>(dv.duration_type ?? 'hours')
  const [durationValue, setDurationValue] = useState(dv.duration_value ?? '')
  const [maxGuests,     setMaxGuests]     = useState(dv.max_guests ?? '4')
  const [price,         setPrice]         = useState(dv.price_per_person_eur ?? '')

  // ── Location ─────────────────────────────────────────────────────────────
  const [locationCountry, setLocationCountry] = useState(dv.location_country ?? '')
  const [locationCity,    setLocationCity]    = useState(dv.location_city ?? '')
  const [meetingPoint,    setMeetingPoint]    = useState(dv.meeting_point ?? '')

  // ── Inclusions ───────────────────────────────────────────────────────────
  const [included, setIncluded] = useState<string[]>(dv.what_included ?? [])
  const [excluded, setExcluded] = useState<string[]>(dv.what_excluded ?? [])

  // ── Images ───────────────────────────────────────────────────────────────
  const existingImages = dv.images ?? []
  const [coverUrl,    setCoverUrl]    = useState<string | null>(existingImages.find(i => i.is_cover)?.url ?? null)
  const [gallery,     setGallery]     = useState<Array<string | null>>([
    existingImages.find(i => !i.is_cover && i.sort_order === 1)?.url ?? null,
    existingImages.find(i => !i.is_cover && i.sort_order === 2)?.url ?? null,
    existingImages.find(i => !i.is_cover && i.sort_order === 3)?.url ?? null,
    existingImages.find(i => !i.is_cover && i.sort_order === 4)?.url ?? null,
  ])

  // ── Settings ─────────────────────────────────────────────────────────────
  const [published, setPublished] = useState(dv.published ?? false)

  // ── Error / success ──────────────────────────────────────────────────────
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toggleFish  = (f: string) =>
    setFishTypes(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  // Build images array for payload
  const buildImages = (): ImageInput[] => {
    const result: ImageInput[] = []
    if (coverUrl != null) result.push({ url: coverUrl, is_cover: true, sort_order: 0 })
    gallery.forEach((url, i) => {
      if (url != null) result.push({ url, is_cover: false, sort_order: i + 1 })
    })
    return result
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (title.trim() === '')    { setError('Title is required.'); return }
    if (description.trim() === '') { setError('Description is required.'); return }
    if (fishTypes.length === 0) { setError('Select at least one target species.'); return }
    if (durationValue === '')   { setError('Duration is required.'); return }
    if (maxGuests === '')       { setError('Maximum guests is required.'); return }
    if (price === '')           { setError('Price per person is required.'); return }

    const payload: ExperiencePayload = {
      title: title.trim(),
      description: description.trim(),
      fish_types: fishTypes,
      technique: technique.trim() || null,
      difficulty,
      catch_and_release: catchAndRelease,
      duration_hours: durationType === 'hours' ? parseInt(durationValue, 10) : null,
      duration_days:  durationType === 'days'  ? parseInt(durationValue, 10) : null,
      max_guests:          parseInt(maxGuests, 10),
      price_per_person_eur: parseFloat(price),
      location_country: locationCountry.trim() || null,
      location_city:    locationCity.trim() || null,
      meeting_point:    meetingPoint.trim() || null,
      what_included: included,
      what_excluded: excluded,
      published,
      images: buildImages(),
    }

    startTransition(async () => {
      let result

      if (mode === 'create') {
        result = await createExperience(guideId, payload)
        if (result.success && result.data != null) {
          setCreatedId(result.data.id)
          setSuccess(true)
        } else if (!result.success) {
          setError(result.error)
        }
      } else {
        if (expId == null) { setError('Missing experience ID.'); return }
        result = await updateExperience(expId, payload)
        if (result.success) {
          router.push(successPath)
          router.refresh()
        } else {
          setError(result.error)
        }
      }
    })
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success && createdId != null) {
    return (
      <div
        className="max-w-[600px] mx-auto text-center px-8 py-16 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 32px rgba(10,46,77,0.06)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.25)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Experience created
        </p>
        <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-3">
          <span style={{ fontStyle: 'italic' }}>{title}</span>
        </h2>
        <p className="text-[#0A2E4D]/45 text-sm f-body mb-8 leading-relaxed">
          {published ? 'The experience is now live on the platform.' : 'Saved as draft. Publish it when ready.'}
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href={`/experiences/${createdId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2h9M11 2v9M11 2L2 11" />
            </svg>
            View experience
          </a>
          {context === 'admin' ? (
            <button
              type="button"
              onClick={() => router.push(successPath)}
              className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              Back to guide →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(successPath)}
              className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              My experiences →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-[760px]">

      {/* Error banner */}
      {error != null && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-5 f-body text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#DC2626' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" className="flex-shrink-0 mt-0.5">
            <circle cx="7.5" cy="7.5" r="6" />
            <line x1="7.5" y1="4.5" x2="7.5" y2="8" />
            <circle cx="7.5" cy="10.5" r="0.5" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Section 1: Basic Info ────────────────────────────────────── */}
      <SectionCard title="Basic Info">
        <div className="flex flex-col gap-5">
          <Field label="Title" required>
            <TextInput
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Atlantic Salmon Fly Fishing in Hardangerfjord"
            />
          </Field>
          <Field label="Description" required>
            <TextArea
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the experience — what anglers will do, the location, what makes it special…"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 2: Fishing Details ───────────────────────────────── */}
      <SectionCard title="Fishing Details" subtitle="Target species, technique and difficulty">
        <div className="flex flex-col gap-6">

          {/* Target species */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Target species <span style={{ color: '#E67E50' }}>*</span>
              {fishTypes.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: '#E67E50' }}>
                  · {fishTypes.length} selected
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {FISH_OPTIONS.map(f => (
                <Pill
                  key={f}
                  label={f}
                  active={fishTypes.includes(f)}
                  onClick={() => toggleFish(f)}
                  activeColor="#E67E50"
                  activeBg="rgba(230,126,80,0.15)"
                />
              ))}
            </div>
          </div>

          {/* Technique */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Technique">
              <select
                value={technique}
                onChange={e => setTechnique(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none cursor-pointer"
                style={inputBase}
                onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
              >
                <option value="">Select technique</option>
                {TECHNIQUES.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__other">Other</option>
              </select>
              {technique === '__other' && (
                <TextInput
                  type="text"
                  className="mt-2"
                  placeholder="Describe the technique"
                  value={technique === '__other' ? '' : technique}
                  onChange={e => setTechnique(e.target.value)}
                />
              )}
            </Field>

            {/* Difficulty */}
            <Field label="Difficulty level">
              <div className="flex gap-2 flex-wrap">
                {DIFFICULTY_OPTIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(difficulty === d.value ? null : d.value)}
                    className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all f-body"
                    style={
                      difficulty === d.value
                        ? { background: d.bg, color: d.color, border: `1.5px solid ${d.color}30` }
                        : { background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.5)', border: '1.5px solid rgba(10,46,77,0.1)' }
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Catch & Release */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCatchAndRelease(v => !v)}
              className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
              style={{ background: catchAndRelease ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
              role="switch"
              aria-checked={catchAndRelease}
            >
              <span
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: catchAndRelease ? '22px' : '4px' }}
              />
            </button>
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.7)' }}>
              Catch & Release only
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Pricing & Logistics ──────────────────────────── */}
      <SectionCard title="Pricing & Logistics">
        <div className="grid grid-cols-2 gap-5">

          {/* Price */}
          <Field label="Price per person (€)" required>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
              <TextInput
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="350"
                style={{ paddingLeft: '28px' }}
              />
            </div>
          </Field>

          {/* Max guests */}
          <Field label="Max guests" required>
            <TextInput
              type="number"
              min="1"
              max="20"
              value={maxGuests}
              onChange={e => setMaxGuests(e.target.value)}
              placeholder="4"
            />
          </Field>

          {/* Duration */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Duration <span style={{ color: '#E67E50' }}>*</span>
            </label>
            <div className="flex gap-3 items-center">
              {/* Type toggle */}
              <div className="flex rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}>
                {(['hours', 'days'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDurationType(t)}
                    className="px-5 py-2.5 text-sm font-semibold transition-all f-body"
                    style={
                      durationType === t
                        ? { background: '#E67E50', color: 'white' }
                        : { background: 'transparent', color: 'rgba(10,46,77,0.5)' }
                    }
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <TextInput
                type="number"
                min="1"
                value={durationValue}
                onChange={e => setDurationValue(e.target.value)}
                placeholder={durationType === 'hours' ? '8' : '2'}
                style={{ maxWidth: '120px' }}
              />
              <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {durationType}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Location ──────────────────────────────────────── */}
      <SectionCard title="Location">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Country">
            <TextInput
              type="text"
              value={locationCountry}
              onChange={e => setLocationCountry(e.target.value)}
              placeholder="Norway"
            />
          </Field>
          <Field label="City / Region">
            <TextInput
              type="text"
              value={locationCity}
              onChange={e => setLocationCity(e.target.value)}
              placeholder="Hardangerfjord"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Meeting point">
              <TextInput
                type="text"
                value={meetingPoint}
                onChange={e => setMeetingPoint(e.target.value)}
                placeholder="e.g. Bergen Harbor, Bryggen — exact address or description"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 5: Inclusions ────────────────────────────────────── */}
      <SectionCard title="What&apos;s Included / Excluded" subtitle="Add items one by one and press Enter or Add">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              ✓ Included
            </p>
            <TagList
              items={included}
              onAdd={item => setIncluded(prev => [...prev, item])}
              onRemove={i => setIncluded(prev => prev.filter((_, idx) => idx !== i))}
              placeholder="e.g. Fishing license"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
              ✗ Not included
            </p>
            <TagList
              items={excluded}
              onAdd={item => setExcluded(prev => [...prev, item])}
              onRemove={i => setExcluded(prev => prev.filter((_, idx) => idx !== i))}
              placeholder="e.g. Accommodation"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Section 6: Photos ────────────────────────────────────────── */}
      <SectionCard title="Photos" subtitle="Cover photo is required. Up to 4 gallery images. JPEG, PNG, WebP · max 5 MB each.">
        <div className="flex flex-col gap-5">
          {/* Cover */}
          <ImageUpload
            label="Cover photo *"
            aspect="wide"
            currentUrl={coverUrl}
            onUpload={url => setCoverUrl(url)}
            hint="Main image shown on the experience card — ideally 1200×800px"
          />
          {/* Gallery row */}
          <div className="grid grid-cols-2 gap-4">
            {gallery.map((url, i) => (
              <ImageUpload
                key={i}
                label={`Gallery ${i + 1}`}
                aspect="wide"
                currentUrl={url}
                onUpload={newUrl => setGallery(prev => {
                  const next = [...prev]
                  next[i] = newUrl
                  return next
                })}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 7: Settings ──────────────────────────────────────── */}
      <div
        className="px-8 py-6 mb-6 rounded-3xl flex items-center justify-between"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <div>
          <p className="text-[#0A2E4D] text-sm font-bold f-body">Publish immediately</p>
          <p className="text-[#0A2E4D]/40 text-xs f-body mt-0.5">
            Visible to anglers on /experiences. You can change this later.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPublished(v => !v)}
          className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
          style={{ background: published ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
          role="switch"
          aria-checked={published}
        >
          <span
            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: published ? '24px' : '4px' }}
          />
        </button>
      </div>

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 text-white text-sm font-semibold px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 f-body"
          style={{ background: '#E67E50' }}
        >
          {isPending ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeOpacity="0.25" />
                <path d="M7 2a5 5 0 015 5" strokeLinecap="round" />
              </svg>
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            <>
              {mode === 'create' ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                    <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
                    <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
                  </svg>
                  Create Experience
                </>
              ) : (
                'Save Changes →'
              )}
            </>
          )}
        </button>

        {mode === 'create' && (
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {published
              ? 'Goes live on /experiences immediately'
              : 'Saved as draft — publish later'}
          </p>
        )}
      </div>
    </form>
  )
}
