'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ExperienceWithGuide, LocationSpot } from '@/types'
import { cardThumb } from '@/lib/image'
import { CountryFlag } from '@/components/ui/country-flag'
import MapWrapper from './map-wrapper'
import { Menu, MapPin } from 'lucide-react'
import { fetchGeoExperiences } from './geo-action'

export type MapBounds = { north: number; south: number; east: number; west: number }

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}
const MONTHS: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

// ─── Bounds helpers ───────────────────────────────────────────────────────────

function isInBounds(exp: ExperienceWithGuide, b: MapBounds): boolean {
  if (exp.location_lat != null && exp.location_lng != null) {
    if (
      exp.location_lat >= b.south && exp.location_lat <= b.north &&
      exp.location_lng >= b.west  && exp.location_lng <= b.east
    ) return true
  }
  const spots = (exp.location_spots as unknown as LocationSpot[] | null) ?? []
  return spots.some(
    s => s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east,
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initialExperiences: ExperienceWithGuide[]
  initialTotal: number
  paginationNode: React.ReactNode
  filterKey: string
}

// ─── Compact card used in the mobile bottom-sheet horizontal strip ─────────

function SheetCard({
  exp,
  selected,
  onClick,
}: {
  exp: ExperienceWithGuide
  selected: boolean
  onClick: () => void
}) {
  const coverUrl = cardThumb(exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null)
  const [hovered, setHovered] = useState(false)
  const active = selected || hovered

  return (
    <Link
      href={`/trips/${exp.id}`}
      onClick={onClick}
      className="group flex-shrink-0 text-left transition-transform duration-200 active:scale-[0.98]"
      style={{ width: '248px' }}
      aria-label={exp.title}
    >
      <div
        className="overflow-hidden transition-all duration-200 group-hover:-translate-y-1"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: '16px',
          background: '#FDFAF7',
          border: active ? '2px solid #E67E50' : '1px solid rgba(10,46,77,0.09)',
          boxShadow: active
            ? '0 8px 28px rgba(230,126,80,0.30)'
            : '0 2px 12px rgba(10,46,77,0.07)',
        }}
      >
        {/* Image */}
        <div className="relative overflow-hidden" style={{ height: '130px' }}>
          {coverUrl != null ? (
            <Image
              src={coverUrl}
              alt={exp.title}
              fill
              sizes="248px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
          )}
          {/* Price badge */}
          <div
            className="absolute bottom-2.5 left-2.5 text-xs font-bold px-2.5 py-1 rounded-full f-body"
            style={{ background: 'rgba(5,12,22,0.72)', color: '#fff', backdropFilter: 'blur(8px)' }}
          >
            {exp.booking_type === 'icelandic'
              ? 'Custom'
              : `€${exp.price_per_person_eur}/pp`
            }
          </div>
        </div>

        {/* Info */}
        <div className="px-3.5 py-3">
          <p
            className="font-semibold text-[13px] leading-snug line-clamp-1 f-body mb-0.5"
            style={{ color: '#0A2E4D' }}
          >
            {exp.title}
          </p>
          <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            <CountryFlag country={exp.location_country} />
            {exp.location_city != null ? ` ${exp.location_city},` : ''} {exp.location_country}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}
            >
              {exp.guide.avatar_url != null ? (
                <Image src={exp.guide.avatar_url} alt={exp.guide.full_name} width={20} height={20} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: '#0A2E4D' }}>
                  {exp.guide.full_name[0]}
                </div>
              )}
            </div>
            <p className="text-[11px] f-body line-clamp-1" style={{ color: 'rgba(10,46,77,0.55)' }}>
              {exp.guide.full_name}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapSection({
  initialExperiences,
  initialTotal,
  paginationNode,
  filterKey,
}: Props) {
  const [bounds, setBounds]             = useState<MapBounds | null>(null)
  const [isDesktop, setIsDesktop]       = useState(false)
  const [mobileView, setMobileView]     = useState<'list' | 'map'>('list')
  const [hoveredExpId, setHoveredExpId] = useState<string | null>(null)
  const sheetScrollRef                  = useRef<HTMLDivElement>(null)

  // ── Lazy geo data ──────────────────────────────────────────────────────────
  const [geoExperiences, setGeoExperiences] = useState<ExperienceWithGuide[]>([])
  const [geoLoading, setGeoLoading]         = useState(false)
  const geoLoadedForKey                     = useRef<string | null>(null)

  // Shuffle geo data once when it arrives (stable reference via useMemo)
  const shuffledGeoExperiences = useMemo(() => {
    if (geoExperiences.length === 0) return []
    const arr = [...geoExperiences]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [geoExperiences])

  const loadGeoData = useCallback(async () => {
    if (geoLoadedForKey.current === filterKey) return  // already loaded for this filter
    geoLoadedForKey.current = filterKey                // prevent double-fetch
    setGeoLoading(true)
    try {
      const data = await fetchGeoExperiences(filterKey)
      setGeoExperiences(data)
    } catch (err) {
      console.error('[MapSection] geo fetch failed:', err)
      geoLoadedForKey.current = null  // allow retry
    } finally {
      setGeoLoading(false)
    }
  }, [filterKey])

  // ── Detect desktop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const desktop = window.innerWidth >= 1024
    setIsDesktop(desktop)
    // Desktop: load geo data immediately on mount (non-blocking — page already rendered)
    if (desktop) void loadGeoData()
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount; loadGeoData is stable for initial filterKey

  // ── Reset on filter change ─────────────────────────────────────────────────
  const prevFilterKey = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    setBounds(null)
    // Reset geo data so the new filter's data loads fresh
    setGeoExperiences([])
    geoLoadedForKey.current = null
    // Re-fetch immediately if the map is visible
    if (isDesktop || mobileView === 'map') void loadGeoData()
  }, [filterKey, isDesktop, mobileView, loadGeoData])

  // ── Clear bounds when switching to mobile list ─────────────────────────────
  useEffect(() => {
    if (!isDesktop && mobileView === 'list') setBounds(null)
  }, [isDesktop, mobileView])

  const hasServerFilters = filterKey !== ''

  const countries = useMemo(() => {
    const sp = new URLSearchParams(filterKey)
    return sp.get('country')?.split(',').filter(Boolean) ?? []
  }, [filterKey])

  // While geo data loads, fall back to the paginated 12 for map pins
  const mapPinExps = geoExperiences.length > 0 ? shuffledGeoExperiences : initialExperiences

  const useViewportFilter = bounds != null && !hasServerFilters && (isDesktop || mobileView === 'map') && geoExperiences.length > 0

  const visibleExperiences = useViewportFilter
    ? shuffledGeoExperiences.filter(exp => isInBounds(exp, bounds!))
    : initialExperiences

  const visibleCount = useViewportFilter ? visibleExperiences.length : initialTotal
  const isFiltered   = useViewportFilter

  const handlePinClick = useCallback((id: string) => {
    setHoveredExpId(prev => prev === id ? null : id)
    if (!isDesktop && sheetScrollRef.current) {
      const idx = visibleExperiences.findIndex(e => e.id === id)
      if (idx >= 0) {
        const CARD_W = 248 + 12
        sheetScrollRef.current.scrollTo({ left: idx * CARD_W, behavior: 'smooth' })
      }
    }
  }, [isDesktop, visibleExperiences])

  // ─── DESKTOP layout ─────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <div className="flex lg:h-[calc(100vh-72px)]">

        <main
          className="w-full lg:w-1/2 lg:overflow-y-auto px-4 sm:px-8 lg:px-14 py-7"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-5">
            <p className="text-xs font-medium f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
              <span className="font-bold" style={{ color: '#0A2E4D' }}>{visibleCount}</span>
              {isFiltered ? ' in this area' : ` trip${visibleCount !== 1 ? 's' : ''} found`}
            </p>
            {isFiltered && (
              <button
                onClick={() => setBounds(null)}
                className="text-[11px] font-semibold f-body px-2.5 py-0.5 rounded-full transition-opacity hover:opacity-70"
                style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
              >
                Clear map filter ✕
              </button>
            )}
          </div>

          {visibleExperiences.length === 0 ? (
            <EmptyState isFiltered={isFiltered} onClear={() => setBounds(null)} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {visibleExperiences.map((exp, idx) => (
                  <DesktopCard
                    key={exp.id}
                    exp={exp}
                    hovered={hoveredExpId === exp.id}
                    onMouseEnter={() => setHoveredExpId(exp.id)}
                    onMouseLeave={() => setHoveredExpId(null)}
                    priority={idx < 4}
                  />
                ))}
              </div>
              {!isFiltered && paginationNode}
            </>
          )}
        </main>

        <aside className="flex-shrink-0 lg:w-1/2" style={{ padding: '12px 16px 12px 0' }}>
          <div className="w-full h-full overflow-hidden" style={{ borderRadius: '20px' }}>
            <MapWrapper
              experiences={mapPinExps}
              onBoundsChange={setBounds}
              hoveredExpId={hoveredExpId}
              onPinClick={handlePinClick}
              countries={countries}
            />
          </div>
        </aside>

      </div>
    )
  }

  // ─── MOBILE MAP view ────────────────────────────────────────────────────────

  if (mobileView === 'map') {
    const SHEET_H = 290

    return (
      <div
        className="relative overflow-hidden"
        style={{ height: 'calc(100dvh - var(--nav-h, 120px))' }}
      >
        {/* Full-screen map */}
        <div className="absolute inset-0" style={{ bottom: `${SHEET_H}px` }}>
          <MapWrapper
            experiences={mapPinExps}
            onBoundsChange={setBounds}
            hoveredExpId={hoveredExpId}
            onPinClick={handlePinClick}
            showPopups={false}
            countries={countries}
          />
        </div>

        {/* "Show list" pill */}
        <button
          onClick={() => setMobileView('list')}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-full f-body"
          style={{
            background: '#fff',
            color: '#0A2E4D',
            boxShadow: '0 2px 16px rgba(10,46,77,0.18)',
          }}
        >
          <Menu size={14} aria-hidden="true" />
          Show list
        </button>

        {/* Bottom sheet */}
        <div
          className="absolute inset-x-0 bottom-0 z-[400]"
          style={{
            height: `${SHEET_H}px`,
            borderRadius: '20px 20px 0 0',
            background: '#F3EDE4',
            boxShadow: '0 -4px 24px rgba(10,46,77,0.12)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-[5px] rounded-full" style={{ background: 'rgba(10,46,77,0.14)' }} />
          </div>

          {/* Count */}
          <div className="flex items-center gap-2 px-5 mb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {isFiltered
                ? <><span style={{ color: '#0A2E4D' }}>{visibleCount}</span> in this area</>
                : <>{initialTotal} trip{initialTotal !== 1 ? 's' : ''}</>
              }
            </p>
            {isFiltered && (
              <button
                onClick={() => setBounds(null)}
                className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
              >
                Clear ✕
              </button>
            )}
            {geoLoading && (
              <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                Loading all pins…
              </span>
            )}
          </div>

          {/* Horizontal scrollable cards */}
          <div
            ref={sheetScrollRef}
            className="flex gap-3 overflow-x-auto"
            style={{
              paddingLeft: '20px',
              paddingRight: '20px',
              paddingBottom: '20px',
              scrollbarWidth: 'none',
            } as React.CSSProperties}
          >
            {visibleExperiences.length === 0 ? (
              <div className="flex items-center justify-center w-full py-6">
                <p className="text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  No trips in this area — pan or zoom
                </p>
              </div>
            ) : (
              visibleExperiences.map(exp => (
                <SheetCard
                  key={exp.id}
                  exp={exp}
                  selected={hoveredExpId === exp.id}
                  onClick={() => handlePinClick(exp.id)}
                />
              ))
            )}

            {!isFiltered && initialTotal > initialExperiences.length && (
              <Link
                href="/trips"
                className="flex-shrink-0 flex items-center justify-center text-sm font-semibold f-body rounded-2xl"
                style={{
                  width: '120px',
                  background: 'rgba(10,46,77,0.06)',
                  color: 'rgba(10,46,77,0.55)',
                  border: '1px solid rgba(10,46,77,0.08)',
                }}
              >
                +{initialTotal - initialExperiences.length} more →
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MOBILE LIST view ────────────────────────────────────────────────────────

  return (
    <main className="px-4 sm:px-6 py-6 pb-28">

      <p className="text-xs font-medium f-body mb-5" style={{ color: 'rgba(10,46,77,0.6)' }}>
        <span className="font-bold" style={{ color: '#0A2E4D' }}>{initialTotal}</span>
        {' '}trip{initialTotal !== 1 ? 's' : ''} found
      </p>

      {initialExperiences.length === 0 ? (
        <EmptyState isFiltered={false} onClear={() => {}} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {initialExperiences.map((exp, idx) => (
              <DesktopCard
                key={exp.id}
                exp={exp}
                hovered={false}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                priority={idx < 4}
              />
            ))}
          </div>
          {paginationNode}
        </>
      )}

      {/* Floating "Map" FAB */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]">
        <button
          onClick={() => {
            setMobileView('map')
            void loadGeoData()
          }}
          className="flex items-center gap-2 text-[14px] font-semibold px-6 py-3.5 rounded-full f-body"
          style={{
            background: '#0A2E4D',
            color: '#fff',
            boxShadow: '0 6px 28px rgba(10,46,77,0.38)',
          }}
        >
          <MapPin size={16} aria-hidden="true" />
          Map
        </button>
      </div>

    </main>
  )
}

// ─── SHARED sub-components ────────────────────────────────────────────────────

function EmptyState({ isFiltered, onClear }: { isFiltered: boolean; onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        borderRadius: '20px',
        background: '#FDFAF7',
        border: '1px solid rgba(10,46,77,0.07)',
        minHeight: '340px',
      }}
    >
      <p
        className="font-bold f-display mb-3 text-center"
        style={{ fontSize: '44px', color: 'rgba(10,46,77,0.05)', fontStyle: 'italic' }}
      >
        No trips found
      </p>
      <p className="text-sm mb-6 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
        {isFiltered ? 'Pan or zoom the map to find trips.' : 'Try broadening your search.'}
      </p>
      {isFiltered ? (
        <button
          onClick={onClear}
          className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          Clear map filter
        </button>
      ) : (
        <Link
          href="/trips"
          className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          Clear all filters
        </Link>
      )}
    </div>
  )
}

function DesktopCard({
  exp,
  hovered,
  onMouseEnter,
  onMouseLeave,
  priority = false,
}: {
  exp: ExperienceWithGuide
  hovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  priority?: boolean
}) {
  const coverUrl = cardThumb(exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null)
  const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
  const hasSeason = exp.season_from != null && exp.season_to != null
  const duration  =
    exp.duration_hours != null ? `${exp.duration_hours}h`
    : exp.duration_days != null ? `${exp.duration_days} days`
    : null

  return (
    <Link
      href={`/trips/${exp.id}`}
      className="group block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <article
        className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
        style={{ borderRadius: '16px' }}
      >
        {/* Photo */}
        <div
          className="relative overflow-hidden"
          style={{ height: '200px', borderRadius: '12px', background: '#EDE6DB' }}
        >
          {coverUrl != null && (
            <Image
              src={coverUrl}
              alt={exp.title}
              fill
              sizes="(min-width: 1280px) 560px, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {diffLabel != null && (
              <div
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', color: '#0A2E4D' }}
              >
                {diffLabel}
              </div>
            )}
            {hasSeason && (
              <div
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(10,46,77,0.65)', backdropFilter: 'blur(8px)', color: '#fff' }}
              >
                {MONTHS[exp.season_from!]} – {MONTHS[exp.season_to!]}
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 hidden md:flex justify-center pb-3 opacity-0 translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
            <span
              className="text-[12px] font-semibold f-body px-4 py-1.5 rounded-full"
              style={{ background: '#E67E50', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
            >
              View trip →
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="pt-3 px-0.5">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="font-semibold leading-snug line-clamp-1 f-body" style={{ fontSize: '14px', color: '#0A2E4D' }}>
              {exp.title}
            </h3>
          </div>

          <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
            <CountryFlag country={exp.location_country} />
            {exp.location_city != null ? ` ${exp.location_city},` : ''} {exp.location_country}
          </p>

          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}>
              {exp.guide.avatar_url != null ? (
                <Image src={exp.guide.avatar_url} alt={exp.guide.full_name} width={28} height={28} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold f-body" style={{ background: '#0A2E4D' }}>
                  {exp.guide.full_name[0]}
                </div>
              )}
            </div>
            <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {exp.guide.full_name}
            </p>
          </div>

          {duration != null && (
            <p className="text-[12px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.65)' }}>{duration}</p>
          )}

          <div className="flex items-center justify-between mt-1">
            {exp.booking_type === 'icelandic' ? (
              <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.45)', fontStyle: 'italic' }}>
                Custom — price on request
              </p>
            ) : (
              <p className="text-[13px] f-body" style={{ color: '#0A2E4D' }}>
                <span className="font-semibold">€{exp.price_per_person_eur}</span>
                <span style={{ color: 'rgba(10,46,77,0.65)' }}> /pp</span>
              </p>
            )}

            {/* CTA — always visible on mobile, hidden on desktop (desktop uses hover overlay) */}
            <span
              className="md:hidden flex-shrink-0 text-[12px] font-semibold f-body px-3.5 py-1.5 rounded-full"
              style={{ background: '#E67E50', color: '#fff' }}
            >
              {exp.booking_type === 'icelandic' ? 'Enquire →' : 'View trip →'}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
