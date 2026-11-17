// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import DestinationHubView, { monthRange } from './destination-hub-view'
import { completeHub, emptyHub } from './hub.fixture'
import type { DestinationHubData } from '@/lib/supabase/queries'
import type { BlogPostSummary } from '@/lib/blog/post'

afterEach(cleanup)

/**
 * The country hub's layout (FA-1.65; 2026-11 redesign, docs/design/blog-hubs-2026-11).
 * Fixtures: ./hub.fixture.ts.
 */

/** The page's sections in DOM order: the measured anchors and the fixed blocks. */
const order = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-section], [data-block]')]
    .map(el => el.getAttribute('data-section') ?? el.getAttribute('data-block'))

const headings = (container: HTMLElement) =>
  [...container.querySelectorAll('h2')].map(h => h.textContent?.trim() ?? '')

const article = (slug: string): BlogPostSummary => ({
  slug, title: `Article ${slug}`, description: 'Fixture description.', imageUrl: '/hub/iceland.jpg', imageAlt: '',
  category: 'Seasons', country: 'New Zealand', publishedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readMinutes: 4,
})

const guides: DestinationHubData['guides'] = [
  { id: '11111111-1111-1111-1111-111111111111', slug: 'fixture-guide', name: 'Fixture Guide', avatarUrl: null, tagline: 'Fixture tagline.' },
  { id: '22222222-2222-2222-2222-222222222222', slug: null, name: 'No Slug Guide', avatarUrl: null, tagline: null },
]

describe('DestinationHubView — complete hub', () => {
  it('renders every section in the mockup order', () => {
    const data = { ...completeHub(), guides, articles: [article('a')] }
    const { container } = render(<DestinationHubView data={data} />)
    expect(order(container)).toEqual([
      'hero', 'trips', 'season', 'guides', 'how-it-works', 'reviews', 'articles', 'faq', 'destinations', 'plan',
    ])
  })

  it('FA-1.66: the funnel anchors are exactly the four HUB_SECTIONS', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const anchors = [...container.querySelectorAll('[data-section]')].map(el => el.getAttribute('data-section'))
    expect([...new Set(anchors)].sort()).toEqual(['faq', 'reviews', 'season', 'trips'])
  })

  it('the hero facts are computed from the hub data, each only when known', () => {
    const { getByTestId } = render(<DestinationHubView data={completeHub()} />)
    const facts = [...getByTestId('hub-facts').querySelectorAll('div')].map(d => d.textContent)
    expect(facts).toEqual([
      'SeasonOctober to April',
      'Best monthsDecember to February',
      'SpeciesRainbow Trout, Brown Trout, Kingfish',
      'Guides3',
      'Trips fromNZ$1,320',
    ])
  })

  it('a card shows its price and links to its offer page', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const cards = [...container.querySelectorAll('[data-testid="hub-cards"] > article')]
    expect(cards.map(c => c.id)).toEqual(['slug-a', 'slug-b', 'slug-c'])
    expect(cards[0]!.querySelector('[data-testid="hub-card-price"]')?.textContent).toBe('from NZ$1,320 · 1–2 anglers per guide')
    expect(cards[2]!.querySelector('[data-testid="hub-card-price"]')?.textContent).toBe('Price on request')
    expect([...cards[0]!.querySelectorAll('a')].every(a => a.getAttribute('href') === '/experiences/slug-a')).toBe(true)
  })

  it('the season bar marks peak, in-season and closed months', () => {
    const { getByTestId } = render(<DestinationHubView data={completeHub()} />)
    const states = [...getByTestId('hub-season-scroll').querySelectorAll('[data-month-state]')].map(el => el.getAttribute('data-month-state'))
    expect(states).toEqual(['peak', 'peak', 'season', 'season', 'closed', 'closed', 'closed', 'closed', 'closed', 'season', 'season', 'peak'])
  })

  it('the FAQ is one <details> per question, the first one open', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const items = [...container.querySelectorAll('[data-section="faq"] details')] as HTMLDetailsElement[]
    expect(items).toHaveLength(1)
    expect(items[0]!.open).toBe(true)
    expect(container.querySelector('[data-section="faq"] a')?.getAttribute('href')).toBe('mailto:fixture@example.com')
  })

  it('the closing block offers WhatsApp built from the digits only', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    const hrefs = [...container.querySelectorAll('[data-block="plan"] a')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(['/trips', 'https://wa.me/48000000000'])
  })

  it('the hero photo is the one set in /admin/hubs, then the newest offer photo, then the default', () => {
    const src = (data: DestinationHubData) => {
      const { container } = render(<DestinationHubView data={data} />)
      const img = container.querySelector('[data-block="hero"] img')?.getAttribute('src') ?? ''
      cleanup()
      return decodeURIComponent(img)
    }
    const hub = completeHub()
    expect(src({ ...hub, hub: { ...hub.hub, heroImageUrl: '/hub/norway.jpg' }, ogImage: '/hub/sweden.jpg' })).toContain('/hub/norway.jpg')
    expect(src({ ...hub, ogImage: '/hub/sweden.jpg' })).toContain('/hub/sweden.jpg')
    expect(src(hub)).toContain('/hub/canyon.jpg')
  })

  it('FA-1.65: there is no inquiry form on the hub', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    expect(container.querySelector('form')).toBeNull()
  })
})

describe('DestinationHubView — empty hub (red proof: no empty heading)', () => {
  it('renders hero + cards + 3 steps + other destinations + closing block, nothing else', () => {
    const { container } = render(<DestinationHubView data={emptyHub()} />)
    expect(order(container)).toEqual(['hero', 'trips', 'how-it-works', 'destinations', 'plan'])
    expect(container.querySelectorAll('[data-step]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid="hub-cards"] > article')).toHaveLength(3)
  })

  it('no heading of an empty section is in the DOM', () => {
    const { container } = render(<DestinationHubView data={emptyHub()} />)
    expect(headings(container)).toEqual(['Guided fishing trips in New Zealand', 'How it works', 'More destinations', 'Tell us your dates for New Zealand'])
  })

  it('the hero shows only the facts it knows: no season, no price', () => {
    const { getByTestId } = render(<DestinationHubView data={emptyHub()} />)
    expect(getByTestId('hub-facts').textContent).toBe('Guides2')
  })

  it('a hub with no guides and no price shows no fact list at all', () => {
    const { queryByTestId } = render(<DestinationHubView data={{ ...emptyHub(), guideCount: 0 }} />)
    expect(queryByTestId('hub-facts')).toBeNull()
  })
})

describe('DestinationHubView — the angler quote', () => {
  const testimonial: NonNullable<DestinationHubData['testimonial']> = {
    id: 't1', quote: 'Fixture testimonial.', authorName: 'Marek', authorCountry: 'PL', tripCountry: 'New Zealand',
    rating: 5, photoUrl: null, photoLayout: 'horizontal', source: 'trustpilot', sourceUrl: 'https://www.trustpilot.com/reviews/fixture',
  }

  it('reviews present: the newest review, even when a testimonial is passed', () => {
    const { container } = render(<DestinationHubView data={{ ...completeHub(), testimonial }} />)
    expect(container.querySelector('[data-section="reviews"] blockquote')?.textContent).toBe('Fixture review.')
  })

  it('FA-1.69: no reviews — the testimonial in their place', () => {
    const { container } = render(<DestinationHubView data={{ ...emptyHub(), testimonial }} />)
    expect(container.querySelector('[data-section="reviews"] blockquote')?.textContent).toBe('Fixture testimonial.')
    expect(container.querySelector('[data-section="reviews"] figcaption')?.textContent).toBe('Marek, Poland')
  })
})

describe('DestinationHubView — guides and articles (FA-1.82)', () => {
  it('FA-1.86: a guide links to /guides/<slug>; a guide without a slug is shown without any link', () => {
    const { container } = render(<DestinationHubView data={{ ...completeHub(), guides }} />)
    const block = container.querySelector('[data-block="guides"]')!
    expect([...block.querySelectorAll('li a')].map(a => a.getAttribute('href'))).toEqual(['/guides/fixture-guide'])
    expect(block.innerHTML).not.toMatch(/22222222-2222-2222-2222-222222222222|\/guides\/(null|undefined)/)
    expect(block.textContent).toContain('NSNo Slug Guide')
    expect(block.textContent).toContain('Fixture tagline.')
  })

  it('at most the three newest articles, each linking to its post', () => {
    const data = { ...completeHub(), articles: ['a', 'b', 'c', 'd'].map(article) }
    const { container } = render(<DestinationHubView data={data} />)
    const titles = [...container.querySelectorAll('[data-block="articles"] h3 a')].map(a => a.getAttribute('href'))
    expect(titles).toEqual(['/blog/a', '/blog/b', '/blog/c'])
  })

  it('no guides and no articles — neither block, no heading', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    expect(container.querySelector('[data-block="guides"]')).toBeNull()
    expect(container.querySelector('[data-block="articles"]')).toBeNull()
    expect(container.textContent).not.toContain('Your guides')
    expect(container.textContent).not.toContain('Read before you go')
  })
})

describe('monthRange', () => {
  it('reads runs, a season across the new year, gaps and the whole year', () => {
    expect(monthRange([4, 5, 6, 7, 8, 9])).toBe('April to September')
    expect(monthRange([10, 11, 12, 1, 2, 3, 4])).toBe('October to April')
    expect(monthRange([5, 6, 9])).toBe('May to June, September')
    expect(monthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('All year')
    expect(monthRange([])).toBeNull()
  })
})
