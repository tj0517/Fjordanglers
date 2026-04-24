'use client'

/**
 * GuideSubmissionForm — simplified trip info intake for guides.
 *
 * Replaces the complex ExperienceForm for guides. Instead of building their
 * own experience page, guides provide raw info and FA creates a polished page.
 *
 * Sections:
 *  1. Where do you fish? (location, country, region)
 *  2. What can anglers catch? (species, fishing methods)
 *  3. When is the best time? (season months, trip types)
 *  4. Group & pricing (max anglers, approx price)
 *  5. What's included? (checkboxes + notes)
 *  6. About your fishing (personal note)
 */

import { useState, useCallback, useTransition } from 'react'
import { Check, Loader2, ChevronRight } from 'lucide-react'
import { FISH_ALL } from '@/lib/fish'
import { COUNTRIES } from '@/lib/countries'
import { createGuideSubmission, type SubmissionPayload } from '@/actions/submissions'

// ─── Constants ────────────────────────────────────────────────────────────────

const FISHING_METHODS = [
  'Fly fishing', 'Spinning', 'Trolling', 'Jigging',
  'Ice fishing', 'Baitcasting', 'Shore fishing', 'Sea fishing',
]

const MONTHS = [
  { v: 1,  l: 'Jan' }, { v: 2,  l: 'Feb' }, { v: 3,  l: 'Mar' },
  { v: 4,  l: 'Apr' }, { v: 5,  l: 'May' }, { v: 6,  l: 'Jun' },
  { v: 7,  l: 'Jul' }, { v: 8,  l: 'Aug' }, { v: 9,  l: 'Sep' },
  { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dec' },
]

const TRIP_TYPES = [
  { v: 'half_day',  l: 'Half day' },
  { v: 'full_day',  l: 'Full day' },
  { v: 'multi_day', l: 'Multi-day' },
]

const INCLUDES_OPTIONS = [
  { v: 'guide_service', l: 'Guide service' },
  { v: 'boat',          l: 'Boat' },
  { v: 'equipment',     l: 'Fishing equipment' },
  { v: 'license',       l: 'Fishing license' },
  { v: 'accommodation', l: 'Accommodation' },
  { v: 'meals',         l: 'Meals / catering' },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function SectionLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}>
        <span className="text-[11px] font-bold f-body">{step}</span>
      </div>
      <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>{title}</h2>
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
      style={{
        background: active ? '#E67E50' : 'rgba(10,46,77,0.06)',
        color:      active ? '#fff'    : 'rgba(10,46,77,0.6)',
        border:     active ? 'none'    : '1px solid rgba(10,46,77,0.1)',
        boxShadow:  active ? '0 2px 8px rgba(230,126,80,0.28)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="my-8" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }} />
}

// ─── GuideSubmissionForm ──────────────────────────────────────────────────────

export default function GuideSubmissionForm() {
  // Section 1 — Location
  const [locationName,   setLocationName]   = useState('')
  const [country,        setCountry]        = useState('')
  const [region,         setRegion]         = useState('')

  // Section 2 — Fishing
  const [species,        setSpecies]        = useState<string[]>([])
  const [methods,        setMethods]        = useState<string[]>([])

  // Section 3 — Season & trip types
  const [months,         setMonths]         = useState<number[]>([])
  const [tripTypes,      setTripTypes]      = useState<string[]>([])

  // Section 4 — Group & pricing
  const [maxAnglers,     setMaxAnglers]     = useState(4)
  const [priceApprox,    setPriceApprox]    = useState('')

  // Section 5 — Includes
  const [includes,       setIncludes]       = useState<string[]>(['guide_service'])
  const [includesNotes,  setIncludesNotes]  = useState('')

  // Section 6 — Personal note
  const [personalNote,   setPersonalNote]   = useState('')

  // Submit state
  const [isPending,   startTransition]  = useTransition()
  const [submitted,   setSubmitted]     = useState(false)
  const [serverError, setServerError]   = useState<string | null>(null)
  const [hasAttempted, setHasAttempted] = useState(false)

  // Validation
  const locationValid = locationName.trim() !== ''
  const countryValid  = country !== ''
  const speciesValid  = species.length > 0
  const monthsValid   = months.length > 0
  const canSubmit     = locationValid && countryValid && speciesValid && monthsValid

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttempted(true)
    if (!canSubmit) return

    setServerError(null)

    const payload: SubmissionPayload = {
      location_name:    locationName.trim(),
      country,
      region:           region.trim() || null,
      species,
      fishing_methods:  methods,
      season_months:    months,
      trip_types:       tripTypes,
      max_anglers:      maxAnglers,
      price_approx_eur: priceApprox !== '' ? parseFloat(priceApprox) : null,
      includes,
      includes_notes:   includesNotes.trim() || null,
      personal_note:    personalNote.trim() || null,
    }

    startTransition(async () => {
      const result = await createGuideSubmission(payload)
      if (result.success) {
        setSubmitted(true)
      } else {
        setServerError(result.error)
      }
    })
  }, [
    canSubmit, locationName, country, region, species, methods, months,
    tripTypes, maxAnglers, priceApprox, includes, includesNotes, personalNote,
  ])

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-[620px] mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(230,126,80,0.12)' }}>
          <Check size={32} style={{ color: '#E67E50' }} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          Submission received!
        </h2>
        <p className="text-sm f-body leading-relaxed mb-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
          FjordAnglers will review your information and build your experience page
          within <strong>3–5 business days</strong>. We&apos;ll be in touch if we need anything else.
        </p>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Want to send photos? Email them to{' '}
          <a href="mailto:photos@fjordanglers.com" className="underline" style={{ color: '#E67E50' }}>
            photos@fjordanglers.com
          </a>
        </p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-[680px]">

      {/* ── Section 1: Location ── */}
      <SectionLabel step={1} title="Where do you fish?" />

      <div className="space-y-3 mb-0">
        <div>
          <label className={labelCls}>
            River / lake / sea name <Req />
          </label>
          <input
            type="text"
            value={locationName}
            onChange={e => setLocationName(e.target.value)}
            placeholder="e.g. River Gaula, Lake Mjøsa, Lofoten coast"
            className={inputCls}
            style={{ ...inputStyle, border: hasAttempted && !locationValid ? err : inputStyle.border }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Country <Req /></label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, border: hasAttempted && !countryValid ? err : inputStyle.border }}
            >
              <option value="">Select…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Region <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="e.g. Trøndelag, Vesterålen"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Section 2: Fishing ── */}
      <SectionLabel step={2} title="What can anglers catch?" />

      <div className="mb-5">
        <label className={labelCls}>Target species <Req /></label>
        {hasAttempted && !speciesValid && (
          <p className="text-xs f-body mb-2" style={{ color: '#DC2626' }}>Select at least one species</p>
        )}
        <div className="flex flex-wrap gap-2">
          {FISH_ALL.map(f => (
            <Chip key={f} label={f} active={species.includes(f)} onClick={() => setSpecies(toggleItem(species, f))} />
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Fishing methods <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {FISHING_METHODS.map(m => (
            <Chip key={m} label={m} active={methods.includes(m)} onClick={() => setMethods(toggleItem(methods, m))} />
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Section 3: Season & trip types ── */}
      <SectionLabel step={3} title="When is the best time?" />

      <div className="mb-5">
        <label className={labelCls}>Best months <Req /></label>
        {hasAttempted && !monthsValid && (
          <p className="text-xs f-body mb-2" style={{ color: '#DC2626' }}>Select at least one month</p>
        )}
        <div className="flex flex-wrap gap-2">
          {MONTHS.map(({ v, l }) => (
            <Chip key={v} label={l} active={months.includes(v)} onClick={() => setMonths(toggleItem(months, v))} />
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Trip types you offer <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map(({ v, l }) => (
            <Chip key={v} label={l} active={tripTypes.includes(v)} onClick={() => setTripTypes(toggleItem(tripTypes, v))} />
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Section 4: Group & pricing ── */}
      <SectionLabel step={4} title="Group & pricing" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Max group size</label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={inputStyle}>
            <button type="button"
              onClick={() => setMaxAnglers(n => Math.max(1, n - 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-base"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', lineHeight: 1 }}
              aria-label="Decrease">−</button>
            <span className="flex-1 text-center text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
              {maxAnglers} {maxAnglers === 1 ? 'angler' : 'anglers'}
            </span>
            <button type="button"
              onClick={() => setMaxAnglers(n => Math.min(20, n + 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-base"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', lineHeight: 1 }}
              aria-label="Increase">+</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Approx. price per person{' '}
            <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(EUR, per day)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body font-semibold"
              style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
            <input
              type="number"
              min="0"
              step="10"
              value={priceApprox}
              onChange={e => setPriceApprox(e.target.value)}
              placeholder="e.g. 250"
              className={inputCls + ' pl-7'}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Section 5: What's included ── */}
      <SectionLabel step={5} title="What's included?" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {INCLUDES_OPTIONS.map(({ v, l }) => {
          const active = includes.includes(v)
          return (
            <label key={v}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                background: active ? 'rgba(230,126,80,0.08)' : 'rgba(10,46,77,0.04)',
                border: active ? '1.5px solid rgba(230,126,80,0.35)' : '1.5px solid rgba(10,46,77,0.08)',
              }}>
              <input
                type="checkbox"
                checked={active}
                onChange={() => setIncludes(toggleItem(includes, v))}
                className="sr-only"
              />
              <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: active ? '#E67E50' : 'rgba(10,46,77,0.1)' }}>
                {active && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
              </div>
              <span className="text-xs font-semibold f-body" style={{ color: active ? '#E67E50' : 'rgba(10,46,77,0.55)' }}>
                {l}
              </span>
            </label>
          )
        })}
      </div>

      <div>
        <label className={labelCls}>
          Anything else included?{' '}
          <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={includesNotes}
          onChange={e => setIncludesNotes(e.target.value)}
          placeholder="e.g. waders and wading boots, riverside lunch, airport transfer…"
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
          style={inputStyle}
        />
      </div>

      <Divider />

      {/* ── Section 6: Personal note ── */}
      <SectionLabel step={6} title="About your fishing" />

      <div>
        <label className={labelCls}>
          Tell us what makes your spot and your guiding special{' '}
          <span style={{ color: 'rgba(10,46,77,0.3)', fontWeight: 400 }}>(optional but highly recommended)</span>
        </label>
        <textarea
          value={personalNote}
          onChange={e => setPersonalNote(e.target.value)}
          placeholder="Share anything that would help us tell your story — the history of the river, what makes the fish run there, your guiding philosophy, the kind of experience anglers have…"
          rows={5}
          maxLength={2000}
          className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all resize-none"
          style={inputStyle}
        />
        <p className="text-[11px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.3)' }}>
          {personalNote.length} / 2000
        </p>
      </div>

      {/* ── Photos note ── */}
      <div className="mt-6 px-4 py-3.5 rounded-xl"
        style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
        <p className="text-xs font-semibold f-body mb-0.5" style={{ color: '#0A2E4D' }}>📸 Photos</p>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
          Please send your best fishing photos to{' '}
          <a href="mailto:photos@fjordanglers.com" style={{ color: '#E67E50', textDecoration: 'underline' }}>
            photos@fjordanglers.com
          </a>{' '}
          after submitting this form. Aim for 5–10 high-quality shots of the location and catches.
        </p>
      </div>

      {/* ── Error ── */}
      {serverError != null && (
        <div className="mt-4 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm f-body" style={{ color: '#DC2626' }}>{serverError}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="mt-8 flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold f-body transition-all"
          style={{
            background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
            color:      '#fff',
            cursor:     isPending ? 'not-allowed' : 'pointer',
            boxShadow:  isPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
          }}
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Submitting…</>
          ) : (
            <>Submit for review <ChevronRight size={14} /></>
          )}
        </button>
        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          FjordAnglers will build your experience page within 3–5 business days.
        </p>
      </div>

    </form>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(10,46,77,0.04)',
  border:     '1.5px solid rgba(10,46,77,0.1)',
  color:      '#0A2E4D',
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none transition-all'

const labelCls = 'text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block'
  + ' text-[rgba(10,46,77,0.45)]'

const err = '1.5px solid rgba(239,68,68,0.5)'

function Req() {
  return <span style={{ color: '#E67E50' }}>*</span>
}
