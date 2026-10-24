// @vitest-environment jsdom
/**
 * FA-1.69 — on an offer page a testimonial only ever stands in for an empty S10. The whole
 * template is rendered to HTML (data mocked), so the check is on the markup a visitor gets:
 * with reviews, S10 and no testimonial — and no testimonial is even fetched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Testimonial } from '@/lib/supabase/testimonials'

const h = vi.hoisted(() => ({
  getExperienceV2: vi.fn(),
  getTestimonial:  vi.fn(),
}))

vi.mock('@/lib/env', () => ({ env: { EXPERIENCE_V2_ENABLED: true, NEXT_PUBLIC_WHATSAPP_NUMBER: '48600100200' } }))
vi.mock('@/lib/supabase/queries', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/supabase/queries')>()),
  getExperienceV2:           h.getExperienceV2,
  getRelatedExperiencePages: async () => ({ pages: [], tier: 'anywhere' }),
}))
vi.mock('@/lib/supabase/testimonials', () => ({ getTestimonial: h.getTestimonial }))
vi.mock('@/lib/fx', () => ({ fetchIndicativeRates: async () => ({}) }))
vi.mock('next/navigation', () => ({
  notFound:        () => { throw new Error('NEXT_NOT_FOUND') },
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname:     () => '/experiences/seed-nz',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/layout/nav-with-user', () => ({ NavWithUser: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/offer/OfferLocationMap', () => ({ OfferLocationMap: () => null }))

import ExperienceV2 from '../_v2/ExperienceV2'
import { fixedPage } from '@/components/experience-v2/v2-page.fixture'

const testimonial: Testimonial = {
  id: 't1', quote: 'Fixture testimonial.', authorName: 'Marek', authorCountry: 'PL', tripCountry: 'New Zealand',
  rating: 5, photoUrl: null, photoLayout: 'horizontal', source: 'trustpilot', sourceUrl: 'https://www.trustpilot.com/reviews/fixture',
}

const review = {
  id: 'r1', rating: 5, comment: 'Fixture review.', firstName: 'Ann', country: 'DE',
  submittedAt: '2026-03-01T00:00:00Z', photoUrl: null,
}

async function html(reviews: typeof review[]): Promise<string> {
  h.getExperienceV2.mockResolvedValue(fixedPage({ reviews }))
  return renderToStaticMarkup(await ExperienceV2({ slug: 'seed-nz' }) as ReactElement)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getTestimonial.mockResolvedValue(testimonial)
})

describe('offer page: S10 or one testimonial, never both', () => {
  it('reviews present — S10 rendered, no testimonial in the markup, none fetched', async () => {
    const markup = await html([review])
    expect(markup).toContain('data-section="S10"')
    expect(markup).not.toContain('data-block="testimonial"')
    expect(h.getTestimonial).not.toHaveBeenCalled()
  })

  it('no reviews — the testimonial for the page country in S10’s place', async () => {
    const markup = await html([])
    expect(markup).not.toContain('data-section="S10"')
    expect(markup).toContain('data-block="testimonial"')
    expect(h.getTestimonial).toHaveBeenCalledWith(['New Zealand'])
  })
})
