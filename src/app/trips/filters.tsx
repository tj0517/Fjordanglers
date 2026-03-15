'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FISH_FILTER as SPECIES } from '@/lib/fish'
import { COUNTRY_OPTIONS as COUNTRIES } from '@/lib/countries'
import { CountryFlag } from '@/components/ui/country-flag'

// ─── Static data ──────────────────────────────────────────────────────────────

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
  { value: 'price-asc',     label: 'Price ↑'     },
  { value: 'price-desc',    label: 'Price ↓'     },
  { value: 'duration-asc',  label: 'Shortest'    },
  { value: 'duration-desc', label: 'Longest'     },
]

const DURATION_OPTIONS = [
  { value: 'half-day',   label: '½ Day'      },
  { value: 'full-day',   label: 'Full Day'   },
  { value: 'overnight',  label: 'Overnight'  },
  { value: 'multi-day',  label: 'Multi-day'  },
  { value: 'expedition', label: 'Expedition' },
]

const TECHNIQUE_OPTIONS = [
  'Fly fishing', 'Lure fishing', 'Ice fishing',
  'Trolling', 'Spin fishing', 'Jigging', 'Sea fishing',
]

const GUESTS_OPTIONS = [
  { value: '1',  label: 'Solo'       },
  { value: '2',  label: '2 people'   },
  { value: '4',  label: '4+ people'  },
  { value: '8',  label: '8+ people'  },
  { value: '10', label: '10+ people' },
]

// ─── Chip style helper ────────────────────────────────────────────────────────

function chip(active: boolean, variant: 'orange' | 'blue' = 'orange') {
  return {
    background: active
      ? variant === 'orange' ? '#E67E50' : '#0A2E4D'
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

  const country      = sp.get('country')      ?? ''
  const fish         = sp.get('fish')         ?? ''
  const difficulty   = sp.get('difficulty')   ?? ''
  const sort         = sp.get('sort')         ?? ''
  const minPrice     = sp.get('minPrice')     ?? ''
  const maxPrice     = sp.get('maxPrice')     ?? ''
  const technique    = sp.get('technique')    ?? ''
  const duration     = sp.get('duration')     ?? ''
  const catchRelease = sp.get('catchRelease') === 'true'
  const guests       = sp.get('guests')       ?? ''

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
    const isActive = (sp.get('minPrice') ?? '') === preset.min
                  && (sp.get('maxPrice') ?? '') === preset.max
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

  const hasPrice   = minPrice !== '' || maxPrice !== ''
  const hasFilters = country !== '' || fish !== '' || difficulty !== '' || hasPrice
                  || sort !== '' || technique !== '' || duration !== '' || catchRelease || guests !== ''

  return (
    <div
      className="flex items-center gap-2 px-3 h-full overflow-x-auto"
      style={{ scrollbarWidth: 'none' } as React.CSSProperties}
    >
      {/* Country */}
      {COUNTRIES.map(c => (
        <button key={c.value} onClick={() => toggle('country', c.value, country)} className={CLS} style={chip(country === c.value)}>
          <CountryFlag country={c.value} /> {c.value}
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

      {/* Duration */}
      {DURATION_OPTIONS.map(d => (
        <button key={d.value} onClick={() => toggle('duration', d.value, duration)} className={CLS} style={chip(duration === d.value)}>
          {d.label}
        </button>
      ))}

      {SEP}

      {/* Technique */}
      {TECHNIQUE_OPTIONS.map(t => (
        <button key={t} onClick={() => toggle('technique', t, technique)} className={CLS} style={chip(technique === t, 'blue')}>
          {t}
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

      {/* Group size */}
      {GUESTS_OPTIONS.map(o => (
        <button key={o.value} onClick={() => toggle('guests', o.value, guests)} className={CLS} style={chip(guests === o.value, 'blue')}>
          {o.label}
        </button>
      ))}

      {SEP}

      {/* Catch & Release */}
      <button onClick={toggleCatchRelease} className={CLS} style={chip(catchRelease, 'blue')}>
        🎣 C&R only
      </button>

      {SEP}

      {/* Sort */}
      {SORT_OPTIONS.map(o => (
        <button key={o.value} onClick={() => setParam('sort', sort === o.value ? '' : o.value)} className={CLS} style={chip(sort === o.value, 'blue')}>
          {o.label}
        </button>
      ))}

      {/* Clear all */}
      {hasFilters && (
        <>
          {SEP}
          <button
            onClick={() => router.push('/trips')}
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
