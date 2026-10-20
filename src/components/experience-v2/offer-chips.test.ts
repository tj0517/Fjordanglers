import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OfferChips, { gearIncluded } from './offer-chips'
import type { HeroFacts } from '@/lib/experience-v2-content'

/**
 * The "gear included" chip is a copy rule over free text an admin typed into
 * `experience_pages.includes`, so it is worth pinning: a false positive promises an
 * angler they can turn up with nothing.
 */
describe('gearIncluded', () => {
  it("matches the seed page's wording", () => {
    expect(gearIncluded(['Guide service', 'Gear and flies included', 'Lunch on the river'])).toBe(true)
  })

  it('matches the other ways an admin writes it', () => {
    expect(gearIncluded(['Rods and reels provided'])).toBe(true)
    expect(gearIncluded(['All tackle supplied'])).toBe(true)
    expect(gearIncluded(['Fly selection for the week'])).toBe(true)
    expect(gearIncluded(['Equipment included'])).toBe(true)
  })

  it('does not fire on an includes list that says nothing about gear', () => {
    expect(gearIncluded(['Guide service', 'Transfers from Reykjavik', 'Lunch'])).toBe(false)
    expect(gearIncluded([])).toBe(false)
  })

  it('does not fire on a word that merely contains one of the tokens', () => {
    // "Garden lunch" / "Rodeo" style false positives — the rule is word-bounded.
    expect(gearIncluded(['Rodeo evening'])).toBe(false)
    expect(gearIncluded(['Gearbox repairs not included'])).toBe(false)
  })
})

const page = {
  region: 'Otago', minDays: 1, maxDays: 3, maxAnglersPerGuide: 2,
  seasonMonths: [10, 11, 12, 1, 2], includes: ['Gear and flies included'],
}

const none: HeroFacts = {
  location: null, dayLength: null, groupSize: null, season: null, gearIncluded: null, startPickup: null,
}

/** The chip labels, in order. */
function labels(heroFacts: HeroFacts | null, over: Partial<typeof page> = {}): string[] {
  const html = renderToStaticMarkup(createElement(OfferChips, { ...page, ...over, heroFacts }))
  return [...html.matchAll(/<\/svg>([^<]+)<\/li>/g)].map(match => match[1])
}

describe('OfferChips', () => {
  const chips = () => renderToStaticMarkup(createElement(OfferChips, { ...page, heroFacts: null }))

  it('shows no skill-level chip (feedback round 1) — the level stays in the admin and the inquiry brief', () => {
    expect(chips()).not.toMatch(/level/i)
    expect(chips()).not.toContain('/ 5')
  })

  it('still shows the other chips', () => {
    const html = chips()
    for (const label of ['Otago', '1–3 days', '1–2 anglers / guide', 'gear included']) expect(html).toContain(label)
  })
})

/**
 * hero_facts (FA-1.63): each chip takes the typed value when there is one and is computed
 * as before when there is not — one chip at a time, never all or nothing.
 */
describe('OfferChips with hero facts', () => {
  const computed = ['Otago', '1–3 days', '1–2 anglers / guide', 'season Oct–Feb', 'gear included']

  it('without hero facts: the five computed chips', () => {
    expect(labels(null)).toEqual(computed)
    expect(labels(none)).toEqual(computed)
  })

  it('location only overrides the location chip; the other four stay computed', () => {
    expect(labels({ ...none, location: 'X' })).toEqual(['X', '1–3 days', '1–2 anglers / guide', 'season Oct–Feb', 'gear included'])
  })

  it('day length only overrides the length chip', () => {
    expect(labels({ ...none, dayLength: 'multi_day' })).toEqual(['Otago', 'multi-day', '1–2 anglers / guide', 'season Oct–Feb', 'gear included'])
    expect(labels({ ...none, dayLength: 'half_day' })[1]).toBe('half day')
    expect(labels({ ...none, dayLength: 'full_day' }, { minDays: 3, maxDays: 7 })[1]).toBe('full day')
  })

  it('group size only overrides the anglers chip, as typed', () => {
    expect(labels({ ...none, groupSize: '2–4 anglers' })).toEqual(['Otago', '1–3 days', '2–4 anglers', 'season Oct–Feb', 'gear included'])
  })

  it('season only overrides the season chip, as typed — no "season " prefix', () => {
    expect(labels({ ...none, season: 'Nov–Apr' })).toEqual(['Otago', '1–3 days', '1–2 anglers / guide', 'Nov–Apr', 'gear included'])
  })

  it('a typed season shows even when the page has no season months', () => {
    expect(labels({ ...none, season: 'Nov–Apr' }, { seasonMonths: [] })).toContain('Nov–Apr')
    expect(labels(null, { seasonMonths: [] })).toEqual(['Otago', '1–3 days', '1–2 anglers / guide', 'gear included'])
  })

  it('gear: Included shows the chip even when Includes says nothing, Not included hides it', () => {
    expect(labels({ ...none, gearIncluded: true }, { includes: ['Lunch'] })).toContain('gear included')
    expect(labels(null, { includes: ['Lunch'] })).not.toContain('gear included')
    expect(labels({ ...none, gearIncluded: false })).toEqual(['Otago', '1–3 days', '1–2 anglers / guide', 'season Oct–Feb'])
  })

  it('a typed location shows even when the region is empty', () => {
    expect(labels({ ...none, location: 'Tierra del Fuego' }, { region: '' })[0]).toBe('Tierra del Fuego')
  })

  it('all five typed: exactly those five chips', () => {
    expect(labels({
      ...none, location: 'Tierra del Fuego', dayLength: 'multi_day', groupSize: '2–4 anglers', season: 'Nov–Apr', gearIncluded: true,
    })).toEqual(['Tierra del Fuego', 'multi-day', '2–4 anglers', 'Nov–Apr', 'gear included'])
  })
})
