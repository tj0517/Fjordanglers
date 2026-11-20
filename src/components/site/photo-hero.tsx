/**
 * The photo hero of the guides list and the guide profile (docs/design/site-2026-11, "Wspólne
 * zasady"): a photo in a frame 12 px in from the edges, max 1560 px wide, 28 px corners, under a
 * left-to-right dark gradient, with the content pinned to the bottom of a 1200 px column. The
 * fixed site nav floats over the top of it.
 */

import Image from 'next/image'
import type { ReactNode } from 'react'
import { NAVY } from './ui'
import { ScrollAway } from './scroll-away'

export function PhotoHero({
  image, minHeight, children,
}: { image: string | null; minHeight: number; children: ReactNode }) {
  return (
    <ScrollAway>
      <section
        data-block="hero"
        className="relative mx-auto mt-3 flex items-end overflow-hidden pt-[130px]"
        style={{ width: 'calc(100% - 24px)', maxWidth: 1560, minHeight, borderRadius: 28, paddingBottom: 'clamp(28px, 4vw, 48px)', background: NAVY }}
      >
        {image != null && (
          <Image src={image} alt="" fill priority sizes="(min-width: 1584px) 1560px, 100vw" className="object-cover" style={{ objectPosition: 'center 45%' }} />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(7,22,36,.86) 0%, rgba(7,22,36,.6) 55%, rgba(7,22,36,.4) 100%)' }}
        />
        <div className="relative mx-auto w-full px-6" style={{ maxWidth: 1200 }}>{children}</div>
      </section>
    </ScrollAway>
  )
}
