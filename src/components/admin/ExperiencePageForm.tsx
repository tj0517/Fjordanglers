'use client'

/**
 * ExperiencePageForm — admin form for creating/editing experience_pages.
 *
 * FA fills this after reviewing a guide submission. Sections:
 *  1. Identity   — name, slug, country, region, price, season, status
 *  2. Quick fit  — difficulty, effort, technique[], species[], environment[]
 *  3. Story      — hero image, story text, catches text, rod setup, best months
 *  4. Gallery    — gallery image URLs (one per line)
 *  5. Season     — visual month picker (open season + peak months)
 *  6. Meet       — meeting point name + description
 *  7. What's inc — includes[], excludes[]
 *  8. SEO        — meta_title, meta_description, og_image_url
 *
 * Supports both create and edit modes via the `mode` prop.
 */

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ChevronRight } from 'lucide-react'
import { FISH_ALL } from '@/lib/fish'
import { COUNTRIES } from '@/lib/countries'
import { createExperiencePage, updateExperiencePage, type ExperiencePagePayload } from '@/actions/experience-pages'
import ImageUpload from '@/components/admin/image-upload'
import MultiImageUpload, { type GalleryImage } from '@/components/admin/multi-image-upload'
import LatLngPicker from '@/components/admin/LatLngPicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES    = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
const EFFORTS         = ['Low', 'Medium', 'High']
const ENVIRONMENTS    = ['River', 'Lake', 'Sea', 'Fjord', 'Estuary', 'Coast']
const TECHNIQUES      = ['Fly fishing', 'Spinning', 'Trolling', 'Jigging', 'Ice fishing', 'Baitcasting', 'Shore fishing', 'Sea fishing']
const MONTHS          = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS_OPTIONS  = [
  { v: 'draft',    l: 'Draft'    },
  { v: 'active',   l: 'Active'   },
  { v: 'archived', l: 'Archived' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function parseLines(s: string): string[] {
  return s.split('\n').map(l => l.trim()).filter(Boolean)
}

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function SectionLabel({ step, title, desc }: { step: number; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}>
        <span className="text-[11px] font-bold f-body">{step}</span>
      </div>
      <div>
        <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>{title}</h2>
        {desc && <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>{desc}</p>}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
      style={{
        background: active ? '#E67E50' : 'rgba(10,46,77,0.06)',
        color:      active ? '#fff'    : 'rgba(10,46,77,0.6)',
        border:     active ? 'none'    : '1px solid rgba(10,46,77,0.1)',
        boxShadow:  active ? '0 2px 8px rgba(230,126,80,0.28)' : 'none',
      }}>
      {label}
    </button>
  )
}

function Divider() {
  return <div className="my-8" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }} />
}

// ─── Visual month picker ───────────────────────────────────────────────────────
// Each month tile cycles: off-season → open season → peak (on double click,
// or use two separate rows: one for season, one for peak).
// We use two rows: top = open season, bottom = peak months.

function MonthPicker({
  seasonMonths,
  peakMonths,
  onSeasonChange,
  onPeakChange,
}: {
  seasonMonths: number[]
  peakMonths:   number[]
  onSeasonChange: (months: number[]) => void
  onPeakChange:   (months: number[]) => void
}) {
  const toggleSeason = (m: number) => {
    const next = toggleItem(seasonMonths, m)
    onSeasonChange(next)
    // Remove from peak if removed from season
    if (!next.includes(m)) {
      onPeakChange(peakMonths.filter(pm => pm !== m))
    }
  }
  const togglePeak = (m: number) => {
    if (!seasonMonths.includes(m)) return // must be in season first
    onPeakChange(toggleItem(peakMonths, m))
  }

  return (
    <div className="space-y-4">
      {/* Row 1 — open season */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-2.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Open season — click to mark which months the experience runs
        </p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
          {MONTHS_SHORT.map((label, i) => {
            const m = i + 1
            const isOpen = seasonMonths.includes(m)
            const isPeak = peakMonths.includes(m)
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleSeason(m)}
                className="flex flex-col items-center justify-between rounded-xl py-3 px-1 transition-all"
                style={{
                  minHeight: '72px',
                  background: isPeak
                    ? '#E67E50'
                    : isOpen
                      ? 'rgba(230,126,80,0.12)'
                      : 'rgba(10,46,77,0.04)',
                  border: isOpen
                    ? isPeak ? '1.5px solid #E67E50' : '1.5px solid rgba(230,126,80,0.35)'
                    : '1.5px solid rgba(10,46,77,0.08)',
                  cursor: 'pointer',
                }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide f-body"
                  style={{ color: isPeak ? '#fff' : isOpen ? '#E67E50' : 'rgba(10,46,77,0.3)' }}>
                  {label}
                </span>
                <span className="w-1.5 h-1.5 rounded-full" style={{
                  background: isPeak ? '#fff' : isOpen ? '#E67E50' : 'rgba(10,46,77,0.12)',
                }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] f-body text-center leading-tight"
                  style={{ color: isPeak ? '#fff' : isOpen ? '#E67E50' : 'rgba(10,46,77,0.2)' }}>
                  {isPeak ? 'Peak' : isOpen ? 'Open' : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Row 2 — peak months (subset selector) */}
      {seasonMonths.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-2.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Peak months — highlight the best fishing months in orange
          </p>
          <div className="flex flex-wrap gap-2">
            {seasonMonths.sort((a, b) => a - b).map(m => {
              const isPeak = peakMonths.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => togglePeak(m)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
                  style={{
                    background: isPeak ? '#E67E50' : 'rgba(230,126,80,0.08)',
                    color:      isPeak ? '#fff'    : '#E67E50',
                    border:     isPeak ? 'none'    : '1px solid rgba(230,126,80,0.25)',
                    boxShadow:  isPeak ? '0 2px 8px rgba(230,126,80,0.3)' : 'none',
                  }}
                >
                  {MONTHS[m - 1]}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.3)' }}>
            Selected: {peakMonths.length > 0 ? peakMonths.sort((a,b)=>a-b).map(m => MONTHS[m-1]).join(', ') : 'none'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExperiencePageFormInitialData {
  experience_name:           string
  slug:                      string
  country:                   string
  region:                    string
  price_from:                number
  season_start:              string | null
  season_end:                string | null
  status:                    'draft' | 'active' | 'archived'
  difficulty:                string | null
  physical_effort:           string | null
  non_angler_friendly:       boolean
  technique:                 string[]
  target_species:            string[]
  environment:               string[]
  hero_image_url:            string | null
  gallery_image_urls:        string[]
  story_text:                string | null
  catches_text:              string | null
  rod_setup:                 string | null
  best_months:               string | null
  season_months:             number[]
  peak_months:               number[]
  meeting_point_name:        string | null
  meeting_point_description: string | null
  includes:                  string[]
  excludes:                  string[]
  meta_title:                string | null
  meta_description:          string | null
  og_image_url:              string | null
  location_lat:              number | null
  location_lng:              number | null
}

export interface ExperiencePageFormProps {
  mode?: 'create' | 'edit'
  experienceId?: string
  /** Pre-fill values from a guide_submission (create mode only) */
  prefill?: {
    country?:        string
    region?:         string
    species?:        string[]
    technique?:      string[]
    season_months?:  number[]
    price_approx?:   number | null
    location_name?:  string
    guide_id?:       string
  }
  /** Full initial data for edit mode */
  initialData?: ExperiencePageFormInitialData
  /**
   * URLs from the guide's photo gallery (guide_photos table).
   * When provided, the hero image and gallery pickers show a "From gallery" tab.
   */
  guidePhotos?: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExperiencePageForm({
  mode = 'create',
  experienceId,
  prefill,
  initialData,
  guidePhotos = [],
}: ExperiencePageFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  // ── Section 1: Identity
  const [experienceName, setExperienceName] = useState(initialData?.experience_name ?? '')
  const [slug,           setSlug]           = useState(initialData?.slug ?? '')
  const [slugEdited,     setSlugEdited]     = useState(isEdit) // In edit mode, don't auto-generate slug
  const [country,        setCountry]        = useState(initialData?.country ?? prefill?.country ?? '')
  const [region,         setRegion]         = useState(initialData?.region ?? prefill?.region ?? prefill?.location_name ?? '')
  const [priceFrom,      setPriceFrom]      = useState(initialData?.price_from?.toString() ?? prefill?.price_approx?.toString() ?? '')
  const [seasonStart,    setSeasonStart]    = useState(initialData?.season_start ?? '')
  const [seasonEnd,      setSeasonEnd]      = useState(initialData?.season_end ?? '')
  const [status,         setStatus]         = useState<'draft' | 'active' | 'archived'>(initialData?.status ?? 'draft')

  // ── Section 2: Quick fit
  const [difficulty,        setDifficulty]        = useState(initialData?.difficulty ?? '')
  const [effort,            setEffort]            = useState(initialData?.physical_effort ?? '')
  const [nonAnglerFriendly, setNonAnglerFriendly] = useState(initialData?.non_angler_friendly ?? false)
  const [technique,         setTechnique]         = useState<string[]>(initialData?.technique ?? prefill?.technique ?? [])
  const [targetSpecies,     setTargetSpecies]     = useState<string[]>(initialData?.target_species ?? prefill?.species ?? [])
  const [environment,       setEnvironment]       = useState<string[]>(initialData?.environment ?? [])

  // ── Section 3: Story
  const [heroImageUrl, setHeroImageUrl] = useState(initialData?.hero_image_url ?? '')
  const [storyText,    setStoryText]    = useState(initialData?.story_text ?? '')
  const [catchesText,  setCatchesText]  = useState(initialData?.catches_text ?? '')
  const [rodSetup,     setRodSetup]     = useState(initialData?.rod_setup ?? '')
  const [bestMonths,   setBestMonths]   = useState(() => {
    if (initialData?.best_months) return initialData.best_months
    if (!prefill?.season_months?.length) return ''
    return prefill.season_months.map(m => MONTHS[m - 1] ?? '').filter(Boolean).join(', ')
  })

  // ── Section 4: Gallery
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    () => (initialData?.gallery_image_urls ?? []).map((url, i) => ({ id: String(i), url, is_cover: i === 0, sort_order: i }))
  )

  // ── Section 5: Season months
  const [seasonMonths, setSeasonMonths] = useState<number[]>(
    initialData?.season_months ?? prefill?.season_months ?? []
  )
  const [peakMonths, setPeakMonths] = useState<number[]>(initialData?.peak_months ?? [])

  // ── Section 6: Meeting point
  const [meetingName, setMeetingName] = useState(initialData?.meeting_point_name ?? '')
  const [meetingDesc, setMeetingDesc] = useState(initialData?.meeting_point_description ?? '')

  // ── Section 7: Includes/Excludes
  const [includes, setIncludes] = useState(initialData?.includes?.join('\n') ?? 'Guide service')
  const [excludes, setExcludes] = useState(initialData?.excludes?.join('\n') ?? '')

  // ── Section 8: SEO
  const [metaTitle, setMetaTitle] = useState(initialData?.meta_title ?? '')
  const [metaDesc,  setMetaDesc]  = useState(initialData?.meta_description ?? '')
  const [ogImage,   setOgImage]   = useState(initialData?.og_image_url ?? '')

  // ── Location (map pin)
  const [locationLat, setLocationLat] = useState<number | null>(initialData?.location_lat ?? null)
  const [locationLng, setLocationLng] = useState<number | null>(initialData?.location_lng ?? null)

  const handleLocationChange = useCallback(
    (lat: number | null, lng: number | null) => {
      setLocationLat(lat)
      setLocationLng(lng)
    },
    [],
  )

  // ── Submit state
  const [isPending,    startTransition]  = useTransition()
  const [serverError,  setServerError]   = useState<string | null>(null)
  const [hasAttempted, setHasAttempted]  = useState(false)

  // Validation
  const nameValid    = experienceName.trim() !== ''
  const slugValid    = slug.trim() !== ''
  const countryValid = country !== ''
  const regionValid  = region.trim() !== ''
  const priceValid   = priceFrom !== '' && parseFloat(priceFrom) > 0
  const canSubmit    = nameValid && slugValid && countryValid && regionValid && priceValid

  // Auto-generate slug from name (until manually edited)
  const handleNameChange = useCallback((val: string) => {
    setExperienceName(val)
    if (!slugEdited) setSlug(slugify(val))
  }, [slugEdited])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttempted(true)
    if (!canSubmit) return

    setServerError(null)

    const payload: ExperiencePagePayload = {
      guide_id:                  prefill?.guide_id ?? null,
      experience_name:           experienceName.trim(),
      slug:                      slug.trim(),
      country,
      region:                    region.trim(),
      price_from:                parseFloat(priceFrom),
      season_start:              seasonStart.trim() || null,
      season_end:                seasonEnd.trim()   || null,
      status,
      difficulty:                difficulty  || null,
      physical_effort:           effort      || null,
      non_angler_friendly:       nonAnglerFriendly,
      technique,
      target_species:            targetSpecies,
      environment,
      hero_image_url:            heroImageUrl.trim() || null,
      gallery_image_urls:        galleryImages.map(g => g.url),
      story_text:                storyText.trim()   || null,
      catches_text:              catchesText.trim() || null,
      rod_setup:                 rodSetup.trim()    || null,
      best_months:               bestMonths.trim()  || null,
      season_months:             seasonMonths,
      peak_months:               peakMonths,
      meeting_point_name:        meetingName.trim() || null,
      meeting_point_description: meetingDesc.trim() || null,
      includes:                  parseLines(includes),
      excludes:                  parseLines(excludes),
      meta_title:                metaTitle.trim()   || null,
      meta_description:          metaDesc.trim()    || null,
      og_image_url:              ogImage.trim()     || null,
      location_lat:              locationLat,
      location_lng:              locationLng,
    }

    startTransition(async () => {
      if (isEdit && experienceId) {
        const result = await updateExperiencePage(experienceId, payload)
        if (result.success) {
          router.push(`/admin/experiences/${experienceId}`)
          router.refresh()
        } else {
          setServerError(result.error)
        }
      } else {
        const result = await createExperiencePage(payload)
        if (result.success) {
          router.push(`/admin/experiences/${result.id}`)
        } else {
          setServerError(result.error)
        }
      }
    })
  }, [
    canSubmit, experienceName, slug, country, region, priceFrom, seasonStart, seasonEnd,
    status, difficulty, effort, nonAnglerFriendly, technique, targetSpecies, environment,
    heroImageUrl, galleryImages, storyText, catchesText, rodSetup, bestMonths,
    seasonMonths, peakMonths,
    meetingName, meetingDesc, includes, excludes, metaTitle, metaDesc, ogImage,
    locationLat, locationLng,
    prefill, router, isEdit, experienceId,
  ])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-[760px]">

      {/* ── 1. Identity ── */}
      <SectionLabel step={1} title="Identity" desc="Core details shown in listings and SEO" />

      <div className="space-y-3">
        <div>
          <label className={lbl}>Experience name <Req /></label>
          <input type="text" value={experienceName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="THE GAULA RUN"
            className={inp} style={{ ...iStyle, border: hasAttempted && !nameValid ? errB : iStyle.border }} />
          <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.35)' }}>
            All caps recommended — this is the editorial title shown on the page.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>URL slug <Req /></label>
            <input type="text" value={slug}
              onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true) }}
              placeholder="the-gaula-run"
              className={inp} style={{ ...iStyle, border: hasAttempted && !slugValid ? errB : iStyle.border }} />
            <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.35)' }}>
              /experiences/<strong>{slug || 'the-gaula-run'}</strong>
            </p>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inp} style={iStyle}>
              {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Country <Req /></label>
            <select value={country} onChange={e => setCountry(e.target.value)} className={inp}
              style={{ ...iStyle, border: hasAttempted && !countryValid ? errB : iStyle.border }}>
              <option value="">Select…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Region <Req /></label>
            <input type="text" value={region} onChange={e => setRegion(e.target.value)}
              placeholder="e.g. Trøndelag"
              className={inp} style={{ ...iStyle, border: hasAttempted && !regionValid ? errB : iStyle.border }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Price from <Req /></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body font-semibold"
                style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
              <input type="number" min="1" step="10" value={priceFrom}
                onChange={e => setPriceFrom(e.target.value)}
                placeholder="350"
                className={inp + ' pl-7'} style={{ ...iStyle, border: hasAttempted && !priceValid ? errB : iStyle.border }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Season start</label>
            <input type="text" value={seasonStart} onChange={e => setSeasonStart(e.target.value)}
              placeholder="June" className={inp} style={iStyle} />
          </div>
          <div>
            <label className={lbl}>Season end</label>
            <input type="text" value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)}
              placeholder="August" className={inp} style={iStyle} />
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Map Pin Location ── */}
      <SectionLabel
        step={2}
        title="Map Pin Location"
        desc="Place a pin so the experience appears on the /trips map. Click the map or drag the pin to adjust."
      />

      <LatLngPicker
        lat={locationLat}
        lng={locationLng}
        onChange={handleLocationChange}
      />

      <Divider />

      {/* ── 3. Quick Fit Matrix ── */}
      <SectionLabel step={3} title="Quick Fit Matrix" desc="Helps anglers quickly assess if this trip suits them" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map(d => (
                <Chip key={d} label={d} active={difficulty === d} onClick={() => setDifficulty(difficulty === d ? '' : d)} />
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Physical effort</label>
            <div className="flex flex-wrap gap-2">
              {EFFORTS.map(e => (
                <Chip key={e} label={e} active={effort === e} onClick={() => setEffort(effort === e ? '' : e)} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={lbl}>Target species</label>
          <div className="flex flex-wrap gap-2">
            {FISH_ALL.map(f => (
              <Chip key={f} label={f} active={targetSpecies.includes(f)}
                onClick={() => setTargetSpecies(toggleItem(targetSpecies, f))} />
            ))}
          </div>
        </div>

        <div>
          <label className={lbl}>Technique</label>
          <div className="flex flex-wrap gap-2">
            {TECHNIQUES.map(t => (
              <Chip key={t} label={t} active={technique.includes(t)}
                onClick={() => setTechnique(toggleItem(technique, t))} />
            ))}
          </div>
        </div>

        <div>
          <label className={lbl}>Environment</label>
          <div className="flex flex-wrap gap-2">
            {ENVIRONMENTS.map(env => (
              <Chip key={env} label={env} active={environment.includes(env)}
                onClick={() => setEnvironment(toggleItem(environment, env))} />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: nonAnglerFriendly ? '#E67E50' : 'rgba(10,46,77,0.1)' }}
            onClick={() => setNonAnglerFriendly(v => !v)}>
            {nonAnglerFriendly && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
          </div>
          <span className="text-sm f-body font-semibold" style={{ color: nonAnglerFriendly ? '#E67E50' : 'rgba(10,46,77,0.55)' }}>
            Non-angler friendly — suitable for partners/family who don&apos;t fish
          </span>
        </label>
      </div>

      <Divider />

      {/* ── 3. Story & Content ── */}
      <SectionLabel step={3} title="Story & Content" desc="Editorial copy — this is what sells the trip" />

      <div className="space-y-3">
        <ImageUpload
          label="Hero image"
          variant="cover"
          aspect="wide"
          cropAspect={16 / 9}
          currentUrl={heroImageUrl || null}
          onUpload={(url) => setHeroImageUrl(url)}
          pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
          guideId={prefill?.guide_id ?? undefined}
          hint="16:9 landscape — this is the full-bleed hero shown at the top of the experience page."
        />

        <div>
          <label className={lbl}>Story text</label>
          <textarea value={storyText} onChange={e => setStoryText(e.target.value)}
            placeholder="The Gaula flows from the mountains of Røros through the valleys of Trøndelag before meeting the sea at Trondheim fjord. For Atlantic salmon, it is one of Europe's premier destinations…"
            rows={6} maxLength={5000}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
          <p className="text-[10px] f-body mt-0.5 text-right" style={{ color: 'rgba(10,46,77,0.3)' }}>
            {storyText.length} / 5000
          </p>
        </div>

        <div>
          <label className={lbl}>What to expect — catches & experience</label>
          <textarea value={catchesText} onChange={e => setCatchesText(e.target.value)}
            placeholder="Gaula salmon run from June through August, peaking in mid-July. Expect fish between 4–15 kg with occasional monsters over 20 kg…"
            rows={4} maxLength={2000}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>

        <div>
          <label className={lbl}>Rod setup & recommended gear</label>
          <textarea value={rodSetup} onChange={e => setRodSetup(e.target.value)}
            placeholder="Double-handed 14–15 ft rods rated for AFTM 9/10. Floating and intermediate lines. Flies: Sunray Shadow, Cascade, and traditional Gaula patterns…"
            rows={3} maxLength={1000}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>

        <div>
          <label className={lbl}>Season description <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(free text caption)</span></label>
          <input type="text" value={bestMonths} onChange={e => setBestMonths(e.target.value)}
            placeholder="June–August, with peak salmon runs in mid-July"
            className={inp} style={iStyle} />
          <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.3)' }}>
            Short free-text description — shown below the visual season calendar.
          </p>
        </div>
      </div>

      <Divider />

      {/* ── 4. Gallery ── */}
      <SectionLabel
        step={4}
        title="Gallery"
        desc={guidePhotos.length > 0
          ? `Pick from the guide's ${guidePhotos.length} existing photos or upload new ones`
          : 'Upload photos for this experience page'}
      />
      <MultiImageUpload
        label="Gallery images"
        initial={galleryImages}
        max={12}
        onChange={setGalleryImages}
        pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
        guideId={prefill?.guide_id ?? undefined}
      />

      <Divider />

      {/* ── 5. Season Calendar ── */}
      <SectionLabel
        step={5}
        title="Season Calendar"
        desc="Visual month-by-month availability shown on the public page. Orange = peak, cream = open season."
      />
      <MonthPicker
        seasonMonths={seasonMonths}
        peakMonths={peakMonths}
        onSeasonChange={setSeasonMonths}
        onPeakChange={setPeakMonths}
      />

      <Divider />

      {/* ── 6. Meeting Point ── */}
      <SectionLabel step={6} title="Meeting Point" />
      <div className="space-y-3">
        <div>
          <label className={lbl}>Meeting point name</label>
          <input type="text" value={meetingName} onChange={e => setMeetingName(e.target.value)}
            placeholder="Gaula Parking Lot, Støren"
            className={inp} style={iStyle} />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea value={meetingDesc} onChange={e => setMeetingDesc(e.target.value)}
            placeholder="Park at the riverside car park on Fv6810, 500m south of Støren bridge. GPS coordinates: 63.017°N, 10.293°E…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>
      </div>

      <Divider />

      {/* ── 7. Includes / Excludes ── */}
      <SectionLabel step={7} title="What's Included / Excluded" desc="One item per line" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Included</label>
          <textarea value={includes} onChange={e => setIncludes(e.target.value)}
            placeholder={"Guide service\nBeat access permit\nFishing equipment\nWaders and wading boots"}
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>
        <div>
          <label className={lbl}>Excluded</label>
          <textarea value={excludes} onChange={e => setExcludes(e.target.value)}
            placeholder={"Travel to Norway\nAccommodation\nMeals\nFishing licence (Norway national card)"}
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>
      </div>

      <Divider />

      {/* ── 8. SEO ── */}
      <SectionLabel step={8} title="SEO" desc="Optional — if left blank, we auto-generate from the content above" />
      <div className="space-y-3">
        <div>
          <label className={lbl}>Meta title</label>
          <input type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
            placeholder="Salmon Fly Fishing on River Gaula, Norway | FjordAnglers"
            className={inp} style={iStyle} />
        </div>
        <div>
          <label className={lbl}>Meta description</label>
          <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)}
            placeholder="Fish for Atlantic salmon on Norway's famous River Gaula with an expert local guide. From €350/day. Peak season June–August."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>
        <div>
          <label className={lbl}>OG image URL <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(if different from hero)</span></label>
          <input type="url" value={ogImage} onChange={e => setOgImage(e.target.value)}
            placeholder="https://cdn.fjordanglers.com/og-gaula.jpg"
            className={inp} style={iStyle} />
        </div>
      </div>

      {/* ── Error ── */}
      {serverError != null && (
        <div className="mt-6 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm f-body" style={{ color: '#DC2626' }}>{serverError}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="mt-8 flex items-center gap-4">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold f-body transition-all"
          style={{
            background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
            color:      '#fff',
            cursor:     isPending ? 'not-allowed' : 'pointer',
            boxShadow:  isPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
          }}>
          {isPending
            ? <><Loader2 size={14} className="animate-spin" /> {isEdit ? 'Saving…' : 'Creating…'}</>
            : isEdit
              ? <>Save changes <ChevronRight size={14} /></>
              : <>Create experience page <ChevronRight size={14} /></>}
        </button>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {isEdit
            ? 'Updates the live page immediately if status is Active.'
            : status === 'draft'
              ? 'Saves as draft — not publicly visible yet.'
              : 'Will be live at /experiences/' + (slug || '…')}
        </p>
      </div>

    </form>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  background: 'rgba(10,46,77,0.04)',
  border:     '1.5px solid rgba(10,46,77,0.1)',
  color:      '#0A2E4D',
}
const inp  = 'w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all'
const lbl  = 'text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-[rgba(10,46,77,0.45)]'
const errB = '1.5px solid rgba(239,68,68,0.5)'
function Req() { return <span style={{ color: '#E67E50' }}>*</span> }
