import { describe, it, expect } from 'vitest'
import { BLOG_POSTS } from './blog-data'
import { getIndexableBlogPosts, isBlogStub, parseBlogPostDate } from './blog-articles'

describe('isBlogStub / getIndexableBlogPosts', () => {
  it('a post with content is not a stub; a post without is; unknown slugs are stubs', () => {
    expect(isBlogStub('fishing-regulations-norway-2026')).toBe(false)
    expect(isBlogStub('atlantic-salmon-norway-guide')).toBe(true)
    expect(isBlogStub('no-such-post')).toBe(true)
  })

  it('indexable posts are exactly the non-stubs', () => {
    expect(getIndexableBlogPosts().map(p => p.slug)).toEqual(
      BLOG_POSTS.filter(p => !isBlogStub(p.slug)).map(p => p.slug),
    )
  })
})

describe('parseBlogPostDate', () => {
  it('parses "Month D, YYYY" as UTC midnight', () => {
    expect(parseBlogPostDate('March 17, 2026')?.toISOString()).toBe('2026-03-17T00:00:00.000Z')
    expect(parseBlogPostDate('February 8, 2026')?.toISOString()).toBe('2026-02-08T00:00:00.000Z')
  })

  it('returns undefined — not a guess — for text it cannot read', () => {
    for (const bad of ['', 'soon', '2026-03-17', 'Marchh 17, 2026', 'February 31, 2026']) {
      expect(parseBlogPostDate(bad), bad).toBeUndefined()
    }
  })

  it('every date in blog-data.ts parses', () => {
    for (const p of BLOG_POSTS) expect(parseBlogPostDate(p.date), p.slug).toBeInstanceOf(Date)
  })
})
