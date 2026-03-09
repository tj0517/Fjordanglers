'use client'

import { useRouter, useSearchParams } from 'next/navigation'

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'Norway',  flag: '🇳🇴', label: 'Norway'  },
  { code: 'Sweden',  flag: '🇸🇪', label: 'Sweden'  },
  { code: 'Finland', flag: '🇫🇮', label: 'Finland' },
  { code: 'Iceland', flag: '🇮🇸', label: 'Iceland' },
  { code: 'Denmark', flag: '🇩🇰', label: 'Denmark' },
]

const SPECIES = [
  'Salmon', 'Trout', 'Pike', 'Zander',
  'Grayling', 'Cod', 'Perch', 'Halibut',
]

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: 'rgba(10,46,77,0.07)',
        margin: '18px 0',
      }}
    />
  )
}

function CheckIcon() {
  return (
    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
      <path
        d="M1 3.5L3 5.5L8 1"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FiltersSidebar({ count }: { count: number }) {
  const router = useRouter()
  const sp     = useSearchParams()

  const country    = sp.get('country')    ?? ''
  const fish       = sp.get('fish')       ?? ''
  const difficulty = sp.get('difficulty') ?? ''
  const minPrice   = sp.get('minPrice')   ?? ''
  const maxPrice   = sp.get('maxPrice')   ?? ''

  // ── Param helpers ──────────────────────────────────────────────────────────

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`/experiences?${p.toString()}`)
  }

  function toggle(key: string, value: string, current: string) {
    setParam(key, current === value ? '' : value)
  }

  function setPricePreset(preset: PricePreset) {
    const p         = new URLSearchParams(sp.toString())
    const curMin    = sp.get('minPrice') ?? ''
    const curMax    = sp.get('maxPrice') ?? ''
    const isActive  = curMin === preset.min && curMax === preset.max

    if (isActive) {
      p.delete('minPrice')
      p.delete('maxPrice')
    } else {
      if (preset.min) p.set('minPrice', preset.min); else p.delete('minPrice')
      if (preset.max) p.set('maxPrice', preset.max); else p.delete('maxPrice')
    }
    router.push(`/experiences?${p.toString()}`)
  }

  // ── Active count (for "Clear" badge) ──────────────────────────────────────

  const hasPrice   = minPrice !== '' || maxPrice !== ''
  const activeCount = [country, fish, difficulty, hasPrice ? '1' : ''].filter(Boolean).length

  // ── Reusable checkbox box ─────────────────────────────────────────────────

  function Checkbox({ active }: { active: boolean }) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          width: '18px', height: '18px',
          borderRadius: '5px',
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
          width: '18px', height: '18px',
          borderRadius: '50%',
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
        <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
          Filters
        </h2>
        {activeCount > 0 && (
          <button
            onClick={() => router.push('/experiences')}
            className="text-xs font-semibold f-body transition-opacity hover:opacity-70"
            style={{ color: '#E67E50' }}
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* Trip count */}
      <p className="text-xs f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        <span className="font-semibold" style={{ color: '#0A2E4D' }}>{count}</span>
        {' '}trip{count !== 1 ? 's' : ''} available
      </p>

      <Divider />

      {/* ── Country ───────────────────────────────────────────────────────── */}
      <section>
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Country
        </h3>
        <div className="flex flex-col gap-2.5">
          {COUNTRIES.map(c => {
            const active = country === c.code
            return (
              <button
                key={c.code}
                onClick={() => toggle('country', c.code, country)}
                className="flex items-center gap-2.5 text-left w-full group"
              >
                <Checkbox active={active} />
                <span
                  className="text-sm f-body transition-colors"
                  style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.6)' }}
                >
                  {c.flag} {c.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Species ───────────────────────────────────────────────────────── */}
      <section>
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Target Species
        </h3>
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

      {/* ── Price range ───────────────────────────────────────────────────── */}
      <section>
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Price per person
        </h3>
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
                <span
                  className="text-sm f-body transition-colors"
                  style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.6)' }}
                >
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Divider />

      {/* ── Skill Level ───────────────────────────────────────────────────── */}
      <section>
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Skill Level
        </h3>
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
                  <p
                    className="text-sm f-body leading-none mb-0.5 transition-colors"
                    style={{ color: active ? '#0A2E4D' : 'rgba(10,46,77,0.65)' }}
                  >
                    {d.label}
                  </p>
                  <p
                    className="text-[11px] f-body"
                    style={{ color: 'rgba(10,46,77,0.35)' }}
                  >
                    {d.desc}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

    </div>
  )
}
