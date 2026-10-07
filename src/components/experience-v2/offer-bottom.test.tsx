// @vitest-environment jsdom
/**
 * FA-1.55 — S10–S13 of the v2 offer page.
 *
 * Each section follows the rule S3–S9 set: nothing stored, nothing rendered — never a heading
 * over an empty body. S13 is the one exception, and the test says why: the FA-vs-direct
 * question is on every page whether the admin wrote any FAQ or not.
 *
 * Fixtures: ./v2-page.fixture.ts (the seed's two v2 pages).
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ExperienceV2Review } from '@/lib/supabase/queries'
import OfferReviews from './offer-reviews'
import OfferLogistics from './offer-logistics'
import OfferBring from './offer-bring'
import OfferFaq, { FA_VS_DIRECT_ANSWER, FA_VS_DIRECT_QUESTION } from './offer-faq'
import { fixedPage } from './v2-page.fixture'

// Leaflet needs a real browser; the map is proven in the Playwright walk, not here.
vi.mock('@/components/offer/OfferLocationMap', () => ({
  OfferLocationMap: ({ lat, lng }: { lat: number; lng: number }) => (
    <div data-testid="map-stub">{lat},{lng}</div>
  ),
}))

afterEach(cleanup)

const review = (over: Partial<ExperienceV2Review> = {}): ExperienceV2Review => ({
  id:          'r1',
  rating:      5,
  comment:     'Three fish over four pounds, all spotted first.',
  firstName:   'Tomasz',
  country:     'PL',
  submittedAt: '2026-03-18T09:00:00Z',
  photoUrl:    null,
  ...over,
})

describe('S10 reviews', () => {
  it('renders nothing at all when the page has no reviews', () => {
    const { container } = render(
      <OfferReviews reviews={[]} googleRating={4.9} googleReviewCount={37} googleProfileUrl="https://g.example/x" />,
    )
    expect(container.querySelector('[data-section="S10"]')).toBeNull()
  })

  it('shows the first name, the country as a name and the month', () => {
    const { getByTestId } = render(
      <OfferReviews reviews={[review()]} googleRating={null} googleReviewCount={null} googleProfileUrl={null} />,
    )
    const text = getByTestId('offer-reviews').textContent ?? ''
    expect(text).toContain('Tomasz, Poland · March 2026')
    expect(text).toContain('Three fish over four pounds')
  })

  it('never prints more of the name than the data layer gave it', () => {
    const { getByTestId } = render(
      <OfferReviews reviews={[review()]} googleRating={null} googleReviewCount={null} googleProfileUrl={null} />,
    )
    expect(getByTestId('offer-reviews').textContent).not.toContain('Kowalski')
  })

  it('links to the guide\'s Google profile as an external link, with rel set', () => {
    const { container } = render(
      <OfferReviews
        reviews={[review()]}
        googleRating={4.9}
        googleReviewCount={37}
        googleProfileUrl="https://maps.google.example/profile"
      />,
    )
    const link = container.querySelector('a[href="https://maps.google.example/profile"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(container.textContent).toContain('★ 4.9 · 37 reviews on Google')
  })

  it('shows no Google link when the profile URL is missing (the data layer rejected it)', () => {
    const { container } = render(
      <OfferReviews reviews={[review()]} googleRating={4.9} googleReviewCount={37} googleProfileUrl={null} />,
    )
    expect(container.textContent).not.toContain('See all on Google')
  })

  it('renders a card that has a rating but no text, and one with text but no rating', () => {
    const { getByTestId } = render(
      <OfferReviews
        reviews={[review({ id: 'a', comment: null }), review({ id: 'b', rating: null, comment: 'Great day.' })]}
        googleRating={null}
        googleReviewCount={null}
        googleProfileUrl={null}
      />,
    )
    expect(getByTestId('offer-reviews').children).toHaveLength(2)
  })
})

describe('S11 map, logistics and season', () => {
  const page = fixedPage()

  it('renders the map from both coordinates and the two logistics facts', () => {
    const { getByTestId, container } = render(
      <OfferLogistics
        locationLat={page.locationLat}
        locationLng={page.locationLng}
        nearestAirport={page.nearestAirport}
        suggestedLodging={page.suggestedLodging}
        seasonMonths={page.seasonMonths}
        peakMonths={page.peakMonths}
        region={page.region}
      />,
    )
    expect(getByTestId('map-stub').textContent).toBe('-44.7,169.1')
    expect(container.textContent).toContain('Queenstown (ZQN)')
    expect(container.textContent).toContain('Wanaka Lakeside')
    // A lodging row with a URL is a link; one without is plain text.
    expect(container.querySelector('a[href="https://lodging.example/wanaka"]')).not.toBeNull()
    expect(container.textContent).toContain('Queenstown town centre')
  })

  it('draws no map when only one coordinate is stored', () => {
    const { queryByTestId, container } = render(
      <OfferLogistics
        locationLat={-44.7}
        locationLng={null}
        nearestAirport="Queenstown"
        suggestedLodging={[]}
        seasonMonths={[]}
        peakMonths={[]}
        region="Otago"
      />,
    )
    expect(queryByTestId('map-stub')).toBeNull()
    expect(container.textContent).toContain('Queenstown')
  })

  it('marks peak months dark, open months mid and the rest closed', () => {
    const { getByTestId } = render(
      <OfferLogistics
        locationLat={null} locationLng={null} nearestAirport={null} suggestedLodging={[]}
        seasonMonths={[10, 11, 12, 1, 2, 3, 4]} peakMonths={[12, 1, 2]} region="Otago"
      />,
    )
    const bar    = getByTestId('offer-season-bar')
    const states = [...bar.querySelectorAll('[data-month]')].map(el => el.getAttribute('data-state'))
    // Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
    expect(states).toEqual([
      'peak', 'peak', 'open', 'open', 'closed', 'closed',
      'closed', 'closed', 'closed', 'open', 'open', 'peak',
    ])
  })

  it('renders nothing when there is no map, no facts and no season', () => {
    const { container } = render(
      <OfferLogistics
        locationLat={null} locationLng={null} nearestAirport={null} suggestedLodging={[]}
        seasonMonths={[]} peakMonths={[]} region="Otago"
      />,
    )
    expect(container.querySelector('[data-section="S11"]')).toBeNull()
  })
})

describe('S12 what to bring', () => {
  it('lists what is stored', () => {
    const { container } = render(<OfferBring whatToBring={['Polarised sunglasses', 'Layers']} />)
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<OfferBring whatToBring={[]} />)
    expect(container.querySelector('[data-section="S12"]')).toBeNull()
  })
})

describe('S13 FAQ', () => {
  it('shows the page\'s questions and the fixed FA-vs-direct one last', () => {
    const { getByTestId } = render(<OfferFaq faq={fixedPage().faq} />)
    const questions = [...getByTestId('offer-faq').querySelectorAll('summary')].map(el => el.textContent ?? '')
    expect(questions).toHaveLength(3)
    expect(questions[0]).toContain('fishing licence')
    expect(questions.at(-1)).toContain(FA_VS_DIRECT_QUESTION)
  })

  it('still renders with no stored FAQ at all — the fixed question is on every page', () => {
    const { getByTestId } = render(<OfferFaq faq={[]} />)
    expect(getByTestId('offer-faq').querySelectorAll('summary')).toHaveLength(1)
  })

  it('the FA-vs-direct answer is still the placeholder — this test fails when tj\'s copy lands, which is the point', () => {
    const { getByTestId } = render(<OfferFaq faq={[]} />)
    expect(getByTestId('offer-faq').textContent).toContain(FA_VS_DIRECT_ANSWER)
    expect(FA_VS_DIRECT_ANSWER).toBe('[FA vs direct — answer from tj]')
  })

  it('renders answers as text, never as markup', () => {
    const { getByTestId } = render(
      <OfferFaq faq={[{ question: 'Q?', answer: '<img src=x onerror="alert(1)">' }]} />,
    )
    const body = getByTestId('offer-faq')
    expect(body.querySelector('img')).toBeNull()
    expect(body.textContent).toContain('<img src=x')
  })
})
