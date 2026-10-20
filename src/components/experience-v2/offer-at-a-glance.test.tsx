// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import OfferAtAGlance, { type OfferAtAGlanceProps } from './offer-at-a-glance'
import type { HeroFacts } from '@/lib/experience-v2-content'

afterEach(cleanup)

const none: HeroFacts = {
  location: null, dayLength: null, groupSize: null, season: null, gearIncluded: null, startPickup: null,
}

const glance = (over: Partial<OfferAtAGlanceProps> = {}) => render(
  <OfferAtAGlance
    technique={['Fly fishing', 'Spinning']}
    meetingPointName="Wanaka lakefront"
    meetingPointDescription="by the willow"
    maxAnglersPerGuide={2}
    languages={['en']}
    walkingKmMin={6}
    walkingKmMax={12}
    heroFacts={null}
    {...over}
  />,
)

/** label → value of every card drawn. */
function cards(container: HTMLElement): Record<string, string> {
  return Object.fromEntries([...container.querySelectorAll('[data-section="S3"] span.min-w-0')].map(card => {
    const [label, value] = card.querySelectorAll('span')
    return [label.textContent ?? '', value.textContent ?? '']
  }))
}

describe('OfferAtAGlance (S3)', () => {
  it('without hero facts: start and group size are computed as before', () => {
    const shown = cards(glance().container)
    expect(shown['Start and pick-up']).toBe('Wanaka lakefront — by the willow')
    expect(shown['Group size']).toBe('1–2 anglers per guide')
  })

  it('hero facts with neither field set change nothing', () => {
    expect(cards(glance({ heroFacts: { ...none, location: 'Tierra del Fuego' } }).container))
      .toEqual(cards(glance().container))
  })

  it('a typed start_pickup replaces the meeting point and keeps its line breaks', () => {
    const { container } = glance({ heroFacts: { ...none, startPickup: 'Hotel in Río Grande, 7:00\nBack around 19:00' } })
    expect(cards(container)['Start and pick-up']).toBe('Hotel in Río Grande, 7:00\nBack around 19:00')
    expect(container.textContent).not.toContain('Wanaka lakefront')
    expect(cards(container)['Group size']).toBe('1–2 anglers per guide')
  })

  it('a typed group_size is shown as free text; the meeting point stays computed', () => {
    const shown = cards(glance({ heroFacts: { ...none, groupSize: '2–4 anglers, two boats' } }).container)
    expect(shown['Group size']).toBe('2–4 anglers, two boats')
    expect(shown['Start and pick-up']).toBe('Wanaka lakefront — by the willow')
  })

  it('a typed start_pickup draws the card even when the page has no meeting point', () => {
    const shown = cards(glance({ meetingPointName: null, meetingPointDescription: null, heroFacts: { ...none, startPickup: 'Río Grande' } }).container)
    expect(shown['Start and pick-up']).toBe('Río Grande')
  })

  it('shows every technique of a four-technique fly page, none cut', () => {
    const { container } = glance({ technique: ['Fly fishing', 'Dry fly', 'Nymphing', 'Wade fishing'] })
    expect(cards(container).Techniques).toBe('Fly fishing, Dry fly, Nymphing, Wade fishing')
    const value = [...container.querySelectorAll('span')].find(span => span.textContent === 'Fly fishing, Dry fly, Nymphing, Wade fishing')!
    expect(value.className).not.toMatch(/truncate|line-clamp|overflow-hidden|whitespace-nowrap/)
  })
})
