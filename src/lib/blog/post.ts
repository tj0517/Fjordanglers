/**
 * A blog post as the public pages use it (FA-1.83) — pure: a row in, plain data out. Nothing here
 * queries anything (CLAUDE.md rule 3); `queries.ts` reads, these functions shape.
 *
 * "Published" is the one definition of "not a stub": a row with `status = 'published'`. The
 * database refuses a published row without an SEO title, description, body, image, alt text or
 * date (`blog_posts_published_complete`), so `toBlogPost` returning null is a defensive branch, not
 * a state that exists.
 */

import type { Database } from '@/lib/supabase/database.types'
import { SITE_URL } from '@/lib/site'

export type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']

/** What the list and the sitemap need. No body: the list must not ship every article's text. */
export interface BlogPostSummary {
  slug: string
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  category: string
  country: string | null
  /** ISO 8601, UTC. */
  publishedAt: string
  /** ISO 8601, UTC — `dateModified` and the sitemap's `lastModified`. */
  updatedAt: string
  readMinutes: number
}

export interface BlogPost extends BlogPostSummary {
  seoTitle: string
  bodyMd: string
}

const WORDS_PER_MINUTE = 200

/** Whole minutes to read, at least 1. Counts words in the Markdown source — block syntax adds a few, which is fine. */
export function readMinutes(markdown: string): number {
  const words = markdown.trim() === '' ? 0 : markdown.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** "March 17, 2026" — in UTC, so the day does not depend on the server's timezone. */
export function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The same shape the database enforces. Checked before a slug from a URL reaches a cache key or a query. */
export function isValidBlogSlug(slug: string): boolean {
  return slug.length <= 100 && SLUG_RE.test(slug)
}

function toIso(value: string): string {
  return new Date(value).toISOString()
}

export function toBlogPost(row: BlogPostRow): BlogPost | null {
  if (
    row.status !== 'published' ||
    row.published_at == null ||
    row.seo_title == null ||
    row.description == null ||
    row.image_url == null ||
    row.image_alt == null
  ) {
    return null
  }
  return {
    slug: row.slug,
    title: row.title,
    seoTitle: row.seo_title,
    description: row.description,
    bodyMd: row.body_md,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    category: row.category,
    country: row.country,
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at),
    readMinutes: readMinutes(row.body_md),
  }
}

export function toBlogPostSummary(post: BlogPost): BlogPostSummary {
  // The list does not need the body; the read time was computed from it already.
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    category: post.category,
    country: post.country,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    readMinutes: post.readMinutes,
  }
}

/** An image the row stores as a site path or an https URL, as an absolute URL for Open Graph and JSON-LD. */
export function absoluteImageUrl(imageUrl: string): string {
  return imageUrl.startsWith('/') ? `${SITE_URL}${imageUrl}` : imageUrl
}

// ─── Structured data ──────────────────────────────────────────────────────────

/** Serialise with `serializeJsonLd` (`@/lib/seo/offer-jsonld`) — a title can contain `</script>`. */
export function buildArticleJsonLd(post: BlogPost): Record<string, unknown> {
  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: absoluteImageUrl(post.imageUrl),
    author: { '@type': 'Organization', name: 'FjordAnglers', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'FjordAnglers',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/sygnet.png` },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}

export function buildBlogBreadcrumbJsonLd(post: Pick<BlogPost, 'slug' | 'title'>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  }
}
