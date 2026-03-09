'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'

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

const SORT_OPTIONS = [
  { value: '',              label: 'Recommended'       },
  { value: 'price-asc',    label: 'Price: Low → High' },
  { value: 'price-desc',   label: 'Price: High → Low' },
  { value: 'duration-asc', label: 'Shortest first'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlToPriceKey(min: string, max: string): PriceKey {
  if (!min && max === '150') return 'u150'
  if (min === '150' && max === '300') return '150-300'
  if (min === '300' && max === '500') return '300-500'
  if (min === '500' && !max) return '500p'
  return ''
}

function Pill({
  label, active, onClick, variant = 'blue',
}: {
  label: string; active: boolean; onClick: () => void; variant?: 'blue' | 'orange'
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-semibold px-4 py-2.5 rounded-full transition-all f-body whitespace-nowrap"
      style={{
        background: active ? (variant === 'orange' ? '#E67E50' : '#0A2E4D') : 'rgba(10,46,77,0.05)',
        color: active ? 'white' : 'rgba(10,46,77,0.65)',
        boxShadow: active
          ? variant === 'orange' ? '0 2px 8px rgba(230,126,80,0.35)' : '0 2px 8px rgba(10,46,77,0.22)'
          : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FiltersModal() {
  const [open,   setOpen]   = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const sp     = useSearchParams()

  // Track client mount for portal safety
  useEffect(() => { setMounted(true) }, [])

  // Local filter state — synced from URL when modal opens
  const [difficulty, setDifficulty] = useState<string>('')
  const [price,      setPrice]      = useState<PriceKey>('')
  const [sort,       setSort]       = useState<string>('')

  function handleOpen() {
    setDifficulty(sp.get('difficulty') ?? '')
    setPrice(urlToPriceKey(sp.get('minPrice') ?? '', sp.get('maxPrice') ?? ''))
    setSort(sp.get('sort') ?? '')
    setOpen(true)
  }

  function applyFilters() {
    const p      = new URLSearchParams(sp.toString())
    const preset = PRICE_OPTIONS.find(o => o.key === price)
    if (difficulty)  p.set('difficulty', difficulty); else p.delete('difficulty')
    if (preset?.min) p.set('minPrice', preset.min);   else p.delete('minPrice')
    if (preset?.max) p.set('maxPrice', preset.max);   else p.delete('maxPrice')
    if (sort)        p.set('sort', sort);              else p.delete('sort')
    router.push(`/experiences?${p.toString()}`)
    setOpen(false)
  }

  function handleClearAll() {
    setDifficulty('')
    setPrice('')
    setSort('')
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

  const urlActiveCount = [
    sp.get('difficulty'),
    sp.get('minPrice') || sp.get('maxPrice') ? '1' : '',
    sp.get('sort'),
  ].filter(Boolean).length

  const hasLocalChanges = difficulty !== '' || price !== '' || sort !== ''

  // ── Modal DOM — rendered via portal directly on document.body ──────────────
  // This bypasses the nav's backdrop-filter stacking context which would
  // otherwise trap fixed-position children inside it.
  const modal = mounted && open
    ? createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            style={{
              position: 'fixed',
              zIndex: 9999,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '540px',
              maxHeight: '85vh',
              background: '#FDFAF7',
              borderRadius: '28px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.32)',
              display: 'flex',
              flexDirection: 'column',
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
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div
              className="flex-1 overflow-y-auto px-7 py-7"
              style={{ scrollbarWidth: 'none' } as React.CSSProperties}
            >
              {/* Sort */}
              <section className="mb-8">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Sort by
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setSort(o.value)}
                      className="text-sm font-medium px-4 py-3 rounded-2xl text-left transition-all f-body"
                      style={{
                        background: sort === o.value ? '#0A2E4D' : 'rgba(10,46,77,0.05)',
                        color: sort === o.value ? 'white' : 'rgba(10,46,77,0.65)',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>

              <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '28px' }} />

              {/* Price */}
              <section className="mb-8">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Price per person
                </h3>
                <div className="flex flex-wrap gap-2">
                  {PRICE_OPTIONS.map(o => (
                    <Pill key={o.key} label={o.label} active={price === o.key} onClick={() => setPrice(o.key)} variant="orange" />
                  ))}
                </div>
              </section>

              <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)', marginBottom: '28px' }} />

              {/* Difficulty */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Skill Level
                </h3>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map(d => (
                    <Pill key={d.value} label={d.label} active={difficulty === d.value} onClick={() => setDifficulty(d.value)} variant="blue" />
                  ))}
                </div>
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
                onClick={applyFilters}
                className="text-white text-sm font-bold px-7 py-3 rounded-full transition-all hover:brightness-110 active:scale-[0.97] f-body"
                style={{ background: '#E67E50' }}
              >
                Show results →
              </button>
            </div>
          </div>
        </>,
        document.body,
      )
    : null

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-full transition-all hover:bg-white/[0.18] active:scale-[0.97] f-body"
        style={{
          height: '44px',
          padding: '0 18px',
          background: urlActiveCount > 0 ? 'rgba(230,126,80,0.18)' : 'rgba(255,255,255,0.1)',
          border: `1.5px solid ${urlActiveCount > 0 ? '#E67E50' : 'rgba(255,255,255,0.22)'}`,
          color: 'white',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
          <path d="M1 2.5h3M8 2.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 6.5h5M10 6.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 10.5h2M7 10.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="4.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Filters
        {urlActiveCount > 0 && (
          <span
            className="flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: '#E67E50', color: 'white', width: '18px', height: '18px', flexShrink: 0 }}
          >
            {urlActiveCount}
          </span>
        )}
      </button>

      {/* Portal renders on document.body — outside nav stacking context */}
      {modal}
    </>
  )
}
