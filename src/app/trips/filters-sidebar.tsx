'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FISH_FILTER as SPECIES } from '@/lib/fish'
import { COUNTRY_OPTIONS as COUNTRIES } from '@/lib/countries'
import { CountryFlag } from '@/components/ui/country-flag'


// ─── Static data ──────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { value: 'beginner',     label: 'All Levels',   desc: 'No prior experience needed'   },
  { value: 'intermediate', label: 'Intermediate', desc: 'Basic casting skills required' },
  { value: 'expert',       label: 'Expert only',  desc: 'Advanced techniques & stamina' },
]

type PricePreset = { label: string; min: string; max: string }
const PRICE_PRESETS: PricePreset[] = [
  { label: 'Under €150', min: '',    max: '150' },
  { label: '€150 – 300', min: '150', max: '300' },
  { label: '€300 – 500', min: '300', max: '500' },
  { label: '€500+',      min: '500', max: ''    },
]

const DURATION_OPTIONS = [
  { value: 'half-day',   label: '½ Day',      desc: 'Up to 6 hours'   },
  { value: 'full-day',   label: 'Full Day',   desc: '7 – 12 hours'    },
  { value: 'overnight',  label: 'Overnight',  desc: '1 night'          },
  { value: 'multi-day',  label: 'Multi-day',  desc: '2 – 4 days'      },
  { value: 'expedition', label: 'Expedition', desc: '5 or more days'   },
]

const TECHNIQUE_OPTIONS = [
  'Fly fishing', 'Lure fishing', 'Bait fishing', 'Ice fishing',
  'Trolling', 'Spin fishing', 'Jigging', 'Sea fishing',
]

const GUESTS_OPTIONS = [
  { value: '1',  label: 'Solo (1)'      },
  { value: '2',  label: '2 people'      },
  { value: '4',  label: '4+ people'     },
  { value: '8',  label: '8+ people'     },
  { value: '10', label: '10+ people'    },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', margin: '18px 0' }} />
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3
      className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
      style={{ color: 'rgba(10,46,77,0.38)' }}
    >
      {children}
    </h3>
  )
}

function CheckIcon() {
  return (
    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
      <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FiltersSidebar({ count }: { count: number }) {
  const router = useRouter()
  const sp     = useSearchParams()

  const country      = sp.get('country')      ?? ''
  const fish         = sp.get('fish')         ?? ''
  const difficulty   = sp.get('difficulty')   ?? ''
  const minPrice     = sp.get('minPrice')     ?? ''
  const maxPrice     = sp.get('maxPrice')     ?? ''
  const technique    = sp.get('technique')    ?? ''
  const duration     = sp.get('duration')     ?? ''
  const catchRelease = sp.get('catchRelease') === 'true'
  const guests       = sp.get('guests')       ?? ''

  // ── Param helpers ──────────────────────────────────────────────────────────

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete('page')
    router.push(`/trips?${p.toString()}`)
  }

  function toggle(key: string, value: string, current: string) {
    setParam(key, current === value ? '' : value)
  }

  function setPricePreset(preset: PricePreset) {
    const p        = new URLSearchParams(sp.toString())
    const isActive = minPrice === preset.min && maxPrice === preset.max
    if (isActive) {
      p.delete('minPrice'); p.delete('maxPrice')
    } else {
      if (preset.min) p.set('minPrice', preset.min); else p.delete('minPrice')
      if (preset.max) p.set('maxPrice', preset.max); else p.delete('maxPrice')
    }
    p.delete('page')
    router.push(`/trips?${p.toString()}`)
  }

  function toggleCatchRelease() {
    const p = new URLSearchParams(sp.toString())
    if (catchRelease) p.delete('catchRelease'); else p.set('catchRelease', 'true')
    p.delete('page')
    router.push(`/trips?${p.toString()}`)
  }

  // ── Active count ───────────────────────────────────────────────────────────

  const hasPrice   = minPrice !== '' || maxPrice !== ''
  const activeCount = [
    country, fish, difficulty, technique, duration, guests,
    hasPrice    ? '1' : '',
    catchRelease ? '1' : '',
  ].filter(Boolean).length

  // ── Reusable control shapes ────────────────────────────────────────────────

  function Checkbox({ active }: { active: boolean }) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          width: '18px', height: '18px', borderRadius: '5px',
          background: active ? '#E67E50' : 'transparent',
          border: `1.5px solid ${active ? '#E67E50' : 'rgba(10,46,77,0.18)'}`,
        }}
      >
        {active && <CheckIcon />}
      </div>
    )
  }

  function Radio({ active }: { active: boolean }) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          width: '18px', height: '18px', borderRadius: '50%',
          background: active ? '#0A2E4D' : 'transparent',
          border: `1.5px solid ${active ? '#0A2E4D' : 'rgba(10,46,77,0.18)'}`,
        }}
      >
        {active && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 py-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Filters</h2>
        {activeCount > 0 && (
          <button
            onClick={() => router.push('/trips')}
            className="text-xs font-semibold f-body transition-opacity hover:opacity-70"
            style={{ color: '#E67E50' }}
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>
      <p className="text-xs f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        <span className="font-semibold" style={{ color: '#0A2E4D' }}>{count}</span>
        {' '}trip{count !== 1 ? 's' : ''} available
      </p>

      <Divider />

      {/* ── Country ──────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Country</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {COUNTRIES.map(c => {
            const active = country === c.value
            return (
              <button
                key={c.value}
                onClick={() => toggle('country', c.value, country)}
                className="flex items-center gap-2.5 text-left w-full"
              >
                <Checkbox active={active} />
                <span className="text-sm f-body transition-colors" style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.6)' }}>
                  <CountryFlag country={c.value} /> {c.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Target species ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Target Species</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {SPECIES.map(s => {
            const active = fish === s
            return (
              <button
                key={s}
                onClick={() => toggle('fish', s, fish)}
                className="text-xs font-medium px-3 py-1.5 rounded-full f-body transition-all"
                style={{
                  background: active ? 'rgba(201,107,56,0.12)' : 'rgba(10,46,77,0.05)',
                  color:      active ? '#9E4820'                : 'rgba(10,46,77,0.55)',
                  border:     `1.5px solid ${active ? 'rgba(201,107,56,0.28)' : 'transparent'}`,
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Duration ─────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Trip Duration</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {DURATION_OPTIONS.map(d => {
            const active = duration === d.value
            return (
              <button
                key={d.value}
                onClick={() => toggle('duration', d.value, duration)}
                className="flex items-start gap-2.5 text-left w-full"
              >
                <Radio active={active} />
                <div>
                  <p className="text-sm f-body leading-none mb-0.5 transition-colors" style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.65)' }}>
                    {d.label}
                  </p>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {d.desc}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Price range ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Price per person</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {PRICE_PRESETS.map(preset => {
            const active = minPrice === preset.min && maxPrice === preset.max
            return (
              <button
                key={preset.label}
                onClick={() => setPricePreset(preset)}
                className="flex items-center gap-2.5 text-left w-full"
              >
                <Radio active={active} />
                <span className="text-sm f-body transition-colors" style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.6)' }}>
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Fishing technique ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Fishing Technique</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {TECHNIQUE_OPTIONS.map(t => {
            const active = technique === t
            return (
              <button
                key={t}
                onClick={() => toggle('technique', t, technique)}
                className="text-xs font-medium px-3 py-1.5 rounded-full f-body transition-all"
                style={{
                  background: active ? 'rgba(10,46,77,0.1)' : 'rgba(10,46,77,0.05)',
                  color:      active ? '#0A2E4D'            : 'rgba(10,46,77,0.55)',
                  border:     `1.5px solid ${active ? 'rgba(10,46,77,0.25)' : 'transparent'}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Skill level ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Skill Level</SectionTitle>
        <div className="flex flex-col gap-3">
          {DIFFICULTIES.map(d => {
            const active = difficulty === d.value
            return (
              <button
                key={d.value}
                onClick={() => toggle('difficulty', d.value, difficulty)}
                className="flex items-start gap-2.5 text-left w-full"
              >
                <Radio active={active} />
                <div>
                  <p className="text-sm f-body leading-none mb-0.5 transition-colors" style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.65)' }}>
                    {d.label}
                  </p>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {d.desc}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Group size ───────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Group Size</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {GUESTS_OPTIONS.map(o => {
            const active = guests === o.value
            return (
              <button
                key={o.value}
                onClick={() => toggle('guests', o.value, guests)}
                className="text-xs font-medium px-3 py-1.5 rounded-full f-body transition-all"
                style={{
                  background: active ? 'rgba(10,46,77,0.1)' : 'rgba(10,46,77,0.05)',
                  color:      active ? '#0A2E4D'            : 'rgba(10,46,77,0.55)',
                  border:     `1.5px solid ${active ? 'rgba(10,46,77,0.25)' : 'transparent'}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Catch & Release ──────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Conservation</SectionTitle>
        <button
          onClick={toggleCatchRelease}
          className="flex items-center gap-3 w-full text-left transition-all"
        >
          {/* Toggle */}
          <div
            className="relative flex-shrink-0 transition-all"
            style={{
              width: '40px', height: '24px', borderRadius: '12px',
              background: catchRelease ? '#0A2E4D' : 'rgba(10,46,77,0.15)',
            }}
          >
            <div
              className="absolute top-[3px] transition-all"
              style={{
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                left: catchRelease ? '19px' : '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              }}
            />
          </div>
          <div>
            <p className="text-sm f-body" style={{ color: '#0A2E4D', fontWeight: catchRelease ? 600 : 400 }}>
              Catch &amp; Release only
            </p>
            <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Eco-friendly, no-kill trips
            </p>
          </div>
        </button>
      </section>

    </div>
  )
}
