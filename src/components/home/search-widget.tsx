"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Norway', 'Sweden', 'Finland', 'Denmark', 'Iceland']
const SPECIES = [
  'Salmon', 'Sea Trout', 'Brown Trout', 'Pike',
  'Perch', 'Grayling', 'Arctic Char', 'Zander',
]

export default function HomeSearchWidget() {
  const router = useRouter()
  const [country, setCountry] = useState('')
  const [fish, setFish] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (country) params.set('country', country)
    if (fish) params.set('fish', fish)
    router.push(`/experiences?${params.toString()}`)
  }

  const fieldStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    borderRadius: '12px',
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label className="text-white/38 text-[11px] uppercase tracking-[0.2em] f-body">
          Destination
        </label>
        <div className="relative">
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={fieldStyle}
            className="w-full px-4 py-3.5 text-sm appearance-none pr-10 f-body"
          >
            <option value="" className="bg-[#0A1A2A]">All destinations</option>
            {COUNTRIES.map(c => (
              <option key={c} value={c} className="bg-[#0A1A2A]">{c}</option>
            ))}
          </select>
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none text-xs">▾</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-white/38 text-[11px] uppercase tracking-[0.2em] f-body">
          Target species
        </label>
        <div className="relative">
          <select
            value={fish}
            onChange={e => setFish(e.target.value)}
            style={fieldStyle}
            className="w-full px-4 py-3.5 text-sm appearance-none pr-10 f-body"
          >
            <option value="" className="bg-[#0A1A2A]">Any fish</option>
            {SPECIES.map(s => (
              <option key={s} value={s} className="bg-[#0A1A2A]">{s}</option>
            ))}
          </select>
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none text-xs">▾</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-white/38 text-[11px] uppercase tracking-[0.2em] f-body">
          When
        </label>
        <input
          type="date"
          style={fieldStyle}
          className="w-full px-4 py-3.5 text-sm f-body [color-scheme:dark]"
        />
      </div>

      <div className="pt-1">
        <button
          type="submit"
          className="w-full text-white font-semibold py-3.5 rounded-2xl text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          Search Experiences →
        </button>
        <p className="text-white/22 text-xs text-center mt-3 f-body">
          Norway · Sweden · Finland
        </p>
      </div>
    </form>
  )
}
