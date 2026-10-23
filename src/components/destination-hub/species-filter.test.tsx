// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import HubTrips from './hub-trips'
import { hubSpecies } from '@/lib/hub-species'
import { completeHub, offer } from './hub.fixture'

afterEach(cleanup)

/**
 * FA-1.65 — species chips (tj D2, 2026-10-23): derived from the hub's offers, a non-empty
 * hub-level list overrides them; a chip filters the cards client-side, "All" resets.
 */

const cardNames = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-testid="hub-cards"] h3')].map(h => h.textContent)

const chip = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('[data-testid="hub-species-chips"] button')].find(b => b.textContent === label)!

describe('species filter', () => {
  it('FA-1.65: clicking a chip leaves only the cards with that species; "All" restores them', () => {
    const { offers, species } = completeHub()
    const { container } = render(<HubTrips offers={offers} species={species} />)
    expect(cardNames(container)).toEqual(['Trip a', 'Trip b', 'Trip c'])

    fireEvent.click(chip(container, 'Kingfish'))
    expect(cardNames(container)).toEqual(['Trip b'])
    expect(chip(container, 'Kingfish').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(chip(container, 'Brown Trout'))
    expect(cardNames(container)).toEqual(['Trip a'])

    fireEvent.click(chip(container, 'All'))
    expect(cardNames(container)).toEqual(['Trip a', 'Trip b', 'Trip c'])
    expect(chip(container, 'All').getAttribute('aria-pressed')).toBe('true')
  })

  it('FA-1.65: matching ignores case and spacing — "Rainbow Trout" keeps the card that says "rainbow trout"', () => {
    const { offers, species } = completeHub()
    const { container } = render(<HubTrips offers={offers} species={species} />)
    fireEvent.click(chip(container, 'Rainbow Trout'))
    expect(cardNames(container)).toEqual(['Trip a', 'Trip b'])
  })

  it('FA-1.65: a chip no offer has says so instead of leaving an empty grid', () => {
    const { offers } = completeHub()
    const { container, getByTestId } = render(<HubTrips offers={offers} species={['Sea Trout']} />)
    fireEvent.click(chip(container, 'Sea Trout'))
    expect(getByTestId('hub-cards-empty').textContent).toBe('No trips for Sea Trout yet.')
  })

  it('FA-1.65: no species → no chips section, the cards still render', () => {
    const { offers } = completeHub()
    const { container } = render(<HubTrips offers={offers} species={[]} />)
    expect(container.querySelector('[data-section="species"]')).toBeNull()
    expect(cardNames(container)).toHaveLength(3)
  })
})

describe('hubSpecies — which chips', () => {
  const perOffer = [['Brown Trout', 'Rainbow Trout'], ['rainbow  trout ', 'Kingfish'], [' brown trout']]

  it('FA-1.65: derived list is the union, deduplicated case-insensitively, most offers first', () => {
    expect(hubSpecies([], perOffer)).toEqual(['Brown Trout', 'Rainbow Trout', 'Kingfish'])
    expect(hubSpecies(undefined, perOffer)).toEqual(['Brown Trout', 'Rainbow Trout', 'Kingfish'])
  })

  it('FA-1.65: a non-empty hub-level list overrides the derived one', () => {
    expect(hubSpecies(['Sea-run Brown Trout', 'Chinook Salmon'], perOffer)).toEqual(['Sea-run Brown Trout', 'Chinook Salmon'])
  })

  it('FA-1.65: the override shows up as the chips on the page', () => {
    const offers = [offer({ id: 'x', targetSpecies: ['Brown Trout'] })]
    const species = hubSpecies(['Chinook Salmon'], offers.map(o => o.targetSpecies))
    const { container } = render(<HubTrips offers={offers} species={species} />)
    const labels = [...container.querySelectorAll('[data-testid="hub-species-chips"] button')].map(b => b.textContent)
    expect(labels).toEqual(['All', 'Chinook Salmon'])
  })
})
