/**
 * FA-1.97 — /blog rendered for real with a mocked data layer: the starting filter comes from the URL and
 * the server HTML is already filtered; the canonical never changes; tiles and "Load more" follow the data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlogPostSummary } from '@/lib/blog/post'

const mocks = vi.hoisted(() => ({ posts: [] as BlogPostSummary[] }))

vi.mock('@/lib/supabase/queries', () => ({ getBlogPosts: async () => mocks.posts }))
vi.mock('@/components/layout/nav', () => ({ PLAN_YOUR_TRIP_HREF: '/trips' }))

import BlogPage, { dynamic, metadata } from './page'

const post = (slug: string, category: string, country: string | null, day = 10): BlogPostSummary => ({
  slug, title: `Title ${slug}`, description: `About ${slug}.`, imageUrl: '/fish_catalog/salmon.png', imageAlt: 'Salmon',
  category, country, publishedAt: `2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  updatedAt: `2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`, readMinutes: 4,
})

const TWO = [post('nz-seasons', 'Seasons', 'New Zealand', 20), post('norway-planning', 'Planning', 'Norway', 10)]

const render = async (searchParams: { category?: string | string[]; country?: string | string[] } = {}) =>
  renderToStaticMarkup(await BlogPage({ searchParams: Promise.resolve(searchParams) }))

/** The "All articles" grid only — the featured block and the tiles live outside it. */
const allArticles = (html: string) => html.match(/data-block="article-list"[\s\S]*?<\/section>/)?.[0] ?? ''
const slugsIn = (html: string) => [...new Set([...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map(m => m[1]))]

beforeEach(() => {
  mocks.posts = TWO
})

describe('/blog — starting filter from the URL', () => {
  it('?category=seasons: the server HTML lists only the "Seasons" posts under "All articles"', async () => {
    const list = allArticles(await render({ category: 'seasons' }))
    expect(slugsIn(list)).toEqual(['nz-seasons'])
    expect(list).toMatch(/aria-pressed="true"[^>]*>Seasons</)
  })

  it('no filter lists every post, featured one included (T5)', async () => {
    const html = await render()
    expect(slugsIn(allArticles(html)).sort()).toEqual(['norway-planning', 'nz-seasons'])
    expect(slugsIn(html.match(/data-block="featured-article"[\s\S]*?<\/section>/)?.[0] ?? '')).toEqual(['nz-seasons'])
  })

  it('an unknown category or country is no filter', async () => {
    expect(slugsIn(allArticles(await render({ category: 'Fly tying', country: 'Atlantis' }))).sort()).toEqual(['norway-planning', 'nz-seasons'])
  })

  it('?country=norway narrows by country, case-insensitively', async () => {
    expect(slugsIn(allArticles(await render({ country: 'norway' })))).toEqual(['norway-planning'])
  })

  it('the canonical is /blog whatever the query string', () => {
    expect(metadata.alternates?.canonical).toBe('https://www.fjordanglers.com/blog')
    expect(dynamic).toBe('force-dynamic')
  })
})

describe('/blog — sections from the data', () => {
  it('chips come from the posts: their categories and countries, nothing else', async () => {
    const list = allArticles(await render())
    for (const label of ['All', 'Planning', 'Seasons', 'New Zealand', 'Norway']) expect(list).toContain(`>${label}</button>`)
    expect(list).not.toContain('>Regulations<')
    expect(list).not.toContain('>Iceland<')
  })

  it('"Topic hubs": a tile for each of Regulations / Seasons / Species that has a post, linking to /blog?category=…', async () => {
    mocks.posts = [post('a', 'seasons', 'Norway'), post('b', 'Species', null, 9), post('c', 'Planning', 'Norway', 8)]
    const html = await render()
    expect(html).toContain('Topic hubs')
    expect(html).toContain('href="/blog?category=Seasons"')
    expect(html).toContain('href="/blog?category=Species"')
    expect(html).not.toContain('href="/blog?category=Regulations"')
    expect(html).not.toContain('href="/blog?category=Planning"') // Planning is a chip, not a topic tile
  })

  it('no post in any topic category: no "Topic hubs" section', async () => {
    mocks.posts = [post('c', 'Planning', 'Norway')]
    expect(await render()).not.toContain('Topic hubs')
  })

  it('"Load more" only with more than 12 matching posts', async () => {
    mocks.posts = Array.from({ length: 12 }, (_, i) => post(`p${i}`, 'Planning', 'Norway', 28 - i))
    const twelve = await render()
    expect(twelve).not.toContain('Load more articles')
    expect(slugsIn(allArticles(twelve))).toHaveLength(12)

    mocks.posts = Array.from({ length: 13 }, (_, i) => post(`p${i}`, 'Planning', 'Norway', 28 - i))
    const thirteen = await render()
    expect(thirteen).toContain('Load more articles')
    expect(slugsIn(allArticles(thirteen))).toHaveLength(12)
  })

  it('destination tiles: the mockup\'s order, each to its hub, Patagonia navy without a photo', async () => {
    const html = await render()
    const tiles = html.match(/data-block="destinations"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect([...tiles.matchAll(/href="\/([a-z-]+)"/g)].map(m => m[1])).toEqual(['iceland', 'norway', 'sweden', 'finland', 'new-zealand', 'patagonia'])
    for (const photo of ['iceland.jpg', 'norway.jpg', 'sweden.jpg', 'finland.jpg', 'nzriver.jpg']) expect(tiles).toContain(encodeURIComponent(`/hub/${photo}`))
    expect(tiles.match(/<img/g)).toHaveLength(5)
    expect(tiles).toContain('Argentina and Chile')
  })

  it('"Plan your trip" block and no placeholder from the mockup', async () => {
    const html = await render()
    expect(html).toContain('Tell us your dates. We check with the guide.')
    expect(html).toMatch(/href="\/trips"[^>]*>Plan your trip/)
    expect(html).not.toMatch(/\[(X\]|DATE|ARTICLE TITLE|PHOTO)/)
  })

  it('no posts at all: the "first articles" line and no list', async () => {
    mocks.posts = []
    const html = await render()
    expect(html).toContain('The first articles are on their way')
    expect(html).not.toContain('data-block="article-list"')
  })
})
