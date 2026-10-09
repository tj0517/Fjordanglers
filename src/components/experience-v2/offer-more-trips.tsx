/**
 * "More trips" — the last block before the footer: three other pages, as close to this one
 * as the catalogue allows. The data layer picks the tier (same region, same country, same
 * part of the world, anywhere) and the heading says which, so "More trips in Otago" is
 * never a lie and "More places we guide" is never a dead end.
 *
 * Cards are the home page's: photo, flag, name, guide and the "from" price.
 */

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CountryFlag } from '@/components/ui/country-flag'
import { formatPrice } from '@/lib/format-price'
import type { RelatedExperiencePages } from '@/lib/supabase/queries'
import { mutedStyle, hairline } from './offer-box'

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
    <section
      data-section="more-trips"
      className="mt-14 border-t pt-10 sm:mt-16 sm:pt-12"
      style={{ borderColor: hairline }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Keep exploring
          </p>
          <h2 className="f-display text-[26px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[32px]">
            {heading(related.tier, country, region)}
          </h2>
        </div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 text-[15px] font-semibold underline decoration-[rgba(10,46,77,0.3)] underline-offset-4 hover:decoration-current"
        >
          All trips <ArrowRight aria-hidden size={15} strokeWidth={2.25} />
        </Link>
      </div>

      <ul
        className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
        data-testid="offer-more-trips"
      >
        {related.pages.map(page => (
          <li key={page.id} className="w-[280px] flex-none snap-start sm:w-auto">
            <Link href={`/experiences/${page.slug}`} className="group block">
              <div
                className="relative h-[240px] overflow-hidden rounded-2xl sm:h-[260px]"
                style={{ background: '#1a3a5c', boxShadow: '0 12px 32px -12px rgba(10,46,77,0.25)' }}
              >
                {page.hero_image_url != null && (
                  <Image
                    src={page.hero_image_url}
                    alt={page.experience_name}
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 280px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.78) 0%, rgba(5,10,20,0.1) 55%, transparent 100%)' }}
                />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <CountryFlag country={page.country} size={12} />
                    {page.country}{page.region !== '' && ` · ${page.region}`}
                  </p>
                  <h3 className="f-display text-[18px] font-bold leading-tight">{page.experience_name}</h3>
                </div>
              </div>
              <p className="mt-2.5 px-1 text-[13px]" style={mutedStyle}>
                {page.guide?.full_name != null && <>{page.guide.full_name} · </>}
                {formatPrice({ priceFrom: page.price_from, priceType: page.price_type, currency: page.currency })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
