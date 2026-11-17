/**
 * The trip card — one component for the hub, the home page, the offer page's "More trips" and the
 * guide profile (docs/design/site-2026-11/README.md). Photo with the region tag, name, species, the
 * price exactly as the offer page prints it, and "View trip".
 *
 * `onClick` is for the caller's analytics (the hub counts `hub_card_click`); a server page leaves it out.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { HubOffer } from '@/lib/supabase/queries'
import { CREAM, NAVY, PAGE_BG, SALMON, Tag } from './ui'

export type TripCardData = {
  slug:      string
  name:      string
  region:    string
  cover:     string | null
  species:   readonly string[]
  priceText: string
}

export function TripCard({ trip, priority = false, onClick }: { trip: TripCardData; priority?: boolean; onClick?: () => void }) {
  const href = `/experiences/${trip.slug}`

  return (
    <article id={trip.slug} className="flex scroll-mt-24 flex-col gap-[14px]">
      <Link
        href={href}
        onClick={onClick}
        className="relative block overflow-hidden"
        style={{ borderRadius: 16, aspectRatio: '8 / 7', background: trip.cover == null ? NAVY : CREAM }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {trip.cover != null && (
          <Image src={trip.cover} alt="" fill priority={priority} sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        )}
        {trip.region.trim() !== '' && (
          <span className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-1.5">
            <Tag>{trip.region}</Tag>
          </span>
        )}
      </Link>
      <h3
        className="f-display"
        style={{ margin: 0, fontWeight: 700, fontSize: 20, lineHeight: 1.22, color: NAVY, minHeight: 49 }}
      >
        {trip.name}
      </h3>
      {trip.species.length > 0 && (
        <p className="f-body m-0 text-[14.5px] font-semibold" style={{ color: NAVY }}>
          {trip.species.join(', ')}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="f-body m-0 text-[15px] font-bold" style={{ color: NAVY }} data-testid="hub-card-price">
          {trip.priceText}
        </p>
        <Link
          href={href}
          onClick={onClick}
          className="f-body inline-flex min-h-[44px] flex-none items-center px-4 text-[14px] font-bold"
          style={{ borderRadius: 9, border: `1.5px solid ${NAVY}`, color: PAGE_BG, background: SALMON, textDecoration: 'none' }}
        >
          View trip
        </Link>
      </div>
    </article>
  )
}

/** A hub offer as a card: the first gallery photo, else the hero. */
export function tripCardFromOffer(offer: HubOffer): TripCardData {
  return {
    slug:      offer.page.slug,
    name:      offer.page.experience_name,
    region:    offer.page.region,
    cover:     offer.page.gallery_image_urls[0] ?? offer.page.hero_image_url,
    species:   offer.targetSpecies,
    priceText: offer.priceText,
  }
}
