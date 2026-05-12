'use client'

/**
 * ExperiencePageForm — admin form for creating/editing experience_pages.
 *
 * FA fills this after reviewing a guide submission. Sections:
 *  1. Identity      — name, slug, country, region, price, season, status
 *  2. Map pin       — lat/lng picker
 *  3. Quick fit     — difficulty, effort, technique[], species[], environment[]
 *  4. Content       — intro text, hero image, story text, catches text, rod setup
 *  5. Gallery       — gallery image URLs
 *  6. Season        — visual month picker (open + peak)
 *  7. Species details — per-fish: description, photo, season
 *  8. Boat          — boat description + photo
 *  9. Special attr  — special attraction text + photo
 * 10. Location      — meeting point name + description
 * 11. What's inc    — includes[], excludes[]
 * 12. SEO           — meta_title, meta_description, og_image_url
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { FISH_ALL } from '@/lib/fish'
import { COUNTRIES } from '@/lib/countries'
import {
  createExperiencePage,
  updateExperiencePage,
  createExperiencePageOption,
  updateExperiencePageOption,
  deleteExperiencePageOption,
  type ExperiencePagePayload,
  type SpeciesDetailItem,
  type SpecialAttraction,
  type ContentBlock,
  type FaqItem,
  type ExperiencePageOptionPayload,
} from '@/actions/experience-pages'
import ImageUpload from '@/components/admin/image-upload'
import MultiImageUpload, { type GalleryImage } from '@/components/admin/multi-image-upload'
import LatLngPicker from '@/components/admin/LatLngPicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES    = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
const EFFORTS         = ['Low', 'Medium', 'High']
const ENVIRONMENTS    = ['River', 'Lake', 'Sea', 'Fjord', 'Estuary', 'Coast']
const TECHNIQUES      = [
  'Fly fishing', 'Spinning', 'Trolling', 'Jigging', 'Ice fishing',
  'Baitcasting', 'Shore fishing', 'Sea fishing', 'Vertical fishing',
]
const MONTHS          = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS_OPTIONS  = [
  { v: 'draft',    l: 'Draft'    },
  { v: 'active',   l: 'Active'   },
  { v: 'archived', l: 'Archived' },
]

// ─── Internal type ─────────────────────────────────────────────────────────────

interface SpeciesDetailRecord {
  description:   string
  image_url:     string
  season_months: number[]
  peak_months:   number[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function parseLines(s: string): string[] {
  return s.split('\n').map(l => l.trim()).filter(Boolean)
}

function parseJsonField<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T[] } catch { return [] }
  }
  return []
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
    if (!next.includes(m)) {
      onPeakChange(peakMonths.filter(pm => pm !== m))
    }
  }
  const togglePeak = (m: number) => {
    if (!seasonMonths.includes(m)) return
    onPeakChange(toggleItem(peakMonths, m))
  }

  return (
    <div className="space-y-4">
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

// ─── Species detail accordion item ────────────────────────────────────────────

function SpeciesDetailEditor({
  name,
  detail,
  onChange,
  guidePhotos,
  guideId,
}: {
  name:        string
  detail:      SpeciesDetailRecord
  onChange:    (d: SpeciesDetailRecord) => void
  guidePhotos: string[]
  guideId?:    string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}>

      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ background: open ? 'rgba(230,126,80,0.06)' : 'rgba(10,46,77,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: detail.description || detail.image_url || detail.season_months.length > 0 ? '#E67E50' : 'rgba(10,46,77,0.2)' }} />
          <span className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>{name}</span>
          {detail.season_months.length > 0 && (
            <span className="text-[10px] f-body px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>
              {detail.season_months.length} season months
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} style={{ color: 'rgba(10,46,77,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(10,46,77,0.4)' }} />}
      </button>

      {/* Content */}
      {open && (
        <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
          <div>
            <label className={lbl}>Description</label>
            <textarea
              value={detail.description}
              onChange={e => onChange({ ...detail, description: e.target.value })}
              placeholder={`Tell anglers about ${name} — size, fight, where they're found, what makes them special…`}
              rows={3} maxLength={600}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={iStyle}
            />
          </div>

          <ImageUpload
            label="Photo"
            variant="cover"
            aspect="wide"
            cropAspect={4 / 3}
            currentUrl={detail.image_url || null}
            onUpload={(url) => onChange({ ...detail, image_url: url })}
            pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
            guideId={guideId}
            hint="Landscape — shown alternating with description on the public page."
          />

          <div>
            <label className={lbl}>Season for this species</label>
            <MonthPicker
              seasonMonths={detail.season_months}
              peakMonths={detail.peak_months}
              onSeasonChange={sm => onChange({ ...detail, season_months: sm })}
              onPeakChange={pm => onChange({ ...detail, peak_months: pm })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OptionEditor sub-component ───────────────────────────────────────────────

function OptionEditor({
  option,
  index,
  isOpen,
  onToggle,
  speciesLibrary,
  guidePhotos,
  guideId,
  onSaved,
  onDeleted,
}: {
  option:        ExperiencePageOptionRow
  index:         number
  isOpen:        boolean
  onToggle:      () => void
  speciesLibrary: string[]   // page-level target_species names
  guidePhotos:   string[]
  guideId?:      string
  onSaved:       (updated: ExperiencePageOptionRow) => void
  onDeleted:     (id: string) => void
}) {
  const [label,       setLabel]       = useState(option.label)
  const [price,       setPrice]       = useState(String(option.price_from))
  const [catches,     setCatches]     = useState(option.catches_text ?? '')
  const [species,     setSpecies]     = useState<string[]>(option.target_species ?? [])
  const [boatDesc,    setBoatDesc]    = useState(option.boat_description ?? '')
  const [boatImg,     setBoatImg]     = useState(option.boat_image_url ?? '')
  const [attractions, setAttractions] = useState<SpecialAttraction[]>(
    (option.special_attractions as SpecialAttraction[] | null) ?? []
  )
  const [meetName,    setMeetName]    = useState(option.meeting_point_name ?? '')
  const [meetDesc,    setMeetDesc]    = useState(option.meeting_point_description ?? '')
  const [lat,         setLat]         = useState<number | null>(option.location_lat ?? null)
  const [lng,         setLng]         = useState<number | null>(option.location_lng ?? null)
  const [bring,       setBring]       = useState((option.what_to_bring ?? []).join('\n'))
  const [incl,        setIncl]        = useState((option.includes ?? []).join('\n'))
  const [excl,        setExcl]        = useState((option.excludes ?? []).join('\n'))
  const [blocks,      setBlocks]      = useState<ContentBlock[]>(() => parseJsonField<ContentBlock>(option.content_blocks))
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: Partial<ExperiencePageOptionPayload> = {
        label:                     label.trim() || `Option ${index + 1}`,
        price_from:                parseFloat(price) || 0,
        catches_text:              catches.trim() || null,
        target_species:            species,
        boat_description:          boatDesc.trim() || null,
        boat_image_url:            boatImg.trim() || null,
        special_attractions:       attractions.filter(a => a.text.trim()),
        meeting_point_name:        meetName.trim() || null,
        meeting_point_description: meetDesc.trim() || null,
        location_lat:              lat,
        location_lng:              lng,
        what_to_bring:             parseLines(bring),
        includes:                  parseLines(incl),
        excludes:                  parseLines(excl),
        content_blocks:            blocks.filter(b => b.headline.trim() || b.text.trim()),
      }
      const result = await updateExperiencePageOption(option.id, payload)
      if (result.success) {
        onSaved({
          ...option,
          label:                     payload.label!,
          price_from:                payload.price_from!,
          catches_text:              payload.catches_text ?? null,
          target_species:            payload.target_species ?? [],
          boat_description:          payload.boat_description ?? null,
          boat_image_url:            payload.boat_image_url ?? null,
          special_attractions:       payload.special_attractions ?? [],
          meeting_point_name:        payload.meeting_point_name ?? null,
          meeting_point_description: payload.meeting_point_description ?? null,
          location_lat:              payload.location_lat ?? null,
          location_lng:              payload.location_lng ?? null,
          what_to_bring:             payload.what_to_bring ?? [],
          includes:                  payload.includes ?? [],
          excludes:                  payload.excludes ?? [],
          content_blocks:            payload.content_blocks ?? [],
          updated_at:                new Date().toISOString(),
        })
      } else {
        setSaveError(result.error)
      }
    } catch {
      setSaveError('Unexpected error — try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${label || `Option ${index + 1}`}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const result = await deleteExperiencePageOption(option.id)
      if (result.success) {
        onDeleted(option.id)
      } else {
        alert(result.error)
      }
    } catch {
      alert('Failed to delete option.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      border: isOpen ? '1.5px solid rgba(230,126,80,0.35)' : '1.5px solid rgba(10,46,77,0.1)',
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ background: isOpen ? 'rgba(230,126,80,0.04)' : 'rgba(10,46,77,0.02)' }}
      >
        <div className="flex items-center gap-3">
          {isOpen
            ? <ChevronUp size={14} style={{ color: '#E67E50' }} />
            : <ChevronDown size={14} style={{ color: 'rgba(10,46,77,0.4)' }} />}
          <div>
            <span className="text-sm font-bold f-body" style={{ color: isOpen ? '#E67E50' : '#0A2E4D' }}>
              {label || `Option ${index + 1}`}
            </span>
            {!isOpen && (
              <span className="text-xs f-body ml-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
                from €{option.price_from}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleDelete() }}
          disabled={deleting}
          className="text-xs font-semibold f-body px-2.5 py-1 rounded-lg ml-4 flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>

          {/* Label + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Option label <Req /></label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="Full Day Trip"
                className={inp} style={iStyle} />
            </div>
            <div>
              <label className={lbl}>Price from (€) <Req /></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body font-semibold"
                  style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
                <input type="number" min="0" step="10" value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="350"
                  className={inp + ' pl-7'} style={iStyle} />
              </div>
            </div>
          </div>

          {/* Catches intro */}
          <div>
            <label className={lbl}>What you can catch — intro paragraph</label>
            <textarea value={catches} onChange={e => setCatches(e.target.value)}
              placeholder="Describe what anglers can expect to catch on this option…"
              rows={3} maxLength={2000}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={iStyle} />
          </div>

          {/* Target species — checkboxes from page-level species library */}
          <div>
            <label className={lbl}>Target species for this option</label>
            {speciesLibrary.length === 0 ? (
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Add target species in the Quick Fit section first, then assign them per option here.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {speciesLibrary.map(name => {
                  const checked = species.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSpecies(prev => toggleItem(prev, name))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
                      style={{
                        background: checked ? '#E67E50' : 'rgba(10,46,77,0.06)',
                        color:      checked ? '#fff'    : 'rgba(10,46,77,0.6)',
                        border:     checked ? '1.5px solid transparent' : '1.5px solid rgba(10,46,77,0.1)',
                      }}
                    >
                      {checked && <Check size={10} strokeWidth={3} />}
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Boat */}
          <div className="space-y-3">
            <label className={lbl}>Boat (optional)</label>
            <textarea value={boatDesc} onChange={e => setBoatDesc(e.target.value)}
              placeholder="Describe the boat used for this option…"
              rows={3} maxLength={800}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={iStyle} />
            <ImageUpload
              label="Boat photo"
              variant="cover"
              aspect="wide"
              cropAspect={4 / 3}
              currentUrl={boatImg || null}
              onUpload={url => setBoatImg(url)}
              pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
              guideId={guideId}
              hint="Landscape — shown next to the boat description."
            />
          </div>

          {/* Special attractions */}
          <div className="space-y-3">
            <label className={lbl}>Special attractions</label>
            {attractions.map((attr, i) => (
              <div key={i} className="space-y-2 p-3 rounded-xl"
                style={{ border: '1px solid rgba(10,46,77,0.1)', background: 'rgba(10,46,77,0.02)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body"
                    style={{ color: 'rgba(10,46,77,0.4)' }}>Attraction {i + 1}</span>
                  <button type="button"
                    onClick={() => setAttractions(prev => prev.filter((_, j) => j !== i))}
                    className="text-xs font-semibold f-body px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                    Remove
                  </button>
                </div>
                <ImageUpload
                  label="Photo"
                  variant="cover"
                  aspect="wide"
                  cropAspect={4 / 3}
                  currentUrl={attr.image_url || null}
                  onUpload={url => setAttractions(prev => prev.map((a, j) => j === i ? { ...a, image_url: url } : a))}
                  pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
                  guideId={guideId}
                  hint="Shown to the left of the text."
                />
                <textarea
                  value={attr.text}
                  onChange={e => setAttractions(prev => prev.map((a, j) => j === i ? { ...a, text: e.target.value } : a))}
                  placeholder="Describe this attraction…"
                  rows={3} maxLength={800}
                  className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                  style={iStyle} />
              </div>
            ))}
            <button type="button"
              onClick={() => setAttractions(prev => [...prev, { text: '', image_url: '' }])}
              className="text-xs font-semibold f-body px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
              + Add attraction
            </button>
          </div>

          {/* Meeting point */}
          <div className="space-y-2">
            <label className={lbl}>Meeting point</label>
            <input type="text" value={meetName} onChange={e => setMeetName(e.target.value)}
              placeholder="Harbour car park, Bodø"
              className={inp} style={iStyle} />
            <textarea value={meetDesc} onChange={e => setMeetDesc(e.target.value)}
              placeholder="Directions to the meeting point…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={iStyle} />
          </div>

          {/* Location map pin */}
          <div>
            <label className={lbl}>Location pin (optional — overrides page-level pin for this option)</label>
            <LatLngPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />
          </div>

          {/* What to bring */}
          <div>
            <label className={lbl}>What to bring <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(one item per line)</span></label>
            <textarea value={bring} onChange={e => setBring(e.target.value)}
              placeholder={"Waders and wading boots\nRod and reel\nPolarised sunglasses"}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={iStyle} />
          </div>

          {/* Includes / Excludes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Included</label>
              <textarea value={incl} onChange={e => setIncl(e.target.value)}
                placeholder={"Guide service\nBeat access permit"}
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                style={iStyle} />
            </div>
            <div>
              <label className={lbl}>Excluded</label>
              <textarea value={excl} onChange={e => setExcl(e.target.value)}
                placeholder={"Travel\nAccommodation\nMeals"}
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                style={iStyle} />
            </div>
          </div>

          {/* Content blocks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={lbl}>Content blocks <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(headline + text pairs)</span></label>
              <button
                type="button"
                onClick={() => setBlocks(prev => [...prev, { headline: '', text: '' }])}
                className="text-xs font-semibold f-body px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                + Add block
              </button>
            </div>
            {blocks.map((block, bi) => (
              <div key={bi} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={block.headline}
                    onChange={e => setBlocks(prev => prev.map((b, i) => i === bi ? { ...b, headline: e.target.value } : b))}
                    placeholder="Section headline…"
                    className={inp} style={{ ...iStyle, flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setBlocks(prev => prev.filter((_, i) => i !== bi))}
                    className="text-xs font-semibold f-body px-2.5 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                    Remove
                  </button>
                </div>
                <textarea
                  value={block.text}
                  onChange={e => setBlocks(prev => prev.map((b, i) => i === bi ? { ...b, text: e.target.value } : b))}
                  placeholder="Block text…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                  style={iStyle} />
              </div>
            ))}
            {blocks.length === 0 && (
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No content blocks. Click &quot;+ Add block&quot; to add one.</p>
            )}
          </div>

          {/* Save */}
          {saveError && (
            <p className="text-xs f-body px-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
            style={{
              background: saving ? 'rgba(230,126,80,0.6)' : '#E67E50',
              color:      '#fff',
              cursor:     saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save option'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExperiencePageFormInitialData {
  experience_name:              string
  slug:                         string
  country:                      string
  region:                       string
  price_from:                   number
  season_start:                 string | null
  season_end:                   string | null
  status:                       'draft' | 'active' | 'archived'
  difficulty:                   string | null
  physical_effort:              string | null
  non_angler_friendly:          boolean
  technique:                    string[]
  target_species:               string[]
  environment:                  string[]
  intro_text:                   string | null
  hero_image_url:               string | null
  gallery_image_urls:           string[]
  story_text:                   string | null
  catches_text:                 string | null
  rod_setup:                    string | null
  best_months:                  string | null
  season_months:                number[]
  peak_months:                  number[]
  species_details:              SpeciesDetailItem[]
  boat_description:             string | null
  boat_image_url:               string | null
  special_attractions:          SpecialAttraction[]
  what_to_bring:                string[]
  meeting_point_name:           string | null
  meeting_point_description:    string | null
  includes:                     string[]
  excludes:                     string[]
  faq:                          unknown   // FaqItem[] stored as JSONB
  meta_title:                   string | null
  meta_description:             string | null
  og_image_url:                 string | null
  location_lat:                 number | null
  location_lng:                 number | null
}

// Row shape returned from DB — mirrors experience_page_options table
export interface ExperiencePageOptionRow {
  id:                        string
  experience_page_id:        string
  sort_order:                number
  label:                     string
  price_from:                number
  description:               string | null
  catches_text:              string | null
  target_species:            string[]
  boat_description:          string | null
  boat_image_url:            string | null
  special_attractions:       unknown   // SpecialAttraction[] stored as JSONB
  meeting_point_name:        string | null
  meeting_point_description: string | null
  location_lat:              number | null
  location_lng:              number | null
  what_to_bring:             string[]
  includes:                  string[]
  excludes:                  string[]
  content_blocks:            unknown   // ContentBlock[] stored as JSONB
  created_at:                string
  updated_at:                string
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
  /** Trip options fetched from experience_page_options table */
  initialOptions?: ExperiencePageOptionRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExperiencePageForm({
  mode = 'create',
  experienceId,
  prefill,
  initialData,
  guidePhotos = [],
  initialOptions = [],
}: ExperiencePageFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  // ── Trip Options (Section 13) ─────────────────────────────────────────────
  const [tripOptions, setTripOptions] = useState<ExperiencePageOptionRow[]>(initialOptions)
  const [optionCreating, setOptionCreating] = useState(false)
  const [optionOpenIdx, setOptionOpenIdx] = useState<number | null>(null)

  // ── Section 1: Identity
  const [experienceName, setExperienceName] = useState(initialData?.experience_name ?? '')
  const [slug,           setSlug]           = useState(initialData?.slug ?? '')
  const [slugEdited,     setSlugEdited]     = useState(isEdit)
  const [country,        setCountry]        = useState(initialData?.country ?? prefill?.country ?? '')
  const [region,         setRegion]         = useState(initialData?.region ?? prefill?.region ?? prefill?.location_name ?? '')
  const [priceFrom,      setPriceFrom]      = useState(initialData?.price_from?.toString() ?? prefill?.price_approx?.toString() ?? '')
  const [seasonStart,    setSeasonStart]    = useState(initialData?.season_start ?? '')
  const [seasonEnd,      setSeasonEnd]      = useState(initialData?.season_end ?? '')
  const [status,         setStatus]         = useState<'draft' | 'active' | 'archived'>(initialData?.status ?? 'draft')

  // ── Section 3: Quick fit
  const [difficulty,        setDifficulty]        = useState(initialData?.difficulty ?? '')
  const [effort,            setEffort]            = useState(initialData?.physical_effort ?? '')
  const [nonAnglerFriendly, setNonAnglerFriendly] = useState(initialData?.non_angler_friendly ?? false)
  const [technique,         setTechnique]         = useState<string[]>(initialData?.technique ?? prefill?.technique ?? [])
  const [targetSpecies,     setTargetSpecies]     = useState<string[]>(initialData?.target_species ?? prefill?.species ?? [])
  const [environment,       setEnvironment]       = useState<string[]>(initialData?.environment ?? [])

  // ── Section 4: Content
  const [introText,    setIntroText]    = useState(initialData?.intro_text ?? '')
  const [heroImageUrl, setHeroImageUrl] = useState(initialData?.hero_image_url ?? '')
  const [storyText,    setStoryText]    = useState(initialData?.story_text ?? '')
  const [catchesText,  setCatchesText]  = useState(initialData?.catches_text ?? '')
  const [rodSetup,     setRodSetup]     = useState(initialData?.rod_setup ?? '')
  const [bestMonths,   setBestMonths]   = useState(() => {
    if (initialData?.best_months) return initialData.best_months
    if (!prefill?.season_months?.length) return ''
    return prefill.season_months.map(m => MONTHS[m - 1] ?? '').filter(Boolean).join(', ')
  })

  // ── Section 5: Gallery
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    () => (initialData?.gallery_image_urls ?? []).map((url, i) => ({ id: String(i), url, is_cover: i === 0, sort_order: i }))
  )

  // ── Section 6: Season months
  const [seasonMonths, setSeasonMonths] = useState<number[]>(
    initialData?.season_months ?? prefill?.season_months ?? []
  )
  const [peakMonths, setPeakMonths] = useState<number[]>(initialData?.peak_months ?? [])

  // ── Section 7: Species details (per-fish)
  const [speciesDetails, setSpeciesDetails] = useState<Record<string, SpeciesDetailRecord>>(() => {
    const rec: Record<string, SpeciesDetailRecord> = {}
    for (const item of (initialData?.species_details ?? [])) {
      rec[item.name] = {
        description:   item.description,
        image_url:     item.image_url,
        season_months: item.season_months,
        peak_months:   item.peak_months,
      }
    }
    return rec
  })

  const updateSpeciesDetail = useCallback((name: string, detail: SpeciesDetailRecord) => {
    setSpeciesDetails(prev => ({ ...prev, [name]: detail }))
  }, [])

  // ── Section 8: Boat
  const [boatDescription, setBoatDescription] = useState(initialData?.boat_description ?? '')
  const [boatImageUrl,    setBoatImageUrl]    = useState(initialData?.boat_image_url ?? '')

  // ── Section 9: Special attractions (multi-item)
  const [specialAttractions, setSpecialAttractions] = useState<SpecialAttraction[]>(
    initialData?.special_attractions ?? []
  )

  // ── Section 10: Meeting point
  const [meetingName, setMeetingName] = useState(initialData?.meeting_point_name ?? '')
  const [meetingDesc, setMeetingDesc] = useState(initialData?.meeting_point_description ?? '')

  // ── Section 11: What to bring
  const [whatToBring, setWhatToBring] = useState(initialData?.what_to_bring?.join('\n') ?? '')

  // ── Section 12: Includes/Excludes
  const [includes, setIncludes] = useState(initialData?.includes?.join('\n') ?? 'Guide service')
  const [excludes, setExcludes] = useState(initialData?.excludes?.join('\n') ?? '')

  // ── Section 12b: FAQ (global)
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() => parseJsonField<FaqItem>(initialData?.faq))

  // ── Section 12: SEO
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
  const [isPending,    setIsPending]    = useState(false)
  const [serverError,  setServerError]   = useState<string | null>(null)
  const [hasAttempted, setHasAttempted]  = useState(false)

  // Validation
  const nameValid    = experienceName.trim() !== ''
  const slugValid    = slug.trim() !== ''
  const countryValid = country !== ''
  const regionValid  = region.trim() !== ''
  const priceValid   = priceFrom !== '' && parseFloat(priceFrom) > 0
  const canSubmit    = nameValid && slugValid && countryValid && regionValid && priceValid

  const handleNameChange = useCallback((val: string) => {
    setExperienceName(val)
    if (!slugEdited) setSlug(slugify(val))
  }, [slugEdited])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttempted(true)
    if (!canSubmit) return

    setServerError(null)

    // Build species_details array from current targetSpecies + detail records
    const speciesDetailItems: SpeciesDetailItem[] = targetSpecies.map(name => ({
      name,
      description:   speciesDetails[name]?.description   ?? '',
      image_url:     speciesDetails[name]?.image_url     ?? '',
      season_months: speciesDetails[name]?.season_months ?? [],
      peak_months:   speciesDetails[name]?.peak_months   ?? [],
    }))

    const payload: ExperiencePagePayload = {
      guide_id:                         prefill?.guide_id ?? null,
      experience_name:                  experienceName.trim(),
      slug:                             slug.trim(),
      country,
      region:                           region.trim(),
      price_from:                       parseFloat(priceFrom),
      season_start:                     seasonStart.trim() || null,
      season_end:                       seasonEnd.trim()   || null,
      status,
      difficulty:                       difficulty  || null,
      physical_effort:                  effort      || null,
      non_angler_friendly:              nonAnglerFriendly,
      technique,
      target_species:                   targetSpecies,
      environment,
      intro_text:                       introText.trim()    || null,
      hero_image_url:                   heroImageUrl.trim() || null,
      gallery_image_urls:               galleryImages.map(g => g.url),
      story_text:                       storyText.trim()   || null,
      catches_text:                     catchesText.trim() || null,
      rod_setup:                        rodSetup.trim()    || null,
      best_months:                      bestMonths.trim()  || null,
      season_months:                    seasonMonths,
      peak_months:                      peakMonths,
      species_details:                  speciesDetailItems,
      boat_description:                 boatDescription.trim()             || null,
      boat_image_url:                   boatImageUrl.trim()                || null,
      special_attractions:              specialAttractions.filter(a => a.text.trim()),
      what_to_bring:                    parseLines(whatToBring),
      meeting_point_name:               meetingName.trim() || null,
      meeting_point_description:        meetingDesc.trim() || null,
      includes:                         parseLines(includes),
      excludes:                         parseLines(excludes),
      faq:                              faqItems.filter(f => f.question.trim() || f.answer.trim()),
      meta_title:                       metaTitle.trim()   || null,
      meta_description:                 metaDesc.trim()    || null,
      og_image_url:                     ogImage.trim()     || null,
      location_lat:                     locationLat,
      location_lng:                     locationLng,
    }

    setIsPending(true)
    try {
      if (isEdit && experienceId) {
        const result = await updateExperiencePage(experienceId, payload)
        if (result.success) {
          router.push(`/admin/experiences/${experienceId}`)
        } else {
          setServerError(result.error)
          setIsPending(false)
        }
      } else {
        const result = await createExperiencePage(payload)
        if (result.success) {
          router.push(`/admin/experiences/${result.id}`)
        } else {
          setServerError(result.error)
          setIsPending(false)
        }
      }
    } catch {
      setServerError('Unexpected error — please try again.')
      setIsPending(false)
    }
  }, [
    canSubmit, experienceName, slug, country, region, priceFrom, seasonStart, seasonEnd,
    status, difficulty, effort, nonAnglerFriendly, technique, targetSpecies, environment,
    introText, heroImageUrl, galleryImages, storyText, catchesText, rodSetup, bestMonths,
    seasonMonths, peakMonths, speciesDetails,
    boatDescription, boatImageUrl, specialAttractions, whatToBring,
    meetingName, meetingDesc, includes, excludes, metaTitle, metaDesc, ogImage,
    locationLat, locationLng,
    prefill, router, isEdit, experienceId,
  ])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={e => e.preventDefault()} noValidate className="max-w-[760px]">

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

      {/* ── 2. Map Pin Location ── */}
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

      {/* ── 4. Content ── */}
      <SectionLabel step={4} title="Content" desc="Editorial copy — this is what sells the trip" />

      <div className="space-y-3">
        <div>
          <label className={lbl}>Introduction <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(shown first, before Quick Fit)</span></label>
          <textarea value={introText} onChange={e => setIntroText(e.target.value)}
            placeholder="One powerful sentence that hooks the reader. E.g. 'Where the Gaula meets the sea — Norway's most iconic salmon river, with a local guide who has fished it for 20 years.'"
            rows={2} maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
          <p className="text-[10px] f-body mt-0.5 text-right" style={{ color: 'rgba(10,46,77,0.3)' }}>
            {introText.length} / 300
          </p>
        </div>

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
          <label className={lbl}>About this experience <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(main story)</span></label>
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
          <label className={lbl}>What you can catch — intro paragraph</label>
          <textarea value={catchesText} onChange={e => setCatchesText(e.target.value)}
            placeholder="Gaula salmon run from June through August, peaking in mid-July. Expect fish between 4–15 kg with occasional monsters over 20 kg…"
            rows={3} maxLength={2000}
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
        </div>
      </div>

      <Divider />

      {/* ── 5. Gallery ── */}
      <SectionLabel
        step={5}
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

      {/* ── 6. Season Calendar ── */}
      <SectionLabel
        step={6}
        title="Season Calendar"
        desc="Overall season for the experience. Orange = peak, cream = open season."
      />
      <MonthPicker
        seasonMonths={seasonMonths}
        peakMonths={peakMonths}
        onSeasonChange={setSeasonMonths}
        onPeakChange={setPeakMonths}
      />

      <Divider />

      {/* ── 7. Species Details ── */}
      <SectionLabel
        step={7}
        title="Species Details"
        desc="Per-fish description, photo and season — powers the alternating fish layout on the public page."
      />

      {targetSpecies.length === 0 ? (
        <p className="text-sm f-body py-4" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Select target species in the Quick Fit section first.
        </p>
      ) : (
        <div className="space-y-2">
          {targetSpecies.map(name => (
            <SpeciesDetailEditor
              key={name}
              name={name}
              detail={speciesDetails[name] ?? { description: '', image_url: '', season_months: [], peak_months: [] }}
              onChange={d => updateSpeciesDetail(name, d)}
              guidePhotos={guidePhotos}
              guideId={prefill?.guide_id}
            />
          ))}
          <p className="text-[10px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.35)' }}>
            Click each species to expand and fill details. Even partial data improves the page.
          </p>
        </div>
      )}

      <Divider />

      {/* ── 8. Boat ── */}
      <SectionLabel
        step={8}
        title="Boat"
        desc="Shown as two-column section: description left, photo right."
      />
      <div className="space-y-3">
        <div>
          <label className={lbl}>Boat description</label>
          <textarea value={boatDescription} onChange={e => setBoatDescription(e.target.value)}
            placeholder="Our 24-foot aluminium RIB handles anything the North Sea throws at it. Equipped with radar, VHF, safety equipment and a live bait tank…"
            rows={4} maxLength={800}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
            style={iStyle} />
        </div>
        <ImageUpload
          label="Boat photo"
          variant="cover"
          aspect="wide"
          cropAspect={4 / 3}
          currentUrl={boatImageUrl || null}
          onUpload={(url) => setBoatImageUrl(url)}
          pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
          guideId={prefill?.guide_id ?? undefined}
          hint="Landscape — shown to the right of the boat description."
        />
      </div>

      <Divider />

      {/* ── 9. Special Attractions ── */}
      <SectionLabel
        step={9}
        title="Special Attractions"
        desc="Each attraction is shown as a two-column block: photo left, text right. Add as many as you like."
      />
      <div className="space-y-4">
        {specialAttractions.map((attr, idx) => (
          <div key={idx} className="space-y-3 p-4 rounded-2xl" style={{ border: '1px solid rgba(10,46,77,0.1)', background: 'rgba(10,46,77,0.02)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                Attraction {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => setSpecialAttractions(prev => prev.filter((_, i) => i !== idx))}
                className="text-xs font-semibold f-body px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
              >
                Remove
              </button>
            </div>
            <ImageUpload
              label="Photo"
              variant="cover"
              aspect="wide"
              cropAspect={4 / 3}
              currentUrl={attr.image_url || null}
              onUpload={(url) => setSpecialAttractions(prev => prev.map((a, i) => i === idx ? { ...a, image_url: url } : a))}
              pickFrom={guidePhotos.length > 0 ? guidePhotos : undefined}
              guideId={prefill?.guide_id ?? undefined}
              hint="Landscape — shown to the left of the text."
            />
            <div>
              <label className={lbl}>Text</label>
              <textarea
                value={attr.text}
                onChange={e => setSpecialAttractions(prev => prev.map((a, i) => i === idx ? { ...a, text: e.target.value } : a))}
                placeholder="Fish under the midnight sun from late June to mid-July…"
                rows={4} maxLength={800}
                className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
                style={iStyle}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSpecialAttractions(prev => [...prev, { text: '', image_url: '' }])}
          className="text-sm font-semibold f-body px-4 py-2 rounded-xl transition-colors"
          style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
        >
          + Add attraction
        </button>
      </div>

      <Divider />

      {/* ── 10. Location ── */}
      <SectionLabel step={10} title="Location" desc="Meeting point and directions for the angler" />
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

      {/* ── 11. What to Bring ── */}
      <SectionLabel step={11} title="What to Bring" desc="One item per line — gear and items anglers should bring" />
      <textarea
        value={whatToBring}
        onChange={e => setWhatToBring(e.target.value)}
        placeholder={"Waders and wading boots\nRod and reel\nPolarised sunglasses\nWaterproof jacket\nSunscreen"}
        rows={5}
        className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
        style={iStyle}
      />

      <Divider />

      {/* ── 12. Includes / Excludes ── */}
      <SectionLabel step={12} title="What's Included / Excluded" desc="One item per line" />
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

      {/* ── 12. SEO ── */}
      <SectionLabel step={12} title="SEO" desc="Optional — if left blank, we auto-generate from the content above" />
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

      <Divider />

      {/* ── 13. FAQ ── */}
      <SectionLabel step={13} title="FAQ" desc="Frequently asked questions — shown on the experience page" />
      <div className="space-y-3">
        {faqItems.map((item, fi) => (
          <div key={fi} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={item.question}
                onChange={e => setFaqItems(prev => prev.map((f, i) => i === fi ? { ...f, question: e.target.value } : f))}
                placeholder="Question…"
                className="flex-1 px-3 py-2 rounded-xl text-sm f-body outline-none transition-all"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1.5px solid rgba(10,46,77,0.1)', color: '#0A2E4D' }} />
              <button
                type="button"
                onClick={() => setFaqItems(prev => prev.filter((_, i) => i !== fi))}
                className="text-xs font-semibold f-body px-2.5 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                Remove
              </button>
            </div>
            <textarea
              value={item.answer}
              onChange={e => setFaqItems(prev => prev.map((f, i) => i === fi ? { ...f, answer: e.target.value } : f))}
              placeholder="Answer…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1.5px solid rgba(10,46,77,0.1)', color: '#0A2E4D' }} />
          </div>
        ))}
        {faqItems.length === 0 && (
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No FAQ items yet. Click &quot;+ Add FAQ&quot; to add one.</p>
        )}
        <button
          type="button"
          onClick={() => setFaqItems(prev => [...prev, { question: '', answer: '' }])}
          className="text-sm font-semibold f-body px-4 py-2 rounded-xl transition-colors"
          style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
          + Add FAQ
        </button>
      </div>

      <Divider />

      {/* ── 14. Trip Options ── */}
      <SectionLabel
        step={14}
        title="Trip Options"
        desc="Add variants like Full Day / Half Day. Each option has its own price, catches, boat, location and inclusions. Species details come from the shared library above."
      />

      {!isEdit && (
        <p className="text-sm f-body py-2 mb-3" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Save the experience page first, then add trip options in edit mode.
        </p>
      )}

      {isEdit && experienceId && (
        <div className="space-y-3">
          {tripOptions.map((opt, idx) => (
            <OptionEditor
              key={opt.id}
              option={opt}
              index={idx}
              isOpen={optionOpenIdx === idx}
              onToggle={() => setOptionOpenIdx(prev => prev === idx ? null : idx)}
              speciesLibrary={targetSpecies}
              guidePhotos={guidePhotos}
              guideId={prefill?.guide_id}
              onSaved={(updated) => setTripOptions(prev => prev.map(o => o.id === updated.id ? updated : o))}
              onDeleted={(id) => {
                setTripOptions(prev => prev.filter(o => o.id !== id))
                setOptionOpenIdx(null)
              }}
            />
          ))}

          <button
            type="button"
            disabled={optionCreating}
            onClick={async () => {
              if (!experienceId) return
              setOptionCreating(true)
              try {
                const result = await createExperiencePageOption(experienceId, {
                  label: `Option ${tripOptions.length + 1}`,
                  price_from: 0,
                  sort_order: tripOptions.length,
                })
                if (result.success) {
                  const newOpt: ExperiencePageOptionRow = {
                    id:                        result.id,
                    experience_page_id:        experienceId,
                    sort_order:                tripOptions.length,
                    label:                     `Option ${tripOptions.length + 1}`,
                    price_from:                0,
                    description:               null,
                    catches_text:              null,
                    target_species:            [],
                    boat_description:          null,
                    boat_image_url:            null,
                    special_attractions:       [],
                    meeting_point_name:        null,
                    meeting_point_description: null,
                    location_lat:              null,
                    location_lng:              null,
                    what_to_bring:             [],
                    includes:                  [],
                    excludes:                  [],
                    content_blocks:            [],
                    created_at:                new Date().toISOString(),
                    updated_at:                new Date().toISOString(),
                  }
                  setTripOptions(prev => [...prev, newOpt])
                  setOptionOpenIdx(tripOptions.length)
                } else {
                  alert(result.error)
                }
              } finally {
                setOptionCreating(false)
              }
            }}
            className="text-sm font-semibold f-body px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D', cursor: optionCreating ? 'not-allowed' : 'pointer' }}
          >
            {optionCreating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : '+ Add trip option'}
          </button>

          {tripOptions.length === 0 && (
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              No trip options yet. Click &quot;+ Add trip option&quot; to add variants like Full Day, Half Day, etc.
            </p>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {serverError != null && (
        <div className="mt-6 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm f-body" style={{ color: '#DC2626' }}>{serverError}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="mt-8 flex items-center gap-4">
        <button type="button" onClick={handleSubmit} disabled={isPending}
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
