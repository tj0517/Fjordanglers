'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CountryFlag } from '@/components/ui/country-flag'
import type { ExperienceWithGuide } from '@/types'

interface Props {
  experiences: ExperienceWithGuide[]
}

export function ExperiencesSlider({ experiences }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'prev' | 'next') => {
    trackRef.current?.scrollBy({ left: dir === 'next' ? 340 : -340, behavior: 'smooth' })
  }

  if (experiences.length === 0) return null

  return (
    <div>
      {/* Arrow row — flush right, aligned with content padding */}
      <div className="flex justify-end gap-2 mb-5 px-4 md:px-8 lg:px-14">
        {(['prev', 'next'] as const).map(dir => (
          <button
            key={dir}
            onClick={() => scroll(dir)}
            aria-label={dir === 'prev' ? 'Previous' : 'Next'}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: '#fff',
              border: '1px solid rgba(10,46,77,0.14)',
              color: '#0A2E4D',
              fontSize: '16px',
            }}
          >
            {dir === 'prev' ? '←' : '→'}
          </button>
        ))}
      </div>

      {/* Scroll track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pl-4 md:pl-8 lg:pl-14 pr-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: '4px' }}
      >
        {experiences.map(exp => {
          const cover = exp.images.find(img => img.is_cover)?.url ?? exp.images[0]?.url ?? null
          const dur =
            exp.duration_hours != null
              ? `${exp.duration_hours}h`
              : exp.duration_days != null
              ? `${exp.duration_days} days`
              : null

          return (
            <Link
              key={exp.id}
              href={`/trips/${exp.id}`}
              className="group flex-shrink-0"
              style={{ width: 'clamp(240px, 26vw, 320px)' }}
            >
              <div
                className="relative overflow-hidden"
                style={{ height: '300px', borderRadius: '16px', background: '#1a3a5c' }}
              >
                {cover != null && (
                  <Image
                    src={cover}
                    alt={exp.title}
                    fill
                    sizes="320px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(5,10,20,0.75) 0%, rgba(5,10,20,0.08) 55%, transparent 100%)',
                  }}
                />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CountryFlag country={exp.location_country ?? ''} />
                    <span
                      className="f-body font-semibold uppercase tracking-[0.14em]"
                      style={{ fontSize: '10px', color: '#E67E50' }}
                    >
                      {exp.location_country}
                    </span>
                  </div>
                  <h3
                    className="f-display font-bold text-white leading-tight"
                    style={{ fontSize: '16px' }}
                  >
                    {exp.title}
                  </h3>
                  <p className="f-body mt-1" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.48)' }}>
                    {exp.guide.full_name}
                    {dur != null ? ` · ${dur}` : ''}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}

        {/* Trailing "see all" card */}
        <Link
          href="/trips"
          className="group flex-shrink-0 flex items-center justify-center"
          style={{ width: '160px', minWidth: '160px' }}
        >
          <div
            className="flex flex-col items-center justify-center gap-3 w-full"
            style={{
              height: '300px',
              borderRadius: '16px',
              background: 'rgba(10,46,77,0.06)',
              border: '1px solid rgba(10,46,77,0.10)',
            }}
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors group-hover:bg-[#E67E50] group-hover:text-white"
              style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', fontSize: '16px' }}
            >
              →
            </span>
            <span
              className="f-body text-[13px] font-medium text-center leading-snug"
              style={{ color: 'rgba(10,46,77,0.45)' }}
            >
              See all<br />trips
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
