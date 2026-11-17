'use client'

/**
 * The trip cards of a country hub with the species filter above them (FA-1.65; redesign
 * docs/design/blog-hubs-2026-11): one grid, one row of filter buttons, no map. A button filters
 * the cards client-side by `target_species`; "All species" resets. A card click is counted as
 * `hub_card_click`.
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useHubFunnel } from '@/components/analytics/hub-funnel'
import { offerHasSpecies, speciesKey } from '@/lib/hub-species'
import type { HubOffer } from '@/lib/supabase/queries'
import { CREAM, LINE, MUTED, NAVY, PAGE_BG, SALMON, SectionHeading, Tag } from './hub-ui'

export type HubTripsProps = {
  offers:  HubOffer[]
  species: string[]
  /** "Iceland" in "Guided fishing trips in Iceland". */
  place?:  string
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="f-body inline-flex min-h-[44px] cursor-pointer items-center px-[18px] text-[14.5px] font-semibold"
      style={{
        borderRadius: 9,
        background: active ? NAVY : CREAM,
        color:      active ? '#FFFFFF' : NAVY,
        border:     `1.5px solid ${active ? NAVY : LINE}`,
      }}
    >
      {label}
    </button>
  )
}

function TripCard({ offer, priority, onClick }: { offer: HubOffer; priority: boolean; onClick: () => void }) {
  const { page } = offer
  const href  = `/experiences/${page.slug}`
  const cover = page.gallery_image_urls[0] ?? page.hero_image_url

  return (
    <article id={page.slug} className="flex scroll-mt-24 flex-col gap-[14px]">
      <Link
        href={href}
        onClick={onClick}
        className="relative block overflow-hidden"
        style={{ borderRadius: 16, aspectRatio: '8 / 7', background: cover == null ? NAVY : CREAM }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {cover != null && (
          <Image src={cover} alt="" fill priority={priority} sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        )}
        {page.region.trim() !== '' && (
          <span className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-1.5">
            <Tag>{page.region}</Tag>
          </span>
        )}
      </Link>
      <h3
        className="f-display"
        style={{ margin: 0, fontWeight: 700, fontSize: 20, lineHeight: 1.22, color: NAVY, minHeight: 49 }}
      >
        {page.experience_name}
      </h3>
      {offer.targetSpecies.length > 0 && (
        <p className="f-body m-0 text-[14.5px] font-semibold" style={{ color: NAVY }}>
          {offer.targetSpecies.join(', ')}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="f-body m-0 text-[15px] font-bold" style={{ color: NAVY }} data-testid="hub-card-price">
          {offer.priceText}
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

export default function HubTrips({ offers, species, place }: HubTripsProps) {
  const [chip, setChip] = useState<string | null>(null)
  const funnel = useHubFunnel()

  if (offers.length === 0) return null

  const visible = chip == null ? offers : offers.filter(o => offerHasSpecies(o.targetSpecies, chip))

  return (
    <section id="trips" data-section="trips" className="flex scroll-mt-24 flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <SectionHeading eyebrow="Trips" title={place != null ? `Guided fishing trips in ${place}` : 'Guided fishing trips'} />
        {species.length > 0 && (
          <div role="group" aria-label="Filter by species" className="flex flex-wrap gap-2" data-testid="hub-species-chips">
            <FilterButton label="All species" active={chip == null} onClick={() => setChip(null)} />
            {species.map(name => (
              <FilterButton
                key={speciesKey(name)}
                label={name}
                active={chip != null && speciesKey(chip) === speciesKey(name)}
                onClick={() => setChip(current => (current === name ? null : name))}
              />
            ))}
          </div>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-x-7 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }} data-testid="hub-cards">
          {visible.map((offer, idx) => (
            <TripCard key={offer.id} offer={offer} priority={idx < 4} onClick={() => funnel?.cardClick(offer.page.slug, idx + 1)} />
          ))}
        </div>
      ) : (
        <p className="f-body text-[15px]" style={{ color: MUTED }} data-testid="hub-cards-empty">
          No trips for {chip} yet.
        </p>
      )}
    </section>
  )
}
