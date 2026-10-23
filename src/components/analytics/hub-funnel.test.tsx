// @vitest-environment jsdom
/**
 * FA-1.66 — the country hub in GA4, on the real hub view (fixture data).
 *
 * What is proven here:
 *   • hub_view, section_view and hub_card_click go to GA4 (send_to) with the hub's page_slug;
 *   • hub_view and each section_view fire once per page load — a re-render and a section seen
 *     again do not send them again (red proof: without the guard in hub-funnel.tsx the
 *     "seen again" assertion fails, because the observer keeps watching counted sections);
 *   • exactly season / trips / faq / reviews are watched;
 *   • hub_card_click carries experience_slug and the card's slot among the cards shown;
 *   • nothing on the hub sends the Ads conversion or SUBMIT_LEAD_FORM.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import DestinationHubView from '@/components/destination-hub/destination-hub-view'
import { completeHub } from '@/components/destination-hub/hub.fixture'

type GtagCall = [command: string, action: string, params: Record<string, unknown>]

let gtag: ReturnType<typeof vi.fn>

/** IntersectionObserver stand-in: the test decides what is on screen. */
let observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = []

class FakeIntersectionObserver {
  private readonly entry: { callback: IntersectionObserverCallback; targets: Element[] }
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] }
    observers.push(this.entry)
  }
  observe(target: Element) { this.entry.targets.push(target) }
  unobserve(target: Element) { this.entry.targets = this.entry.targets.filter(t => t !== target) }
  disconnect() { this.entry.targets = [] }
}

/** Puts `el` `ratio` on screen, in a 1000 px viewport. */
function show(el: Element, ratio: number) {
  for (const o of observers) {
    if (!o.targets.includes(el)) continue
    const entry = {
      target:            el,
      isIntersecting:    ratio > 0,
      intersectionRatio: ratio,
      intersectionRect:  { height: 300 * ratio },
      rootBounds:        { height: 1000 },
    } as unknown as IntersectionObserverEntry
    act(() => o.callback([entry], {} as IntersectionObserver))
  }
}

const section = (container: HTMLElement, name: string) => container.querySelector(`[data-section="${name}"]`)!
const events  = () => (gtag.mock.calls as GtagCall[]).map(([, action]) => action)
const callsOf = (action: string) => (gtag.mock.calls as GtagCall[]).filter(([, a]) => a === action).map(([, , p]) => p)

const HUB = { send_to: 'G-Z3Y8GMHR4J', page_slug: 'fixture-hub' }

beforeEach(() => {
  observers = []
  gtag = vi.fn()
  vi.stubGlobal('gtag', gtag)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the hub funnel', () => {
  it('sends hub_view once per page load, re-renders included', () => {
    const view = render(<DestinationHubView data={completeHub()} />)
    view.rerender(<DestinationHubView data={completeHub()} />)
    expect(callsOf('hub_view')).toEqual([HUB])
  })

  it('watches exactly season, trips, faq and reviews', () => {
    render(<DestinationHubView data={completeHub()} />)
    const watched = observers.flatMap(o => o.targets).map(t => t.getAttribute('data-section'))
    expect(watched).toEqual(['season', 'trips', 'faq', 'reviews'])
  })

  it('sends section_view once per section, only when half of it is on screen', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    show(section(container, 'season'), 0.3)
    expect(callsOf('section_view')).toEqual([])
    show(section(container, 'season'), 0.6)
    show(section(container, 'trips'), 1)
    show(section(container, 'faq'), 0.5)
    show(section(container, 'reviews'), 0.8)
    expect(callsOf('section_view')).toEqual([
      { ...HUB, section: 'season' },
      { ...HUB, section: 'trips' },
      { ...HUB, section: 'faq' },
      { ...HUB, section: 'reviews' },
    ])
  })

  it('does not send section_view again when the visitor comes back to a section', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    show(section(container, 'season'), 0.9)
    show(section(container, 'season'), 0)
    show(section(container, 'season'), 0.9)
    expect(callsOf('section_view')).toEqual([{ ...HUB, section: 'season' }])
  })

  it('sends hub_card_click with experience_slug and the card slot among the cards shown', () => {
    const { container, getByRole } = render(<DestinationHubView data={completeHub()} />)
    // jsdom does not navigate; the click only has to reach the card's handler.
    container.addEventListener('click', e => e.preventDefault())
    const cards = () => [...container.querySelectorAll('[data-testid="hub-cards"] > div > a')]

    fireEvent.click(cards()[1]!)
    fireEvent.click(getByRole('button', { name: 'Kingfish' }))
    fireEvent.click(cards()[0]!)

    expect(callsOf('hub_card_click')).toEqual([
      { ...HUB, experience_slug: 'slug-b', position: 2 },
      { ...HUB, experience_slug: 'slug-b', position: 1 },
    ])
  })

  it('never sends the Ads conversion or SUBMIT_LEAD_FORM', () => {
    const { container } = render(<DestinationHubView data={completeHub()} />)
    container.addEventListener('click', e => e.preventDefault())
    for (const name of ['season', 'trips', 'faq', 'reviews']) show(section(container, name), 1)
    fireEvent.click(container.querySelector('[data-testid="hub-cards"] > div > a')!)
    expect(events()).not.toContain('conversion')
    expect(events()).not.toContain('SUBMIT_LEAD_FORM')
    expect(new Set(events())).toEqual(new Set(['hub_view', 'section_view', 'hub_card_click']))
  })
})
