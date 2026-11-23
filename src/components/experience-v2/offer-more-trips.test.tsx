import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OfferMoreTrips from './offer-more-trips'
import type { FeaturedExperiencePage } from '@/lib/supabase/queries'

/**
 * FA-1.97 (tj review): only the trip cards under a blog article link their guide. The offer page's
 * "More trips" reads the same `relatedPagesByTier` data — `publicSlug` included — and still prints
 * the guide's name as text.
 */

const page = (n: number): FeaturedExperiencePage => ({
  id: `p${n}`, slug: `trip-${n}`, experience_name: `Trip ${n}`, country: 'Norway', region: 'Lofoten',
  price_from: 100, price_type: 'per_person', currency: 'EUR', hero_image_url: null,
  guide: { id: `g${n}`, full_name: `Guide ${n}`, publicSlug: `guide-${n}` },
})

describe('OfferMoreTrips', () => {
  it('names the guide on each card but never links the profile, even when the data has a public slug', () => {
    const html = renderToStaticMarkup(<OfferMoreTrips related={{ tier: 'country', pages: [page(1), page(2)] }} country="Norway" region="Lofoten" />)
    expect(html.replace(/<!-- -->/g, '')).toContain('Guide: Guide 1')
    expect(html.replace(/<!-- -->/g, '')).toContain('Guide: Guide 2')
    expect(html).not.toContain('/guides/')
  })
})
