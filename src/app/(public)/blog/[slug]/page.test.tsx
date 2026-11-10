import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlogPost } from '@/lib/blog/post'

/**
 * FA-1.83 — the article page, rendered for real with a mocked data layer.
 *   D3:  database text cannot end the ld+json <script> tag (`</script>` in the title);
 *   XSS: a <script> typed into the body is not in the page's HTML;
 *   SEO: the <title> is the row's SEO title as written; dates are ISO; an unknown post is a 404.
 */

const mocks = vi.hoisted(() => ({ post: null as BlogPost | null }))

vi.mock('@/lib/supabase/queries', () => ({ getBlogPost: async () => mocks.post }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import BlogPostPage, { generateMetadata } from './page'

const post = (over: Partial<BlogPost> = {}): BlogPost => ({
  slug: 'fishing-regulations-norway-2026',
  title: 'Fishing in Norway 2026',
  seoTitle: 'Fishing in Norway 2026: Regulations & Limits',
  description: 'Rules for 2026.',
  bodyMd: '## Sea angling\n\nText.',
  imageUrl: '/fish_catalog/salmon.png',
  imageAlt: 'Atlantic salmon',
  category: 'Planning',
  country: 'Norway',
  publishedAt: '2026-03-17T00:00:00.000Z',
  updatedAt: '2026-04-02T09:30:00.000Z',
  readMinutes: 4,
  ...over,
})

const props = { params: Promise.resolve({ slug: 'fishing-regulations-norway-2026' }) }
const render = async () => renderToStaticMarkup(await BlogPostPage(props))

beforeEach(() => {
  mocks.post = post()
})

describe('article page — JSON-LD (D3)', () => {
  it('a title containing </script> cannot close the ld+json tag', async () => {
    mocks.post = post({ title: 'Evil </script><script>alert(1)</script> title' })
    const html = await render()

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    expect(blocks).toHaveLength(2) // Article + BreadcrumbList: each tag closed exactly once, by us
    expect(html).not.toContain('<script>alert(1)')
    for (const [, json] of blocks) {
      expect(json).not.toMatch(/<\/?script/i)
      expect(() => JSON.parse(json)).not.toThrow()
    }
    const article = JSON.parse(blocks[0][1]) as { headline: string }
    expect(article.headline).toBe('Evil </script><script>alert(1)</script> title') // still the same text for a machine
  })

  it('emits Article and BreadcrumbList with ISO dates', async () => {
    const html = await render()
    const [article, crumbs] = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]) as Record<string, unknown>)
    expect(article['@type']).toBe('Article')
    expect(article.datePublished).toBe('2026-03-17T00:00:00.000Z')
    expect(article.dateModified).toBe('2026-04-02T09:30:00.000Z')
    expect(article.image).toBe('https://www.fjordanglers.com/fish_catalog/salmon.png')
    expect(crumbs['@type']).toBe('BreadcrumbList')
  })
})

describe('article page — body is never HTML (XSS)', () => {
  it('a <script> in the body does not appear in the page', async () => {
    mocks.post = post({ bodyMd: 'Safe text.\n\n<script>window.__pwned = 1</script>\n\n<img src=x onerror="alert(1)">' })
    const html = await render()
    expect(html).toContain('Safe text.')
    expect(html).not.toContain('__pwned')
    expect(html).not.toMatch(/onerror/i)
    // The only scripts on the page are the two ld+json ones.
    expect(html.match(/<script/g)).toHaveLength(2)
  })
})

describe('article page — metadata and 404', () => {
  it('the <title> is the SEO title as written, not the headline with a site suffix', async () => {
    const meta = await generateMetadata(props)
    expect(meta.title).toEqual({ absolute: 'Fishing in Norway 2026: Regulations & Limits' })
    expect((meta.title as { absolute: string }).absolute.length).toBeLessThanOrEqual(60)
    expect((meta.description ?? '').length).toBeLessThanOrEqual(155)
    expect(meta.alternates?.canonical).toBe('https://www.fjordanglers.com/blog/fishing-regulations-norway-2026')
  })

  it("the post's own image is the Open Graph image", async () => {
    const meta = await generateMetadata(props)
    expect(meta.openGraph?.images).toEqual([
      { url: 'https://www.fjordanglers.com/fish_catalog/salmon.png', width: 1200, height: 630, alt: 'Atlantic salmon' },
    ])
  })

  it('a slug that is not a published post is a 404, with no metadata', async () => {
    mocks.post = null
    await expect(BlogPostPage(props)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(await generateMetadata(props)).toEqual({})
  })
})
