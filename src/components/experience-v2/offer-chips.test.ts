import { describe, it, expect } from 'vitest'
import { gearIncluded } from './offer-chips'

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
