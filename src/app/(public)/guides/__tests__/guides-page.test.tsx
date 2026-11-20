/**
 * /guides in the 2026-11 design: the card shows the fields the list had before (cover, avatar or
 * initials, name, place, years, up to three species, tagline, languages), the filters are rows of
 * links with the same options and parameters, paging and the empty state still work, and the
 * "For guides" block closes the page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const getGuides = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  getGuides: (...a: unknown[]) => getGuides(...a),
  getPlatformStats: async () => ({ guideCount: 7, experienceCount: 9, countryCount: 5, languageCount: 6 }),
}))

import GuidesPage from '../page'

const guide = (over: Record<string, unknown> = {}) => ({
  id: 'g-1', slug: 'kristina-placko', full_name: 'Kristina Placko & Daryl Paskell', country: 'New Zealand', city: 'Lumsden',
  avatar_url: null, cover_url: '/hub/iceland.jpg', bio: 'Long bio that the card does not print.', tagline: 'Owner-guide on Southland rivers',
  average_rating: null, years_experience: 30, fish_expertise: ['Brown trout', 'Rainbow trout'], languages: ['English'],
  ...over,
})

const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await GuidesPage({ searchParams: Promise.resolve(searchParams) }))

/** Text of the element carrying `aria-current="true"` inside a filter group. */
const current = (html: string, group: string) => {
  const block = new RegExp(`aria-label="Filter by ${group}"(.*?)</div>`).exec(html)![1]!
  return /<a[^>]*aria-current="true"[^>]*>([^<]*)<\/a>/.exec(block)?.[1]
}
const decode = (s: string) => s.replace(/&amp;/g, '&')

beforeEach(() => getGuides.mockReset())

describe('guide card', () => {
  it('shows cover, initials, name, place, years, species, tagline and languages — and not the bio', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 1 })
    const html = decode(await render())
    expect(html).toContain('href="/guides/kristina-placko"')
    expect(html).toContain('iceland.jpg')
    expect(html).toContain('>KP<') // initials stand in for the missing avatar
    expect(html).toContain('Kristina Placko & Daryl Paskell')
    expect(html).toContain('Lumsden, New Zealand')
    expect(html).toContain('30 yrs exp')
    expect(html).toContain('Brown trout')
    expect(html).toContain('Owner-guide on Southland rivers')
    expect(html).toContain('>English<')
    expect(html).toContain('View profile')
    const grid = /data-testid="guides-grid"(.*?)<\/section>/.exec(html)![1]!
    expect(grid).not.toContain('Long bio that the card does not print.') // JSON-LD keeps it as the description
    expect(html).not.toContain('★') // no rating, no rating tag
  })

  it('caps species at three with "+N more", languages at two with "+N", and shows a rating when there is one', async () => {
    getGuides.mockResolvedValue({
      guides: [guide({
        avatar_url: '/hub/kristina.jpg', average_rating: 4.8, years_experience: null,
        fish_expertise: ['Salmon', 'Sea trout', 'Brown trout', 'Arctic char', 'Grayling'],
        languages: ['English', 'Icelandic', 'German'],
      })],
      total: 1,
    })
    const html = await render()
    expect(html).toContain('Brown trout')
    expect(html).not.toContain('Arctic char')
    expect(html).toContain('+2 more')
    expect(html).toContain('English, Icelandic +1')
    expect(html).toContain('★ 4.8')
    expect(html).toContain('kristina.jpg')
    expect(html).not.toContain('>KP<')
    expect(html).not.toContain('yrs exp')
  })

  it('a guide with no cover gets the navy block and no image', async () => {
    getGuides.mockResolvedValue({ guides: [guide({ cover_url: null })], total: 1 })
    const html = await render()
    expect(html).not.toContain('iceland.jpg')
  })
  it('language codes print as English names; names typed out stay as they are (tj)', async () => {
    getGuides.mockResolvedValue({ guides: [guide({ languages: ['en', 'is'] }), guide({ id: 'g-2', slug: 'b', languages: ['English', 'German'] })], total: 2 })
    const grid = /data-testid="guides-grid"(.*?)<\/section>/.exec(await render())![1]!
    expect(grid).toContain('English, Icelandic')
    expect(grid).toContain('English, German')
    expect(grid).not.toMatch(/>en, is</)
  })
})

describe('filters', () => {
  it('rows of links with today\'s options; "All" is current with no filter', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 1 })
    const html = await render()
    for (const c of ['Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark', 'Argentina', 'Chile', 'New Zealand']) {
      expect(html).toContain(`href="/guides?country=${encodeURIComponent(c).replace(/%20/g, '+')}"`)
    }
    for (const l of ['English', 'Norwegian', 'Swedish', 'Finnish', 'Icelandic', 'German']) {
      expect(html).toContain(`href="/guides?language=${l}"`)
    }
    expect(current(html, 'country')).toBe('All countries')
    expect(current(html, 'language')).toBe('All languages')
  })

  it('a country link keeps the language, "All countries" drops only the country, and the query gets both', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 1 })
    const html = decode(await render({ country: 'Iceland', language: 'German', page: '2' }))
    expect(getGuides).toHaveBeenCalledWith({ country: 'Iceland', language: 'German', page: 2 })
    expect(current(html, 'country')).toBe('Iceland')
    expect(current(html, 'language')).toBe('German')
    expect(html).toContain('href="/guides?country=Norway&language=German"')
    expect(html).toContain('href="/guides?language=German"')
    expect(html).toContain('href="/guides?country=Iceland"')
  })

  it('no match → "No guides found" with a way back to all guides', async () => {
    getGuides.mockResolvedValue({ guides: [], total: 0 })
    const html = await render({ country: 'Denmark' })
    expect(html).toContain('No guides found')
    expect(html).toContain('0 guides')
    expect(html).toContain('>Clear all filters<')
  })
})

describe('pagination', () => {
  it('none for one page', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 12 })
    expect(await render()).not.toContain('aria-label="Pagination"')
  })

  it('pages keep the filters; the current page is marked; Prev is inert on page 1', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 30 })
    const html = decode(await render({ language: 'English' }))
    expect(html).toContain('aria-label="Pagination"')
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>1<\/span>/)
    expect(html).toContain('href="/guides?language=English&page=2"')
    expect(html).toContain('href="/guides?language=English&page=3"')
    expect(html).not.toContain('page=0')
    expect(html).toMatch(/<span[^>]*>← Prev<\/span>/)
    expect(html).toMatch(/<a[^>]*href="\/guides\?language=English&page=2"[^>]*>Next →<\/a>/)
  })
})

describe('hero and closing block', () => {
  it('live counts in the hero, "For guides" block with the CTA', async () => {
    getGuides.mockResolvedValue({ guides: [guide()], total: 1 })
    const html = await render()
    const stats = /data-testid="guides-stats"(.*?)<\/dl>/.exec(html)![1]!
    expect(stats).toMatch(/Guides<\/dt><dd[^>]*>7</)
    expect(stats).toMatch(/Countries<\/dt><dd[^>]*>5</)
    expect(stats).toMatch(/Languages<\/dt><dd[^>]*>6</)
    expect(html).toContain('Do you guide on your own water?')
    expect(html).toContain('You set your price; we handle the enquiry and the deposit.')
    expect(html).toContain('>Become a guide<')
  })
})
