'use client'

/**
 * One content-block card of "About this trip" (a location such as "Spring Creeks").
 *
 * Feedback round 1, change 9: a block with two or more photos opens them in a lightbox.
 * The card shows the cover and a "+N photos" badge. The dialog trigger is one transparent
 * button laid over the whole card with the badge inside it, so a click anywhere on the card
 * (or on the badge) opens the gallery, and the heading and text stay outside the button.
 *
 * The lightbox is ./offer-photo-lightbox.tsx, shared with the species cards since FA-1.62.
 *
 * A block with 0–1 photos renders exactly as before and is not clickable.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Images } from 'lucide-react'
import { Dialog, DialogTrigger } from '@/components/ui/dialog-root'
import type { StoryBlock } from '@/lib/experience-v2-content'
import { Box } from './offer-box'
import { INK } from '@/components/site/ui'
import { PhotoLightbox, useLightboxIndex } from './offer-photo-lightbox-loader'

export default function OfferStoryBlock({ block, single }: { block: StoryBlock; single: boolean }) {
  const [open, setOpen] = useState(false)

  const cover      = block.imageUrls[0] ?? null
  const count      = block.imageUrls.length
  const hasGallery = count >= 2
  const name       = block.headline ?? 'this place'
  const lightbox   = useLightboxIndex(count)

  const card = (
    <Box className={`${hasGallery ? 'relative' : ''} ${single ? 'flex flex-col gap-5 sm:flex-row' : 'flex flex-col'}`}>
      {cover != null && (
        <div
          className={single
            ? 'relative -mx-5 -mt-5 h-[200px] flex-none overflow-hidden rounded-t-[13px] sm:-my-5 sm:ml-[-20px] sm:mr-0 sm:h-auto sm:min-h-[170px] sm:w-[240px] sm:rounded-l-[13px] sm:rounded-tr-none'
            : 'relative -mx-5 -mt-5 mb-4 h-[200px] overflow-hidden rounded-t-[13px]'}
        >
          <Image src={cover} alt={block.headline ?? ''} fill sizes="(min-width: 640px) 45vw, 100vw" className="object-cover" />
        </div>
      )}
      {hasGallery && (
        <DialogTrigger
          data-testid="story-block-gallery"
          aria-label={`Open ${count} photos of ${name}`}
          onClick={lightbox.reset}
          className="absolute inset-0 z-[1] cursor-pointer rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fa-navy)] focus-visible:ring-offset-2"
        >
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[5px] px-[9px] py-1.5 text-[11.5px] font-bold uppercase tracking-[0.07em]"
            style={{ background: '#FDFAF7', color: 'var(--fa-navy)' }}
          >
            <Images aria-hidden size={14} strokeWidth={2.25} />
            +{count - 1} photos
          </span>
        </DialogTrigger>
      )}
      <div className="min-w-0 flex-1">
        {block.headline != null && <h3 className="text-[16.5px] font-bold leading-snug">{block.headline}</h3>}
        {block.text != null && <p className={`${block.headline != null ? 'mt-1.5' : ''} whitespace-pre-line text-[15px] leading-[1.6]`} style={{ color: INK }}>{block.text}</p>}
      </div>
    </Box>
  )

  if (!hasGallery) return card

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {card}
      <PhotoLightbox title={block.headline ?? 'Photos'} name={name} photos={block.imageUrls} index={lightbox.index} step={lightbox.step} />
    </Dialog>
  )
}
