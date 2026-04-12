'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { FISH_FILTER } from '@/lib/fish'
import { X, SlidersHorizontal } from 'lucide-react'

// ─── Static data ──────────────────────────────────────────────────────────────

type PriceKey = '' | 'u150' | '150-300' | '300-500' | '500p'

const PRICE_OPTIONS: { key: PriceKey; label: string; min: string; max: string }[] = [
  { key: '',        label: 'Any',         min: '',    max: ''    },
  { key: 'u150',    label: 'Under €150',  min: '',    max: '150' },
  { key: '150-300', label: '€150 – 300',  min: '150', max: '300' },
  { key: '300-500', label: '€300 – 500',  min: '300', max: '500' },
  { key: '500p',    label: '€500+',       min: '500', max: ''    },
]

const DIFFICULTIES = [
  { value: '',             label: 'Any level'    },
  { value: 'beginner',     label: 'All Levels'   },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert',       label: 'Expert only'  },
]

const DURATION_OPTIONS = [
  { value: '',           label: 'Any'        },
  { value: 'half-day',   label: '½ Day',     desc: 'Up to 6 hours'     },
  { value: 'full-day',   label: 'Full Day',  desc: '7 – 12 hours'      },
  { value: 'overnight',  label: 'Overnight', desc: '1 night'            },
  { value: 'multi-day',  label: 'Multi-day', desc: '2 – 4 days'        },
  { value: 'expedition', label: 'Expedition', desc: '5 or more days'   },
]

const TECHNIQUE_OPTIONS = [
  'Fly fishing',
  'Lure fishing',
  'Bait fishing',
  'Ice fishing',
  'Trolling',
  'Spin fishing',
  'Jigging',
  'Sea fishing',
]

const GUESTS_OPTIONS = [
  { value: '',   label: 'Any'         },
  { value: '1',  label: 'Solo'        },
  { value: '2',  label: '2 people'    },
  { value: '4',  label: '4+ people'   },
  { value: '8',  label: '8+ people'   },
  { value: '10', label: '10+ people'  },
]

const SORT_OPTIONS = [
  { value: '',              label: 'Recommended'       },
  { value: 'price-asc',    label: 'Price: Low → High' },
  { value: 'price-desc',   label: 'Price: High → Low' },
  { value: 'duration-asc', label: 'Shortest first'    },
  { value: 'duration-desc', label: 'Longest first'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlToPriceKey(min: string, max: string): PriceKey {
  if (!min && max === '150') return 'u150'
  if (min === '150' && max === '300') return '150-300'
  if (min === '300' && max === '500') return '300-500'
  if (min === '500' && !max) return '500p'
  return ''
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3
      className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
      style={{ color: 'rgba(10,46,77,0.38)' }}
    >
      {children}
    </h3>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', margin: '24px 0' }} />
}

function Pill({
  label,
  active,
  onClick,
  variant = 'blue',
}: {
  label: string
  active: boolean
  onClick: () => void
  variant?: 'blue' | 'orange'
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-semibold px-4 py-2.5 rounded-full transition-all f-body whitespace-nowrap"
      style={{
        background: active
          ? variant === 'orange' ? '#E67E50' : '#0A2E4D'
          : 'rgba(10,46,77,0.05)',
        color: active ? 'white' : 'rgba(10,46,77,0.65)',
        boxShadow: active
          ? variant === 'orange'
            ? '0 2px 8px rgba(230,126,80,0.35)'
            : '0 2px 8px rgba(10,46,77,0.22)'
          : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FiltersModal() {
  const [open,     setOpen]    = useState(false)
  const [mounted,  setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const sp     = useSearchParams()

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Local filter state — synced from URL when modal opens ─────────────────
  const [difficulty,   setDifficulty]   = useState<string>('')
  const [price,        setPrice]        = useState<PriceKey>('')
  const [sort,         setSort]         = useState<string>('')
  const [technique,    setTechnique]    = useState<string>('')
  const [duration,     setDuration]     = useState<string>('')
  const [catchRelease, setCatchRelease] = useState<boolean>(false)
  const [guests,       setGuests]       = useState<string>('')
  const [fish,         setFish]         = useState<string[]>([])

  function handleOpen() {
    setDifficulty(sp.get('difficulty')   ?? '')
    setPrice(urlToPriceKey(sp.get('minPrice') ?? '', sp.get('maxPrice') ?? ''))
    setSort(sp.get('sort')               ?? '')
    setTechnique(sp.get('technique')     ?? '')
    setDuration(sp.get('duration')       ?? '')
    setCatchRelease(sp.get('catchRelease') === 'true')
    setGuests(sp.get('guests')           ?? '')
    setFish(sp.get('fish') ? sp.get('fish')!.split(',').filter(Boolean) : [])
    setOpen(true)
  }

  function commitFilters(overrides: {
    difficulty?: string
    price?: PriceKey
    sort?: string
    technique?: string
    duration?: string
    catchRelease?: boolean
    guests?: string
    fish?: string[]
  }) {
    const d   = overrides.difficulty   ?? difficulty
    const pr  = overrides.price        ?? price
    const s   = overrides.sort         ?? sort
    const t   = overrides.technique    ?? technique
    const dur = overrides.duration     ?? duration
    const cr  = overrides.catchRelease ?? catchRelease
    const g   = overrides.guests       ?? guests
    const f   = overrides.fish         ?? fish

    const p      = new URLSearchParams(sp.toString())
    const preset = PRICE_OPTIONS.find(o => o.key === pr)

    if (d)        p.set('difficulty', d);         else p.delete('difficulty')
    if (preset?.min) p.set('minPrice', preset.min); else p.delete('minPrice')
    if (preset?.max) p.set('maxPrice', preset.max); else p.delete('maxPrice')
    if (s)        p.set('sort', s);                else p.delete('sort')
    if (t)        p.set('technique', t);           else p.delete('technique')
    if (dur)      p.set('duration', dur);          else p.delete('duration')
    if (cr)       p.set('catchRelease', 'true');   else p.delete('catchRelease')
    if (g)        p.set('guests', g);              else p.delete('guests')
    if (f.length) p.set('fish', f.join(','));      else p.delete('fish')
    p.delete('page')

    router.push(`/trips?${p.toString()}`)
  }

  function handleClearAll() {
    setDifficulty('')
    setPrice('')
    setSort('')
    setTechnique('')
    setDuration('')
    setCatchRelease(false)
    setGuests('')
    setFish([])
    commitFilters({ difficulty: '', price: '', sort: '', technique: '', duration: '', catchRelease: false, guests: '', fish: [] })
  }

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Count active URL filters (for badge on trigger button)
  const urlActiveCount = [
    sp.get('difficulty'),
    sp.get('minPrice') || sp.get('maxPrice') ? '1' : '',
    sp.get('sort'),
    sp.get('technique'),
    sp.get('duration'),
    sp.get('catchRelease') === 'true' ? '1' : '',
    sp.get('guests'),
    sp.get('fish'),
  ].filter(Boolean).length

  const hasLocalChanges =
    difficulty !== '' || price !== '' || sort !== '' || technique !== '' ||
    duration !== '' || catchRelease || guests !== '' || fish.length > 0

  // ── Modal DOM ─────────────────────────────────────────────────────────────
  const modal = mounted && open
    ? createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Dialog — full-screen on mobile, centered sheet on desktop */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            style={isMobile ? {
              position: 'fixed', zIndex: 9999,
              inset: 0,
              background: '#FDFAF7',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            } : {
              position: 'fixed', zIndex: 9999,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '560px',
              maxHeight: '88vh',
              background: '#FDFAF7',
              borderRadius: '28px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.32)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}
            >
              <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                Filters
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(10,46,77,0.07)]"
                style={{ width: '32px', height: '32px', color: '#0A2E4D' }}
                aria-label="Close filters"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* Scrollable body */}
            <div
              className="flex-1 overflow-y-auto px-7 py-7"
              style={{ scrollbarWidth: 'none' } as React.CSSProperties}
            >

              {/* ── Target species ──────────────────────────────────────── */}
              <section>
                <SectionLabel>Target species</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {[...FISH_FILTER].map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        const newFish = fish.includes(s) ? fish.filter(x => x !== s) : [...fish, s]
                        setFish(newFish)
                        commitFilters({ fish: newFish })
                      }}
                      className="text-sm font-medium px-4 py-2 rounded-full transition-all f-body"
                      style={{
                        background: fish.includes(s) ? 'rgba(230,126,80,0.14)' : 'rgba(10,46,77,0.05)',
                        color:      fish.includes(s) ? '#9E4820'               : 'rgba(10,46,77,0.65)',
                        border:     `1.5px solid ${fish.includes(s) ? 'rgba(230,126,80,0.3)' : 'transparent'}`,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Sort by ─────────────────────────────────────────────── */}
              <section>
                <SectionLabel>Sort by</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { setSort(o.value); commitFilters({ sort: o.value }) }}
                      className="text-sm font-medium px-4 py-3 rounded-2xl text-left transition-all f-body"
                      style={{
                        background: sort === o.value ? '#0A2E4D' : 'rgba(10,46,77,0.05)',
                        color:      sort === o.value ? 'white'   : 'rgba(10,46,77,0.65)',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Duration ────────────────────────────────────────────── */}
              <section>
                <SectionLabel>Trip duration</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { setDuration(o.value); commitFilters({ duration: o.value }) }}
                      className="flex flex-col items-start px-4 py-3 rounded-2xl text-left transition-all f-body"
                      style={{
                        background: duration === o.value ? '#0A2E4D' : 'rgba(10,46,77,0.05)',
                        color:      duration === o.value ? 'white'   : 'rgba(10,46,77,0.65)',
                      }}
                    >
                      <span className="text-sm font-semibold leading-tight">{o.label}</span>
                      {o.desc && (
                        <span
                          className="text-[11px] mt-0.5 leading-tight"
                          style={{ opacity: duration === o.value ? 0.65 : 0.5 }}
                        >
                          {o.desc}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Price per person ─────────────────────────────────────── */}
              <section>
                <SectionLabel>Price per person</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {PRICE_OPTIONS.map(o => (
                    <Pill
                      key={o.key}
                      label={o.label}
                      active={price === o.key}
                      onClick={() => { setPrice(o.key); commitFilters({ price: o.key }) }}
                      variant="orange"
                    />
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Technique ────────────────────────────────────────────── */}
              <section>
                <SectionLabel>Fishing technique</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {TECHNIQUE_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        const newTech = technique === t ? '' : t
                        setTechnique(newTech)
                        commitFilters({ technique: newTech })
                      }}
                      className="text-sm font-medium px-4 py-2 rounded-full transition-all f-body"
                      style={{
                        background: technique === t ? 'rgba(230,126,80,0.14)' : 'rgba(10,46,77,0.05)',
                        color:      technique === t ? '#9E4820'               : 'rgba(10,46,77,0.65)',
                        border:     `1.5px solid ${technique === t ? 'rgba(230,126,80,0.3)' : 'transparent'}`,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Skill level ──────────────────────────────────────────── */}
              <section>
                <SectionLabel>Skill level</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map(d => (
                    <Pill
                      key={d.value}
                      label={d.label}
                      active={difficulty === d.value}
                      onClick={() => { setDifficulty(d.value); commitFilters({ difficulty: d.value }) }}
                      variant="blue"
                    />
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Group size ───────────────────────────────────────────── */}
              <section>
                <SectionLabel>Group size</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {GUESTS_OPTIONS.map(o => (
                    <Pill
                      key={o.value}
                      label={o.label}
                      active={guests === o.value}
                      onClick={() => { setGuests(o.value); commitFilters({ guests: o.value }) }}
                      variant="blue"
                    />
                  ))}
                </div>
              </section>

              <Divider />

              {/* ── Catch & Release toggle ───────────────────────────────── */}
              <section>
                <SectionLabel>Conservation</SectionLabel>
                <button
                  onClick={() => {
                    const newCR = !catchRelease
                    setCatchRelease(newCR)
                    commitFilters({ catchRelease: newCR })
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all f-body"
                  style={{
                    background: catchRelease ? 'rgba(10,46,77,0.06)' : 'rgba(10,46,77,0.04)',
                    border: `1.5px solid ${catchRelease ? '#0A2E4D' : 'transparent'}`,
                  }}
                >
                  {/* Toggle pill */}
                  <div
                    className="relative flex-shrink-0 transition-all"
                    style={{
                      width: '44px', height: '26px',
                      borderRadius: '13px',
                      background: catchRelease ? '#0A2E4D' : 'rgba(10,46,77,0.15)',
                    }}
                  >
                    <div
                      className="absolute top-[3px] transition-all"
                      style={{
                        width: '20px', height: '20px',
                        borderRadius: '50%',
                        background: 'white',
                        left: catchRelease ? '21px' : '3px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      Catch &amp; Release only
                    </p>
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Show only eco-friendly, no-kill trips
                    </p>
                  </div>
                </button>
              </section>

            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-7 py-5 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
            >
              <button
                onClick={handleClearAll}
                className="text-sm font-semibold f-body underline decoration-dotted transition-opacity hover:opacity-60"
                style={{ color: 'rgba(10,46,77,0.5)' }}
                disabled={!hasLocalChanges}
              >
                Clear all
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white text-sm font-bold px-7 py-3 rounded-full transition-all hover:brightness-110 active:scale-[0.97] f-body"
                style={{ background: '#E67E50' }}
              >
                Done
              </button>
            </div>
          </div>
        </>,
        document.body,
      )
    : null

  return (
    <>
      {/* Trigger button — icon only */}
      <button
        onClick={handleOpen}
        className="flex-shrink-0 relative flex items-center justify-center rounded-2xl transition-all active:scale-[0.97]"
        style={{
          width:      '44px',
          height:     '52px',
          background: urlActiveCount > 0 ? 'rgba(230,126,80,0.15)' : 'rgba(10,46,77,0.08)',
          color:      urlActiveCount > 0 ? '#9E4820' : 'rgba(10,46,77,0.75)',
        }}
        aria-label="Filters"
      >
        <SlidersHorizontal size={17} strokeWidth={1.5} />
        {urlActiveCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: '#E67E50', color: 'white', width: '15px', height: '15px' }}
          >
            {urlActiveCount}
          </span>
        )}
      </button>

      {modal}
    </>
  )
}
