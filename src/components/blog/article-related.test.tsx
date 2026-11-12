/**
 * FA-1.90 — the block below an article and the home page's journal block, from fixtures.
 * Headings follow the tier the data layer chose (tj D3); every part hides when it is empty.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ArticleRelated, { relatedTripsHeading } from './article-related'
import { LatestArticles } from '@/components/home/latest-articles'
import type { ArticleRelated as Related, FeaturedExperiencePage } from '@/lib/supabase/queries'
import type { BlogPostSummary } from '@/lib/blog/post'

const page = (n: number, country: string): FeaturedExperiencePage => ({
  id: `p${n}`, slug: `trip-${n}`, experience_name: `Trip ${n}`, country, region: '',
  price_from: 100, price_type: 'per_person', currency: 'EUR', hero_image_url: null, guide: null,
})
const GUIDE = { id: 'g1', slug: 'nor-guide', name: 'Nor Guide', avatarUrl: null, tagline: 'Sea trout on the fjord.' }
const HUB = { slug: 'norway', label: 'Guided Fishing Trips in Norway' }

const render = (related: Related, country: string | null) => renderToStaticMarkup(<ArticleRelated related={related} country={country} />)
const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map(m => m[1])
const h2s = (html: string) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1]!.replace(/<!-- -->/g, ''))

describe('ArticleRelated', () => {
  it('country tier: "Trips in Norway", the trips, the guide and the hub link', () => {
    const html = render({ offers: { tier: 'country', pages: [page(1, 'Norway'), page(2, 'Norway')] }, guides: [GUIDE], hub: HUB }, 'Norway')
    expect(h2s(html)).toEqual(['Trips in Norway', 'Guides in Norway'])
    expect(hrefs(html)).toEqual(['/experiences/trip-1', '/experiences/trip-2', '/guides/nor-guide', '/norway'])
    expect(html).toContain('Guided Fishing Trips in Norway')
  })

  it('group fallback: "Trips near Norway" — the heading never claims Swedish trips are in Norway', () => {
    const html = render({ offers: { tier: 'group', pages: [page(1, 'Sweden')] }, guides: [], hub: HUB }, 'Norway')
    expect(h2s(html)[0]).toBe('Trips near Norway')
  })

  it('NULL country: "Trips we guide", no guides part, no hub link', () => {
    const html = render({ offers: { tier: 'anywhere', pages: [page(1, 'Iceland'), page(2, 'Sweden')] }, guides: [], hub: null }, null)
    expect(h2s(html)).toEqual(['Trips we guide'])
    expect(html).not.toContain('data-part="guides"')
    expect(html).not.toContain('data-part="hub"')
    expect(hrefs(html)).toEqual(['/experiences/trip-1', '/experiences/trip-2'])
  })

  it('no guides in the country: the guides part is hidden, trips and hub stay', () => {
    const html = render({ offers: { tier: 'country', pages: [page(1, 'Norway')] }, guides: [], hub: HUB }, 'Norway')
    expect(html).not.toContain('data-part="guides"')
    expect(html).not.toContain('Guides in')
    expect(hrefs(html)).toEqual(['/experiences/trip-1', '/norway'])
  })

  it('nothing at all: no block', () => {
    expect(render({ offers: { tier: 'anywhere', pages: [] }, guides: [], hub: null }, null)).toBe('')
  })

  it('heading per tier', () => {
    expect(relatedTripsHeading('country', 'Iceland')).toBe('Trips in Iceland')
    expect(relatedTripsHeading('group', 'Iceland')).toBe('Trips near Iceland')
    expect(relatedTripsHeading('anywhere', 'Iceland')).toBe('Trips we guide')
    expect(relatedTripsHeading('anywhere', null)).toBe('Trips we guide')
  })
})

describe('LatestArticles (home)', () => {
  const post = (slug: string): BlogPostSummary => ({
    slug, title: `Title ${slug}`, description: 'D.', imageUrl: '/fish_catalog/salmon.png', imageAlt: 'Salmon',
    category: 'Planning', country: null, publishedAt: '2026-03-17T00:00:00.000Z', updatedAt: '2026-03-17T00:00:00.000Z', readMinutes: 3,
  })

  it('a card per post linking to /blog/<slug>, plus "All articles"', () => {
    const html = renderToStaticMarkup(<LatestArticles posts={[post('a'), post('b'), post('c')]} />)
    expect(hrefs(html)).toEqual(['/blog', '/blog/a', '/blog/b', '/blog/c'])
  })

  it('no posts (none published, or the read failed): no block', () => {
    expect(renderToStaticMarkup(<LatestArticles posts={[]} />)).toBe('')
  })
})
