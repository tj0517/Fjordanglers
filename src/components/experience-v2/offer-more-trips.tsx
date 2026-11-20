/**
 * "More trips" — the last block before the footer: three other pages, as close to this one
 * as the catalogue allows. The data layer picks the tier (same region, same country, same
 * part of the world, anywhere) and the heading says which, so "More trips in Otago" is
 * never a lie and "More places we guide" is never a dead end.
 *
 * Cards are the site's one trip card (src/components/site/trip-card.tsx, 2026-11 mockup): photo
 * with the region tag, name, the guide and the "from" price — the hub and the home page use the
 * same card without the guide line.
 */

import { formatPrice } from '@/lib/format-price'
import type { RelatedExperiencePages } from '@/lib/supabase/queries'
import { NAVY, SecondaryButton } from '@/components/site/ui'
import { TripCard } from '@/components/site/trip-card'

export type OfferMoreTripsProps = {
  related: RelatedExperiencePages
  country: string
  region:  string
}

function heading(tier: RelatedExperiencePages['tier'], country: string, region: string): string {
  switch (tier) {
    case 'region':  return `More trips in ${region}`
    case 'country': return `More trips in ${country}`
    case 'group':   return `More trips near ${country}`
    default:        return 'More places we guide'
  }
}

export default function OfferMoreTrips({ related, country, region }: OfferMoreTripsProps) {
  if (related.pages.length === 0) return null

  return (
    <section data-section="more-trips" className="mt-14 flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="f-display text-[28px] font-bold leading-[1.12] tracking-[-0.01em] sm:text-[34px]" style={{ color: NAVY }}>
          {heading(related.tier, country, region)}
        </h2>
        <SecondaryButton href="/trips">All trips</SecondaryButton>
      </div>

      <ul
        className="m-0 grid list-none gap-x-7 gap-y-10 p-0 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]"
        data-testid="offer-more-trips"
      >
        {related.pages.map(page => (
          <li key={page.id} className="min-w-0">
            <TripCard
              trip={{
                slug:      page.slug,
                name:      page.experience_name,
                region:    page.region,
                cover:     page.hero_image_url,
                species:   [],
                guideName: page.guide?.full_name ?? null,
                priceText: formatPrice({ priceFrom: page.price_from, priceType: page.price_type, currency: page.currency }),
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
