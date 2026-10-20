'use client'

/**
 * The photo lightbox of the v2 page's photo cards — a content block (./offer-story-block.tsx)
 * and a species card (./offer-species-card.tsx, FA-1.62). The caller owns the `Dialog` and its
 * trigger; this is what opens inside it.
 *
 * The lightbox is `ui/dialog.tsx` (Base UI): it traps focus, closes on Esc and returns focus
 * to the trigger. On top of that: prev / next buttons, the arrow keys, a counter. The photo
 * frame has a fixed aspect ratio, so nothing jumps while a photo loads.
 */

import { useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'

/** Which photo the lightbox shows; `reset()` goes in the trigger's onClick, so every opening starts at the cover. */
export function useLightboxIndex(count: number) {
  const [index, setIndex] = useState(0)
  return {
    index,
    reset: () => setIndex(0),
    step:  (by: number) => setIndex(current => (current + by + count) % count),
  }
}

export function PhotoLightbox({ title, name, photos, index, step }: {
  /** The dialog's heading. */
  title:  string
  /** What the photos are of, for the alt text: "<name> — photo 2 of 5". */
  name:   string
  photos: string[]
  index:  number
  step:   (by: number) => void
}) {
  const count   = photos.length
  const current = photos[index] ?? photos[0] ?? null

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft')  { event.preventDefault(); step(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
  }

  return (
    <DialogContent
      data-testid="story-lightbox"
      onKeyDown={onKeyDown}
      className="max-w-[calc(100%-1.5rem)] gap-3 p-3 sm:max-w-[min(1000px,calc(100%-4rem))] sm:p-4"
    >
      <div className="flex items-baseline justify-between gap-3 pr-9">
        <DialogTitle className="f-display text-[18px] font-bold">{title}</DialogTitle>
        <span className="flex-none text-[13px] tabular-nums text-muted-foreground" aria-live="polite" data-testid="story-lightbox-counter">
          {index + 1} / {count}
        </span>
      </div>

      <div className="relative aspect-[3/2] max-h-[72vh] w-full overflow-hidden rounded-lg" style={{ background: 'var(--fa-navy)' }}>
        {current != null && (
          <Image
            key={current}
            src={current}
            alt={`${name} — photo ${index + 1} of ${count}`}
            fill
            sizes="(min-width: 1064px) 1000px, calc(100vw - 1.5rem)"
            className="object-contain"
          />
        )}
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => step(-1)}
          className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[var(--fa-navy)] shadow outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft aria-hidden size={20} />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => step(1)}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[var(--fa-navy)] shadow outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight aria-hidden size={20} />
        </button>
      </div>
    </DialogContent>
  )
}
