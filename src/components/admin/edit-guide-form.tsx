'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateGuide, type UpdateGuidePayload, type GuideGalleryImage } from '@/actions/admin'
import ImageUpload from '@/components/admin/image-upload'
import MultiImageUpload from '@/components/admin/multi-image-upload'

// ─── Constants ────────────────────────────────────────────────────────────────

import { COUNTRIES } from '@/lib/countries'

const ALL_LANGUAGES = [
  'English', 'Norwegian', 'Swedish', 'Finnish', 'Icelandic',
  'Danish', 'German', 'Polish', 'French',
]

const ALL_FISH = [
  'Salmon', 'Brown Trout', 'Sea Trout', 'Arctic Char', 'Rainbow Trout',
  'Grayling', 'Pike', 'Perch', 'Zander', 'Whitefish',
  'Cod', 'Halibut', 'Sea Bass', 'Eel', 'Burbot',
]

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending — awaiting verification' },
  { value: 'verified',  label: 'Verified — approved, not yet active' },
  { value: 'active',    label: 'Active — fully live on /guides' },
  { value: 'suspended', label: 'Suspended — hidden from public' },
] as const

// ─── Micro-components ─────────────────────────────────────────────────────────

function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.55)' }}
    >
      {children}
      {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all"
      style={{
        background: '#F3EDE4',
        border: '1.5px solid rgba(10,46,77,0.1)',
        color: '#0A2E4D',
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function TextAreaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-none overflow-hidden"
      style={{
        background: '#F3EDE4',
        border: '1.5px solid rgba(10,46,77,0.1)',
        color: '#0A2E4D',
        ...(props.style ?? {}),
      }}
      ref={(el) => {
        // Auto-size on mount so pre-filled content is fully visible
        if (el != null) {
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }
      }}
      onInput={(e) => {
        // Auto-expand as user types — no internal scrollbar
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none cursor-pointer"
      style={{
        background: '#F3EDE4',
        border: '1.5px solid rgba(10,46,77,0.1)',
        color: '#0A2E4D',
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3 py-1.5 rounded-full transition-all f-body"
      style={
        active
          ? { background: '#0A2E4D', color: '#fff' }
          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }
      }
    >
      {label}
    </button>
  )
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px" style={{ background: 'rgba(10,46,77,0.08)' }} />
      <p className="text-[10px] uppercase tracking-[0.22em] font-semibold f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
        {title}
      </p>
      <div className="flex-1 h-px" style={{ background: 'rgba(10,46,77,0.08)' }} />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuideEditData = {
  id: string
  full_name: string
  country: string
  city: string | null
  bio: string | null
  languages: string[]
  fish_expertise: string[]
  years_experience: number | null
  avatar_url: string | null
  cover_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  pricing_model: 'flat_fee' | 'commission'
  status: string
  is_beta_listing: boolean
  images?: GuideGalleryImage[]
}

type Props = {
  guide: GuideEditData
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export default function EditGuideForm({ guide }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Form state initialised from existing guide data ─────────────────────────
  const [fullName,      setFullName]      = useState(guide.full_name)
  const [country,       setCountry]       = useState(guide.country)
  const [city,          setCity]          = useState(guide.city ?? '')
  const [bio,           setBio]           = useState(guide.bio ?? '')
  const [languages,     setLanguages]     = useState<string[]>(guide.languages.length > 0 ? guide.languages : ['English'])
  const [fishExpertise, setFishExpertise] = useState<string[]>(guide.fish_expertise)
  const [yearsExp,      setYearsExp]      = useState(guide.years_experience != null ? String(guide.years_experience) : '')
  const [avatarUrl,     setAvatarUrl]     = useState(guide.avatar_url ?? '')
  const [coverUrl,      setCoverUrl]      = useState(guide.cover_url ?? '')
  const [instagramUrl,  setInstagramUrl]  = useState(guide.instagram_url ?? '')
  const [youtubeUrl,    setYoutubeUrl]    = useState(guide.youtube_url ?? '')
  const [galleryImages, setGalleryImages] = useState<GuideGalleryImage[]>(guide.images ?? [])
  const [pricingModel,  setPricingModel]  = useState<'flat_fee' | 'commission'>(guide.pricing_model)
  const [status,        setStatus]        = useState<UpdateGuidePayload['status']>(
    (guide.status as UpdateGuidePayload['status']) ?? 'pending',
  )
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleLanguage = (lang: string) =>
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])

  const toggleFish = (fish: string) =>
    setFishExpertise(prev => prev.includes(fish) ? prev.filter(f => f !== fish) : [...prev, fish])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim() === '') { setError('Full name is required.'); return }
    if (fishExpertise.length === 0) { setError('Select at least one fish species.'); return }
    if (languages.length === 0) { setError('Select at least one language.'); return }

    const payload: UpdateGuidePayload = {
      full_name:        fullName,
      country,
      city:             city || undefined,
      bio:              bio || undefined,
      languages,
      fish_expertise:   fishExpertise,
      years_experience: yearsExp !== '' ? parseInt(yearsExp, 10) : null,
      avatar_url:       avatarUrl || undefined,
      cover_url:        coverUrl || undefined,
      gallery_images:   galleryImages,
      instagram_url:    instagramUrl || undefined,
      youtube_url:      youtubeUrl || undefined,
      pricing_model:    pricingModel,
      status,
    }

    startTransition(async () => {
      const result = await updateGuide(guide.id, payload)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
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
          Changes saved
        </p>
        <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-3">
          <span style={{ fontStyle: 'italic' }}>{fullName}</span> updated
        </h2>
        <p className="text-[#0A2E4D]/45 text-sm f-body mb-8 leading-relaxed">
          All changes are live immediately.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push(`/admin/guides/${guide.id}`)}
            className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            Back to guide →
          </button>
          <a
            href={`/guides/${guide.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-95 f-body"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 2h8M10 2v8M10 2L2 10" />
            </svg>
            Public profile
          </a>
          <button
            type="button"
            onClick={() => { setSuccess(false); setError(null) }}
            className="text-sm f-body transition-colors hover:text-[#E67E50]"
            style={{ color: 'rgba(10,46,77,0.45)' }}
          >
            Edit again
          </button>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-[720px]">

      {/* Error banner */}
      {error != null && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-6 f-body text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#DC2626' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
            <circle cx="8" cy="8" r="6.5" />
            <line x1="8" y1="5" x2="8" y2="8.5" />
            <circle cx="8" cy="11" r="0.6" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {/* ── BASIC INFO ──────────────────────────────────────────── */}
      <div
        className="p-8 mb-5 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-6">Basic Info</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Full name */}
          <div className="md:col-span-2">
            <FieldLabel required htmlFor="edit-full-name">Full name</FieldLabel>
            <TextInput
              id="edit-full-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Bjørn Eriksen"
              required
            />
          </div>

          {/* Country */}
          <div>
            <FieldLabel required htmlFor="edit-country">Country</FieldLabel>
            <SelectInput
              id="edit-country"
              value={country}
              onChange={e => setCountry(e.target.value)}
            >
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>

          {/* City */}
          <div>
            <FieldLabel htmlFor="edit-city">City / Region</FieldLabel>
            <TextInput
              id="edit-city"
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Tromsø"
            />
          </div>

          {/* Years experience */}
          <div>
            <FieldLabel htmlFor="edit-years">Years of experience</FieldLabel>
            <TextInput
              id="edit-years"
              type="number"
              min="0"
              max="70"
              value={yearsExp}
              onChange={e => setYearsExp(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>

          {/* Pricing model */}
          <div>
            <FieldLabel required htmlFor="edit-pricing">Pricing model</FieldLabel>
            <SelectInput
              id="edit-pricing"
              value={pricingModel}
              onChange={e => setPricingModel(e.target.value as 'flat_fee' | 'commission')}
            >
              <option value="commission">Commission (10% per booking)</option>
              <option value="flat_fee">Flat fee (€29/month)</option>
            </SelectInput>
          </div>

          {/* Bio */}
          <div className="md:col-span-2">
            <FieldLabel htmlFor="edit-bio">Bio</FieldLabel>
            <TextAreaInput
              id="edit-bio"
              rows={4}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Describe the guide's background, style and what makes their trips special…"
            />
          </div>
        </div>
      </div>

      {/* ── EXPERTISE ───────────────────────────────────────────── */}
      <div
        className="p-8 mb-5 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-1">Fish Expertise</h3>
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-5">Select all species this guide specialises in</p>

        <div className="flex flex-wrap gap-2">
          {ALL_FISH.map(fish => (
            <PillToggle
              key={fish}
              label={fish}
              active={fishExpertise.includes(fish)}
              onClick={() => toggleFish(fish)}
            />
          ))}
        </div>

        {fishExpertise.length > 0 && (
          <p className="mt-3 text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {fishExpertise.length} selected: {fishExpertise.join(', ')}
          </p>
        )}

        <SectionDivider title="Languages" />

        <p className="text-[#0A2E4D]/40 text-xs f-body mb-4">Languages the guide speaks</p>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map(lang => (
            <PillToggle
              key={lang}
              label={lang}
              active={languages.includes(lang)}
              onClick={() => toggleLanguage(lang)}
            />
          ))}
        </div>
      </div>

      {/* ── PHOTOS ──────────────────────────────────────────────── */}
      <div
        className="p-8 mb-5 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-1">Photos</h3>
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-6">
          JPEG · PNG · WebP — any size, auto-compressed
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ImageUpload
            label="Cover photo"
            aspect="wide"
            cropAspect={16 / 9}
            currentUrl={coverUrl || null}
            onUpload={url => setCoverUrl(url)}
            hint="Landscape — crop to 16:9 before upload"
          />
          <ImageUpload
            label="Avatar / Profile photo"
            aspect="square"
            cropAspect={1}
            currentUrl={avatarUrl || null}
            onUpload={url => setAvatarUrl(url)}
            hint="Square headshot — crop to 1:1 before upload"
          />
        </div>

        <MultiImageUpload
          label="Gallery photos"
          max={5}
          initial={galleryImages}
          onChange={setGalleryImages}
        />
      </div>

      {/* ── SOCIAL LINKS ────────────────────────────────────────── */}
      <div
        className="p-8 mb-5 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-1">Social Links</h3>
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-5">Optional — shown on the guide's public profile</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <FieldLabel htmlFor="edit-instagram">Instagram handle or URL</FieldLabel>
            <TextInput
              id="edit-instagram"
              type="text"
              value={instagramUrl}
              onChange={e => setInstagramUrl(e.target.value)}
              placeholder="@bjorneriksen or full URL"
            />
          </div>
          <div>
            <FieldLabel htmlFor="edit-youtube">YouTube channel URL</FieldLabel>
            <TextInput
              id="edit-youtube"
              type="url"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/@channel"
            />
          </div>
        </div>
      </div>

      {/* ── ADMIN STATUS ────────────────────────────────────────── */}
      <div
        className="p-8 mb-6 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <h3 className="text-[#0A2E4D] text-base font-bold f-display mb-1">Account Status</h3>
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-5">
          Controls guide visibility and dashboard access.
          Changing to <strong>Active</strong> will set <code>verified_at</code> if not already set.
        </p>

        <div>
          <FieldLabel required htmlFor="edit-status">Status</FieldLabel>
          <SelectInput
            id="edit-status"
            value={status}
            onChange={e => setStatus(e.target.value as UpdateGuidePayload['status'])}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </SelectInput>
        </div>
      </div>

      {/* ── SUBMIT ──────────────────────────────────────────────── */}
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
              Saving…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1.5,7 5,10.5 11.5,3" />
              </svg>
              Save changes
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/admin/guides/${guide.id}`)}
          className="text-sm f-body transition-colors hover:text-[#0A2E4D]"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
