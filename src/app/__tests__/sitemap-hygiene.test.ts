/**
 * FA-1.88 — the sitemap lists only pages meant for the index, with real dates.
 *
 *  - no blog stub (the same `isBlogStub` rule the blog page uses for `noindex`);
 *  - `lastModified` is a real date or absent — never "now";
 *  - two fetches at different times carry identical `lastModified` values.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { BLOG_POSTS } from '@/lib/blog-data'
import { ARTICLE_CONTENT, isBlogStub } from '@/lib/blog-articles'

vi.mock('@/lib/supabase/server', () => {
  const rows: Record<string, unknown[]> = {
    experience_pages: [
      { slug: 'dated-offer',   updated_at: '2026-10-01T08:30:00Z' },
      { slug: 'undated-offer', updated_at: null },
    ],
    guides: [
      { id: 'g1', slug: 'dated-guide',   updated_at: '2026-09-15T12:00:00Z' },
      { id: 'g2', slug: 'undated-guide', updated_at: null },
    ],
  }
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows[table] ?? [], error: null }),
    }
    return chain
  }
  return { createServiceClient: () => ({ from }) }
})

import sitemap from '../sitemap'

const SITE = 'https://www.fjordanglers.com'
const byUrl = (entries: Awaited<ReturnType<typeof sitemap>>, path: string) =>
  entries.find(e => e.url === `${SITE}${path}`)

afterEach(() => vi.useRealTimers())

describe('sitemap — only indexable URLs', () => {
  it('the fixture has both a stub and a real article, otherwise the filter proves nothing', () => {
    expect(BLOG_POSTS.some(p => isBlogStub(p.slug))).toBe(true)
    expect(Object.keys(ARTICLE_CONTENT).length).toBeGreaterThan(0)
  })

  it('lists no blog stub', async () => {
    const urls = (await sitemap()).map(e => e.url)
    const stubs = BLOG_POSTS.filter(p => isBlogStub(p.slug)).map(p => `${SITE}/blog/${p.slug}`)
    expect(urls.filter(u => stubs.includes(u))).toEqual([])
  })

  it('lists every blog post that has content', async () => {
    const urls = (await sitemap()).map(e => e.url)
    for (const slug of Object.keys(ARTICLE_CONTENT)) {
      expect(urls).toContain(`${SITE}/blog/${slug}`)
    }
  })
})

describe('sitemap — lastModified is real or absent', () => {
  it('static pages and hubs have no lastModified', async () => {
    const entries = await sitemap()
    const nonDynamic = entries.filter(
      e => !e.url.includes('/experiences/') && !/\/guides\/./.test(e.url) && !e.url.includes('/blog/'),
    )
    expect(nonDynamic.length).toBeGreaterThan(8) // home, trips, guides, blog, 4 legal + hubs
    for (const e of nonDynamic) expect(e, e.url).not.toHaveProperty('lastModified')
  })

  it('offers and guides carry their updated_at; null updated_at → field absent', async () => {
    const entries = await sitemap()
    expect(byUrl(entries, '/experiences/dated-offer')?.lastModified).toEqual(new Date('2026-10-01T08:30:00Z'))
    expect(byUrl(entries, '/guides/dated-guide')?.lastModified).toEqual(new Date('2026-09-15T12:00:00Z'))
    expect(byUrl(entries, '/experiences/undated-offer')).not.toHaveProperty('lastModified')
    expect(byUrl(entries, '/guides/undated-guide')).not.toHaveProperty('lastModified')
  })

  it("blog posts carry the post's own date (UTC), not the fetch time", async () => {
    const entries = await sitemap()
    const slug = Object.keys(ARTICLE_CONTENT)[0]
    const post = BLOG_POSTS.find(p => p.slug === slug)!
    expect(post.date).toBe('March 17, 2026') // if the fixture changes, update the expectation below on purpose
    expect(byUrl(entries, `/blog/${slug}`)?.lastModified).toEqual(new Date(Date.UTC(2026, 2, 17)))
  })

  it('two fetches at different times have identical lastModified values', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-05T10:00:00Z'))
    const first = await sitemap()
    vi.setSystemTime(new Date('2026-11-05T10:00:05Z'))
    const second = await sitemap()
    const dates = (es: typeof first) => es.map(e => [e.url, e.lastModified instanceof Date ? e.lastModified.toISOString() : null])
    expect(dates(second)).toEqual(dates(first))
  })

  it('no entry is dated at or after the moment of the fetch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-05T10:00:00Z'))
    for (const e of await sitemap()) {
      if (e.lastModified instanceof Date) expect(e.lastModified.getTime(), e.url).toBeLessThan(Date.now())
    }
  })
})
