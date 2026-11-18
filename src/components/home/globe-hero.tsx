'use client'

/**
 * The home hero with the globe (docs/design/site-2026-11/home.dc.html): the photo frame with the
 * headline on the left (`children`) and the site's d3 canvas globe (site/globe-canvas) on the right,
 * which turns to the selected destination; the destination buttons sit under the frame. The
 * mockup's free globe — no tile service, no token (tj, 2026-11-18, replacing Mapbox).
 */

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CREAM, LINE, NAVY, SALMON_ON_DARK } from '@/components/site/ui'
import { GlobeCanvas, type GlobePlace } from '@/components/site/globe-canvas'
import s from './home.module.css'

export type GlobeDestination = GlobePlace & {
  tripCount: number
  priceFrom: string | null
}

export function GlobeHero({
  destinations, initial, children,
}: { destinations: GlobeDestination[]; initial: string | null; children: ReactNode }) {
  const [selected, setSelected] = useState(initial ?? destinations[0]?.slug ?? null)
  const hasGlobe = destinations.length > 0

  const current = destinations.find(d => d.slug === selected) ?? null

  return (
    <>
      <section
        data-block="hero"
        className="relative mx-auto mt-3 flex items-end overflow-hidden pt-[120px]"
        style={{ width: 'calc(100% - 24px)', maxWidth: 1560, minHeight: 'calc(100svh - 24px)', borderRadius: 28, paddingBottom: 'clamp(28px, 4vw, 48px)', background: NAVY }}
      >
        <Image src="/hub/canyon.jpg" alt="" fill priority sizes="(min-width: 1584px) 1560px, 100vw" className="object-cover" style={{ objectPosition: 'center 40%' }} />
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(7,22,36,.86) 0%, rgba(7,22,36,.72) 50%, rgba(7,22,36,.62) 100%)' }}
        />
        <div className="relative mx-auto flex w-full flex-wrap items-center gap-x-12 gap-y-8 px-6" style={{ maxWidth: 1200 }}>
          <div className="flex min-w-0 max-w-[600px] flex-[1_1_420px] flex-col items-start gap-[22px]">
            {children}
          </div>
          {hasGlobe && (
            <div className="flex min-w-0 flex-[1_1_420px] flex-col items-center gap-4">
              <div className="w-full max-w-[500px]" style={{ aspectRatio: '1 / 1' }}>
                <GlobeCanvas destinations={destinations} selected={selected} />
              </div>
              {current != null && (
                <p className="f-body m-0 flex flex-wrap items-center justify-center gap-x-[14px] gap-y-[6px] text-[15px]" style={{ color: '#E3EAF0' }}>
                  <span className="f-display text-[22px] font-bold" style={{ color: '#FFFFFF' }}>{current.name}</span>
                  {current.tripCount > 0 && <span>{current.tripCount} {current.tripCount === 1 ? 'trip' : 'trips'}</span>}
                  {current.priceFrom != null && <span>{current.priceFrom}</span>}
                  <Link href={`/${current.slug}`} className="inline-flex min-h-[44px] items-center font-bold" style={{ color: SALMON_ON_DARK, textDecoration: 'none' }}>
                    See trips →
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {hasGlobe && (
        <div className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-[10px] px-6 pt-5" style={{ maxWidth: 1200 }}>
          <span className="f-body text-[12.5px] font-bold uppercase" style={{ letterSpacing: '.12em', color: '#E67E50' }}>Spin the globe</span>
          <div role="group" aria-label="Destinations" className="flex flex-wrap justify-center gap-2">
            {destinations.map(d => {
              const on = d.slug === selected
              return (
                <button
                  key={d.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(d.slug)}
                  className={`${s.chip} f-body min-h-[44px] cursor-pointer rounded-full px-[18px] text-[15px] font-medium`}
                  style={{ border: `1px solid ${on ? NAVY : LINE}`, background: on ? NAVY : CREAM, color: on ? '#FFFFFF' : NAVY }}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
