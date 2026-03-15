'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import type { LocationEntry } from '@/lib/supabase/queries'
import { COUNTRIES, COUNTRY_FLAG, getCountryFlag } from '@/lib/countries'

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Mo','Tu','We','Th','Fr','Sa','Su']

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function firstDayOffset(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7 }
function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function formatShort(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Dark panel style (matches experience search bar) ─────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background:   '#0A2E4D',
  borderRadius: '20px',
  boxShadow:    '0 12px 56px rgba(10,46,77,0.38)',
  border:       '1px solid rgba(255,255,255,0.08)',
}

// ─── Location helpers ─────────────────────────────────────────────────────────

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ý/g, 'y')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ß/g, 'ss')
}

const STOP_WORDS = new Set([
  'and', 'in', 'at', 'the', 'or',
  ...COUNTRIES.map(c => c.toLowerCase()),
  'norge', 'sverige', 'suomi', 'island',
])

type Hit =
  | { kind: 'country'; value: string; flag: string }
  | { kind: 'city';    value: string; country: string; flag: string }

function buildCountries(locations: LocationEntry[]) {
  const map = new Map<string, Set<string>>(COUNTRIES.map(c => [c, new Set()]))
  for (const { city, country } of locations) {
    const canonical = COUNTRIES.find(c => c.toLowerCase() === country.toLowerCase().trim()) ?? country
    if (!map.has(canonical)) map.set(canonical, new Set())
    map.get(canonical)!.add(city)
  }
  return Array.from(map.entries()).map(([country, cities]) => ({
    value: country,
    flag: getCountryFlag(country),
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b)),
  }))
}

function getHits(query: string, countries: ReturnType<typeof buildCountries>): Hit[] {
  const raw = norm(query.trim())
  if (!raw) return countries.map(c => ({ kind: 'country', value: c.value, flag: c.flag }))
  const tokens = raw.split(/\s+/).filter(t => !STOP_WORDS.has(t))
  const q = tokens.join(' ')
  if (q.length < 2) return countries.map(c => ({ kind: 'country', value: c.value, flag: c.flag }))
  const countryPrefix = countries.find(c =>
    raw.startsWith(norm(c.value)) || raw.startsWith(norm(c.value).slice(0, 4))
  )
  const pool = countryPrefix ? [countryPrefix] : countries
  const hits: Hit[] = []
  for (const c of pool) {
    for (const city of c.cities) {
      if (norm(city).includes(q)) {
        hits.push({ kind: 'city', value: city, country: c.value, flag: c.flag })
      }
    }
  }
  return hits
}

// ─── Calendar Dropdown ────────────────────────────────────────────────────────

function CalendarDropdown({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string
  dateTo:   string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const now  = new Date()
  const [viewY, setViewY] = useState(now.getFullYear())
  const [viewM, setViewM] = useState(now.getMonth())
  const [stage, setStage] = useState<'from' | 'to'>('from')

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  function prevMonth() {
    if (viewM === 0) { setViewM(11); setViewY(y => y - 1) } else setViewM(m => m - 1)
  }
  function nextMonth() {
    if (viewM === 11) { setViewM(0); setViewY(y => y + 1) } else setViewM(m => m + 1)
  }

  function pickDay(day: number) {
    const iso = toIso(viewY, viewM, day)
    if (stage === 'from' || !dateFrom) {
      onChange(iso, '')
      setStage('to')
    } else {
      if (iso < dateFrom) { onChange(iso, dateFrom) } else { onChange(dateFrom, iso) }
      setStage('from')
    }
  }

  const triggerText = dateFrom
    ? dateTo ? `${formatShort(dateFrom)} – ${formatShort(dateTo)}` : formatShort(dateFrom)
    : null

  const days   = daysInMonth(viewY, viewM)
  const offset = firstDayOffset(viewY, viewM)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex flex-col justify-center outline-none"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
          style={{ color: 'rgba(255,255,255,0.36)' }}
        >
          When
        </span>
        <span
          className="text-sm font-medium f-body mt-1"
          style={{ color: triggerText ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.36)' }}
        >
          {triggerText ?? 'Any dates'}
        </span>
      </button>

      {open && (
        <div
          className="absolute z-[200]"
          style={{ ...PANEL_STYLE, top: 'calc(100% + 12px)', left: '0', width: '300px', padding: '20px' }}
        >
          {/* Stage hint */}
          <p className="text-[11px] f-body mb-3 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {stage === 'from' ? 'Select start date' : 'Select end date'}
          </p>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-[14px] font-semibold f-body" style={{ color: 'white' }}>
              {MONTHS_LONG[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold f-body py-1"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: offset }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const iso = toIso(viewY, viewM, day)
              const isFrom  = iso === dateFrom
              const isTo    = iso === dateTo
              const inRange = !!(dateFrom && dateTo && iso > dateFrom && iso < dateTo)
              const isToday = day === now.getDate() && viewM === now.getMonth() && viewY === now.getFullYear()
              const isPast  = iso < toIso(now.getFullYear(), now.getMonth(), now.getDate())
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(day)}
                  className="flex items-center justify-center text-[13px] f-body font-medium transition-all"
                  style={{
                    height: '34px',
                    borderRadius: (isFrom || isTo) ? '9999px' : inRange ? '0' : '9999px',
                    background: (isFrom || isTo) ? '#E67E50' : inRange ? 'rgba(230,126,80,0.18)' : 'transparent',
                    color: (isFrom || isTo) ? '#fff'
                      : isPast ? 'rgba(255,255,255,0.18)'
                      : inRange ? 'rgba(255,255,255,0.9)'
                      : isToday ? '#E67E50'
                      : 'rgba(255,255,255,0.75)',
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    fontWeight: (isFrom || isTo || isToday) ? 700 : undefined,
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Clear */}
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { onChange('', ''); setStage('from') }}
              className="mt-4 w-full text-center text-[12px] f-body transition-opacity hover:opacity-60"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HeroSearchBar({ locations }: { locations: LocationEntry[] }) {
  const router = useRouter()

  const [query,           setQuery]           = useState('')
  const [dateFrom,        setDateFrom]        = useState('')
  const [dateTo,          setDateTo]          = useState('')
  const [open,            setOpen]            = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('')

  const countries = buildCountries(locations)
  const hits = getHits(query, countries)

  function pick(hit: Hit) {
    if (hit.kind === 'country') {
      setQuery(hit.value)
      setSelectedCountry(hit.value)
    } else {
      setQuery(`${hit.value}, ${hit.country}`)
      setSelectedCountry(hit.country)
    }
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (selectedCountry)   params.set('country', selectedCountry)
    else if (query.trim()) params.set('country', query.trim())
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo',   dateTo)
    router.push(`/experiences?${params.toString()}`)
  }

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="flex items-center mb-3 w-full max-w-[540px]"
      style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.14)',
        position: 'relative',
      }}
    >
      {/* ── Destination ──────────────────────────────────── */}
      <div className="flex flex-col px-5 py-3.5 flex-1 min-w-0" style={{ position: 'relative' }}>
        <label
          htmlFor="hero-destination"
          className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 f-body"
          style={{ color: 'rgba(255,255,255,0.36)' }}
        >
          Destination
        </label>

        <Command shouldFilter={false} style={{ position: 'relative' }}>
          <Command.Input
            id="hero-destination"
            value={query}
            onValueChange={v => { setQuery(v); setSelectedCountry(''); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="City or country…"
            className="bg-transparent text-sm font-medium outline-none f-body w-full placeholder:text-white/30"
            style={{ color: 'rgba(255,255,255,0.88)' }}
          />

          {open && hits.length > 0 && (
            <Command.List
              className="absolute left-0 top-full mt-2 z-[200]"
              style={{
                width: '230px',
                background: 'rgba(7,17,28,0.94)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                padding: '6px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {!query && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest f-body mb-1"
                    style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Countries
                  </div>
                  {hits.map(h => h.kind === 'country' && (
                    <Command.Item
                      key={h.value}
                      value={h.value}
                      onSelect={() => pick(h)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm f-body cursor-pointer rounded-[10px]"
                      style={{ color: 'rgba(255,255,255,0.72)' }}
                    >
                      <span className="text-base leading-none">{h.flag}</span>
                      <span>{h.value}</span>
                    </Command.Item>
                  ))}
                </>
              )}

              {query && (() => {
                const grouped: Record<string, { flag: string; cities: string[] }> = {}
                for (const h of hits) {
                  if (h.kind !== 'city') continue
                  if (!grouped[h.country]) grouped[h.country] = { flag: h.flag, cities: [] }
                  grouped[h.country].cities.push(h.value)
                }
                return Object.entries(grouped).map(([country, { flag, cities }]) => (
                  <Command.Group
                    key={country}
                    heading={
                      <span className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest f-body"
                        style={{ color: 'rgba(255,255,255,0.28)' }}>
                        <span>{flag}</span> {country}
                      </span>
                    }
                  >
                    {cities.map(city => (
                      <Command.Item
                        key={city}
                        value={city}
                        onSelect={() => pick({ kind: 'city', value: city, country, flag })}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm f-body cursor-pointer rounded-[10px]"
                        style={{ color: 'rgba(255,255,255,0.72)' }}
                      >
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>—</span>
                        {city}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))
              })()}
            </Command.List>
          )}
        </Command>
      </div>

      {/* Divider */}
      <div className="w-px self-stretch my-3" style={{ background: 'rgba(255,255,255,0.1)' }} />

      {/* ── When (calendar) ──────────────────────────────── */}
      <div className="flex flex-col px-5 py-3.5 flex-1 min-w-0">
        <CalendarDropdown
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
        />
      </div>

      {/* ── Submit ───────────────────────────────────────── */}
      <button
        type="submit"
        className="m-2 shrink-0 text-white font-semibold text-sm px-7 py-3 rounded-[14px] transition-all hover:brightness-110 f-body whitespace-nowrap"
        style={{ background: '#E67E50' }}
      >
        Search
      </button>
    </form>

    {/* ── Country flag chips ── */}
    <div className="flex items-center gap-2 mb-7 flex-wrap">
      {COUNTRIES.map(country => (
        <button
          key={country}
          type="button"
          onClick={() => router.push(`/experiences?country=${country}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:opacity-80 f-body"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <span className="text-base leading-none">{COUNTRY_FLAG[country]}</span>
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{country}</span>
        </button>
      ))}
    </div>
    </>
  )
}
