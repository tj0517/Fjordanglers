// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import DestinationHubView from './destination-hub-view'
import { completeHub, emptyHub } from './hub.fixture'

afterEach(cleanup)

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
    const cards = [...container.querySelectorAll('[data-testid="hub-cards"] > a')]
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
    expect(container.querySelectorAll('[data-testid="hub-cards"] > a')).toHaveLength(3)
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
