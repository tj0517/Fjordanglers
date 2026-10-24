// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import DestinationHubView from './destination-hub-view'
import { completeHub, emptyHub, withCoordinates } from './hub.fixture'
import type { HubMapPin } from './hub-map-view'
import type { DestinationHubData } from '@/lib/supabase/queries'

// Leaflet does not run in jsdom: the map is a list of pin buttons with the same props.
vi.mock('./hub-map-view', () => ({
  default: ({ pins, onPinClick }: { pins: HubMapPin[]; onPinClick: (slug: string) => void }) => (
    <ul data-testid="hub-map-pins">
      {pins.map(pin => (
        <li key={pin.slug}>
          <button type="button" data-pin={pin.slug} onClick={() => onPinClick(pin.slug)}>
            {pin.name} · {pin.priceText} · {pin.guideName ?? '—'}
          </button>
        </li>
      ))}
    </ul>
  ),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * FA-1.65 — the country hub's layout. Fixtures: ./hub.fixture.ts.
 */

/** The page's sections in DOM order: the six measured anchors and the three fixed blocks. */
const order = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-section], [data-block]')]
    .map(el => el.getAttribute('data-section') ?? el.getAttribute('data-block'))

const headings = (container: HTMLElement) =>
  [...container.querySelectorAll('h2')].map(h => h.textContent?.trim() ?? '')

describe('DestinationHubView — complete hub', () => {
  it('FA-1.65: renders all nine sections in the Goal order', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    expect(order(container)).toEqual([
      'hero', 'season', 'species', 'trips', 'faq', 'reviews', 'how-it-works', 'destinations', 'contact',
    ])
  })

  it('FA-1.65: the six data-section anchors FA-1.66 measures are exactly these', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const anchors = [...container.querySelectorAll('[data-section]')].map(el => el.getAttribute('data-section'))
    expect([...new Set(anchors)].sort()).toEqual(['contact', 'faq', 'reviews', 'season', 'species', 'trips'])
  })

  it('FA-1.65: the hero carries the proof line and the quote', () => {
    const { getByTestId } = render(<DestinationHubView data={completeHub()} />)
    expect(getByTestId('hub-proof-line').textContent).toBe('3 guides · from NZ$1,320 · 1–2 anglers per guide · gear included')
    expect(getByTestId('hub-quote').textContent).toContain('Fixture Author, Fixtureland')
  })

  it('FA-1.65: a card shows its price and its first guide, "+1" when the offer has two', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const cards = [...container.querySelectorAll('[data-testid="hub-cards"] > div > a')]
    expect(cards).toHaveLength(3)
    expect(cards[0]!.querySelector('[data-testid="exp-card-price"]')?.textContent).toBe('from NZ$1,320 · 1–2 anglers per guide')
    expect(cards[0]!.querySelector('[data-testid="exp-card-guide"]')?.textContent).toBe('Jwith Josh Fixture +1')
    expect(cards[1]!.querySelector('[data-testid="exp-card-guide"]')?.textContent).toBe('Kwith Kristina Fixture')
    expect(cards[2]!.querySelector('[data-testid="exp-card-guide"]')).toBeNull()
    expect(cards[2]!.querySelector('[data-testid="exp-card-price"]')?.textContent).toBe('Price on request')
  })

  it('FA-1.65: contact is a mail link and a WhatsApp link built from the digits only', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const contact = container.querySelector('[data-section="contact"]')!
    const hrefs = [...contact.querySelectorAll('a')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(['mailto:fixture@example.com', 'https://wa.me/48000000000'])
  })

  it('FA-1.65: the season bar sits in its own horizontal scroller (mobile), not the page', () => {
    const { getByTestId } = render(<DestinationHubView data={completeHub()} />)
    expect(getByTestId('hub-season-scroll').className).toContain('overflow-x-auto')
    expect(getByTestId('hub-season-scroll').querySelector('[data-testid="offer-season-bar"]')).not.toBeNull()
  })

  it('FA-1.65: there is no inquiry form on the hub', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    expect(container.querySelector('form')).toBeNull()
    expect(container.textContent).not.toContain('Check availability')
  })
})

describe('DestinationHubView — empty hub (red proof: no empty heading)', () => {
  it('FA-1.65: renders hero + cards + 3 steps + other countries, nothing else', () => {
    const { container } = render(<DestinationHubView data={emptyHub()} />)
    expect(order(container)).toEqual(['hero', 'trips', 'how-it-works', 'destinations'])
    expect(container.querySelectorAll('[data-step]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid="hub-cards"] > div > a')).toHaveLength(3)
  })

  it('FA-1.65: no heading of an empty section is in the DOM', () => {
    const { container } = render(<DestinationHubView data={emptyHub()} />)
    expect(headings(container)).toEqual(['Guided trips', 'How it works', 'More destinations'])
    for (const gone of ['When to go', 'What you fish for', 'Questions anglers ask', 'What anglers said', 'Questions? Ask']) {
      expect(container.textContent).not.toContain(gone)
    }
  })

  it('FA-1.65: the proof line keeps only what is known — no price, no note', () => {
    const { getByTestId, queryByTestId } = render(<DestinationHubView data={emptyHub()} />)
    expect(getByTestId('hub-proof-line').textContent).toBe('2 guides')
    expect(queryByTestId('hub-quote')).toBeNull()
  })

  it('FA-1.65: a hub with no guides and no price shows no proof line at all', () => {
    const data = { ...emptyHub(), guideCount: 0 }
    const { queryByTestId } = render(<DestinationHubView data={data} />)
    expect(queryByTestId('hub-proof-line')).toBeNull()
  })
})

describe('DestinationHubView — testimonial in place of empty reviews (FA-1.69)', () => {
  const testimonial: NonNullable<DestinationHubData['testimonial']> = {
    id: 't1', quote: 'Fixture testimonial.', authorName: 'Marek', authorCountry: 'PL', tripCountry: 'New Zealand',
    rating: 5, photoUrl: null, photoLayout: 'horizontal', source: 'trustpilot', sourceUrl: 'https://www.trustpilot.com/reviews/fixture',
  }

  it('FA-1.69: reviews present — the reviews section, no testimonial, even when one is passed', () => {
    const { container } = render(<DestinationHubView data={{ ...completeHub(), testimonial }} />)
    expect(container.querySelector('[data-section="reviews"]')).not.toBeNull()
    expect(container.querySelector('[data-block="testimonial"]')).toBeNull()
  })

  it('FA-1.69: no reviews — the testimonial in their slot, and still six measured anchors at most', () => {
    const { container } = render(<DestinationHubView data={{ ...emptyHub(), testimonial }} />)
    expect(order(container)).toEqual(['hero', 'trips', 'testimonial', 'how-it-works', 'destinations'])
    expect(container.querySelector('[data-section="reviews"]')).toBeNull()
  })
})

describe('DestinationHubView — map (FA-1.66)', () => {
  it('FA-1.66: a hub whose offers have no coordinates renders no map section (red proof: fixture)', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    expect(container.querySelector('[data-block="map"]')).toBeNull()
    expect(order(container)[1]).toBe('season')
  })

  it('FA-1.66: the map sits right after the hero; only offers with coordinates get a pin', async () => {
    const { container, findAllByRole } = render(<DestinationHubView data={withCoordinates(completeHub(), ['a', 'b'])} />)
    expect(order(container).slice(0, 3)).toEqual(['hero', 'map', 'season'])
    const pins = await findAllByRole('button', { name: /^Trip / })
    expect(pins.map(p => p.getAttribute('data-pin'))).toEqual(['slug-a', 'slug-b'])
    expect(pins[0]!.textContent).toBe('Trip a · from NZ$1,320 · 1–2 anglers per guide · Josh Fixture')
  })

  it('FA-1.66: every card carries its slug as id — the target of its pin', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const ids = [...container.querySelectorAll('[data-testid="hub-cards"] > div')].map(el => el.id)
    expect(ids).toEqual(['slug-a', 'slug-b', 'slug-c'])
  })

  it('FA-1.66: a pin click scrolls to its card and highlights it for a moment', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const { container, findAllByRole } = render(<DestinationHubView data={withCoordinates(completeHub(), ['a', 'b'])} />)
    const pins = await findAllByRole('button', { name: /^Trip / })

    vi.useFakeTimers()
    fireEvent.click(pins[1]!)
    const card = container.querySelector('#slug-b')!
    expect(card.getAttribute('data-highlighted')).toBe('true')
    expect(container.querySelectorAll('[data-highlighted]')).toHaveLength(1)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(card)

    act(() => { vi.advanceTimersByTime(4000) })
    expect(container.querySelector('[data-highlighted]')).toBeNull()
  })

  it('FA-1.66: a pin whose card a species chip hides resets the chip first', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const { container, getByRole, findAllByRole } = render(<DestinationHubView data={withCoordinates(completeHub(), ['a', 'b'])} />)
    fireEvent.click(getByRole('button', { name: 'Kingfish' }))
    expect(container.querySelector('#slug-a')).toBeNull()

    const pins = await findAllByRole('button', { name: /^Trip / })
    fireEvent.click(pins[0]!)
    expect(container.querySelector('#slug-a')?.getAttribute('data-highlighted')).toBe('true')
    expect(getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })
})
