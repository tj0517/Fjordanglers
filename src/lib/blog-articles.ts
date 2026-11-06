import type { ComponentType } from 'react'
import { BLOG_POSTS, type BlogPost } from '@/lib/blog-data'
import { NorwayRegulationsContent } from '@/lib/blog-content/norway-regulations-2026'

/**
 * Slugs that have a real article body. Anything in `BLOG_POSTS` without an entry
 * here is a stub: the page renders a placeholder and says `noindex`.
 *
 * `isBlogStub` below is the ONE definition of "stub". The blog page (robots meta)
 * and the sitemap both read it — do not re-derive it elsewhere. FA-1.83 replaces
 * this registry with a table; the rule moves with it.
 */
export const ARTICLE_CONTENT: Record<string, ComponentType> = {
  'fishing-regulations-norway-2026': NorwayRegulationsContent,
}

export function isBlogStub(slug: string): boolean {
  return ARTICLE_CONTENT[slug] == null
}

/** Posts that are meant for the search index (everything that is not a stub). */
export function getIndexableBlogPosts(): BlogPost[] {
  return BLOG_POSTS.filter(post => !isBlogStub(post.slug))
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * `BlogPost.date` is display text ("March 17, 2026"). Returns it as a UTC date so
 * the result does not depend on the server's timezone, or `undefined` when the
 * text is not in that shape — the caller then omits the field instead of guessing.
 */
export function parseBlogPostDate(text: string): Date | undefined {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(text.trim())
  if (m == null) return undefined
  const month = MONTHS.indexOf(m[1].toLowerCase())
  if (month === -1) return undefined
  const day = Number(m[2])
  const date = new Date(Date.UTC(Number(m[3]), month, day))
  // Date.UTC rolls "February 31" into March — reject that instead of returning a wrong day.
  return date.getUTCDate() === day ? date : undefined
}
