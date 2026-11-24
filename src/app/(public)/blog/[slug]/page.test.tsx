import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlogPost, BlogPostSummary } from '@/lib/blog/post'

/**
 * FA-1.83 — the article page, rendered for real with a mocked data layer.
 *   D3:  database text cannot end the ld+json <script> tag (`</script>` in the title);
 *   XSS: a <script> typed into the body is not in the page's HTML;
 *   SEO: the <title> is the row's SEO title as written; dates are ISO; an unknown post is a 404.
 */

const mocks = vi.hoisted(() => ({
  post: null as BlogPost | null,
  hub: null as { slug: string; label: string } | null,
  latest: [] as BlogPostSummary[],
}))

vi.mock('@/lib/supabase/queries', () => ({
  getBlogPost: async () => mocks.post,
  getArticleRelated: async () => ({ offers: { tier: 'anywhere', pages: [] }, hub: mocks.hub }),
  getLatestBlogPosts: async () => mocks.latest,
}))
vi.mock('@/components/layout/nav', () => ({ PLAN_YOUR_TRIP_HREF: '/trips' }))
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

const summary = (slug: string): BlogPostSummary => ({
  slug, title: `Title ${slug}`, description: 'Description.', imageUrl: '/fish_catalog/salmon.png', imageAlt: 'Salmon',
  category: 'Seasons', country: 'Sweden', publishedAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z', readMinutes: 3,
})

const ldBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]) as Record<string, unknown>)

beforeEach(() => {
  mocks.post = post()
  mocks.hub = null
  mocks.latest = []
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

const FAQ_BODY = [
  '## Sea angling', '', 'Text.', '',
  '## FAQ – Frequently Asked Questions (2026)', '',
  '### Do I need a licence for the sea?', '', 'No. A **licence** is not required.', '',
  '### What do I need for a salmon river?', '', '- The *national* fee.', '- A local fiskekort.', '',
  '## Useful Links (Official Resources)', '', '- [Fiskeridirektoratet](https://www.fiskeridir.no)',
].join('\n')

describe('article page — FAQ section and FAQPage (FA-1.97)', () => {
  it('a body with an FAQ: a third ld+json block, FAQPage, one question per ###, plain-text answers', async () => {
    mocks.post = post({ bodyMd: FAQ_BODY })
    const html = await render()
    const blocks = ldBlocks(html)
    expect(blocks.map(b => b['@type'])).toEqual(['Article', 'BreadcrumbList', 'FAQPage'])

    const faq = blocks[2] as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
    expect(faq.mainEntity).toHaveLength(2)
    expect(faq.mainEntity[0].name).toBe('Do I need a licence for the sea?')
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe('No. A licence is not required.')
    expect(faq.mainEntity[1].acceptedAnswer.text).toBe('The national fee.\nA local fiskekort.')

    // The section is on the page once, with the heading's id; the questions are not <h3>s any more.
    expect(html.match(/data-block="article-faq"/g)).toHaveLength(1)
    expect(html).toContain('id="faq-frequently-asked-questions-2026"')
    expect(html).not.toMatch(/<h3[^>]*>Do I need a licence/)
    expect(html).toContain('id="useful-links-official-resources"')
  })

  it('a body without an FAQ: no FAQPage and no FAQ block', async () => {
    mocks.post = post({ bodyMd: '## Sea angling\n\nText.\n\n## Useful links\n\n- a' })
    const html = await render()
    expect(ldBlocks(html).map(b => b['@type'])).toEqual(['Article', 'BreadcrumbList'])
    expect(html).not.toContain('FAQPage')
    expect(html).not.toContain('data-block="article-faq"')
  })

  it('an FAQ heading with no ### question is an ordinary section: no FAQPage', async () => {
    mocks.post = post({ bodyMd: '## Sea angling\n\nText.\n\n## FAQ\n\nAsk us.' })
    const html = await render()
    expect(html).not.toContain('FAQPage')
    expect(html).toContain('id="faq"')
  })
})

describe('article page — layout around the body (FA-1.97)', () => {
  it('breadcrumb: the country links to the hub when there is one, is plain text when not, and is omitted without a country', async () => {
    mocks.hub = { slug: 'norway', label: 'Guided Fishing Trips in Norway' }
    const withHub = await render()
    expect(withHub).toMatch(/<a [^>]*href="\/norway"[^>]*>Norway<\/a>/)

    mocks.hub = null
    const noHub = await render()
    expect(noHub).not.toMatch(/<a [^>]*>Norway<\/a>/)
    expect(noHub).toMatch(/<span[^>]*>Norway<\/span>/)

    mocks.post = post({ country: null, title: 'Fishing rules' })
    const noCountry = await render()
    expect(noCountry.match(/aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0]).not.toContain('Norway')
  })

  it('footer: "Written by FjordAnglers · Published …", and "Updated …" only on another UTC day', async () => {
    const other = await render() // published 2026-03-17, updated 2026-04-02
    expect(other).toContain('Written by FjordAnglers')
    expect(other).toMatch(/Published March 17, 2026[\s\S]*Updated April 2, 2026/)

    mocks.post = post({ updatedAt: '2026-03-17T23:59:00.000Z' })
    const sameDay = await render()
    expect(sameDay).toContain('Published March 17, 2026')
    expect(sameDay).not.toContain('Updated')
  })

  it('hub block only with a hub; "More from the Journal" never lists the current post and shows at most three', async () => {
    expect(await render()).not.toContain('data-block="article-hub"')
    expect(await render()).not.toContain('More from the Journal')

    mocks.hub = { slug: 'norway', label: 'Guided Fishing Trips in Norway' }
    mocks.latest = [summary('fishing-regulations-norway-2026'), summary('a'), summary('b'), summary('c')]
    const html = await render()
    expect(html).toContain('data-block="article-hub"')
    expect(html).toContain('More from the Journal')
    const cards = [...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map(m => m[1])
    expect(new Set(cards)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('no placeholder from the mockup ever reaches the page', async () => {
    mocks.hub = { slug: 'norway', label: 'Guided Fishing Trips in Norway' }
    mocks.latest = [summary('a')]
    const html = await render()
    expect(html).not.toMatch(/\[(X\]|DATE|PHOTO|GUIDE QUOTE|OFFICIAL SOURCE)|Last checked|Report an outdated|Ask us directly|Rules for the 2026/)
  })

  it('the contents column is sticky, not fixed, and the page has one <main>', async () => {
    const html = await render()
    expect(html).toContain('position:sticky')
    expect(html).not.toContain('position:fixed')
    expect(html.match(/<main[\s>]/g)).toHaveLength(1)
  })
})
