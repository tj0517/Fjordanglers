'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Menu } from 'lucide-react'
import { CountryFlag } from '@/components/ui/country-flag'
import ExpPageMapWrapper from './exp-page-map-wrapper'
import { fetchGeoExpPages } from './exp-page-geo-action'
import type { MapBounds } from './exp-page-map-view'

// ─── Shared type ──────────────────────────────────────────────────────────────

export type ExpPage = {
  id: string
  slug: string
  experience_name: string
  country: string
  region: string
  price_from: number
  price_type: string
  hero_image_url: string | null
  gallery_image_urls: unknown
  difficulty: string | null
  technique: unknown
  target_species: unknown
  non_angler_friendly: boolean | null
  location_lat: number | null
  location_lng: number | null
  location_area: unknown   // GeoJSON.Polygon | null
  location_spots: unknown  // LocationSpot[] | null
}

function formatPrice(priceFrom: number, priceType: string): string {
  if (priceType === 'request') return 'Price on request'
  if (priceType === 'flat') return `from €${priceFrom} for the group`
  return `from €${priceFrom} / person`
}

// ─── Difficulty colours ───────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
  Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
  Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
  Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
}

// ─── Bounds helper ────────────────────────────────────────────────────────────

function isInBounds(page: ExpPage, b: MapBounds): boolean {
  // Primary pin
  if (page.location_lat != null && page.location_lng != null) {
    if (
      page.location_lat >= b.south && page.location_lat <= b.north &&
      page.location_lng >= b.west  && page.location_lng <= b.east
    ) return true
  }
  // Area polygon vertices
  const area = page.location_area as import('geojson').Polygon | null
  if (area?.coordinates?.[0]) {
    if (area.coordinates[0].some(([lng, lat]) =>
      lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east
    )) return true
  }
  // Named spots
  const spots = page.location_spots as Array<{ lat: number; lng: number }> | null
  if (spots) {
    if (spots.some(s => s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east)) return true
  }
  return false
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialPages: ExpPage[]
  initialTotal: number
  paginationNode: React.ReactNode
  filterKey: string
}

// ─── Mobile bottom-sheet compact card ─────────────────────────────────────────

function SheetCard({
  page,
  selected,
  onClick,
}: {
  page: ExpPage
  selected: boolean
  onClick: () => void
}) {
  const gallery = (page.gallery_image_urls as string[] | null) ?? []
  const coverUrl = gallery[0] ?? page.hero_image_url
  const [hovered, setHovered] = useState(false)
  const active = selected || hovered

  return (
    <Link
      href={`/experiences/${page.slug}`}
      onClick={onClick}
      className="group flex-shrink-0 text-left transition-transform duration-200 active:scale-[0.98]"
      style={{ width: 'min(248px, 80vw)' }}
      aria-label={page.experience_name}
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
              alt={page.experience_name}
              fill
              sizes="248px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
          )}
        </div>

        {/* Info */}
        <div className="px-3.5 pt-3 pb-3.5">
          <p
            className="font-semibold text-[13px] leading-snug line-clamp-1 f-body mb-1"
            style={{ color: '#0A2E4D' }}
          >
            {page.experience_name}
          </p>

          {/* Location — one line */}
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="flex-shrink-0"><CountryFlag country={page.country} size={12} /></span>
            <p className="text-[11px] f-body truncate min-w-0" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {page.region}, {page.country}
            </p>
          </div>

          {/* Price */}
          <div className="flex items-center mt-2.5">
            <span className="text-[13px] font-bold f-display" style={{ color: '#0A2E4D' }}>
              {formatPrice(page.price_from, page.price_type)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Full listing card ────────────────────────────────────────────────────────

function ExpCard({
  page,
  priority = false,
  hovered = false,
  onMouseEnter,
  onMouseLeave,
}: {
  page: ExpPage
  priority?: boolean
  hovered?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const gallery   = (page.gallery_image_urls as string[] | null) ?? []
  const coverUrl  = gallery[0] ?? page.hero_image_url
  const dc = page.difficulty ? (DIFFICULTY_COLOR[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }) : null

  return (
    <Link
      href={`/experiences/${page.slug}`}
      className="block group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <article
        className="transition-all duration-200 group-hover:-translate-y-0.5"
        style={{ borderRadius: '20px' }}
      >
        {/* ── Image ─────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{ height: '240px', borderRadius: '16px', background: '#EDE6DB' }}
        >
          {coverUrl != null && (
            <Image
              src={coverUrl}
              alt={page.experience_name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {dc != null && page.difficulty && (
              <div
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(8px)', color: '#0A2E4D' }}
              >
                {page.difficulty}
              </div>
            )}
            {page.non_angler_friendly && (
              <div
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(74,222,128,0.85)', backdropFilter: 'blur(8px)', color: '#fff' }}
              >
                Family-friendly
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
            <span
              className="text-[13px] font-bold px-3.5 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(5,12,22,0.72)', color: '#fff', backdropFilter: 'blur(8px)' }}
            >
              {formatPrice(page.price_from, page.price_type)}
            </span>
          </div>
        </div>

        {/* ── Text info ─────────────────────────────────────────── */}
        <div className="pt-3 px-0.5 pb-3">

          <h3
            className="font-semibold leading-snug f-body line-clamp-2"
            style={{ fontSize: '15px', color: '#0A2E4D' }}
          >
            {page.experience_name}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(10,46,77,0.07)' }}>
            <MapPin size={10} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.45)', flexShrink: 0 }} />
            <p className="text-[11px] font-medium f-body truncate min-w-0" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {page.region}, {page.country}
            </p>
            <span className="flex-shrink-0"><CountryFlag country={page.country} /></span>
          </div>

        </div>
      </article>
    </Link>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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
        No experiences found
      </p>
      <p className="text-sm mb-6 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
        {isFiltered ? 'Pan or zoom the map to find experiences.' : 'Check back soon — new trips are added regularly.'}
      </p>
      {isFiltered && (
        <button
          onClick={onClear}
          className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          Clear map filter
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpPageMapSection({
  initialPages,
  initialTotal,
  paginationNode,
  filterKey,
}: Props) {
  const [bounds, setBounds]             = useState<MapBounds | null>(null)
  const [isDesktop, setIsDesktop]       = useState(false)
  const [mobileView, setMobileView]     = useState<'list' | 'map'>('list')
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null)
  const sheetScrollRef                  = useRef<HTMLDivElement>(null)

  // ── Lazy geo data ──────────────────────────────────────────────────────────
  const [geoPages, setGeoPages]       = useState<ExpPage[]>([])
  const [geoLoading, setGeoLoading]   = useState(false)
  const geoLoadedForKey               = useRef<string | null>(null)

  // Shuffle geo data once when it arrives
  const shuffledGeoPages = useMemo(() => {
    if (geoPages.length === 0) return []
    const arr = [...geoPages]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [geoPages])

  const loadGeoData = useCallback(async () => {
    if (geoLoadedForKey.current === filterKey) return
    geoLoadedForKey.current = filterKey
    setGeoLoading(true)
    try {
      const data = await fetchGeoExpPages()
      setGeoPages(data)
    } catch (err) {
      console.error('[ExpPageMapSection] geo fetch failed:', err)
      geoLoadedForKey.current = null
    } finally {
      setGeoLoading(false)
    }
  }, [filterKey])

  // ── Detect desktop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const desktop = window.innerWidth >= 768
    setIsDesktop(desktop)
    if (desktop) void loadGeoData()
    const check = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset on filter change ─────────────────────────────────────────────────
  const prevFilterKey = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return
    prevFilterKey.current = filterKey
    setBounds(null)
    setGeoPages([])
    geoLoadedForKey.current = null
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

  const mapPinPages = geoPages.length > 0 ? shuffledGeoPages : initialPages.filter(p => p.location_lat != null)
  const useViewportFilter = bounds != null && !hasServerFilters && (isDesktop || mobileView === 'map') && geoPages.length > 0

  const visiblePages = useViewportFilter
    ? shuffledGeoPages.filter(p => isInBounds(p, bounds!))
    : initialPages

  const visibleCount = useViewportFilter ? visiblePages.length : initialTotal
  const isFiltered   = useViewportFilter

  const handlePinClick = useCallback((id: string) => {
    setHoveredPageId(prev => prev === id ? null : id)
    if (!isDesktop && sheetScrollRef.current) {
      const idx = visiblePages.findIndex(p => p.id === id)
      if (idx >= 0) {
        const CARD_W = Math.min(248, Math.round(window.innerWidth * 0.8)) + 12
        sheetScrollRef.current.scrollTo({ left: idx * CARD_W, behavior: 'smooth' })
      }
    }
  }, [isDesktop, visiblePages])

  // ─── DESKTOP layout ─────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <>
        <div className="flex items-start">

          <main
            className="w-full md:w-1/2 px-4 sm:px-8 lg:px-14 py-7"
            style={{ minHeight: 'calc(100dvh - 72px)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <p className="text-xs font-medium f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                <span className="font-bold" style={{ color: '#0A2E4D' }}>{visibleCount}</span>
                {isFiltered ? ' in this area' : ` experience${visibleCount !== 1 ? 's' : ''} found`}
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

            {visiblePages.length === 0 ? (
              <EmptyState isFiltered={isFiltered} onClear={() => setBounds(null)} />
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {visiblePages.map((page, idx) => (
                    <ExpCard
                      key={page.id}
                      page={page}
                      hovered={hoveredPageId === page.id}
                      onMouseEnter={() => setHoveredPageId(page.id)}
                      onMouseLeave={() => setHoveredPageId(null)}
                      priority={idx < 4}
                    />
                  ))}
                </div>
                {!isFiltered && paginationNode}
              </>
            )}
          </main>

          <aside
            className="hidden md:block flex-shrink-0 md:w-1/2"
            style={{
              position: 'sticky',
              top: '72px',
              height: 'calc(100dvh - 72px)',
              padding: '12px 16px 12px 0',
            }}
          >
            <div className="w-full h-full overflow-hidden" style={{ borderRadius: '20px', isolation: 'isolate' }}>
              <ExpPageMapWrapper
                pages={mapPinPages}
                onBoundsChange={setBounds}
                hoveredPageId={hoveredPageId}
                onPinClick={handlePinClick}
                countries={countries}
              />
            </div>
          </aside>

        </div>

      </>
    )
  }

  // ─── MOBILE MAP view ─────────────────────────────────────────────────────────

  if (mobileView === 'map') {
    const SHEET_H = Math.min(290, Math.round(window.innerHeight * 0.45))

    return (
      <div
        className="relative overflow-hidden"
        style={{ height: 'calc(100dvh - var(--nav-h, 120px))', isolation: 'isolate' }}
      >
        <div className="absolute inset-0" style={{ bottom: `${SHEET_H}px` }}>
          <ExpPageMapWrapper
            pages={mapPinPages}
            onBoundsChange={setBounds}
            hoveredPageId={hoveredPageId}
            onPinClick={handlePinClick}
            showPopups={false}
            countries={countries}
          />
        </div>

        {/* "Show list" pill */}
        <button
          onClick={() => setMobileView('list')}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-full f-body"
          style={{ background: '#fff', color: '#0A2E4D', boxShadow: '0 2px 16px rgba(10,46,77,0.18)' }}
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
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-[5px] rounded-full" style={{ background: 'rgba(10,46,77,0.14)' }} />
          </div>

          <div className="flex items-center gap-2 px-5 mb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {isFiltered
                ? <><span style={{ color: '#0A2E4D' }}>{visibleCount}</span> in this area</>
                : <>{initialTotal} experience{initialTotal !== 1 ? 's' : ''}</>
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

          <div
            ref={sheetScrollRef}
            className="flex gap-3 overflow-x-auto"
            style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '20px', scrollbarWidth: 'none' } as React.CSSProperties}
          >
            {visiblePages.length === 0 ? (
              <div className="flex items-center justify-center w-full py-6">
                <p className="text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  No experiences in this area — pan or zoom
                </p>
              </div>
            ) : (
              visiblePages.map(page => (
                <SheetCard
                  key={page.id}
                  page={page}
                  selected={hoveredPageId === page.id}
                  onClick={() => handlePinClick(page.id)}
                />
              ))
            )}

            {!isFiltered && initialTotal > initialPages.length && (
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
                +{initialTotal - initialPages.length} more →
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MOBILE LIST view ─────────────────────────────────────────────────────────

  return (
    <main className="px-5 sm:px-6 py-6 pb-28">

      <p className="text-xs font-medium f-body mb-5" style={{ color: 'rgba(10,46,77,0.6)' }}>
        <span className="font-bold" style={{ color: '#0A2E4D' }}>{initialTotal}</span>
        {' '}experience{initialTotal !== 1 ? 's' : ''} found
      </p>

      {initialPages.length === 0 ? (
        <EmptyState isFiltered={false} onClear={() => {}} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {initialPages.map((page, idx) => (
              <ExpCard key={page.id} page={page} priority={idx < 3} />
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
          style={{ background: '#0A2E4D', color: '#fff', boxShadow: '0 6px 28px rgba(10,46,77,0.38)' }}
        >
          <MapPin size={16} aria-hidden="true" />
          Map
        </button>
      </div>

    </main>
  )
}
