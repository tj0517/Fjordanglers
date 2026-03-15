'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBetaGuide, type BetaGuidePayload, type GuideGalleryImage } from '@/actions/admin'
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

// ─── Micro-components ─────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
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
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-none"
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

function PillToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
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

/** Pre-filled values when creating a listing from a lead application. */
export type GuideFormDefaults = {
  full_name?: string
  country?: string
  city?: string
  bio?: string
  languages?: string[]
  fish_expertise?: string[]
  years_experience?: string     // numeric string, e.g. "10"
  instagram_url?: string
  youtube_url?: string
  invite_email?: string         // stored as bridge field, not shown in form
  pricing_model?: 'flat_fee' | 'commission'
}

type Props = {
  /** Pre-fills the form fields when creating a listing from a lead. */
  defaultValues?: GuideFormDefaults
  /** If set, the guide listing will be linked back to this lead (audit trail + auto-onboard). */
  leadId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise country value from lead form to the admin form's allowed list. */
function normaliseCountry(raw: string | undefined): string {
  if (raw == null) return COUNTRIES[0]
  const match = COUNTRIES.find(c => c.toLowerCase() === raw.toLowerCase())
  return match ?? COUNTRIES[0]
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function CreateGuideForm({ defaultValues, leadId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Form state — initialised from defaultValues if provided ────────────────
  const [fullName, setFullName]           = useState(defaultValues?.full_name ?? '')
  const [country, setCountry]             = useState<string>(normaliseCountry(defaultValues?.country))
  const [city, setCity]                   = useState(defaultValues?.city ?? '')
  const [bio, setBio]                     = useState(defaultValues?.bio ?? '')
  const [languages, setLanguages]         = useState<string[]>(defaultValues?.languages?.length ? defaultValues.languages : ['English'])
  const [fishExpertise, setFishExpertise] = useState<string[]>(defaultValues?.fish_expertise ?? [])
  const [yearsExp, setYearsExp]           = useState(defaultValues?.years_experience ?? '')
  const [avatarUrl, setAvatarUrl]         = useState('')
  const [coverUrl, setCoverUrl]           = useState('')
  const [galleryImages, setGalleryImages] = useState<GuideGalleryImage[]>([])
  const [instagramUrl, setInstagramUrl]   = useState(defaultValues?.instagram_url ?? '')
  const [youtubeUrl, setYoutubeUrl]       = useState(defaultValues?.youtube_url ?? '')
  const [pricingModel, setPricingModel]   = useState<'flat_fee' | 'commission'>(defaultValues?.pricing_model ?? 'commission')
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)
  const [createdId, setCreatedId]         = useState<string | null>(null)

  const isFromLead = leadId != null

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleLanguage = (lang: string) =>
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])

  const toggleFish = (fish: string) =>
    setFishExpertise(prev => prev.includes(fish) ? prev.filter(f => f !== fish) : [...prev, fish])

  // ── Reset helper ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setFullName('')
    setCity('')
    setBio('')
    setLanguages(['English'])
    setFishExpertise([])
    setYearsExp('')
    setAvatarUrl('')
    setCoverUrl('')
    setGalleryImages([])
    setInstagramUrl('')
    setYoutubeUrl('')
    setPricingModel('commission')
    setSuccess(false)
    setCreatedId(null)
    setError(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim() === '') { setError('Full name is required.'); return }
    if (fishExpertise.length === 0) { setError('Select at least one fish species.'); return }
    if (languages.length === 0) { setError('Select at least one language.'); return }

    const payload: BetaGuidePayload = {
      full_name:        fullName,
      country,
      city:             city || undefined,
      bio:              bio || undefined,
      languages,
      fish_expertise:   fishExpertise,
      years_experience: yearsExp !== '' ? parseInt(yearsExp, 10) : null,
      avatar_url:       avatarUrl || undefined,
      cover_url:        coverUrl || undefined,
      gallery_images:   galleryImages.length > 0 ? galleryImages : undefined,
      instagram_url:    instagramUrl || undefined,
      youtube_url:      youtubeUrl || undefined,
      pricing_model:    pricingModel,
      // Lead bridge — set when creating from a lead application
      invite_email:     defaultValues?.invite_email || undefined,
      lead_id:          leadId ?? undefined,
    }

    startTransition(async () => {
      const result = await createBetaGuide(payload)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        setCreatedId(result.guideId)
      }
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
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
          Listing created
        </p>
        <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-3">
          <span style={{ fontStyle: 'italic' }}>{fullName}</span> is live!
        </h2>
        <p className="text-[#0A2E4D]/45 text-sm f-body mb-8 leading-relaxed">
          The beta guide listing is now publicly visible on <strong>/guides</strong>.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href={`/guides/${createdId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2h9M11 2v9M11 2L2 11" />
            </svg>
            View public listing
          </a>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
          >
            Create another
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/guides')}
            className="text-sm f-body transition-colors hover:text-[#E67E50]"
            style={{ color: 'rgba(10,46,77,0.45)' }}
          >
            All guides →
          </button>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-[720px]">

      {/* Lead pre-fill banner */}
      {isFromLead && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-6 f-body text-sm"
          style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: '#1D4ED8' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
            <circle cx="8" cy="8" r="6.5" />
            <line x1="8" y1="5" x2="8" y2="8.5" />
            <circle cx="8" cy="11" r="0.6" fill="currentColor" />
          </svg>
          <span>
            <strong>Pre-filled from lead application.</strong>{' '}
            Review and complete the form, then click &ldquo;Create Beta Listing&rdquo;.
            The lead will be automatically marked as <em>Onboarded</em> and a bridge
            to the future guide dashboard will be stored.
          </span>
        </div>
      )}

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
            <FieldLabel required>Full name</FieldLabel>
            <TextInput
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Bjørn Eriksen"
              required
            />
          </div>

          {/* Country */}
          <div>
            <FieldLabel required>Country</FieldLabel>
            <SelectInput value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>

          {/* City */}
          <div>
            <FieldLabel>City / Region</FieldLabel>
            <TextInput
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Tromsø"
            />
          </div>

          {/* Years experience */}
          <div>
            <FieldLabel>Years of experience</FieldLabel>
            <TextInput
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
            <FieldLabel required>Pricing model</FieldLabel>
            <SelectInput
              value={pricingModel}
              onChange={e => setPricingModel(e.target.value as 'flat_fee' | 'commission')}
            >
              <option value="commission">Commission (10% per booking)</option>
              <option value="flat_fee">Flat fee (€29/month)</option>
            </SelectInput>
          </div>

          {/* Bio */}
          <div className="md:col-span-2">
            <FieldLabel>Bio</FieldLabel>
            <TextAreaInput
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
          Uploaded to Supabase Storage and served over CDN. JPEG, PNG or WebP · max 5 MB each.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Cover photo — landscape */}
          <div>
            <ImageUpload
              label="Cover photo"
              aspect="wide"
              cropAspect={16 / 9}
              currentUrl={coverUrl || null}
              onUpload={url => setCoverUrl(url)}
              hint="Landscape — crop to 16:9 before upload"
            />
          </div>

          {/* Avatar — square */}
          <div>
            <ImageUpload
              label="Avatar / Profile photo"
              aspect="square"
              cropAspect={1}
              currentUrl={avatarUrl || null}
              onUpload={url => setAvatarUrl(url)}
              hint="Square headshot — crop to 1:1 before upload"
            />
          </div>
        </div>

        {/* Gallery — multi-photo */}
        <MultiImageUpload
          label="Gallery photos"
          max={5}
          onChange={setGalleryImages}
        />
      </div>

      {/* ── SOCIAL LINKS ────────────────────────────────────────── */}
      <div
        className="p-8 mb-6 rounded-3xl"
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
            <FieldLabel>Instagram handle or URL</FieldLabel>
            <TextInput
              type="text"
              value={instagramUrl}
              onChange={e => setInstagramUrl(e.target.value)}
              placeholder="@bjorneriksen or full URL"
            />
          </div>

          <div>
            <FieldLabel>YouTube channel URL</FieldLabel>
            <TextInput
              type="url"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/@channel"
            />
          </div>
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
              Creating listing…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
                <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
              </svg>
              Create Beta Listing
            </>
          )}
        </button>

        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Goes live on <span className="font-semibold" style={{ color: 'rgba(10,46,77,0.55)' }}>/guides</span> immediately
        </p>
      </div>
    </form>
  )
}
