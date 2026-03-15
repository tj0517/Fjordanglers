'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ExperienceWithGuide, LocationSpot } from '@/types'
import { cardThumb } from '@/lib/image'
import { CountryFlag } from '@/components/ui/country-flag'
import MapWrapper from './map-wrapper'

export type MapBounds = { north: number; south: number; east: number; west: number }

const NAV_H = 96
const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}
const MONTHS: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

// ─── Bounds helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if an experience has at least one coordinate within the given
 * map bounds. Checks both the primary lat/lng pin AND any location_spots
 * (multi-spot experiences).  Without checking spots, multi-spot experiences
 * appear on the map but silently vanish from the card list.
 */
function isInBounds(exp: ExperienceWithGuide, b: MapBounds): boolean {
  if (exp.location_lat != null && exp.location_lng != null) {
    if (
      exp.location_lat >= b.south &&
      exp.location_lat <= b.north &&
      exp.location_lng >= b.west &&
      exp.location_lng <= b.east
    ) return true
  }

  const spots = (exp.location_spots as unknown as LocationSpot[] | null) ?? []
  return spots.some(
    s => s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east,
  )
}

type Props = {
  allGeoExperiences: ExperienceWithGuide[]
  initialExperiences: ExperienceWithGuide[]
  initialTotal: number
  paginationNode: React.ReactNode
}

export default function MapSection({
  allGeoExperiences,
  initialExperiences,
  initialTotal,
  paginationNode,
}: Props) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  // ID of the card the user is hovering — forwarded to MapWrapper so the
  // corresponding pin turns Salmon Orange without any map interaction needed
  const [hoveredExpId, setHoveredExpId] = useState<string | null>(null)

  const visibleExperiences =
    bounds != null
      ? allGeoExperiences.filter(exp => isInBounds(exp, bounds))
      : initialExperiences

  const visibleCount = bounds != null ? visibleExperiences.length : initialTotal
  const isFiltered = bounds != null

  return (
    <div className="flex" style={{ height: `calc(100vh - ${NAV_H}px)` }}>

      <main
        className="overflow-y-auto"
        style={{ width: '50%', padding: '28px 56px 32px', scrollbarWidth: 'none' } as React.CSSProperties}
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
              Clear map filter x
            </button>
          )}
        </div>

        {visibleExperiences.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{
              borderRadius: '20px',
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.07)',
              minHeight: '400px',
            }}
          >
            <p
              className="font-bold f-display mb-3"
              style={{ fontSize: '44px', color: 'rgba(10,46,77,0.05)', fontStyle: 'italic' }}
            >
              No trips found
            </p>
            <p className="text-sm mb-6 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {isFiltered ? 'Pan or zoom the map to find trips.' : 'Try broadening your search.'}
            </p>
            {!isFiltered && (
              <Link
                href="/experiences"
                className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body"
                style={{ background: '#E67E50' }}
              >
                Clear all filters
              </Link>
            )}
            {isFiltered && (
              <button
                onClick={() => setBounds(null)}
                className="text-white text-sm font-semibold px-6 py-3 rounded-full hover:brightness-110 f-body"
                style={{ background: '#E67E50' }}
              >
                Clear map filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              {visibleExperiences.map(exp => {
                const rawCover = exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url ?? null
                const coverUrl = cardThumb(rawCover)
                // flag rendered as <CountryFlag> below
                const diffLabel =
                  exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
                const duration =
                  exp.duration_hours != null
                    ? `${exp.duration_hours}h`
                    : exp.duration_days != null
                    ? `${exp.duration_days} days`
                    : null
                const hasSeason = exp.season_from != null && exp.season_to != null

                return (
                  <Link
                    key={exp.id}
                    href={`/experiences/${exp.id}`}
                    className="group block"
                    onMouseEnter={() => setHoveredExpId(exp.id)}
                    onMouseLeave={() => setHoveredExpId(null)}
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
                            sizes="25vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        )}

                        {/* Top-left badges: difficulty + season stacked */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                          {diffLabel != null && (
                            <div
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                              style={{
                                background: 'rgba(255,255,255,0.92)',
                                backdropFilter: 'blur(8px)',
                                color: '#0A2E4D',
                              }}
                            >
                              {diffLabel}
                            </div>
                          )}
                          {hasSeason && (
                            <div
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                              style={{
                                background: 'rgba(10,46,77,0.65)',
                                backdropFilter: 'blur(8px)',
                                color: '#fff',
                              }}
                            >
                              {MONTHS[exp.season_from!]} – {MONTHS[exp.season_to!]}
                            </div>
                          )}
                        </div>

                        {/* Hover CTA */}
                        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                          <span
                            className="text-[12px] font-semibold f-body px-4 py-1.5 rounded-full"
                            style={{ background: '#E67E50', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
                          >
                            View trip -&gt;
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="pt-3 px-0.5">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <h3
                            className="font-semibold leading-snug line-clamp-1 f-body"
                            style={{ fontSize: '14px', color: '#0A2E4D' }}
                          >
                            {exp.title}
                          </h3>
                          {exp.fish_types[0] != null && (
                            <span
                              className="text-[11px] f-body flex-shrink-0"
                              style={{ color: 'rgba(10,46,77,0.7)' }}
                            >
                              * {exp.fish_types[0]}
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                          <CountryFlag country={exp.location_country} />{exp.location_city != null ? ` ${exp.location_city},` : ''} {exp.location_country}
                        </p>

                        {/* Guide avatar + name */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div
                            className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                            style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}
                          >
                            {exp.guide.avatar_url != null ? (
                              <Image
                                src={exp.guide.avatar_url}
                                alt={exp.guide.full_name}
                                width={28}
                                height={28}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold f-body"
                                style={{ background: '#0A2E4D' }}
                              >
                                {exp.guide.full_name[0]}
                              </div>
                            )}
                          </div>
                          <p className="text-[12px] f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>
                            {exp.guide.full_name}
                          </p>
                        </div>

                        {duration != null && (
                          <p className="text-[12px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.65)' }}>
                            {duration}
                          </p>
                        )}

                        {exp.booking_type === 'icelandic' ? (
                          <p className="text-[12px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)', fontStyle: 'italic' }}>
                            Guide crafts your dream experience
                          </p>
                        ) : (
                          <p className="text-[13px] f-body mt-1" style={{ color: '#0A2E4D' }}>
                            <span className="font-semibold" style={{ textDecoration: 'underline' }}>
                              €{exp.price_per_person_eur}
                            </span>
                            <span style={{ color: 'rgba(10,46,77,0.65)' }}> /person</span>
                          </p>
                        )}
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>

            {!isFiltered && paginationNode}
          </>
        )}
      </main>

      <aside className="flex-shrink-0 hidden lg:block" style={{ width: '50%', padding: '12px 16px 12px 0' }}>
        <div className="w-full h-full overflow-hidden" style={{ borderRadius: '20px' }}>
          <MapWrapper
            experiences={allGeoExperiences}
            onBoundsChange={setBounds}
            hoveredExpId={hoveredExpId}
          />
        </div>
      </aside>

    </div>
  )
}
