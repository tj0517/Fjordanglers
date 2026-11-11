/**
 * The rules of the blog editor (FA-1.84) — pure: no I/O, no React, safe to import from the form
 * (client) and from the server action alike. The database enforces the same rules
 * (`supabase/migrations/20261110000000_add_blog_posts.sql`); this module gives the author a readable
 * message first, and the action re-checks everything on the server — the client's counters are a
 * convenience, never the guard.
 *
 * Keep the numbers here in step with the migration: SEO title ≤ 60 and description ≤ 155 apply to
 * drafts too (tj E1, 2026-11-10), so they are blocking, not warnings.
 */

import { z } from 'zod'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import type { Root, RootContent } from 'mdast'
import { COUNTRIES } from '@/lib/countries'
import { isValidBlogSlug } from '@/lib/blog/post'

export const SEO_TITLE_MAX = 60
export const DESCRIPTION_MAX = 155
export const TITLE_MAX = 200
const SLUG_MAX = 100
const BODY_MAX = 200_000
export const CATEGORY_MAX = 40
export const IMAGE_ALT_MAX = 300

const BLOG_STATUSES = ['draft', 'published'] as const
export type BlogStatus = (typeof BLOG_STATUSES)[number]

// ─── Slug ─────────────────────────────────────────────────────────────────────

/** Letters NFKD does not decompose into base letter + mark. */
const TRANSLITERATE: Record<string, string> = {
  ø: 'o', æ: 'ae', å: 'a', ð: 'd', þ: 'th', ł: 'l', ß: 'ss', đ: 'd', ı: 'i', œ: 'oe',
}

/** `Fishing in Norway: 2026 rules` → `fishing-in-norway-2026-rules`, at most 100 characters. */
export function suggestBlogSlug(title: string): string {
  const folded = Array.from(title.trim().toLowerCase())
    .map(ch => TRANSLITERATE[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

/**
 * A slug is the URL of an indexed page. It stays editable only until the post has been published
 * once — `published_at` is set at the first publication and kept when the post is unpublished, so
 * "has a date" is exactly "has been public at some point" (tj E2: enforced here, in the action).
 */
export function slugLockedFor(current: { status: string; published_at: string | null }): boolean {
  return current.status === 'published' || current.published_at != null
}

// ─── What a published post needs ──────────────────────────────────────────────

export type PublishField = 'seo_title' | 'description' | 'body_md' | 'image_url' | 'image_alt'

export const PUBLISH_FIELD_LABELS: Record<PublishField, string> = {
  seo_title: 'SEO title',
  description: 'Meta description',
  body_md: 'Article text',
  image_url: 'Hero image',
  image_alt: 'Image alt text',
}

/** Fields `blog_posts_published_complete` requires that are blank in `values` (a date is set by the action). */
export function missingForPublish(values: {
  seo_title: string | null
  description: string | null
  body_md: string
  image_url: string | null
  image_alt: string | null
}): PublishField[] {
  const blank = (v: string | null) => v == null || v.trim() === ''
  const missing: PublishField[] = []
  if (blank(values.seo_title)) missing.push('seo_title')
  if (blank(values.description)) missing.push('description')
  if (blank(values.body_md)) missing.push('body_md')
  if (blank(values.image_url)) missing.push('image_url')
  if (blank(values.image_alt)) missing.push('image_alt')
  return missing
}

/** "Hero image and Image alt text are required to publish." — names the field, not a constraint. */
export function missingForPublishMessage(missing: readonly PublishField[]): string {
  const names = missing.map(f => PUBLISH_FIELD_LABELS[f])
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${list} ${names.length === 1 ? 'is' : 'are'} required to publish.`
}

// ─── Database constraint → sentence ───────────────────────────────────────────

/**
 * Fallback for a violation that got past the checks above (a caller that skipped the form, or a
 * rule added to the table and not yet here). Keyed by constraint name, not by message text.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  blog_posts_published_complete:
    'A published post needs an SEO title, a meta description, the article text, a hero image with alt text and a publication date.',
  blog_posts_seo_title_length: `The SEO title is too long — ${SEO_TITLE_MAX} characters at most.`,
  blog_posts_description_length: `The meta description is too long — ${DESCRIPTION_MAX} characters at most.`,
  blog_posts_slug_format: 'The slug may contain only lowercase letters, digits and single hyphens (e.g. "fishing-in-norway-2026").',
  blog_posts_slug_key: 'Another post already uses this slug. Choose a different one.',
  blog_posts_title_not_blank: `The title cannot be blank and must be at most ${TITLE_MAX} characters.`,
  blog_posts_body_length: `The article text is too long — ${BODY_MAX.toLocaleString('en-US')} characters at most.`,
  blog_posts_image_url_shape: 'The image must be uploaded here or be a site path starting with "/".',
  blog_posts_category_length: `The category cannot be blank and must be at most ${CATEGORY_MAX} characters.`,
  blog_posts_country_check: 'Unknown country.',
  blog_posts_status_check: 'Unknown status.',
  blog_posts_guide_id_fkey: 'That guide no longer exists.',
}

export function blogConstraintMessage(dbMessage: string): string | null {
  for (const [constraint, human] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (dbMessage.includes(constraint)) return human
  }
  return null
}

// ─── Image URL ────────────────────────────────────────────────────────────────

/**
 * The hero image: a file the editor uploaded to `guide-photos/blog/` (tj O-50 a), or a site path
 * such as `/fish_catalog/salmon.png` — the Norway article already uses one, and a post must stay
 * editable without a re-upload. Anything else (another host, `data:`, `javascript:`, `//host`) is
 * refused; the table's `blog_posts_image_url_shape` is the second line.
 */
export function isBlogImageUrl(value: string, supabaseUrl: string): boolean {
  if (/^\/(?!\/)/.test(value)) return !value.includes('..') && !value.includes('\\')
  try {
    const prefix = new URL('/storage/v1/object/public/guide-photos/blog/', supabaseUrl).href
    const href = new URL(value).href
    return href === value && href.startsWith(prefix) && href.length > prefix.length
  } catch {
    return false
  }
}

// ─── Zod ──────────────────────────────────────────────────────────────────────

/** Optional text: trimmed, and an empty string is stored as NULL. */
const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).nullable()
    .transform(v => (v == null || v === '' ? null : v))

/**
 * The editor's payload. `image_url` is checked by the action (it needs the project URL), not here,
 * so this schema stays importable from the client. A blank SEO title / description is fine for a
 * draft; whether the post may be published is `missingForPublish`, checked once the status is known.
 */
export const BlogPostPayloadSchema = z.object({
  title: z.string().trim()
    .min(1, 'Title cannot be blank')
    .max(TITLE_MAX, `Title is too long — ${TITLE_MAX} characters at most`),
  slug: z.string().trim()
    .refine(isValidBlogSlug, 'The slug may contain only lowercase letters, digits and single hyphens (e.g. "fishing-in-norway-2026"), 100 characters at most'),
  seo_title: optionalText(SEO_TITLE_MAX, `SEO title is too long — ${SEO_TITLE_MAX} characters at most`),
  description: optionalText(DESCRIPTION_MAX, `Meta description is too long — ${DESCRIPTION_MAX} characters at most`),
  body_md: z.string().max(BODY_MAX, `Article text is too long — ${BODY_MAX.toLocaleString('en-US')} characters at most`),
  image_url: optionalText(2048, 'Image address is too long'),
  image_alt: optionalText(IMAGE_ALT_MAX, `Alt text is too long — ${IMAGE_ALT_MAX} characters at most`),
  category: z.string().trim()
    .min(1, 'Category cannot be blank')
    .max(CATEGORY_MAX, `Category is too long — ${CATEGORY_MAX} characters at most`),
  country: z.string()
    .refine(c => (COUNTRIES as readonly string[]).includes(c), 'Unknown country')
    .nullable(),
  guide_id: z.string().uuid('Invalid guide').nullable(),
  status: z.enum(BLOG_STATUSES),
})

export type BlogPostPayload = z.input<typeof BlogPostPayloadSchema>

// ─── Raw HTML in the body ─────────────────────────────────────────────────────

const htmlParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)

/**
 * The raw HTML the public renderer drops (`skipHtml`): the tags an author pasted from a web page
 * or an e-mail. Found by parsing the body the way the renderer does, so `<` inside a code span or
 * a fenced block, and an autolink like `<https://…>`, are not reported — they are not removed.
 * Returns each tag once, at most 5, as written.
 */
export function findDroppedHtml(markdown: string): string[] {
  const found: string[] = []
  const walk = (node: Root | RootContent): void => {
    if (node.type === 'html') found.push(node.value.trim())
    if ('children' in node) node.children.forEach(walk)
  }
  walk(htmlParser.parse(markdown))
  const tags = found.flatMap(v => v.match(/<\/?[a-zA-Z][^>]*>/g) ?? [])
  return [...new Set(tags)].slice(0, 5)
}
