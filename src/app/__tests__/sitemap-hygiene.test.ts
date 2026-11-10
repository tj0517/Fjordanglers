/**
 * FA-1.88 — the sitemap lists only pages meant for the index, with real dates.
 *
 *  - blog posts come from `getBlogPosts()` — published rows only (the draft filter itself is
 *    proved against the database in `src/lib/supabase/blog-queries.test.ts`);
 *  - `lastModified` is a real date or absent — never "now";
 *  - two fetches at different times carry identical `lastModified` values.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const PUBLISHED = [
  { slug: 'published-article', updatedAt: '2026-03-17T00:00:00.000Z' },
  { slug: 'second-article',    updatedAt: '2026-04-02T09:30:00.000Z' },
]

const blogMock = vi.hoisted(() => ({ fail: false }))

vi.mock('@/lib/supabase/queries', () => ({
  getBlogPosts: async () => {
    if (blogMock.fail) throw new Error('db down')
    return PUBLISHED
  },
}))

vi.mock('@/lib/supabase/server', () => {
  const rows: Record<string, unknown[]> = {
    experience_pages: [
      // A guide is listed only with an active offer (FA-1.86) — each fixture guide has one.
      { slug: 'dated-offer',   updated_at: '2026-10-01T08:30:00Z', guide_id: 'g1' },
      { slug: 'undated-offer', updated_at: null,                   guide_id: 'g2' },
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
  it('lists every published blog post and no other /blog/ URL', async () => {
    const blogUrls = (await sitemap()).map(e => e.url).filter(u => u.includes('/blog/'))
    expect(blogUrls.sort()).toEqual(PUBLISHED.map(p => `${SITE}/blog/${p.slug}`).sort())
  })

  it('the old stub slugs are not listed', async () => {
    const urls = (await sitemap()).map(e => e.url)
    for (const slug of ['atlantic-salmon-norway-guide', 'best-trout-rivers-sweden', 'pike-fishing-beginners', 'fishing-license-scandinavia', 'grayling-season-2026']) {
      expect(urls).not.toContain(`${SITE}/blog/${slug}`)
    }
  })

  it('a failed blog read leaves the rest of the sitemap in place', async () => {
    blogMock.fail = true
    try {
      const urls = (await sitemap()).map(e => e.url)
      expect(urls).toContain(`${SITE}/trips`)
      expect(urls.filter(u => u.includes('/blog/'))).toEqual([])
    } finally {
      blogMock.fail = false
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

  it("blog posts carry the row's updated_at, not the fetch time", async () => {
    const entries = await sitemap()
    expect(byUrl(entries, '/blog/published-article')?.lastModified).toEqual(new Date('2026-03-17T00:00:00.000Z'))
    expect(byUrl(entries, '/blog/second-article')?.lastModified).toEqual(new Date('2026-04-02T09:30:00.000Z'))
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
