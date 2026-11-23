/** FA-1.97 — the Journal list's filters: case-insensitive, from the data, unknown values mean no filter. */
import { describe, it, expect } from 'vitest'
import { filterPosts, hasCategory, initialFilter, listFacets, LIST_PAGE_SIZE } from './list'
import type { BlogPostSummary } from './post'

const post = (slug: string, category: string, country: string | null): BlogPostSummary => ({
  slug, title: `Title ${slug}`, description: 'D.', imageUrl: '/fish_catalog/salmon.png', imageAlt: 'Salmon',
  category, country, publishedAt: '2026-03-17T00:00:00.000Z', updatedAt: '2026-03-17T00:00:00.000Z', readMinutes: 3,
})

const POSTS = [
  post('nz', 'Seasons', 'New Zealand'),
  post('no', 'Planning', 'Norway'),
  post('se', 'seasons', 'Sweden'),
  post('general', ' Species ', null),
]

describe('initialFilter', () => {
  it('category=seasons keeps only the "Seasons" posts, whatever the casing of the data or the URL', () => {
    const filter = initialFilter(POSTS, { category: 'seasons' })
    expect(filter.category).toBe('Seasons') // the data's spelling (the newest post's)
    expect(filterPosts(POSTS, filter).map(p => p.slug)).toEqual(['nz', 'se'])
    expect(filterPosts(POSTS, initialFilter(POSTS, { category: 'SEASONS' })).map(p => p.slug)).toEqual(['nz', 'se'])
  })

  it('country is matched the same way', () => {
    const filter = initialFilter(POSTS, { country: 'new zealand' })
    expect(filter.country).toBe('New Zealand')
    expect(filterPosts(POSTS, filter).map(p => p.slug)).toEqual(['nz'])
  })

  it('an unknown value is no filter, not an empty page', () => {
    expect(initialFilter(POSTS, { category: 'Fly tying', country: 'Atlantis' })).toEqual({ category: null, country: null })
    expect(initialFilter(POSTS, {})).toEqual({ category: null, country: null })
    expect(initialFilter(POSTS, { category: '  ' })).toEqual({ category: null, country: null })
  })

  it('a repeated parameter (?category=a&category=b) uses the first', () => {
    expect(initialFilter(POSTS, { category: ['planning', 'seasons'] }).category).toBe('Planning')
  })

  it('category and country together narrow further', () => {
    const filter = initialFilter(POSTS, { category: 'seasons', country: 'sweden' })
    expect(filterPosts(POSTS, filter).map(p => p.slug)).toEqual(['se'])
  })
})

describe('listFacets', () => {
  it('chips come from the data, grouped case-insensitively, A–Z, blanks and missing countries dropped', () => {
    expect(listFacets(POSTS)).toEqual({
      categories: ['Planning', 'Seasons', 'Species'],
      countries: ['New Zealand', 'Norway', 'Sweden'],
    })
    expect(listFacets([post('x', '  ', null)])).toEqual({ categories: [], countries: [] })
    expect(listFacets([])).toEqual({ categories: [], countries: [] })
  })
})

describe('hasCategory (a "Topic hubs" tile shows only for a category with a post)', () => {
  it('is case-insensitive', () => {
    expect(hasCategory(POSTS, 'Seasons')).toBe(true)
    expect(hasCategory(POSTS, 'Species')).toBe(true)
    expect(hasCategory(POSTS, 'Regulations')).toBe(false)
  })
})

describe('paging', () => {
  it('"Load more" is for lists longer than 12', () => {
    expect(LIST_PAGE_SIZE).toBe(12)
  })
})
