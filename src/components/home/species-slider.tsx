'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useCallback } from 'react'
import { FISH_CATALOG } from '@/lib/fish'

type SpeciesItem = (typeof FISH_CATALOG)[number] & { count: number }

const CARD_W = 200

export function SpeciesSlider({ species }: { species: SpeciesItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const items = [...species, ...species, ...species]

  function scroll(dir: 'left' | 'right') {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'right' ? CARD_W * 2 : -CARD_W * 2, behavior: 'smooth' })
  }

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const setW = species.length * CARD_W
    if (el.scrollLeft <= 0) el.scrollLeft = setW
    else if (el.scrollLeft >= setW * 2) el.scrollLeft = setW
  }, [species.length])

  const onMount = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = el
    el.scrollLeft = species.length * CARD_W
  }, [species.length])

  const ArrowBtn = ({ dir }: { dir: 'left' | 'right' }) => (
    <button
      onClick={() => scroll(dir)}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all hover:opacity-80"
      style={{
        background: 'transparent',
        border: '1px solid rgba(10,46,77,0.15)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        {dir === 'left'
          ? <path d="M10 12L6 8l4-4" stroke="#0A2E4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M6 4l4 4-4 4" stroke="#0A2E4D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        }
      </svg>
    </button>
  )

  return (
    <div className="flex items-center gap-3">
      <ArrowBtn dir="left" />

      {/* Track */}
      <div
        ref={onMount}
        onScroll={onScroll}
        className="flex gap-2 overflow-x-auto flex-1"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' } as React.CSSProperties}
      >
        {items.map((s, i) => (
          <Link
            key={`${s.slug}-${i}`}
            href={`/experiences?fish=${s.slug}`}
            className="group flex-shrink-0 flex flex-col items-center"
            style={{ width: `${CARD_W - 8}px`, scrollSnapAlign: 'start' }}
          >
            <div className="relative w-full transition-transform duration-300 group-hover:-translate-y-1" style={{ height: '200px' }}>
              <Image
                src={s.img}
                alt={s.name}
                fill
                className="object-contain transition-transform duration-500 group-hover:scale-[1.1]"
              />
            </div>
            <p className="font-semibold text-xs f-display text-center mt-1.5" style={{ color: '#0A2E4D' }}>
              {s.name}
            </p>
            {s.count > 0 && (
              <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                {s.count} {s.count === 1 ? 'trip' : 'trips'}
              </p>
            )}
          </Link>
        ))}
      </div>

      <ArrowBtn dir="right" />
    </div>
  )
}
