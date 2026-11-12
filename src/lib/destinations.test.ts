import { describe, it, expect } from 'vitest'
import { DESTINATION_HUBS, getHubCountries, getHubSlugForCountry } from './destinations'

/**
 * The skeleton of the hubs that stays in code (FA-1.85, O-42 → (b)): which hubs exist and which
 * countries each covers (their articles come from `blog_posts` since FA-1.90). Their editorial content is in the
 * `destination_hubs` table, and what every hub must have there is checked by `hub-rows.test.ts`.
 */
describe('DESTINATION_HUBS', () => {
  it('has the six hubs', () => {
    expect(DESTINATION_HUBS.map(h => h.slug).sort()).toEqual(
      ['finland', 'iceland', 'new-zealand', 'norway', 'patagonia', 'sweden'],
    )
  })

  it('Norway, Sweden and Finland are single-country Nordic hubs; Iceland is unchanged', () => {
    for (const [slug, country] of [['norway', 'Norway'], ['sweden', 'Sweden'], ['finland', 'Finland'], ['iceland', 'Iceland']] as const) {
      const hub = DESTINATION_HUBS.find(h => h.slug === slug)!
      expect(hub.group).toBe('Nordic')
      expect(getHubCountries(hub)).toEqual([country])
      expect(getHubSlugForCountry(country)).toBe(slug)
    }
  })

  it('every country with active offers on prod has a hub (the footer needs no /trips fallback)', () => {
    for (const c of ['Norway', 'Sweden', 'Finland', 'Iceland', 'Argentina', 'Chile', 'New Zealand']) {
      expect(getHubSlugForCountry(c), c).not.toBeNull()
    }
  })
})
