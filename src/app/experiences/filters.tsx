'use client'

import { useRouter, useSearchParams } from 'next/navigation'

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'Norway',  flag: '🇳🇴' },
  { code: 'Sweden',  flag: '🇸🇪' },
  { code: 'Finland', flag: '🇫🇮' },
  { code: 'Iceland', flag: '🇮🇸' },
  { code: 'Denmark', flag: '🇩🇰' },
]

const SPECIES = ['Salmon', 'Trout', 'Pike', 'Zander', 'Grayling', 'Cod']

const DIFFICULTIES = [
  { value: 'beginner',     label: 'All Levels'   },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert',       label: 'Expert'       },
]

type PricePreset = { label: string; min: string; max: string }

const PRICE_PRESETS: PricePreset[] = [
  { label: 'Under €150', min: '',    max: '150' },
  { label: '€150–300',   min: '150', max: '300' },
  { label: '€300–500',   min: '300', max: '500' },
  { label: '€500+',      min: '500', max: ''    },
]

const SORT_OPTIONS = [
  { value: 'price-asc',    label: 'Price ↑'  },
  { value: 'price-desc',   label: 'Price ↓'  },
  { value: 'duration-asc', label: 'Shortest' },
]

// ─── Chip style helper ────────────────────────────────────────────────────────

function chip(active: boolean, variant: 'orange' | 'blue' = 'orange') {
  return {
    background: active
      ? (variant === 'orange' ? '#E67E50' : '#0A2E4D')
      : 'rgba(10,46,77,0.06)',
    color: active ? 'white' : 'rgba(10,46,77,0.65)',
    border: '1px solid transparent',
    boxShadow: active
      ? variant === 'orange'
        ? '0 2px 8px rgba(230,126,80,0.35)'
        : '0 2px 8px rgba(10,46,77,0.22)'
      : 'none',
  }
}

const SEP = (
  <div
    className="flex-shrink-0 self-stretch w-px my-3"
    style={{ background: 'rgba(10,46,77,0.1)' }}
  />
)

const CLS = 'flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all f-body whitespace-nowrap cursor-pointer'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExperienceFilters() {
  const router = useRouter()
  const sp     = useSearchParams()

  const country    = sp.get('country')    ?? ''
  const fish       = sp.get('fish')       ?? ''
  const difficulty = sp.get('difficulty') ?? ''
  const sort       = sp.get('sort')       ?? ''
  const minPrice   = sp.get('minPrice')   ?? ''
  const maxPrice   = sp.get('maxPrice')   ?? ''

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
    const p        = new URLSearchParams(sp.toString())
    const isActive = (sp.get('minPrice') ?? '') === preset.min
                  && (sp.get('maxPrice') ?? '') === preset.max
    if (isActive) {
      p.delete('minPrice')
      p.delete('maxPrice')
    } else {
      if (preset.min) p.set('minPrice', preset.min); else p.delete('minPrice')
      if (preset.max) p.set('maxPrice', preset.max); else p.delete('maxPrice')
    }
    router.push(`/experiences?${p.toString()}`)
  }

  const hasPrice   = minPrice !== '' || maxPrice !== ''
  const hasFilters = country !== '' || fish !== '' || difficulty !== ''
                  || hasPrice || sort !== ''

  return (
    <div
      className="flex items-center gap-2 px-3 h-full overflow-x-auto"
      style={{ scrollbarWidth: 'none' } as React.CSSProperties}
    >
      {/* Country */}
      {COUNTRIES.map(c => (
        <button key={c.code} onClick={() => toggle('country', c.code, country)} className={CLS} style={chip(country === c.code)}>
          {c.flag} {c.code}
        </button>
      ))}

      {SEP}

      {/* Species */}
      {SPECIES.map(s => (
        <button key={s} onClick={() => toggle('fish', s, fish)} className={CLS} style={chip(fish === s)}>
          {s}
        </button>
      ))}

      {SEP}

      {/* Difficulty */}
      {DIFFICULTIES.map(d => (
        <button key={d.value} onClick={() => toggle('difficulty', d.value, difficulty)} className={CLS} style={chip(difficulty === d.value, 'blue')}>
          {d.label}
        </button>
      ))}

      {SEP}

      {/* Price */}
      {PRICE_PRESETS.map(preset => {
        const active = (sp.get('minPrice') ?? '') === preset.min
                    && (sp.get('maxPrice') ?? '') === preset.max
        return (
          <button key={preset.label} onClick={() => setPricePreset(preset)} className={CLS} style={chip(active, 'blue')}>
            {preset.label}
          </button>
        )
      })}

      {SEP}

      {/* Sort */}
      {SORT_OPTIONS.map(o => (
        <button key={o.value} onClick={() => setParam('sort', sort === o.value ? '' : o.value)} className={CLS} style={chip(sort === o.value, 'blue')}>
          {o.label}
        </button>
      ))}

      {/* Clear */}
      {hasFilters && (
        <>
          {SEP}
          <button
            onClick={() => router.push('/experiences')}
            className="flex-shrink-0 text-xs font-semibold f-body whitespace-nowrap transition-opacity hover:opacity-60"
            style={{ color: '#E67E50' }}
          >
            Clear ×
          </button>
        </>
      )}
    </div>
  )
}
