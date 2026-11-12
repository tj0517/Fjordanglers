/**
 * Below an article (FA-1.90): where to go after reading — 2–3 trips, 1–2 guides from the post's
 * country, and the country's hub. The data layer picks the trips' tier (same country, same part of
 * the world, anywhere — tj D3) and the heading says which, so "Trips in Norway" is never a list of
 * Swedish trips. A general post (no country) gets trips from anywhere, no guides and no hub link.
 * Each part hides when it is empty; with nothing at all the block is not rendered.
 */

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CountryFlag } from '@/components/ui/country-flag'
import { GuideLink } from '@/components/guides/guide-link'
import { formatPrice } from '@/lib/format-price'
import type { ArticleRelated as ArticleRelatedData, RelatedExperiencePages } from '@/lib/supabase/queries'

export function relatedTripsHeading(tier: RelatedExperiencePages['tier'], country: string | null): string {
  if (country != null && (tier === 'country' || tier === 'region')) return `Trips in ${country}`
  if (country != null && tier === 'group') return `Trips near ${country}`
  return 'Trips we guide'
}

const cardShadow = '0 1px 2px rgba(10,46,77,0.06), 0 12px 32px -12px rgba(10,46,77,0.14)'

export default function ArticleRelated({ related, country }: { related: ArticleRelatedData; country: string | null }) {
  const { offers, guides, hub } = related
  if (offers.pages.length === 0 && guides.length === 0 && hub == null) return null

  return (
    <section data-block="article-related" style={{ marginTop: '5rem', paddingTop: '3rem', borderTop: '1px solid rgba(10,46,77,0.1)' }}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
        Fish it with a guide
      </p>

      {offers.pages.length > 0 && (
        <div data-part="trips">
          <h2 className="f-display text-[26px] font-bold leading-[1.1] sm:text-[30px]" style={{ color: '#0A2E4D' }}>
            {relatedTripsHeading(offers.tier, country)}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {offers.pages.map(page => (
              <li key={page.id}>
                <Link href={`/experiences/${page.slug}`} className="group block">
                  <div className="relative h-[200px] overflow-hidden rounded-2xl" style={{ background: '#1a3a5c', boxShadow: cardShadow }}>
                    {page.hero_image_url != null && (
                      <Image
                        src={page.hero_image_url}
                        alt={page.experience_name}
                        fill
                        sizes="(min-width: 640px) 240px, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                      />
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,10,20,0.78) 0%, rgba(5,10,20,0.1) 55%, transparent 100%)' }} />
                    <div className="absolute inset-x-3 bottom-3 text-white">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] f-body" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        <CountryFlag country={page.country} size={12} />
                        {page.country}
                      </p>
                      <h3 className="f-display text-[16px] font-bold leading-tight">{page.experience_name}</h3>
                    </div>
                  </div>
                  <p className="mt-2 px-1 text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                    {formatPrice({ priceFrom: page.price_from, priceType: page.price_type, currency: page.currency })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guides.length > 0 && (
        <div data-part="guides" className="mt-10">
          <h2 className="f-display text-[22px] font-bold leading-[1.1] sm:text-[24px]" style={{ color: '#0A2E4D' }}>
            Guides in {country}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guides.map(guide => (
              <li key={guide.id}>
                <GuideLink
                  slug={guide.slug}
                  className="flex h-full items-start gap-4 rounded-2xl bg-white px-5 py-4 transition-transform hover:-translate-y-0.5"
                  style={{ color: '#0A2E4D', boxShadow: cardShadow }}
                >
                  {guide.avatarUrl != null ? (
                    <span className="relative block h-12 w-12 flex-none overflow-hidden rounded-full" style={{ background: '#EDE6DB' }}>
                      <Image src={guide.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-[16px] font-semibold f-body" style={{ background: 'rgba(10,46,77,0.10)' }}>
                      {guide.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold f-body">{guide.name}</span>
                    {guide.tagline != null && guide.tagline.trim() !== '' && (
                      <span className="mt-1 block text-[14px] leading-snug f-body" style={{ color: 'rgba(10,46,77,0.68)' }}>{guide.tagline}</span>
                    )}
                  </span>
                </GuideLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hub != null && (
        <Link
          href={`/${hub.slug}`}
          data-part="hub"
          className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold f-body underline decoration-[rgba(10,46,77,0.3)] underline-offset-4 hover:decoration-current"
          style={{ color: '#0A2E4D' }}
        >
          {hub.label} <ArrowRight aria-hidden size={15} strokeWidth={2.25} />
        </Link>
      )}
    </section>
  )
}
