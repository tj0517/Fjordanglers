/**
 * FA-1.90 — the reads behind the internal links, run through the real `queries.ts` against an
 * in-memory database (`src/tests/fake-supabase.ts`), so they do not depend on what the local seed
 * holds (it has no Norway offers or guides) and survive a `db reset`.
 *
 *   article  — offers widen by tier (country → region group → anywhere, tj D3); guides are active,
 *              visible and from the post's country; the hub is the country's; a general post (NULL
 *              country) starts at "anywhere" with no guides and no hub
 *   hub      — its articles are the published posts of its countries, newest first (tj D2)
 *   home     — the three newest published posts
 *   fail-soft — a failed blog read hides the home block and the hub section; both pages still render
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createFakeDb, fakeClient, type FakeDb } from '@/tests/fake-supabase'

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeClient(h.db) }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
// Client islands that need a browser or are irrelevant to links — the pages around them are real.
vi.mock('@/components/layout/nav', () => ({ SiteNav: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/home/species-slider', () => ({ SpeciesSlider: () => null }))
vi.mock('@/components/home/experiences-slider', () => ({ ExperiencesSlider: () => null }))
vi.mock('@/components/home/bg-video', () => ({ BgVideo: () => null }))
vi.mock('@/components/ui/contact-expert-button', () => ({ ContactExpertButton: () => null }))
vi.mock('@/components/destination-hub/hub-map-view', () => ({ default: () => null }))
vi.mock('@/components/analytics/WebEventTracker', () => ({ WebEventTracker: () => null }))

import { getArticleRelated, getDestinationHub, getLatestBlogPosts } from './queries'
import HomePage from '@/app/page'
import DestinationHubPage from '@/app/(public)/[destination]/page'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const hubRow = (slug: string, h1: string) => ({
  slug, h1, intro: 'Intro.', meta_title: h1, meta_description: 'Meta.',
  season_months: [], peak_months: [], season_note: null, species: [], faq: [],
  hero_quote_text: null, hero_quote_author: null, hero_quote_country: null, proof_note: null,
  contact_name: null, contact_email: null, contact_whatsapp: null,
})
const HUB_ROWS = [
  hubRow('norway', 'Guided Fishing Trips in Norway'), hubRow('sweden', 'Guided Fishing Trips in Sweden'),
  hubRow('finland', 'Guided Fishing Trips in Finland'), hubRow('iceland', 'Iceland Fly Fishing Trips'),
  hubRow('patagonia', 'Patagonia Fly Fishing Trips'), hubRow('new-zealand', 'New Zealand Fly Fishing Trips'),
]

let n = 0
const offer = (country: string, over: Record<string, unknown> = {}) => {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, slug: `fa190-${country.toLowerCase().replace(' ', '-')}-${n}`,
    experience_name: `${country} trip ${n}`, country, region: '', status: 'active',
    price_from: 100, price_type: 'per_person', currency: 'EUR', hero_image_url: null,
    guide: { id: 'g', full_name: 'G' }, created_at: `2026-01-${String(n).padStart(2, '0')}T00:00:00Z`,
    ...over,
  }
}

const guide = (slug: string | null, over: Record<string, unknown> = {}) => ({
  id: `guide-${slug ?? Math.random()}`, slug, full_name: `Guide ${slug}`, avatar_url: null, tagline: null,
  country: 'Norway', status: 'active', is_hidden: false, average_rating: null, ...over,
})

const post = (slug: string, country: string | null, publishedAt: string, status = 'published') => ({
  id: `post-${slug}`, slug, title: `Title ${slug}`, seo_title: `SEO ${slug}`, description: 'Description.',
  body_md: 'Body text.', image_url: '/fish_catalog/salmon.png', image_alt: 'Salmon', category: 'Planning',
  country, guide_id: null, status, published_at: publishedAt, created_at: publishedAt, updated_at: publishedAt,
})

const POSTS = [
  post('fa190-norway-old', 'Norway', '2026-01-10T00:00:00Z'),
  post('fa190-norway-new', 'Norway', '2026-03-10T00:00:00Z'),
  post('fa190-sweden',     'Sweden', '2026-02-10T00:00:00Z'),
  post('fa190-general',    null,     '2026-04-10T00:00:00Z'),
  post('fa190-draft',      'Norway', '2026-05-10T00:00:00Z', 'draft'),
]

let errors: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.db = createFakeDb()
  h.db.tables.destination_hubs = HUB_ROWS
  h.db.tables.blog_posts = POSTS
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errors.mockRestore())

// ─── Article ──────────────────────────────────────────────────────────────────

describe('getArticleRelated (article → offers, guides, hub)', () => {
  it('country tier: 3 offers from the post\'s country, 2 active visible guides from it, the country\'s hub', async () => {
    h.db.tables.experience_pages = [offer('Norway'), offer('Norway'), offer('Norway'), offer('Norway'), offer('Sweden'), offer('Norway', { status: 'draft' })]
    h.db.tables.guides = [
      guide('nor-a', { average_rating: 4.9 }), guide('nor-b', { average_rating: 4.5 }), guide('nor-c', { average_rating: 4.0 }),
      guide('nor-hidden', { is_hidden: true, average_rating: 5 }), guide('nor-inactive', { status: 'pending', average_rating: 5 }),
      guide(null, { average_rating: 5 }), guide('swe', { country: 'Sweden', average_rating: 5 }),
    ]

    const r = await getArticleRelated({ country: 'Norway' })

    expect(r.offers.tier).toBe('country')
    expect(r.offers.pages).toHaveLength(3)
    expect(r.offers.pages.every(p => p.country === 'Norway')).toBe(true)
    expect(r.guides.map(g => g.slug)).toEqual(['nor-a', 'nor-b'])
    expect(r.hub).toEqual({ slug: 'norway', label: 'Guided Fishing Trips in Norway' })
  })

  it('group fallback: no offer in the country → offers from the same part of the world (Nordic), never further', async () => {
    h.db.tables.experience_pages = [offer('Sweden'), offer('Iceland'), offer('New Zealand')]
    h.db.tables.guides = [guide('nor-a')]

    const r = await getArticleRelated({ country: 'Norway' })

    expect(r.offers.tier).toBe('group')
    expect(r.offers.pages.map(p => p.country).sort()).toEqual(['Iceland', 'Sweden'])
  })

  it('anywhere: nothing in the country or the group → any active offer', async () => {
    h.db.tables.experience_pages = [offer('New Zealand')]
    h.db.tables.guides = []

    const r = await getArticleRelated({ country: 'Norway' })

    expect(r.offers.tier).toBe('anywhere')
    expect(r.offers.pages.map(p => p.country)).toEqual(['New Zealand'])
  })

  it('NULL country (a general post): starts at "anywhere", no guides read, no hub', async () => {
    h.db.tables.experience_pages = [offer('Norway'), offer('Sweden')]
    h.db.tables.guides = [guide('nor-a')]

    const r = await getArticleRelated({ country: null })

    expect(r.offers.tier).toBe('anywhere')
    expect(r.offers.pages).toHaveLength(2)
    expect(r.guides).toEqual([])
    expect(r.hub).toBeNull()
    expect(h.db.reads).not.toContain('guides')
    expect(h.db.reads).not.toContain('destination_hubs')
  })

  it('no guides in the country → guides empty (the part hides), offers and hub unaffected', async () => {
    h.db.tables.experience_pages = [offer('Norway'), offer('Norway')]
    h.db.tables.guides = [guide('swe', { country: 'Sweden' })]

    const r = await getArticleRelated({ country: 'Norway' })

    expect(r.guides).toEqual([])
    expect(r.offers.tier).toBe('country')
    expect(r.hub?.slug).toBe('norway')
  })

  it('failed offer and guide reads → an empty block, not a failed page', async () => {
    h.db.failing.add('experience_pages')
    h.db.failing.add('guides')

    const r = await getArticleRelated({ country: 'Norway' })

    expect(r.offers.pages).toEqual([])
    expect(r.guides).toEqual([])
  })
})

// ─── Hub and home ─────────────────────────────────────────────────────────────

describe('hub articles (tj D2: from blog_posts, by the hub\'s countries)', () => {
  it('/norway lists the published Norway posts, newest first — not Sweden\'s, not a general post, not a draft', async () => {
    h.db.tables.experience_pages = []
    const data = await getDestinationHub('norway')
    expect(data?.articles).toEqual([
      { slug: 'fa190-norway-new', title: 'Title fa190-norway-new' },
      { slug: 'fa190-norway-old', title: 'Title fa190-norway-old' },
    ])
  })

  it('a hub with no posts of its countries has no articles', async () => {
    h.db.tables.experience_pages = []
    expect((await getDestinationHub('finland'))?.articles).toEqual([])
  })
})

describe('getLatestBlogPosts (home)', () => {
  it('the three newest published posts, any country', async () => {
    expect((await getLatestBlogPosts(3)).map(p => p.slug)).toEqual(['fa190-general', 'fa190-norway-new', 'fa190-sweden'])
  })
})

// ─── Fail-soft ────────────────────────────────────────────────────────────────

describe('fail-soft: the blog read fails (a build has no database; an outage)', () => {
  beforeEach(() => {
    h.db.failing.add('blog_posts')
    h.db.tables.experience_pages = [offer('Norway')]
  })

  it('home: no "From the journal" block, the page still renders, the failure is logged', async () => {
    expect(await getLatestBlogPosts(3)).toEqual([])
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain('<main>')
    expect(html).not.toContain('data-block="latest-articles"')
    expect(html).not.toContain('href="/blog/')
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('blog posts unavailable'), expect.anything())
  })

  it('hub: no articles section, offers and the rest of the page still render, the failure is logged', async () => {
    const data = await getDestinationHub('norway')
    expect(data?.articles).toEqual([])
    expect(data?.offers).toHaveLength(1)

    const html = renderToStaticMarkup(await DestinationHubPage({ params: Promise.resolve({ destination: 'norway' }) }))
    expect(html).toContain('Guided Fishing Trips in Norway')
    expect(html).not.toContain('data-block="articles"')
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('blog posts unavailable'), expect.anything())
  })
})
