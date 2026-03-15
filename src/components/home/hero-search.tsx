'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Norway', 'Sweden', 'Finland']
import { FISH_FILTER } from '@/lib/fish'

const SPECIES = FISH_FILTER
const DURATIONS = ['Half day (4h)', 'Full day (8h)', 'Multi-day']

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.05)',
  border: '1px solid rgba(10,46,77,0.12)',
  borderRadius: '14px',
  padding: '13px 40px 13px 16px',
  color: '#0A2E4D',
  fontSize: '15px',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export function HeroSearch() {
  const router = useRouter()
  const [country,  setCountry]  = useState('')
  const [fish,     setFish]     = useState('')
  const [duration, setDuration] = useState('')

  function handleSearch() {
    const params = new URLSearchParams()
    if (country)  params.set('country', country)
    if (fish)     params.set('fish', fish)
    if (duration) params.set('duration', duration)
    router.push(`/experiences${params.size ? `?${params}` : ''}`)
  }

  return (
    <div
      style={{
        width: '340px',
        background: '#FDFAF7',
        border: '1px solid rgba(10,46,77,0.09)',
        borderRadius: '28px',
        padding: '28px',
        boxShadow: '0 24px 72px rgba(4,12,22,0.3)',
      }}
    >
      <p className="font-bold f-display mb-5" style={{ fontSize: '20px', color: '#0A2E4D' }}>
        Find your trip
      </p>

      <div className="flex flex-col gap-3">
        {[
          { label: 'Destination', value: country, set: setCountry, opts: COUNTRIES, placeholder: 'Any country' },
          { label: 'Species',     value: fish,    set: setFish,    opts: SPECIES,   placeholder: 'Any species' },
          { label: 'Duration',    value: duration, set: setDuration, opts: DURATIONS, placeholder: 'Any length' },
        ].map(({ label, value, set, opts, placeholder }) => (
          <div key={label}>
            <p className="text-[11px] uppercase tracking-[0.18em] mb-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {label}
            </p>
            <div className="relative">
              <select value={value} onChange={e => set(e.target.value)} style={selectStyle} className="f-body">
                <option value="">{placeholder}</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(10,46,77,0.3)' }}>▾</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSearch}
        className="w-full flex items-center justify-center gap-2 text-white font-semibold transition-all hover:brightness-110 active:scale-[0.98] f-body"
        style={{
          marginTop: '20px',
          background: '#E67E50',
          borderRadius: '14px',
          padding: '14px',
          fontSize: '15px',
        }}
      >
        Search Experiences
      </button>
    </div>
  )
}
