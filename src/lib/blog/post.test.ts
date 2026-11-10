import { describe, it, expect } from 'vitest'
import {
  absoluteImageUrl, buildArticleJsonLd, buildBlogBreadcrumbJsonLd, formatPostDate, isValidBlogSlug,
  readMinutes, toBlogPost, type BlogPostRow,
} from './post'
import { serializeJsonLd } from '@/lib/seo/offer-jsonld'

const row = (over: Partial<BlogPostRow> = {}): BlogPostRow => ({
  id: 'id', slug: 'a-post', title: 'T', seo_title: 'S', description: 'D', body_md: 'one two three',
  image_url: '/fish_catalog/salmon.png', image_alt: 'A', category: 'Planning', country: null, guide_id: null,
  status: 'published', published_at: '2026-03-17T00:00:00+00:00', created_at: '2026-03-17T00:00:00+00:00',
  updated_at: '2026-04-02T09:30:00+00:00', ...over,
})

describe('readMinutes', () => {
  it('is at least one minute, and counts words at 200 per minute', () => {
    expect(readMinutes('')).toBe(1)
    expect(readMinutes('a few words')).toBe(1)
    expect(readMinutes(Array(450).fill('w').join(' '))).toBe(2)
    expect(readMinutes(Array(2000).fill('w').join(' '))).toBe(10)
  })
})

describe('formatPostDate', () => {
  it('is the UTC calendar day, whatever the server timezone', () => {
    expect(formatPostDate('2026-03-17T00:00:00.000Z')).toBe('March 17, 2026')
    expect(formatPostDate('2026-03-17T23:59:59.000Z')).toBe('March 17, 2026')
  })
})

describe('isValidBlogSlug', () => {
  it('accepts what the database accepts and refuses the rest', () => {
    for (const ok of ['a', 'fishing-regulations-norway-2026', 'a1-b2']) expect(isValidBlogSlug(ok), ok).toBe(true)
    for (const bad of ['', 'Upper', 'under_score', '-lead', 'trail-', 'double--hyphen', 'sp ace', 'a/b', '../x', 'a'.repeat(101)]) {
      expect(isValidBlogSlug(bad), bad).toBe(false)
    }
  })
})

describe('toBlogPost', () => {
  it('maps a complete published row, with ISO dates and a read time', () => {
    const post = toBlogPost(row())
    expect(post?.publishedAt).toBe('2026-03-17T00:00:00.000Z')
    expect(post?.updatedAt).toBe('2026-04-02T09:30:00.000Z')
    expect(post?.readMinutes).toBe(1)
  })

  it('refuses a draft, and a "published" row missing what the database requires (defence in depth)', () => {
    expect(toBlogPost(row({ status: 'draft' }))).toBeNull()
    for (const missing of ['seo_title', 'description', 'image_url', 'image_alt', 'published_at'] as const) {
      expect(toBlogPost(row({ [missing]: null })), missing).toBeNull()
    }
  })
})

describe('structured data', () => {
  const post = toBlogPost(row())!

  it('absoluteImageUrl keeps https URLs and prefixes site paths', () => {
    expect(absoluteImageUrl('/fish_catalog/salmon.png')).toBe('https://www.fjordanglers.com/fish_catalog/salmon.png')
    expect(absoluteImageUrl('https://x.supabase.co/storage/v1/object/public/a.png')).toBe('https://x.supabase.co/storage/v1/object/public/a.png')
  })

  it('Article carries the row\'s dates, not a guess', () => {
    const a = buildArticleJsonLd(post)
    expect(a).toMatchObject({ '@type': 'Article', datePublished: '2026-03-17T00:00:00.000Z', dateModified: '2026-04-02T09:30:00.000Z' })
  })

  it('BreadcrumbList is Home → Blog → the post', () => {
    const items = (buildBlogBreadcrumbJsonLd(post).itemListElement as { name: string }[]).map(i => i.name)
    expect(items).toEqual(['Home', 'Blog', 'T'])
  })

  it('serialised, a hostile title cannot contain </script', () => {
    const json = serializeJsonLd(buildArticleJsonLd({ ...post, title: '</script><script>alert(1)</script>' }))
    expect(json).not.toMatch(/<\/?script/i)
    expect(JSON.parse(json).headline).toBe('</script><script>alert(1)</script>')
  })
})
