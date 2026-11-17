/**
 * The guide profile in the 2026-11 design: sections draw on the same conditions as before
 * (Photos, Specialties, the boat, Google reviews, Trips only with data), the trips use the site's
 * one trip card, and "Total reviews" / "Rating" are left out while the guide has no reviews
 * (tj, 2026-11-17).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  permanentRedirect: (to: string) => { throw new Error(`REDIRECT:${to}`) },
}))

const getGuide = vi.fn()
const getGuideExperiencePages = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  getGuide: (...a: unknown[]) => getGuide(...a),
  getGuideExperiencePages: (...a: unknown[]) => getGuideExperiencePages(...a),
}))

import GuideProfilePage from '../page'

const guide = (over: Record<string, unknown> = {}) => ({
  id: 'g-1', slug: 'hana-seed', full_name: 'Hana Seed', country: 'New Zealand', city: 'Queenstown',
  bio: 'Hana fishes the Otago backcountry.', tagline: null, avatar_url: null, cover_url: null, landscape_url: '/hub/nzriver.jpg',
  fish_expertise: ['Brown trout', 'Rainbow trout'], languages: ['English'], years_experience: 9,
  total_reviews: 0, average_rating: null, certifications: null, specialties: null,
  boat_name: null, boat_type: null, boat_length_m: null, boat_engine: null, boat_capacity: null,
  google_rating: null, google_review_count: null, google_profile_url: null,
  instagram_url: null, youtube_url: null, facebook_url: null, website_url: null,
  verified_at: null, cancellation_policy: 'moderate', images: [],
  ...over,
})

const TRIP = {
  id: 'e-1', slug: 'seed-backcountry-day-nz', experience_name: 'Backcountry day', country: 'New Zealand',
  hero_image_url: '/hero.jpg', gallery_image_urls: [], price_from: 650, price_type: 'per_person', currency: 'NZD',
  target_species: ['Brown trout'], difficulty: 'expert',
}

const render = async () => renderToStaticMarkup(await GuideProfilePage({ params: Promise.resolve({ id: 'hana-seed' }) }))
const sections = (html: string) => [...html.matchAll(/data-section="([a-z]+)"/g)].map(m => m[1])
const facts = (html: string) => /data-testid="guide-facts"(.*?)<\/div><\/div><\/section>/.exec(html)![1]!
const card  = (html: string) => /data-testid="guide-contact-card"(.*?)<\/aside>/.exec(html)![1]!

beforeEach(() => {
  getGuide.mockReset()
  getGuideExperiencePages.mockReset()
  getGuideExperiencePages.mockResolvedValue([])
})

describe('reviews figures (tj 2026-11-17)', () => {
  it('no reviews → no "Total reviews" and no "Rating", in the facts or the contact card', async () => {
    getGuide.mockResolvedValue(guide())
    const html = await render()
    expect(facts(html)).toContain('Experience')
    expect(facts(html)).toContain('Queenstown, New Zealand')
    expect(facts(html)).not.toContain('Total reviews')
    expect(facts(html)).not.toContain('Rating')
    expect(card(html)).toContain('Experiences')
    expect(card(html)).not.toContain('Rating')
    expect(html).not.toContain('—</span></div><div') // no empty "—" rating tile left behind
  })

  it('with reviews → both tiles, and the rating in the card', async () => {
    getGuide.mockResolvedValue(guide({ total_reviews: 3, average_rating: 4.67 }))
    const html = await render()
    expect(facts(html)).toMatch(/Total reviews<\/span><span[^>]*>3</)
    expect(facts(html)).toContain('★ 4.7')
    expect(card(html)).toContain('★ 4.7')
  })
})

describe('sections draw only with data', () => {
  it('a bare guide: About and Skills only', async () => {
    getGuide.mockResolvedValue(guide())
    expect(sections(await render())).toEqual(['about', 'skills'])
  })

  it('photos, specialties, boat, Google reviews and trips appear with their data', async () => {
    getGuide.mockResolvedValue(guide({
      images: [{ id: 'i-1', url: '/about/gallery-1.jpg', is_cover: true }],
      specialties: ['Sight fishing'],
      boat_name: 'Kea', boat_type: 'drift_boat', boat_length_m: 5, boat_capacity: 3,
      google_rating: 4.9, google_review_count: 41, google_profile_url: 'https://g.page/hana',
      certifications: ['NZPFGA'],
    }))
    getGuideExperiencePages.mockResolvedValue([TRIP])
    const html = await render()
    expect(sections(html)).toEqual(['about', 'photos', 'specialties', 'skills', 'boat', 'trips'])
    expect(html).toContain('Sight fishing')
    expect(html).toContain('Drift Boat')
    expect(html).toContain('3 persons max')
    expect(html).toContain('data-testid="google-reviews"')
    expect(html).toContain('href="https://g.page/hana"')
    expect(facts(html)).toContain('NZPFGA')
  })

  it('a boat with only a type is still drawn, titled "The vessel"', async () => {
    getGuide.mockResolvedValue(guide({ boat_type: 'kayak' }))
    const html = await render()
    expect(sections(html)).toContain('boat')
    expect(html).toContain('The vessel')
  })
})

describe('trips', () => {
  it('use the site trip card with the price as the offer page prints it', async () => {
    getGuide.mockResolvedValue(guide())
    getGuideExperiencePages.mockResolvedValue([TRIP])
    const html = await render()
    expect(html).toContain('href="/experiences/seed-backcountry-day-nz"')
    expect(html).toContain('Book a trip with Hana')
    expect(html).toMatch(/data-testid="hub-card-price"[^>]*>from NZ\$650 \/ person</)
  })
})

describe('hero', () => {
  it('breadcrumb back to /guides, initials without an avatar, species and years tags', async () => {
    getGuide.mockResolvedValue(guide())
    const html = await render()
    expect(html).toMatch(/aria-label="Breadcrumb".*href="\/guides".*aria-current="page"[^>]*>Hana Seed</)
    expect(html).toContain('>HS<')
    expect(html).toContain('9 yrs exp')
    expect(html).toContain('nzriver.jpg')
  })
})
