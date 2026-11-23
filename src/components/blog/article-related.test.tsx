/**
 * FA-1.90 — the block below an article and the home page's journal block, from fixtures.
 * FA-1.97: the guides part is gone (an offer card names its guide) and the hub link became its own
 * block (`ArticleHubCta`). Headings follow the tier the data layer chose (tj D3); the block hides when empty.
 */
import { vi, describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ArticleRelated, { relatedTripsHeading } from './article-related'
import { ArticleHubCta } from './article-hub-cta'
import { LatestArticles } from '@/components/home/latest-articles'
import type { ArticleRelated as Related, FeaturedExperiencePage } from '@/lib/supabase/queries'
import type { BlogPostSummary } from '@/lib/blog/post'

vi.mock('@/components/layout/nav', () => ({ PLAN_YOUR_TRIP_HREF: '/trips' }))

const page = (n: number, country: string, guide: string | null = null, publicSlug: string | null = null): FeaturedExperiencePage => ({
  id: `p${n}`, slug: `trip-${n}`, experience_name: `Trip ${n}`, country, region: '',
  price_from: 100, price_type: 'per_person', currency: 'EUR', hero_image_url: null,
  guide: guide == null ? null : { id: `g${n}`, full_name: guide, publicSlug },
})
const HUB = { slug: 'norway', label: 'Guided Fishing Trips in Norway' }

const render = (related: Related, country: string | null) => renderToStaticMarkup(<ArticleRelated related={related} country={country} />)
/** Unique hrefs, in order — a trip card links its photo and its button to the same page. */
const hrefs = (html: string) => [...new Set([...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map(m => m[1]))]
const h2s = (html: string) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1]!.replace(/<!-- -->/g, ''))

describe('ArticleRelated', () => {
  it('country tier: "Trips in Norway", the trip cards with their guide, "All Norway trips"', () => {
    const html = render({ offers: { tier: 'country', pages: [page(1, 'Norway', 'Nor Guide'), page(2, 'Norway')] }, hub: HUB }, 'Norway')
    expect(h2s(html)).toEqual(['Trips in Norway'])
    expect(hrefs(html)).toEqual(['/trips?country=Norway', '/experiences/trip-1', '/experiences/trip-2'])
    expect(html).toContain('Guide: Nor Guide')
    expect(html).toContain('All Norway trips')
    expect(html).not.toContain('data-part="guides"')
    expect(html).not.toContain('Guides in')
  })

  it('FA-1.97 (tj review): "Guide:" links to /guides/<slug> when the profile is public, otherwise it is text', () => {
    const html = render({ offers: { tier: 'country', pages: [page(1, 'Norway', 'Public Guide', 'public-guide'), page(2, 'Norway', 'Private Guide', null)] }, hub: HUB }, 'Norway')
    expect(hrefs(html)).toEqual(['/trips?country=Norway', '/experiences/trip-1', '/guides/public-guide', '/experiences/trip-2'])
    expect(html).toMatch(/<a [^>]*href="\/guides\/public-guide"[^>]*>Public Guide<\/a>/)
    expect(html.replace(/<!-- -->/g, '')).toContain('Guide: Private Guide')
    // The guide's link is not inside the card's own links.
    expect(html).not.toMatch(/<a [^>]*href="\/experiences\/[^"]*"[^>]*>(?:(?!<\/a>)[\s\S])*href="\/guides\//)
  })

  it('group fallback: "Trips near Norway" — the heading never claims Swedish trips are in Norway, and the link is not "All Norway trips"', () => {
    const html = render({ offers: { tier: 'group', pages: [page(1, 'Sweden')] }, hub: HUB }, 'Norway')
    expect(h2s(html)[0]).toBe('Trips near Norway')
    expect(hrefs(html)).toContain('/trips')
    expect(html).not.toContain('All Norway trips')
  })

  it('NULL country: "Trips we guide", all trips', () => {
    const html = render({ offers: { tier: 'anywhere', pages: [page(1, 'Iceland'), page(2, 'Sweden')] }, hub: null }, null)
    expect(h2s(html)).toEqual(['Trips we guide'])
    expect(hrefs(html)).toEqual(['/trips', '/experiences/trip-1', '/experiences/trip-2'])
  })

  it('no trips: no block, whatever the hub', () => {
    expect(render({ offers: { tier: 'anywhere', pages: [] }, hub: HUB }, 'Norway')).toBe('')
  })

  it('heading per tier', () => {
    expect(relatedTripsHeading('country', 'Iceland')).toBe('Trips in Iceland')
    expect(relatedTripsHeading('group', 'Iceland')).toBe('Trips near Iceland')
    expect(relatedTripsHeading('anywhere', 'Iceland')).toBe('Trips we guide')
    expect(relatedTripsHeading('anywhere', null)).toBe('Trips we guide')
  })
})

describe('ArticleHubCta', () => {
  it('"Norway hub", the hub\'s title, "Open the Norway hub" → /norway and "Plan your trip" → /trips', () => {
    const html = renderToStaticMarkup(<ArticleHubCta hub={HUB} country="Norway" />)
    expect(html).toContain('Norway hub')
    expect(h2s(html)).toEqual(['Guided Fishing Trips in Norway'])
    expect(html).toContain('Seasons, species and every trip in one place.')
    expect(hrefs(html)).toEqual(['/norway', '/trips'])
    expect(html).toContain('Open the Norway hub')
    expect(html).toContain('Plan your trip')
  })

  it('no hub for the country (or a general post): no block', () => {
    expect(renderToStaticMarkup(<ArticleHubCta hub={null} country="Norway" />)).toBe('')
    expect(renderToStaticMarkup(<ArticleHubCta hub={null} country={null} />)).toBe('')
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
