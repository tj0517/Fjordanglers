/**
 * FA-1.90 — the acceptance criteria of the link-count script, held by fixtures instead of database
 * rows: the three pages rendered for real with a mocked data layer, links counted the way
 * `.fa-proofs/FA-1.90/link-counts.mjs` counts them — unique internal hrefs inside <main> only.
 *
 *   /blog/<norway post> → ≥ 2 /experiences/, ≥ 1 /guides/, exactly 1 hub link (/norway)
 *   /norway             → ≥ 1 /blog/
 *   /                   → ≥ 1 /blog/
 */
import { vi, describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlogPost, BlogPostSummary } from '@/lib/blog/post'
import type { ArticleRelated, FeaturedExperiencePage } from '@/lib/supabase/queries'
import { completeHub } from '@/components/destination-hub/hub.fixture'
import { DESTINATION_HUBS } from '@/lib/destinations'

const summary = (slug: string, country: string | null): BlogPostSummary => ({
  slug, title: `Title ${slug}`, description: 'Description.', imageUrl: '/fish_catalog/salmon.png', imageAlt: 'Salmon',
  category: 'Planning', country, publishedAt: '2026-03-17T00:00:00.000Z', updatedAt: '2026-03-17T00:00:00.000Z', readMinutes: 3,
})
const POST: BlogPost = { ...summary('fishing-regulations-norway-2026', 'Norway'), seoTitle: 'Fishing in Norway 2026', bodyMd: '## Rules\n\nText.' }

const page = (n: number, country: string): FeaturedExperiencePage => ({
  id: `p${n}`, slug: `fixture-trip-${n}`, experience_name: `Trip ${n}`, country, region: '',
  price_from: 100, price_type: 'per_person', currency: 'EUR', hero_image_url: null, guide: null,
})
const RELATED: ArticleRelated = {
  offers: { tier: 'country', pages: [page(1, 'Norway'), page(2, 'Norway'), page(3, 'Norway')] },
  guides: [{ id: 'g1', slug: 'fixture-guide', name: 'Fixture Guide', avatarUrl: null, tagline: null }],
  hub:    { slug: 'norway', label: 'Guided Fishing Trips in Norway' },
}

const hubData = () => ({ ...completeHub(), articles: [{ slug: 'fishing-regulations-norway-2026', title: 'Fishing in Norway 2026' }] })

vi.mock('@/lib/supabase/queries', () => ({
  getBlogPost:              async () => POST,
  getArticleRelated:        async () => RELATED,
  getDestinationHub:        async () => hubData(),
  getPrerenderableHubSlugs: async () => [],
  getLatestBlogPosts:       async () => [summary('a', 'Norway'), summary('b', null), summary('c', 'Sweden')],
  getFeaturedExperiencePages: async () => [],
  getSpeciesCounts:         async () => ({}),
  getFeaturedGuides:        async () => [],
}))
vi.mock('@/lib/supabase/testimonials', () => ({ getTestimonial: async () => null }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('@/components/layout/nav', () => ({ SiteNav: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/home/species-slider', () => ({ SpeciesSlider: () => null }))
vi.mock('@/components/home/experiences-slider', () => ({ ExperiencesSlider: () => null }))
vi.mock('@/components/home/bg-video', () => ({ BgVideo: () => null }))
vi.mock('@/components/ui/contact-expert-button', () => ({ ContactExpertButton: () => null }))
vi.mock('@/components/destination-hub/hub-map-view', () => ({ default: () => null }))
vi.mock('@/components/analytics/WebEventTracker', () => ({ WebEventTracker: () => null }))

import HomePage from '@/app/page'
import DestinationHubPage from '@/app/(public)/[destination]/page'
import BlogPostPage from '@/app/(public)/blog/[slug]/page'

const HUB_SLUGS = DESTINATION_HUBS.map(h => h.slug)

/** The script's rule: one <main>; scripts dropped; unique internal paths, grouped by prefix. */
function linksInMain(html: string) {
  expect(html.match(/<main[\s>]/g) ?? []).toHaveLength(1)
  const main = html.slice(html.search(/<main[\s>]/), html.indexOf('</main>')).replace(/<script\b[\s\S]*?<\/script>/g, '')
  const paths = new Set([...main.matchAll(/<a\b[^>]*?\shref="(\/[^/"][^"]*|\/)"/g)].map(m => m[1]!.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/'))
  const all = [...paths]
  return {
    experiences: all.filter(p => p.startsWith('/experiences/')),
    guides:      all.filter(p => p.startsWith('/guides/')),
    blog:        all.filter(p => p.startsWith('/blog/')),
    hubs:        all.filter(p => HUB_SLUGS.includes(p.slice(1))),
  }
}

describe('FA-1.90 link counts inside <main> (fixtures)', () => {
  it('article (Norway): ≥ 2 /experiences/, ≥ 1 /guides/, exactly 1 hub link — /norway', async () => {
    const html = renderToStaticMarkup(await BlogPostPage({ params: Promise.resolve({ slug: POST.slug }) }))
    const links = linksInMain(html)
    expect(links.experiences.length).toBeGreaterThanOrEqual(2)
    expect(links.guides.length).toBeGreaterThanOrEqual(1)
    expect(links.hubs).toEqual(['/norway'])
  })

  it('hub with articles: ≥ 1 /blog/', async () => {
    const html = renderToStaticMarkup(await DestinationHubPage({ params: Promise.resolve({ destination: 'norway' }) }))
    expect(linksInMain(html).blog).toEqual(['/blog/fishing-regulations-norway-2026'])
  })

  it('home: ≥ 1 /blog/ — the three newest posts', async () => {
    const html = renderToStaticMarkup(await HomePage())
    expect(linksInMain(html).blog).toEqual(['/blog/a', '/blog/b', '/blog/c'])
  })
})
