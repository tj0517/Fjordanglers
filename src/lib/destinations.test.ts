import { describe, it, expect } from 'vitest'
import { DESTINATION_HUBS, getHubCountries, getHubSlugForCountry } from './destinations'
import { BLOG_POSTS } from './blog-data'
import { isBlogStub } from './blog-articles'

/**
 * FA-1.82 — every hub is a public page and a landing page for search: its editorial fields are
 * not optional in practice. The type allows empty fields (a section hides when empty); this test
 * is what says no hub ships that way.
 */
describe('DESTINATION_HUBS (FA-1.82)', () => {
  it('has the six hubs', () => {
    expect(DESTINATION_HUBS.map(h => h.slug).sort()).toEqual(
      ['finland', 'iceland', 'new-zealand', 'norway', 'patagonia', 'sweden'],
    )
  })

  it.each(DESTINATION_HUBS.map(h => [h.slug, h] as const))('%s has intro, meta and FAQ', (_slug, hub) => {
    expect(hub.h1.trim()).not.toBe('')
    expect(hub.intro.trim()).not.toBe('')
    expect(hub.metaTitle.trim()).not.toBe('')
    expect(hub.metaDescription.trim()).not.toBe('')
    expect((hub.faq ?? []).length).toBeGreaterThanOrEqual(3)
    expect((hub.faq ?? []).length).toBeLessThanOrEqual(6)
    for (const entry of hub.faq ?? []) {
      expect(entry.question.trim()).not.toBe('')
      expect(entry.answer.trim()).not.toBe('')
    }
  })

  it.each(DESTINATION_HUBS.map(h => [h.slug, h] as const))('%s: meta description fits a search snippet', (_slug, hub) => {
    expect(hub.metaDescription.length).toBeLessThanOrEqual(160)
  })

  it.each(DESTINATION_HUBS.map(h => [h.slug, h] as const))('%s: season months are 1–12 and peak ⊆ season', (_slug, hub) => {
    const season = hub.seasonMonths ?? []
    const peak = hub.peakMonths ?? []
    for (const m of [...season, ...peak]) expect(Number.isInteger(m) && m >= 1 && m <= 12, String(m)).toBe(true)
    for (const m of peak) expect(season, `peak month ${m} is outside the season`).toContain(m)
  })

  it('every article a hub links to is a real, non-stub blog post', () => {
    for (const hub of DESTINATION_HUBS) {
      for (const a of hub.articles ?? []) {
        const post = BLOG_POSTS.find(p => p.slug === a.slug)
        expect(post, `${hub.slug}: ${a.slug}`).toBeDefined()
        expect(isBlogStub(a.slug), `${hub.slug}: ${a.slug} is a stub`).toBe(false)
        expect(a.title).toBe(post!.title)
      }
    }
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
