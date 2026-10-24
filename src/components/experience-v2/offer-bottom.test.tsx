// @vitest-environment jsdom
/**
 * FA-1.55 — S10–S13 of the v2 offer page.
 *
 * Each section follows the rule S3–S9 set: nothing stored, nothing rendered — never a heading
 * over an empty body. S13 included: since feedback round 1 there is no fixed FAQ entry.
 *
 * Fixtures: ./v2-page.fixture.ts (the seed's two v2 pages).
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import type { ExperienceV2Review } from '@/lib/supabase/queries'
import OfferReviews from './offer-reviews'
import OfferLogistics from './offer-logistics'
import OfferBring from './offer-bring'
import OfferFaq from './offer-faq'
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

/**
 * The card has no say over the photo the angler uploaded, so it reads the proportions the
 * browser reports and shows a portrait photo beside the words instead of cropping it into the
 * strip across the top. jsdom never decodes anything: the natural size is stubbed and the load
 * event fired by hand, which is exactly what the browser does.
 */
describe('S10 review photo orientation', () => {
  const withPhoto = (over: Partial<ExperienceV2Review> = {}) =>
    render(
      <OfferReviews
        reviews={[review({ photoUrl: 'https://pics.example/catch.jpg', ...over })]}
        googleRating={null}
        googleReviewCount={null}
        googleProfileUrl={null}
      />,
    )

  function loadPhoto(container: HTMLElement, naturalWidth: number, naturalHeight: number) {
    const photo = container.querySelector('img')
    if (photo == null) throw new Error('the card rendered no photo')
    Object.defineProperty(photo, 'naturalWidth',  { value: naturalWidth,  configurable: true })
    Object.defineProperty(photo, 'naturalHeight', { value: naturalHeight, configurable: true })
    fireEvent.load(photo)
  }

  /** `next/image` decodes first and calls `onLoad` a microtask later; let that run. */
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

  it('starts horizontal, which is what the server renders and what a photo that never loads keeps', () => {
    const { getByTestId } = withPhoto()
    expect(getByTestId('review-card').getAttribute('data-orientation')).toBe('horizontal')
  })

  it('keeps the horizontal strip for a landscape photo', async () => {
    const { container, getByTestId } = withPhoto()
    loadPhoto(container, 1600, 1066)
    await settle()
    expect(getByTestId('review-card').getAttribute('data-orientation')).toBe('horizontal')
  })

  it('shows a portrait photo as the vertical showcase, with the words beside it', async () => {
    const { container, getByTestId } = withPhoto()
    loadPhoto(container, 1080, 1440)
    await waitFor(() =>
      expect(getByTestId('review-card').getAttribute('data-orientation')).toBe('vertical'))
    const card = getByTestId('review-card')
    expect(card.className).toContain('flex-row')
    // The quote and the name are still there — the layout moved, nothing was dropped.
    expect(card.textContent).toContain('Three fish over four pounds')
    expect(card.textContent).toContain('Tomasz, Poland · March 2026')
  })

  it('counts a square photo as horizontal, and a photo the browser could not decode too', async () => {
    const square = withPhoto()
    loadPhoto(square.container, 1200, 1200)
    await settle()
    expect(square.getByTestId('review-card').getAttribute('data-orientation')).toBe('horizontal')
    cleanup()

    const broken = withPhoto()
    loadPhoto(broken.container, 0, 0)
    await settle()
    expect(broken.getByTestId('review-card').getAttribute('data-orientation')).toBe('horizontal')
  })

  it('renders no photo frame at all when the review came without one', () => {
    const { container, getByTestId } = withPhoto({ photoUrl: null })
    expect(container.querySelector('img')).toBeNull()
    expect(getByTestId('review-card').getAttribute('data-orientation')).toBe('horizontal')
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
        seasonPeriods={page.seasonPeriods}
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
        seasonPeriods={[]}
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
        seasonMonths={[10, 11, 12, 1, 2, 3, 4]} peakMonths={[12, 1, 2]} seasonPeriods={[]} region="Otago"
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
        seasonMonths={[]} peakMonths={[]} seasonPeriods={[]} region="Otago"
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
  it('shows exactly the page\'s own questions, in order — nothing appended', () => {
    const { getByTestId } = render(<OfferFaq faq={fixedPage().faq} />)
    const questions = [...getByTestId('offer-faq').querySelectorAll('summary')].map(el => el.textContent ?? '')
    expect(questions).toHaveLength(2)
    expect(questions[0]).toContain('fishing licence')
    expect(questions[1]).toContain('river is muddy')
  })

  it('renders nothing at all when the page has no FAQ', () => {
    const { container } = render(<OfferFaq faq={[]} />)
    expect(container.querySelector('[data-section="S13"]')).toBeNull()
    expect(container.innerHTML).toBe('')
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

describe('S11 season bar — periods (feedback round 1)', () => {
  const periods = [
    { title: 'Summer (December – February)', months: [1, 2, 12], text: 'Prime time for sight-fishing, nymphing, and dry-fly action.' },
    { title: 'Winter (June – August)',       months: [6, 7, 8],  text: 'The signature period of the Taupō fishery.' },
    { title: 'No words yet',                 months: [10],       text: null },
  ]
  const renderBar = () => render(
    <OfferLogistics
      locationLat={null} locationLng={null} nearestAirport={null} suggestedLodging={[]}
      seasonMonths={[10, 11, 12, 1, 2, 3, 4, 6, 7, 8]} peakMonths={[12, 1, 2]} seasonPeriods={periods} region="Taupō"
    />,
  )
  const month = (bar: HTMLElement, n: number) => bar.querySelector(`[data-month="${n}"]`) as HTMLElement
  const panel = (bar: HTMLElement) => bar.querySelector('[data-testid="season-panel"]')?.textContent ?? ''

  it('months whose period has text are buttons described by that period; the others are as before', () => {
    const bar = renderBar().getByTestId('offer-season-bar')
    const jan = month(bar, 1).querySelector('button')
    expect(jan).not.toBeNull()
    expect(month(bar, 1).getAttribute('title')).toBe('January — best · Summer (December – February)')
    const described = bar.ownerDocument.getElementById(jan!.getAttribute('aria-describedby') ?? '')
    expect(described?.textContent).toContain('Prime time for sight-fishing')

    // No period (May), or a period with no text (October): no button, nothing to open.
    expect(month(bar, 5).querySelector('button')).toBeNull()
    expect(month(bar, 10).querySelector('button')).toBeNull()
    // The colours are untouched: the existing state rule still holds.
    expect(month(bar, 1).getAttribute('data-state')).toBe('peak')
    expect(bar.textContent).toContain('dark = best months · mid = open · pale = closed')
  })

  it('click / tap pins a period under the bar, marks the month active, and toggles off on a second tap', () => {
    const bar = renderBar().getByTestId('offer-season-bar')
    expect(panel(bar)).toContain('Pick a month')

    fireEvent.click(month(bar, 7).querySelector('button')!)
    expect(panel(bar)).toContain('Winter (June – August)')
    expect(panel(bar)).toContain('signature period')
    expect(month(bar, 7).getAttribute('data-active')).toBe('true')
    expect(month(bar, 7).querySelector('button')!.getAttribute('aria-pressed')).toBe('true')

    // Another month swaps the one panel's content.
    fireEvent.click(month(bar, 1).querySelector('button')!)
    expect(panel(bar)).toContain('Summer (December – February)')
    expect(bar.querySelectorAll('[data-testid="season-panel"]')).toHaveLength(1)

    fireEvent.click(month(bar, 1).querySelector('button')!)
    expect(panel(bar)).toContain('Pick a month')
    expect(month(bar, 1).getAttribute('data-active')).toBeNull()
  })

  it('a mouse hover previews a period and leaving restores the pinned one; touch pointers do not preview', () => {
    const bar = renderBar().getByTestId('offer-season-bar')
    fireEvent.click(month(bar, 7).querySelector('button')!)

    fireEvent.pointerEnter(month(bar, 12).querySelector('button')!, { pointerType: 'mouse' })
    expect(panel(bar)).toContain('Summer')
    fireEvent.pointerLeave(month(bar, 12).querySelector('button')!, { pointerType: 'mouse' })
    expect(panel(bar)).toContain('Winter')

    fireEvent.pointerEnter(month(bar, 12).querySelector('button')!, { pointerType: 'touch' })
    expect(panel(bar)).toContain('Winter')
  })

  it('a page without periods draws the bar exactly as before: no buttons, no panel', () => {
    const { getByTestId } = render(
      <OfferLogistics
        locationLat={null} locationLng={null} nearestAirport={null} suggestedLodging={[]}
        seasonMonths={[10, 11, 12]} peakMonths={[12]} seasonPeriods={[]} region="Otago"
      />,
    )
    const bar = getByTestId('offer-season-bar')
    expect(bar.querySelector('button')).toBeNull()
    expect(bar.querySelector('[data-testid="season-panel"]')).toBeNull()
  })
})
