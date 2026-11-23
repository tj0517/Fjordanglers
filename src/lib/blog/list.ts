/**
 * The blog list's filters (FA-1.97) — pure, so the server (initial filter from the URL) and the
 * client list (chips) use the same rules, and a test can hold them.
 *
 * A post's category is free text (FA-1.84 C3) and its country is a name: "Seasons", "seasons" and
 * " Seasons " are one filter. Chips come from the data — a category nobody has written in does not
 * get a chip — and the label of a group is the casing of its newest post.
 */

import type { BlogPostSummary } from './post'

/** "Load more articles" shows only when more than this many posts match. */
export const LIST_PAGE_SIZE = 12

export interface ListFilter {
  category: string | null
  country: string | null
}

export const NO_FILTER: ListFilter = { category: null, country: null }

const fold = (value: string): string => value.trim().toLowerCase()

/** Distinct values, grouped case-insensitively, labelled with their first (newest post's) spelling, A–Z. Blanks dropped. */
function distinct(values: readonly (string | null)[]): string[] {
  const seen = new Map<string, string>()
  for (const value of values) {
    if (value == null) continue
    const label = value.trim()
    if (label !== '' && !seen.has(fold(label))) seen.set(fold(label), label)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export function listFacets(posts: readonly BlogPostSummary[]): { categories: string[]; countries: string[] } {
  return {
    categories: distinct(posts.map(post => post.category)),
    countries: distinct(posts.map(post => post.country)),
  }
}

/** The facet value that `wanted` names, in the data's spelling; null for an unknown or missing one. */
function matchFacet(options: readonly string[], wanted: string | string[] | undefined): string | null {
  const first = Array.isArray(wanted) ? wanted[0] : wanted
  if (first == null || fold(first) === '') return null
  return options.find(option => fold(option) === fold(first)) ?? null
}

/** `?category=` and `?country=` as the list's starting filter; an unknown value means no filter, not an empty page. */
export function initialFilter(
  posts: readonly BlogPostSummary[],
  params: { category?: string | string[]; country?: string | string[] },
): ListFilter {
  const { categories, countries } = listFacets(posts)
  return { category: matchFacet(categories, params.category), country: matchFacet(countries, params.country) }
}

export function filterPosts(posts: readonly BlogPostSummary[], filter: ListFilter): BlogPostSummary[] {
  return posts.filter(post =>
    (filter.category == null || fold(post.category) === fold(filter.category)) &&
    (filter.country == null || (post.country != null && fold(post.country) === fold(filter.country))),
  )
}

/** Does any post carry this category (case-insensitively)? A "Topic hubs" tile shows only when it does. */
export function hasCategory(posts: readonly BlogPostSummary[], category: string): boolean {
  return posts.some(post => fold(post.category) === fold(category))
}
