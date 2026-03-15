'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { FISH_FILTER, FISH_IMG } from '@/lib/fish'
import { COUNTRY_OPTIONS as COUNTRIES } from '@/lib/countries'
import { CountryFlag } from '@/components/ui/country-flag'

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Mo','Tu','We','Th','Fr','Sa','Su']

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
// Monday-first offset
function firstDayOffset(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7 }
function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// ─── Panel shell (shared dark-blue styling) ───────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background:   '#0A2E4D',
  borderRadius: '20px',
  boxShadow:    '0 12px 56px rgba(10,46,77,0.38)',
  border:       '1px solid rgba(255,255,255,0.08)',
  animation:    'dropdownFadeIn 0.14s ease',
}

// ─── Multi-pick Dropdown ──────────────────────────────────────────────────────

function MultiDropdown({
  options,
  values,
  onChange,
  label,
  emptyLabel,
  renderItem,
}: {
  options:     { value: string; meta?: string; label: string }[]
  values:      string[]
  onChange:    (v: string[]) => void
  label:       string
  emptyLabel:  string
  renderItem?: (o: { value: string; meta?: string; label: string }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  }

  const triggerText =
    values.length === 0 ? emptyLabel
    : values.length === 1 ? options.find(o => o.value === values[0])?.label ?? values[0]
    : `${values.length} selected`

  const hasValue = values.length > 0

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-2 rounded-full transition-colors hover:bg-black/[0.04] focus:outline-none"
        style={{ height: '52px' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] f-body leading-none mb-[3px]"
          style={{ color: 'rgba(10,46,77,0.42)' }}>
          {label}
        </p>
        <p className="text-[13px] font-semibold f-body leading-none truncate"
          style={{ color: hasValue ? '#0A2E4D' : 'rgba(10,46,77,0.32)' }}>
          {triggerText}
        </p>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-[200]"
          style={{ ...PANEL_STYLE, minWidth: '260px', maxHeight: '360px', overflowY: 'auto' }}
        >
          {options.map(o => {
            const sel = values.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors"
                style={{ color: 'rgba(255,255,255,0.85)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                {/* Checkbox */}
                <span className="flex-shrink-0 flex items-center justify-center" style={{
                  width: '18px', height: '18px', borderRadius: '5px',
                  border: sel ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                  background: sel ? '#E67E50' : 'transparent',
                }}>
                  {sel && (
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {renderItem ? renderItem(o) : (
                  <span className="text-[14px] font-medium f-body">{o.label}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
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
  // 'from' = picking start, 'to' = picking end
  const [stage, setStage] = useState<'from' | 'to'>('from')

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  function prevMonth() {
    if (viewM === 0) { setViewM(11); setViewY(y => y - 1) }
    else setViewM(m => m - 1)
  }
  function nextMonth() {
    if (viewM === 11) { setViewM(0); setViewY(y => y + 1) }
    else setViewM(m => m + 1)
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

  function formatShort(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const triggerText = dateFrom
    ? dateTo
      ? `${formatShort(dateFrom)} – ${formatShort(dateTo)}`
      : formatShort(dateFrom)
    : null

  const days   = daysInMonth(viewY, viewM)
  const offset = firstDayOffset(viewY, viewM)

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-2 rounded-full transition-colors hover:bg-black/[0.04] focus:outline-none"
        style={{ height: '52px' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] f-body leading-none mb-[3px]"
          style={{ color: 'rgba(10,46,77,0.42)' }}>
          When
        </p>
        <p className="text-[13px] font-semibold f-body leading-none truncate"
          style={{ color: triggerText ? '#0A2E4D' : 'rgba(10,46,77,0.32)' }}>
          {triggerText ?? 'Any dates'}
        </p>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-[200]"
          style={{ ...PANEL_STYLE, width: '300px', padding: '20px' }}
        >
          {/* Stage hint */}
          <p className="text-[11px] f-body mb-3 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {stage === 'from' ? 'Select start date' : 'Select end date'}
          </p>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-[14px] font-semibold f-body" style={{ color: 'white' }}>
              {MONTHS[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full"
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
              const isFrom = iso === dateFrom
              const isTo   = iso === dateTo
              const inRange = dateFrom && dateTo && iso > dateFrom && iso < dateTo
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
                      : isPast ? 'rgba(255,255,255,0.2)'
                      : isToday ? '#E67E50'
                      : inRange ? 'rgba(255,255,255,0.9)'
                      : 'rgba(255,255,255,0.75)',
                    fontWeight: isToday ? 700 : undefined,
                    cursor: isPast ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!isPast && !isFrom && !isTo) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
                  onMouseLeave={e => { if (!isFrom && !isTo) (e.currentTarget as HTMLElement).style.background = inRange ? 'rgba(230,126,80,0.18)' : 'transparent' }}
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
              className="w-full mt-3 pt-3 text-[12px] f-body font-medium text-center"
              style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

export function SearchBar() {
  const router = useRouter()
  const sp     = useSearchParams()

  const [countries, setCountries] = useState<string[]>(
    sp.get('country') ? sp.get('country')!.split(',').filter(Boolean) : []
  )
  const [fish, setFish] = useState<string[]>(
    sp.get('fish') ? sp.get('fish')!.split(',').filter(Boolean) : []
  )
  const [dateFrom, setDateFrom] = useState(sp.get('dateFrom') ?? '')
  const [dateTo,   setDateTo]   = useState(sp.get('dateTo')   ?? '')

  function handleSearch() {
    const p = new URLSearchParams(sp.toString())
    if (countries.length) p.set('country', countries.join(','))   ; else p.delete('country')
    if (fish.length)      p.set('fish',    fish.join(','))        ; else p.delete('fish')
    if (dateFrom)         p.set('dateFrom', dateFrom)             ; else p.delete('dateFrom')
    if (dateTo)           p.set('dateTo',   dateTo)               ; else p.delete('dateTo')
    p.delete('duration')
    p.delete('page')
    router.push(`/experiences?${p.toString()}`)
  }

  const countryOptions = COUNTRIES.map(c => ({ value: c.value, label: c.value, meta: c.code }))
  const fishOptions    = [...FISH_FILTER].map(s => ({ value: s, label: s }))

  return (
    <>
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="flex items-center"
        style={{
          background:   'white',
          borderRadius: '9999px',
          border:       '1px solid rgba(255,255,255,0.15)',
          boxShadow:    '0 4px 28px rgba(0,0,0,0.22)',
          height:       '52px',
          minWidth:     '560px',
        }}
      >
        {/* ── Destination ── */}
        <MultiDropdown
          options={countryOptions}
          values={countries}
          onChange={setCountries}
          label="Destination"
          emptyLabel="Anywhere"
          renderItem={o => (
            <>
              <CountryFlag country={o.label} size={18} />
              <span className="text-[14px] font-medium f-body">{o.label}</span>
            </>
          )}
        />

        <div className="flex-shrink-0 w-px" style={{ height: '28px', background: 'rgba(0,0,0,0.1)' }} />

        {/* ── Species ── */}
        <MultiDropdown
          options={fishOptions}
          values={fish}
          onChange={setFish}
          label="Target species"
          emptyLabel="Any species"
          renderItem={o => (
            <span className="flex items-center gap-2.5">
              {FISH_IMG[o.label] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={FISH_IMG[o.label]} alt="" width={28} height={20}
                  className="object-cover rounded-sm flex-shrink-0" style={{ opacity: 0.85 }} />
              )}
              <span className="text-[14px] font-medium f-body">{o.label}</span>
            </span>
          )}
        />

        <div className="flex-shrink-0 w-px" style={{ height: '28px', background: 'rgba(0,0,0,0.1)' }} />

        {/* ── When ── */}
        <CalendarDropdown
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
        />

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
    </>
  )
}
