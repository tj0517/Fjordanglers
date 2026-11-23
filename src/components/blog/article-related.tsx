/**
 * "Fish it with a guide", under an article (FA-1.90, restyled FA-1.97): 2–3 trips as the site's trip
 * cards, with the guide's name on each (the guides FA-1.90 listed here as people are gone — T8).
 * The data layer picks the trips' tier (same country, same part of the world, anywhere — tj D3) and
 * the heading says which, so "Trips in Norway" is never a list of Swedish trips. A general post (no
 * country) gets trips from anywhere. No trips, no block.
 */

import { formatPrice } from '@/lib/format-price'
import type { ArticleRelated as ArticleRelatedData, RelatedExperiencePages } from '@/lib/supabase/queries'
import { HeadingLink, SectionHeading } from '@/components/site/ui'
import { TripCard } from '@/components/site/trip-card'

export function relatedTripsHeading(tier: RelatedExperiencePages['tier'], country: string | null): string {
  if (country != null && (tier === 'country' || tier === 'region')) return `Trips in ${country}`
  if (country != null && tier === 'group') return `Trips near ${country}`
  return 'Trips we guide'
}

/** "All Norway trips" only when the trips shown are Norway's — otherwise the link would lead to a different list. */
function allTripsLink(tier: RelatedExperiencePages['tier'], country: string | null): { href: string; label: string } {
  if (country != null && (tier === 'country' || tier === 'region')) {
    return { href: `/trips?country=${encodeURIComponent(country)}`, label: `All ${country} trips` }
  }
  return { href: '/trips', label: 'All trips' }
}

export default function ArticleRelated({ related, country }: { related: ArticleRelatedData; country: string | null }) {
  const { offers } = related
  if (offers.pages.length === 0) return null

  const all = allTripsLink(offers.tier, country)

  return (
    <section data-block="article-related">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SectionHeading eyebrow="Fish it with a guide" title={relatedTripsHeading(offers.tier, country)} />
        <HeadingLink href={all.href}>{all.label}</HeadingLink>
      </div>
      <ul className="m-0 grid list-none gap-x-7 gap-y-10 p-0 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {offers.pages.map(page => (
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
