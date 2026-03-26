'use client'

/**
 * ProfileEditForm — guide edits their own profile from /dashboard/profile/edit.
 *
 * Calls updateGuideProfile() Server Action.
 * Photos uploaded via ImageUpload component → Supabase Storage.
 *
 * Sections:
 *   1. Photos
 *   2. Basic Info (+ tagline + cancellation_policy)
 *   3. Expertise
 *   4. Specialties & Certifications   ← NEW
 *   5. External Reviews               ← NEW
 *   6. Social Links
 *   7. Boat (collapsible)             ← NEW
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ImageUpload from '@/components/admin/image-upload'
import { ImageCropModal } from '@/components/ui/image-crop'
import { createClient } from '@/lib/supabase/client'
import { updateGuideProfile } from '@/actions/dashboard'
import { FISH_ALL } from '@/lib/fish'
import { LANDSCAPE_LIBRARY } from '@/lib/landscapes'
import type { CancellationPolicy, BoatType, PaymentMethod } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

import { COUNTRIES } from '@/lib/countries'

const FISH_OPTIONS = FISH_ALL

const LANGUAGE_OPTIONS = [
  'English', 'Norwegian', 'Swedish', 'Finnish', 'Danish', 'Icelandic',
  'German', 'Polish', 'French', 'Dutch', 'Russian', 'Spanish',
]

const SPECIALTY_OPTIONS = [
  'Fly fishing', 'Family-friendly',
  'Ice fishing', 'Sea fishing', 'Catch & release', 'Beginner-friendly',
]

type CancellationOption = { value: CancellationPolicy; label: string; days: string }
const CANCELLATION_OPTIONS: CancellationOption[] = [
  { value: 'flexible', label: 'Flexible', days: '7 days' },
  { value: 'moderate', label: 'Moderate', days: '14 days' },
  { value: 'strict',   label: 'Strict',   days: '30 days' },
]

type BoatTypeOption = { value: BoatType; label: string }
const BOAT_TYPE_OPTIONS: BoatTypeOption[] = [
  { value: 'center_console', label: 'Center console' },
  { value: 'cabin',          label: 'Cabin boat' },
  { value: 'rib',            label: 'RIB' },
  { value: 'drift_boat',     label: 'Drift boat' },
  { value: 'kayak',          label: 'Kayak' },
]

type PaymentMethodOption = { value: PaymentMethod; label: string; icon: string; description: string }
const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    value:       'cash',
    label:       'Cash',
    icon:        '💵',
    description: 'Collected in person at the trip',
  },
  {
    value:       'online',
    label:       'Online payment',
    icon:        '💳',
    description: 'Secure card payment via Stripe',
  },
]

const TAGLINE_MAX = 120

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileDefaults = {
  full_name: string
  country: string
  city: string | null
  bio: string | null
  fish_expertise: string[]
  languages: string[]
  years_experience: number | null
  instagram_url: string | null
  youtube_url: string | null
  facebook_url?: string | null
  website_url?: string | null
  avatar_url: string | null
  cover_url: string | null
  // ── Optional new fields — available after guide profile expansion ──────────
  tagline?: string | null
  cancellation_policy?: CancellationPolicy | null
  specialties?: string[] | null
  certifications?: string[] | null
  google_profile_url?: string | null
  google_rating?: number | null
  google_review_count?: number | null
  boat_name?: string | null
  boat_type?: BoatType | null
  boat_length_m?: number | null
  boat_engine?: string | null
  boat_capacity?: number | null
  landscape_url?: string | null
  accepted_payment_methods?: PaymentMethod[] | null
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%',
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.1)',
  borderRadius: '14px',
  padding: '13px 16px',
  color: '#0A2E4D',
  fontSize: '14px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
  outline: 'none',
  transition: 'border-color 0.15s',
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.45)' }}
    >
      {children}
    </label>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-all f-body"
      style={
        active
          ? { background: '#0A2E4D', color: '#fff' }
          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)', border: '1px solid rgba(10,46,77,0.1)' }
      }
    >
      {label}
    </button>
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileEditForm({ defaults }: { defaults: ProfileDefaults }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ── Basic info ───────────────────────────────────────────────────────────────
  const [fullName,   setFullName]   = useState(defaults.full_name)
  const [country,    setCountry]    = useState(defaults.country)
  const [city,       setCity]       = useState(defaults.city ?? '')
  const [tagline,    setTagline]    = useState(defaults.tagline ?? '')
  const [cancPolicy, setCancPolicy] = useState<CancellationPolicy>(
    defaults.cancellation_policy ?? 'moderate',
  )
  const [bio,        setBio]        = useState(defaults.bio ?? '')
  const [years,      setYears]      = useState(defaults.years_experience?.toString() ?? '')

  // ── Expertise ───────────────────────────────────────────────────────────────
  const [fishList, setFishList] = useState<string[]>(defaults.fish_expertise)
  const [langList, setLangList] = useState<string[]>(defaults.languages)

  // ── Specialties & Certifications ────────────────────────────────────────────
  const [specialties,    setSpecialties]    = useState<string[]>(defaults.specialties ?? [])
  const [certifications, setCertifications] = useState<string[]>(defaults.certifications ?? [])

  // ── External Reviews ────────────────────────────────────────────────────────
  const [googleUrl,         setGoogleUrl]         = useState(defaults.google_profile_url ?? '')
  const [googleRating,      setGoogleRating]      = useState(defaults.google_rating?.toString() ?? '')
  const [googleReviewCount, setGoogleReviewCount] = useState(defaults.google_review_count?.toString() ?? '')

  // ── Boat ────────────────────────────────────────────────────────────────────
  const [hasBoat,      setHasBoat]      = useState(defaults.boat_name != null || defaults.boat_type != null)
  const [boatName,     setBoatName]     = useState(defaults.boat_name ?? '')
  const [boatType,     setBoatType]     = useState<BoatType | ''>(defaults.boat_type ?? '')
  const [boatLength,   setBoatLength]   = useState(defaults.boat_length_m?.toString() ?? '')
  const [boatEngine,   setBoatEngine]   = useState(defaults.boat_engine ?? '')
  const [boatCapacity, setBoatCapacity] = useState(defaults.boat_capacity?.toString() ?? '')

  // ── Payment methods ──────────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    (defaults.accepted_payment_methods ?? ['cash', 'online']) as PaymentMethod[],
  )

  // ── Social ──────────────────────────────────────────────────────────────────
  const [instagram, setInstagram] = useState(defaults.instagram_url ?? '')
  const [youtube,   setYoutube]   = useState(defaults.youtube_url ?? '')
  const [facebook,  setFacebook]  = useState(defaults.facebook_url ?? '')
  const [website,   setWebsite]   = useState(defaults.website_url ?? '')

  // ── Photos ──────────────────────────────────────────────────────────────────
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(defaults.avatar_url)
  const [coverUrl,      setCoverUrl]      = useState<string | null>(defaults.cover_url)
  const [landscapeUrl,  setLandscapeUrl]  = useState<string>(defaults.landscape_url ?? '')
  const [landscapeTab,  setLandscapeTab]  = useState<'library' | 'upload'>('library')
  const [heroCropSrc,   setHeroCropSrc]   = useState<string | null>(null)

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  const toggleFish      = (f: string) =>
    setFishList(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  const toggleLang      = (l: string) =>
    setLangList(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])
  const toggleSpecialty = (s: string) =>
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const togglePaymentMethod = (m: PaymentMethod) =>
    setPaymentMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  // ── Certification helpers ────────────────────────────────────────────────────
  const addCertification = () => {
    if (certifications.length < 5) setCertifications(prev => [...prev, ''])
  }
  const updateCertification = (idx: number, value: string) =>
    setCertifications(prev => prev.map((c, i) => (i === idx ? value : c)))
  const removeCertification = (idx: number) =>
    setCertifications(prev => prev.filter((_, i) => i !== idx))

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!fullName.trim())             { setError('Full name is required.'); return }
    if (!country)                     { setError('Country is required.'); return }
    if (tagline.length > TAGLINE_MAX) { setError(`Tagline must be ${TAGLINE_MAX} characters or fewer.`); return }
    if (paymentMethods.length === 0)  { setError('Select at least one accepted payment method.'); return }

    if (googleRating !== '') {
      const r = parseFloat(googleRating)
      if (isNaN(r) || r < 1 || r > 5) { setError('Google rating must be between 1.0 and 5.0.'); return }
    }

    const filteredCerts = certifications.filter(c => c.trim() !== '')

    startTransition(async () => {
      const result = await updateGuideProfile({
        full_name:           fullName.trim(),
        country,
        city:                city.trim() || null,
        tagline:             tagline.trim() || null,
        cancellation_policy: cancPolicy,
        bio:                 bio.trim() || null,
        fish_expertise:      fishList,
        languages:           langList,
        years_experience:    years ? parseInt(years, 10) : null,
        specialties:         specialties.length > 0 ? specialties : null,
        certifications:      filteredCerts.length > 0 ? filteredCerts : null,
        google_profile_url:  googleUrl.trim() || null,
        google_rating:       googleRating !== '' ? parseFloat(googleRating) : null,
        google_review_count: googleReviewCount !== '' ? parseInt(googleReviewCount, 10) : null,
        // Boat: clear all fields when toggle is off
        boat_name:           hasBoat ? boatName.trim() || null : null,
        boat_type:           hasBoat && boatType !== '' ? boatType : null,
        boat_length_m:       hasBoat && boatLength !== '' ? parseFloat(boatLength) : null,
        boat_engine:         hasBoat ? boatEngine.trim() || null : null,
        boat_capacity:       hasBoat && boatCapacity !== '' ? parseInt(boatCapacity, 10) : null,
        instagram_url:       instagram.trim() || null,
        youtube_url:         youtube.trim() || null,
        facebook_url:        facebook.trim() || null,
        website_url:         website.trim() || null,
        avatar_url:                avatarUrl,
        cover_url:                 coverUrl,
        landscape_url:             landscapeUrl.trim() || null,
        accepted_payment_methods:  paymentMethods,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.push('/dashboard')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[760px]">

      {/* Error banner */}
      {error != null && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-5 text-sm f-body"
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

      {/* Saved banner */}
      {saved && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-5 text-sm f-body"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#16A34A' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="13,4 6,11 2,7" />
          </svg>
          Changes saved successfully.
        </div>
      )}

      {/* ── Hero Landscape ─────────────────────────────────────────── */}
      <SectionCard title="Hero Background" subtitle="Full-width landscape shown behind your guide profile header. Pick from our library or upload your own.">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(10,46,77,0.05)', width: 'fit-content' }}>
          {(['library', 'upload'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setLandscapeTab(tab)}
              className="px-5 py-2 rounded-xl text-sm font-semibold f-body transition-all capitalize"
              style={landscapeTab === tab
                ? { background: '#fff', color: '#0A2E4D', boxShadow: '0 1px 4px rgba(10,46,77,0.12)' }
                : { color: 'rgba(10,46,77,0.45)' }
              }
            >
              {tab === 'library' ? 'Pick from library' : 'Upload my own'}
            </button>
          ))}
        </div>

        {landscapeTab === 'library' && (
          <div className="grid grid-cols-3 gap-3">
            {LANDSCAPE_LIBRARY.map(url => {
              const selected = landscapeUrl === url
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setHeroCropSrc(url)}
                  className="relative overflow-hidden transition-all group"
                  style={{
                    height: '100px',
                    borderRadius: '12px',
                    border: selected ? '2.5px solid #E67E50' : '2px solid rgba(10,46,77,0.1)',
                    boxShadow: selected ? '0 0 0 3px rgba(230,126,80,0.2)' : 'none',
                  }}
                >
                  <Image src={url} alt="" fill className="object-cover" />
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(230,126,80,0.25)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="rgba(230,126,80,0.9)" />
                        <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  {!selected && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(7,17,28,0.45)' }}>
                      <span className="text-[10px] font-semibold f-body text-white">Crop & use</span>
                    </div>
                  )}
                </button>
              )
            })}
            {/* None / auto-assign */}
            <button
              type="button"
              onClick={() => setLandscapeUrl('')}
              className="flex flex-col items-center justify-center gap-1 transition-all"
              style={{
                height: '100px',
                borderRadius: '12px',
                border: landscapeUrl === '' ? '2.5px solid #E67E50' : '2px dashed rgba(10,46,77,0.15)',
                background: 'rgba(10,46,77,0.03)',
              }}
            >
              <span className="text-lg">✕</span>
              <span className="text-[11px] f-body font-medium" style={{ color: 'rgba(10,46,77,0.4)' }}>Auto-assign</span>
            </button>
          </div>
        )}

        {/* Crop modal — hero from library or upload */}
        {heroCropSrc != null && (
          <ImageCropModal
            src={heroCropSrc}
            aspect={16 / 9}
            onConfirm={(croppedFile) => {
              setHeroCropSrc(null)
              void (async () => {
                const supabase = createClient()
                const path = `${crypto.randomUUID()}.jpg`
                await supabase.storage.from('guide-photos').upload(path, croppedFile, {
                  cacheControl: '31536000', upsert: false, contentType: 'image/jpeg',
                })
                const { data: { publicUrl } } = supabase.storage.from('guide-photos').getPublicUrl(path)
                setLandscapeUrl(publicUrl)
              })()
            }}
            onCancel={() => setHeroCropSrc(null)}
          />
        )}

        {landscapeTab === 'upload' && (
          <div>
            <ImageUpload
              label="Hero landscape"
              currentUrl={landscapeUrl || null}
              aspect="wide"
              variant="cover"
              cropAspect={16 / 9}
              onUpload={url => setLandscapeUrl(url)}
            />
            <p className="text-[11px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Landscape orientation recommended · min 2400px wide
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── Photos ─────────────────────────────────────────────────── */}
      <SectionCard title="Photos" subtitle="Avatar shown on your profile card · Cover banner on your guide page">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <ImageUpload
              label="Avatar photo"
              aspect="square"
              variant="avatar"
              cropAspect={1}
              currentUrl={avatarUrl}
              onUpload={url => setAvatarUrl(url)}
              hint="Square — crop to 1:1 before upload"
            />
            <ImageUpload
              label="Cover photo"
              aspect="wide"
              variant="cover"
              cropAspect={16 / 9}
              currentUrl={coverUrl}
              onUpload={url => setCoverUrl(url)}
              hint="Wide banner — crop to 16:9 before upload"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Basic info ─────────────────────────────────────────────── */}
      <SectionCard title="Basic Info">
        <div className="flex flex-col gap-5">

          {/* Full name */}
          <div>
            <Label htmlFor="full_name">Full name *</Label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>

          {/* Country + City */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country">Country *</Label>
              <select
                id="country"
                value={country}
                onChange={e => setCountry(e.target.value)}
                style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="city">City / Region</Label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Bergen"
                style={inputBase}
                onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              maxLength={TAGLINE_MAX + 10}
              placeholder="Salmon & trout specialist in Northern Norway since 2008"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
            <p
              className="text-[11px] mt-1.5 f-body text-right"
              style={{ color: tagline.length > TAGLINE_MAX ? '#DC2626' : 'rgba(10,46,77,0.35)' }}
            >
              {tagline.length} / {TAGLINE_MAX}
            </p>
          </div>

          {/* Cancellation policy */}
          <div>
            <Label>Cancellation policy</Label>
            <div className="flex gap-3 flex-wrap" role="group" aria-label="Cancellation policy">
              {CANCELLATION_OPTIONS.map(opt => {
                const isActive = cancPolicy === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCancPolicy(opt.value)}
                    aria-pressed={isActive}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all f-body"
                    style={
                      isActive
                        ? { background: '#0A2E4D', color: '#fff', border: '1.5px solid #0A2E4D' }
                        : {
                            background: 'rgba(10,46,77,0.04)',
                            color: 'rgba(10,46,77,0.6)',
                            border: '1.5px solid rgba(10,46,77,0.12)',
                          }
                    }
                  >
                    {opt.label}
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={
                        isActive
                          ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }
                          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.4)' }
                      }
                    >
                      {opt.days}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] mt-2 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              Minimum notice before trip start required for a full refund.
            </p>
          </div>

          {/* Accepted payment methods */}
          <div>
            <Label>Accepted payment methods</Label>
            <div className="flex gap-3 flex-wrap" role="group" aria-label="Accepted payment methods">
              {PAYMENT_METHOD_OPTIONS.map(opt => {
                const isActive = paymentMethods.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePaymentMethod(opt.value)}
                    aria-pressed={isActive}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all f-body"
                    style={
                      isActive
                        ? {
                            background: '#0A2E4D',
                            color: '#fff',
                            border: '1.5px solid #0A2E4D',
                            boxShadow: '0 2px 8px rgba(10,46,77,0.18)',
                          }
                        : {
                            background: 'rgba(10,46,77,0.04)',
                            color: 'rgba(10,46,77,0.6)',
                            border: '1.5px solid rgba(10,46,77,0.12)',
                          }
                    }
                  >
                    {/* Checkbox indicator */}
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(10,46,77,0.08)',
                        border: isActive ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid rgba(10,46,77,0.2)',
                      }}
                    >
                      {isActive && (
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-base leading-none">{opt.icon}</span>
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="font-semibold leading-none">{opt.label}</span>
                      <span
                        className="text-[11px] leading-tight"
                        style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(10,46,77,0.4)' }}
                      >
                        {opt.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] mt-2 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              Shown to anglers on your profile and trip pages. Select all that apply.
            </p>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              rows={5}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Describe your experience, specialisation, and what makes your fishing trips special…"
              style={{ ...inputBase, resize: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>

          {/* Years of experience */}
          <div style={{ maxWidth: '200px' }}>
            <Label htmlFor="years_experience">Years of experience</Label>
            <input
              id="years_experience"
              type="number"
              min="1"
              max="60"
              value={years}
              onChange={e => setYears(e.target.value)}
              placeholder="10"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Expertise ──────────────────────────────────────────────── */}
      <SectionCard title="Expertise" subtitle="What species do you guide for?">
        <div className="flex flex-col gap-6">
          <div>
            <Label>
              Target species
              {fishList.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: '#E67E50' }}>
                  · {fishList.length} selected
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {FISH_OPTIONS.map(f => (
                <Pill key={f} label={f} active={fishList.includes(f)} onClick={() => toggleFish(f)} />
              ))}
            </div>
          </div>
          <div>
            <Label>
              Languages spoken
              {langList.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'rgba(10,46,77,0.45)' }}>
                  · {langList.length} selected
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(l => (
                <Pill key={l} label={l} active={langList.includes(l)} onClick={() => toggleLang(l)} />
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Specialties & Certifications ───────────────────────────── */}
      <SectionCard title="Specialties & Certifications" subtitle="Highlight your unique strengths and credentials">
        <div className="flex flex-col gap-6">

          {/* Specialties pills */}
          <div>
            <Label>
              Specialties
              {specialties.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: '#E67E50' }}>
                  · {specialties.length} selected
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(s => (
                <Pill
                  key={s}
                  label={s}
                  active={specialties.includes(s)}
                  onClick={() => toggleSpecialty(s)}
                />
              ))}
            </div>
          </div>

          {/* Certifications dynamic list */}
          <div>
            <Label>
              Certifications
              <span
                className="ml-2 normal-case tracking-normal font-normal"
                style={{ color: 'rgba(10,46,77,0.35)' }}
              >
                max 5
              </span>
            </Label>
            <div className="flex flex-col gap-2.5">
              {certifications.map((cert, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cert}
                    onChange={e => updateCertification(idx, e.target.value)}
                    placeholder="e.g. Wilderness First Aid, Swift Water Rescue"
                    style={{ ...inputBase, flex: 1 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                    aria-label={`Certification ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-base leading-none transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: 'rgba(239,68,68,0.07)',
                      color: '#DC2626',
                      border: '1px solid rgba(239,68,68,0.15)',
                    }}
                    aria-label={`Remove certification ${idx + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}

              {certifications.length < 5 && (
                <button
                  type="button"
                  onClick={addCertification}
                  className="self-start flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 active:scale-[0.98] f-body"
                  style={{
                    background: 'rgba(10,46,77,0.04)',
                    color: 'rgba(10,46,77,0.55)',
                    border: '1.5px dashed rgba(10,46,77,0.18)',
                  }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                  Add certification
                </button>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* External Reviews section removed — not used */}

      {/* ── Social links ───────────────────────────────────────────── */}
      <SectionCard title="Social Links" subtitle="Optional — helps anglers follow your work">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="instagram_url">Instagram URL</Label>
            <input
              id="instagram_url"
              type="url"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
          <div>
            <Label htmlFor="youtube_url">YouTube URL</Label>
            <input
              id="youtube_url"
              type="url"
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
          <div>
            <Label htmlFor="facebook_url">Facebook URL</Label>
            <input
              id="facebook_url"
              type="url"
              value={facebook}
              onChange={e => setFacebook(e.target.value)}
              placeholder="https://facebook.com/yourpage"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
          <div>
            <Label htmlFor="website_url">Website URL</Label>
            <input
              id="website_url"
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Boat (collapsible) ──────────────────────────────────────── */}
      <div
        className="p-8 mb-5 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        {/* Toggle header */}
        <label className="flex items-center gap-3.5 cursor-pointer select-none">
          {/* Custom toggle switch */}
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              checked={hasBoat}
              onChange={e => setHasBoat(e.target.checked)}
              className="sr-only"
              aria-label="I guide from a boat"
            />
            <div
              className="w-11 h-6 rounded-full transition-colors duration-200"
              style={{ background: hasBoat ? '#0A2E4D' : 'rgba(10,46,77,0.12)' }}
            />
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: hasBoat ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
          <div>
            <p className="text-[#0A2E4D] text-base font-bold f-display leading-snug">Boat</p>
            <p className="text-[#0A2E4D]/40 text-xs f-body">I guide from a boat</p>
          </div>
        </label>

        {/* Collapsible boat fields */}
        {hasBoat && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="boat_name">Boat name</Label>
                <input
                  id="boat_name"
                  type="text"
                  value={boatName}
                  onChange={e => setBoatName(e.target.value)}
                  placeholder="Northern Star"
                  style={inputBase}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                />
              </div>
              <div>
                <Label htmlFor="boat_type">Boat type</Label>
                <select
                  id="boat_type"
                  value={boatType}
                  onChange={e => setBoatType(e.target.value as BoatType | '')}
                  style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                >
                  <option value="">Select type</option>
                  {BOAT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="boat_length_m">Length (m)</Label>
                <input
                  id="boat_length_m"
                  type="number"
                  min="1"
                  max="30"
                  step="0.1"
                  value={boatLength}
                  onChange={e => setBoatLength(e.target.value)}
                  placeholder="6.5"
                  style={inputBase}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                />
              </div>
              <div>
                <Label htmlFor="boat_engine">Engine</Label>
                <input
                  id="boat_engine"
                  type="text"
                  value={boatEngine}
                  onChange={e => setBoatEngine(e.target.value)}
                  placeholder="Yamaha 115hp"
                  style={inputBase}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                />
              </div>
              <div>
                <Label htmlFor="boat_capacity">Capacity (anglers)</Label>
                <input
                  id="boat_capacity"
                  type="number"
                  min="1"
                  max="12"
                  value={boatCapacity}
                  onChange={e => setBoatCapacity(e.target.value)}
                  placeholder="4"
                  style={inputBase}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Submit ─────────────────────────────────────────────────── */}
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
            'Save changes →'
          )}
        </button>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Changes visible on your public profile immediately.
        </p>
      </div>

    </form>
  )
}
