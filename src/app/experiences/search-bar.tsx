'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const COUNTRIES = [
  { code: 'Norway',  flag: '🇳🇴', label: 'Norway'  },
  { code: 'Sweden',  flag: '🇸🇪', label: 'Sweden'  },
  { code: 'Finland', flag: '🇫🇮', label: 'Finland' },
  { code: 'Iceland', flag: '🇮🇸', label: 'Iceland' },
  { code: 'Denmark', flag: '🇩🇰', label: 'Denmark' },
]

const SPECIES = [
  'Salmon', 'Trout', 'Pike', 'Zander',
  'Grayling', 'Cod', 'Perch', 'Halibut', 'Arctic Char',
]

// ─── Trick: invisible <select> on top of styled text ──────────────────────────
// Clicking the styled section activates the native select.
// No custom dropdown complexity, works on all devices.

export function SearchBar() {
  const router = useRouter()
  const sp     = useSearchParams()

  const [country, setCountry] = useState(sp.get('country') ?? '')
  const [fish,    setFish]    = useState(sp.get('fish')    ?? '')

  function handleSearch() {
    const p = new URLSearchParams(sp.toString())
    if (country) p.set('country', country); else p.delete('country')
    if (fish)    p.set('fish', fish);       else p.delete('fish')
    router.push(`/experiences?${p.toString()}`)
  }

  const countryLabel = country
    ? `${COUNTRIES.find(c => c.code === country)?.flag ?? ''} ${country}`
    : 'Anywhere'
  const fishLabel = fish || 'Any species'

  return (
    <div
      className="flex items-center"
      style={{
        background: 'white',
        borderRadius: '9999px',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.22)',
        height: '52px',
        minWidth: '420px',
      }}
    >
      {/* ── Destination ── */}
      <div className="relative flex-1 px-5 py-2 cursor-pointer">
        <p
          className="text-[9px] font-bold uppercase tracking-[0.18em] f-body leading-none mb-[3px]"
          style={{ color: 'rgba(10,46,77,0.42)' }}
        >
          Destination
        </p>
        <p
          className="text-[13px] font-semibold f-body leading-none truncate"
          style={{ color: country ? '#0A2E4D' : 'rgba(10,46,77,0.32)' }}
        >
          {countryLabel}
        </p>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label="Select destination"
        >
          <option value="">Anywhere</option>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div className="flex-shrink-0 w-px" style={{ height: '28px', background: 'rgba(0,0,0,0.1)' }} />

      {/* ── Species ── */}
      <div className="relative flex-1 px-5 py-2 cursor-pointer">
        <p
          className="text-[9px] font-bold uppercase tracking-[0.18em] f-body leading-none mb-[3px]"
          style={{ color: 'rgba(10,46,77,0.42)' }}
        >
          Target species
        </p>
        <p
          className="text-[13px] font-semibold f-body leading-none truncate"
          style={{ color: fish ? '#0A2E4D' : 'rgba(10,46,77,0.32)' }}
        >
          {fishLabel}
        </p>
        <select
          value={fish}
          onChange={e => setFish(e.target.value)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label="Select species"
        >
          <option value="">Any species</option>
          {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Search button ── */}
      <div className="flex-shrink-0 pr-1.5">
        <button
          onClick={handleSearch}
          className="flex items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-[0.95]"
          style={{ background: '#E67E50', width: '40px', height: '40px' }}
          aria-label="Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2.5" />
            <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
