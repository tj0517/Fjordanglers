/**
 * The blog editor's pure rules (FA-1.84): slug suggestion, what a published post needs and how the
 * message names it, the constraint fallback, which image addresses are accepted, and which HTML the
 * public renderer would silently drop.
 */
import { describe, it, expect } from 'vitest'
import {
  BlogPostPayloadSchema,
  DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  blogConstraintMessage,
  findDroppedHtml,
  isBlogImageUrl,
  missingForPublish,
  missingForPublishMessage,
  slugLockedFor,
  suggestBlogSlug,
} from '@/lib/blog/editor'
import { isValidBlogSlug } from '@/lib/blog/post'

const valid = {
  title: 'Fishing in Norway', slug: 'fishing-in-norway', seo_title: 'Fishing in Norway', description: 'A guide.',
  body_md: 'Text', image_url: '/fish_catalog/salmon.png', image_alt: 'A salmon', category: 'Planning',
  country: 'Norway', guide_id: null, status: 'draft',
} as const

describe('suggestBlogSlug', () => {
  it('lower-cases, folds accents and Nordic letters, joins with single hyphens', () => {
    expect(suggestBlogSlug('Fishing in Norway: 2026 rules!')).toBe('fishing-in-norway-2026-rules')
    expect(suggestBlogSlug('Sjørøye på Åland — Ærlig talt')).toBe('sjoroye-pa-aland-aerlig-talt')
  })

  it('always yields something the table accepts, at most 100 characters', () => {
    const slug = suggestBlogSlug('word '.repeat(60))
    expect(slug.length).toBeLessThanOrEqual(100)
    expect(isValidBlogSlug(slug)).toBe(true)
  })

  it('is empty for a title with no usable letters (the form then asks for a slug)', () => {
    expect(suggestBlogSlug('!!!')).toBe('')
  })
})

describe('slugLockedFor', () => {
  it('locks a published post and one that has been published before', () => {
    expect(slugLockedFor({ status: 'published', published_at: '2026-03-17T00:00:00Z' })).toBe(true)
    expect(slugLockedFor({ status: 'draft', published_at: '2026-03-17T00:00:00Z' })).toBe(true)
  })
  it('leaves a never-published draft editable', () => {
    expect(slugLockedFor({ status: 'draft', published_at: null })).toBe(false)
  })
})

describe('missingForPublish / message', () => {
  const complete = { seo_title: 'T', description: 'D', body_md: 'B', image_url: '/x.png', image_alt: 'A' }

  it('is empty for a complete post', () => {
    expect(missingForPublish(complete)).toEqual([])
  })

  it('treats blank and whitespace-only as missing, like the CHECK (btrim)', () => {
    expect(missingForPublish({ ...complete, image_url: null, image_alt: '   ', body_md: '\n' }))
      .toEqual(['body_md', 'image_url', 'image_alt'])
  })

  it('names the fields in the message, not a constraint', () => {
    expect(missingForPublishMessage(['image_url'])).toBe('Hero image is required to publish.')
    expect(missingForPublishMessage(['image_url', 'image_alt'])).toBe('Hero image and Image alt text are required to publish.')
    expect(missingForPublishMessage(['seo_title', 'description', 'image_alt']))
      .toBe('SEO title, Meta description and Image alt text are required to publish.')
  })
})

describe('blogConstraintMessage', () => {
  it('maps a Postgres error by constraint name', () => {
    const raw = 'new row for relation "blog_posts" violates check constraint "blog_posts_published_complete"'
    expect(blogConstraintMessage(raw)).toMatch(/published post needs/)
    expect(blogConstraintMessage('duplicate key value violates unique constraint "blog_posts_slug_key"')).toMatch(/already uses this slug/)
  })
  it('returns null for an error it does not know, so the caller logs it instead of showing it', () => {
    expect(blogConstraintMessage('connection reset by peer')).toBeNull()
  })
})

describe('isBlogImageUrl', () => {
  const base = 'http://127.0.0.1:54421'
  const blog = `${base}/storage/v1/object/public/guide-photos/blog/0b1c.jpg`

  it('accepts an upload in guide-photos/blog/ and a site path', () => {
    expect(isBlogImageUrl(blog, base)).toBe(true)
    expect(isBlogImageUrl('/fish_catalog/salmon.png', base)).toBe(true)
  })

  it('refuses another folder, another host, a protocol-relative address, data:, javascript: and traversal', () => {
    expect(isBlogImageUrl(`${base}/storage/v1/object/public/guide-photos/testimonials/x.jpg`, base)).toBe(false)
    expect(isBlogImageUrl(`${base}/storage/v1/object/public/guide-photos/blog/../x.jpg`, base)).toBe(false)
    expect(isBlogImageUrl('https://evil.example/storage/v1/object/public/guide-photos/blog/x.jpg', base)).toBe(false)
    expect(isBlogImageUrl('//evil.example/x.png', base)).toBe(false)
    expect(isBlogImageUrl('data:image/png;base64,AAAA', base)).toBe(false)
    expect(isBlogImageUrl('javascript:alert(1)', base)).toBe(false)
    expect(isBlogImageUrl('/a/../b.png', base)).toBe(false)
  })
})

describe('BlogPostPayloadSchema — the limits apply to a draft too (E1)', () => {
  it('accepts exactly 60 / 155 characters', () => {
    expect(BlogPostPayloadSchema.safeParse({ ...valid, seo_title: 'x'.repeat(SEO_TITLE_MAX), description: 'y'.repeat(DESCRIPTION_MAX) }).success).toBe(true)
  })
  it('refuses 61 / 156 characters, whatever the status', () => {
    const seo = BlogPostPayloadSchema.safeParse({ ...valid, seo_title: 'x'.repeat(SEO_TITLE_MAX + 1) })
    const desc = BlogPostPayloadSchema.safeParse({ ...valid, description: 'y'.repeat(DESCRIPTION_MAX + 1) })
    expect(seo.success).toBe(false)
    expect(desc.success).toBe(false)
    expect(seo.error?.issues[0].path).toEqual(['seo_title'])
    expect(desc.error?.issues[0].path).toEqual(['description'])
  })
  it('stores a blank optional field as NULL', () => {
    const parsed = BlogPostPayloadSchema.parse({ ...valid, seo_title: '  ', description: '', image_alt: null })
    expect([parsed.seo_title, parsed.description, parsed.image_alt]).toEqual([null, null, null])
  })
  it('refuses an unknown country, a bad guide id and a malformed slug', () => {
    expect(BlogPostPayloadSchema.safeParse({ ...valid, country: 'Mexico' }).success).toBe(false)
    expect(BlogPostPayloadSchema.safeParse({ ...valid, guide_id: 'not-a-uuid' }).success).toBe(false)
    expect(BlogPostPayloadSchema.safeParse({ ...valid, slug: 'Has Spaces' }).success).toBe(false)
    expect(BlogPostPayloadSchema.safeParse({ ...valid, slug: 'double--hyphen' }).success).toBe(false)
  })
})

describe('findDroppedHtml — what skipHtml removes', () => {
  it('reports block and inline tags an author pasted', () => {
    expect(findDroppedHtml('<div class="x">Hello</div>\n\nText with <b>bold</b>.')).toEqual(
      expect.arrayContaining(['<div class="x">', '</div>', '<b>', '</b>']),
    )
  })
  it('stays quiet about < in code, fences, autolinks and plain comparisons', () => {
    const md = 'Use `<div>` here.\n\n```html\n<p>fenced</p>\n```\n\nSee <https://example.com> and 3 < 5.'
    expect(findDroppedHtml(md)).toEqual([])
  })
  it('stays quiet about the named blocks', () => {
    expect(findDroppedHtml(':::warning\nCareful.\n:::\n\n::photo{src="/a.png" alt="A"}')).toEqual([])
  })
  it('reports each tag once and at most five', () => {
    const many = Array.from({ length: 9 }, (_, i) => `<t${i}>x</t${i}>`).join(' ')
    expect(findDroppedHtml(many).length).toBeLessThanOrEqual(5)
    expect(findDroppedHtml('<b>a</b> <b>b</b>').filter(t => t === '<b>')).toHaveLength(1)
  })
})
