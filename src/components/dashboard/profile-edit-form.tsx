'use client'

/**
 * ProfileEditForm — guide edits their own profile from /dashboard/profile/edit.
 *
 * Calls updateGuideProfile() Server Action.
 * Photos uploaded via ImageUpload component → Supabase Storage.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/admin/image-upload'
import { updateGuideProfile } from '@/actions/dashboard'

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = ['Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark']

const FISH_OPTIONS = [
  'Salmon', 'Sea Trout', 'Brown Trout', 'Arctic Char', 'Rainbow Trout',
  'Grayling', 'Pike', 'Perch', 'Zander', 'Whitefish',
  'Cod', 'Halibut', 'Catfish', 'Burbot',
]

const LANGUAGE_OPTIONS = [
  'English', 'Norwegian', 'Swedish', 'Finnish', 'Danish', 'Icelandic',
  'German', 'Polish', 'French', 'Dutch', 'Russian', 'Spanish',
]

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
  avatar_url: string | null
  cover_url: string | null
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
      {children}
    </label>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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

  // ── Fields ────────────────────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState(defaults.full_name)
  const [country,     setCountry]     = useState(defaults.country)
  const [city,        setCity]        = useState(defaults.city ?? '')
  const [bio,         setBio]         = useState(defaults.bio ?? '')
  const [fishList,    setFishList]    = useState<string[]>(defaults.fish_expertise)
  const [langList,    setLangList]    = useState<string[]>(defaults.languages)
  const [years,       setYears]       = useState(defaults.years_experience?.toString() ?? '')
  const [instagram,   setInstagram]   = useState(defaults.instagram_url ?? '')
  const [youtube,     setYoutube]     = useState(defaults.youtube_url ?? '')
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(defaults.avatar_url)
  const [coverUrl,    setCoverUrl]    = useState<string | null>(defaults.cover_url)

  const toggleFish = (f: string) =>
    setFishList(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  const toggleLang = (l: string) =>
    setLangList(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!country)         { setError('Country is required.'); return }

    startTransition(async () => {
      const result = await updateGuideProfile({
        full_name:        fullName.trim(),
        country,
        city:             city.trim() || null,
        bio:              bio.trim() || null,
        fish_expertise:   fishList,
        languages:        langList,
        years_experience: years ? parseInt(years, 10) : null,
        instagram_url:    instagram.trim() || null,
        youtube_url:      youtube.trim() || null,
        avatar_url:       avatarUrl,
        cover_url:        coverUrl,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.refresh()
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

      {/* ── Photos ─────────────────────────────────────────────────── */}
      <SectionCard title="Photos" subtitle="Avatar shown on your profile card · Cover banner on your guide page">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <ImageUpload
              label="Avatar photo"
              aspect="square"
              currentUrl={avatarUrl}
              onUpload={url => setAvatarUrl(url)}
              hint="Square, min 400×400px"
            />
            <ImageUpload
              label="Cover photo"
              aspect="wide"
              currentUrl={coverUrl}
              onUpload={url => setCoverUrl(url)}
              hint="Wide banner, min 1200×400px"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Basic info ─────────────────────────────────────────────── */}
      <SectionCard title="Basic Info">
        <div className="flex flex-col gap-5">
          <div>
            <Label>Full name *</Label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Country *</Label>
              <select
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
              <Label>City / Region</Label>
              <input
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

          <div>
            <Label>Bio</Label>
            <textarea
              rows={5}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Describe your experience, specialisation, and what makes your fishing trips special…"
              style={{ ...inputBase, resize: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>

          <div style={{ maxWidth: '200px' }}>
            <Label>Years of experience</Label>
            <input
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

      {/* ── Social links ───────────────────────────────────────────── */}
      <SectionCard title="Social Links" subtitle="Optional — helps anglers follow your work">
        <div className="flex flex-col gap-4">
          <div>
            <Label>Instagram URL</Label>
            <input
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
            <Label>YouTube URL</Label>
            <input
              type="url"
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
            />
          </div>
        </div>
      </SectionCard>

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
