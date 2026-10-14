'use client'

/**
 * One content-block card of "About this trip" (a location such as "Spring Creeks").
 *
 * Feedback round 1, change 9: a block with two or more photos opens them in a lightbox.
 * The card shows the cover and a "+N photos" badge. The dialog trigger is one transparent
 * button laid over the whole card with the badge inside it, so a click anywhere on the card
 * (or on the badge) opens the gallery, and the heading and text stay outside the button.
 *
 * The lightbox is `ui/dialog.tsx` (Base UI): it traps focus, closes on Esc and returns focus
 * to the badge. On top of that: prev / next buttons, the arrow keys, a counter. The photo
 * frame has a fixed aspect ratio, so nothing jumps while a photo loads.
 *
 * A block with 0–1 photos renders exactly as before and is not clickable.
 */

import { useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { StoryBlock } from '@/lib/experience-v2-content'
import { Box } from './offer-box'

export default function OfferStoryBlock({ block, single }: { block: StoryBlock; single: boolean }) {
  const [open, setOpen]   = useState(false)
  const [index, setIndex] = useState(0)

  const cover      = block.imageUrls[0] ?? null
  const count      = block.imageUrls.length
  const hasGallery = count >= 2
  const name       = block.headline ?? 'this place'

  const step = (by: number) => setIndex(current => (current + by + count) % count)

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft')  { event.preventDefault(); step(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
  }

  const card = (
    <Box className={`${hasGallery ? 'relative' : ''} ${single ? 'flex flex-col gap-5 sm:flex-row' : 'flex flex-col'}`}>
      {cover != null && (
        <div
          className={single
            ? 'relative -mx-5 -mt-5 h-[220px] flex-none overflow-hidden rounded-t-2xl sm:-my-5 sm:ml-[-20px] sm:mr-0 sm:h-auto sm:w-[320px] sm:rounded-l-2xl sm:rounded-tr-none'
            : 'relative -mx-5 -mt-5 mb-4 h-[200px] overflow-hidden rounded-t-2xl'}
        >
          <Image src={cover} alt={block.headline ?? ''} fill sizes="(min-width: 640px) 45vw, 100vw" className="object-cover" />
        </div>
      )}
      {hasGallery && (
        <DialogTrigger
          data-testid="story-block-gallery"
          aria-label={`Open ${count} photos of ${name}`}
          onClick={() => setIndex(0)}
          className="absolute inset-0 z-[1] cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--fa-navy)] focus-visible:ring-offset-2"
        >
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white"
            style={{ background: 'rgba(10,46,77,0.72)', backdropFilter: 'blur(6px)' }}
          >
            <Images aria-hidden size={14} strokeWidth={2.25} />
            +{count - 1} photos
          </span>
        </DialogTrigger>
      )}
      <div className="min-w-0 flex-1">
        {block.headline != null && <h3 className="f-display text-[21px] font-bold leading-tight">{block.headline}</h3>}
        {block.text != null && <p className={`${block.headline != null ? 'mt-2' : ''} text-[15px] leading-relaxed`} style={{ color: 'rgba(10,46,77,0.78)' }}>{block.text}</p>}
      </div>
    </Box>
  )

  if (!hasGallery) return card

  const current = block.imageUrls[index] ?? cover

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {card}

      <DialogContent
        data-testid="story-lightbox"
        onKeyDown={onKeyDown}
        className="max-w-[calc(100%-1.5rem)] gap-3 p-3 sm:max-w-[min(1000px,calc(100%-4rem))] sm:p-4"
      >
        <div className="flex items-baseline justify-between gap-3 pr-9">
          <DialogTitle className="f-display text-[18px] font-bold">{block.headline ?? 'Photos'}</DialogTitle>
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
    </Dialog>
  )
}
