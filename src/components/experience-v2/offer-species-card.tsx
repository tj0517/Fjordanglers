'use client'

/**
 * One "What you fish for" card of "About this trip" (FA-1.62, tj's Figma review 2026-10-20).
 *
 * Built like a content block (./offer-story-block.tsx): the cover on top, and with two or more
 * photos a "+N photos" badge and a transparent button over the whole card that opens them in
 * the shared lightbox. Below the name, the full description — no cut, the card grows — then
 * the species' season (`season_months`, printed like the season chip) and "Average size"
 * (`avg_size_text`). A line with nothing to say is not drawn.
 *
 * A species with a season gets an orange calendar icon in the top-left corner of the photo
 * (next to the name when there is no photo). It scrolls to the inquiry form (`INQUIRY_ANCHOR`)
 * and opens nothing — O-40 (b), tj 2026-10-20: no calendar modal. The badge moves to the top
 * right so the two never overlap, and the icon sits above the gallery button, so a click on
 * it scrolls instead of opening the photos.
 */

import { useState, type MouseEvent } from 'react'
import Image from 'next/image'
import { CalendarDays, Images } from 'lucide-react'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import type { SpeciesDetail } from '@/lib/experience-v2-content'
import { seasonLabel } from '@/lib/season-months'
import { Box, mutedStyle } from './offer-box'
import { INQUIRY_ANCHOR } from './inquiry-anchor'
import { PhotoLightbox, useLightboxIndex } from './offer-photo-lightbox'

/** Smooth-scrolls to the form; without JavaScript (or without the section) the href still jumps there. */
function scrollToInquiry(event: MouseEvent<HTMLAnchorElement>) {
  const form = document.getElementById(INQUIRY_ANCHOR.slice(1))
  if (form == null) return
  event.preventDefault()
  form.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function CalendarLink({ name, season, floating }: { name: string; season: string; floating: boolean }) {
  return (
    <a
      href={INQUIRY_ANCHOR}
      onClick={scrollToInquiry}
      data-testid="species-calendar"
      aria-label={`${name} season: ${season} — ask about your dates`}
      title="Ask about your dates"
      className={`${floating ? 'absolute left-3 top-3 z-[2]' : 'flex-none'} inline-flex h-9 w-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--fa-navy)] focus-visible:ring-offset-2`}
      style={{ background: 'var(--fa-salmon)', color: '#fff', boxShadow: '0 2px 8px rgba(10,46,77,0.25)' }}
    >
      <CalendarDays aria-hidden size={18} strokeWidth={2.25} />
    </a>
  )
}

export default function OfferSpeciesCard({ species }: { species: SpeciesDetail }) {
  const [open, setOpen] = useState(false)

  const cover      = species.imageUrls[0] ?? null
  const count      = species.imageUrls.length
  const hasGallery = count >= 2
  const season     = seasonLabel(species.seasonMonths)
  const lightbox   = useLightboxIndex(count)

  const card = (
    <Box className="relative flex h-full flex-col">
      {cover != null && (
        <div className="relative -mx-5 -mt-5 mb-3.5 h-[180px] overflow-hidden rounded-t-2xl">
          <Image src={cover} alt={species.name} fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
        </div>
      )}
      {hasGallery && (
        <DialogTrigger
          data-testid="species-gallery"
          aria-label={`Open ${count} photos of ${species.name}`}
          onClick={lightbox.reset}
          className="absolute inset-0 z-[1] cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--fa-navy)] focus-visible:ring-offset-2"
        >
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white"
            style={{ background: 'rgba(10,46,77,0.72)', backdropFilter: 'blur(6px)' }}
          >
            <Images aria-hidden size={14} strokeWidth={2.25} />
            +{count - 1} photos
          </span>
        </DialogTrigger>
      )}
      {season != null && cover != null && <CalendarLink name={species.name} season={season} floating />}

      <div className="flex items-center gap-2.5">
        {season != null && cover == null && <CalendarLink name={species.name} season={season} floating={false} />}
        <h3 className="f-display text-[19px] font-bold leading-tight">{species.name}</h3>
      </div>
      {species.description != null && (
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: 'rgba(10,46,77,0.75)' }}>{species.description}</p>
      )}
      {(season != null || species.avgSizeText != null) && (
        <dl className="mt-3 space-y-0.5 text-[13px]" data-testid="species-facts">
          {season != null && (
            <div><dt className="inline" style={mutedStyle}>Season: </dt><dd className="inline font-semibold">{season}</dd></div>
          )}
          {species.avgSizeText != null && (
            <div><dt className="inline" style={mutedStyle}>Average size: </dt><dd className="inline font-semibold">{species.avgSizeText}</dd></div>
          )}
        </dl>
      )}
    </Box>
  )

  if (!hasGallery) return card

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {card}
      <PhotoLightbox title={species.name} name={species.name} photos={species.imageUrls} index={lightbox.index} step={lightbox.step} />
    </Dialog>
  )
}
