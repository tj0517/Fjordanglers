'use client'

/**
 * S1 gallery — 1 + 4 on desktop, one swipeable strip with a counter on mobile (FA-1.53).
 *
 * The hero is `priority`, because it is the largest element above the fold and therefore
 * the LCP candidate on this page; everything else is lazy. The mobile counter is driven
 * by scroll position rather than by a carousel library — native scroll-snap already gives
 * the gesture, and a library here would cost more JavaScript than the whole section.
 */

import Image from 'next/image'
import { useRef, useState } from 'react'

export default function OfferGallery({
  heroUrl,
  galleryUrls,
  alt,
}: {
  heroUrl:     string | null
  galleryUrls: string[]
  /** The page's own name — the images have no alt text of their own in the schema. */
  alt:         string
}) {
  const all = [heroUrl, ...galleryUrls].filter((u): u is string => u != null && u !== '')

  const stripRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (all.length === 0) {
    return (
      <div
        className="flex h-[220px] items-center justify-center rounded-xl text-sm sm:h-[450px]"
        style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}
      >
        No photos yet
      </div>
    )
  }

  const hero  = all[0]!
  const thumbs = all.slice(1, 5)
  const extra  = all.length - 1 - thumbs.length

  function onScroll() {
    const el = stripRef.current
    if (el == null) return
    const width = el.clientWidth
    if (width === 0) return
    setIndex(Math.min(all.length - 1, Math.max(0, Math.round(el.scrollLeft / width))))
  }

  return (
    <>
      {/* Mobile — one strip, swipe, counter. */}
      <div className="relative sm:hidden">
        <div
          ref={stripRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          aria-label={`${all.length} photos of ${alt}`}
        >
          {all.map((url, i) => (
            <div key={url} className="relative h-[260px] w-full flex-none snap-center">
              <Image
                src={url}
                alt={i === 0 ? alt : `${alt} — photo ${i + 1}`}
                fill
                sizes="100vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        <p
          className="absolute bottom-2.5 right-2.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: 'rgba(10,46,77,0.75)' }}
        >
          {index + 1} / {all.length}
        </p>
      </div>

      {/* Desktop — hero 2×2 plus up to four thumbnails. */}
      <div className="hidden gap-2.5 sm:grid sm:grid-cols-4 sm:grid-rows-2" style={{ height: 450 }}>
        <div className="relative col-span-2 row-span-2 overflow-hidden rounded-xl">
          <Image src={hero} alt={alt} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" priority />
        </div>

        {thumbs.map((url, i) => {
          const isLast = i === thumbs.length - 1 && extra > 0
          return (
            <div key={url} className="relative overflow-hidden rounded-xl">
              <Image src={url} alt={`${alt} — photo ${i + 2}`} fill sizes="25vw" className="object-cover" />
              {isLast && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white"
                  style={{ background: 'rgba(10,46,77,0.55)' }}
                >
                  +{extra} photos
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
