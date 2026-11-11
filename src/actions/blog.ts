'use server'

/**
 * Blog editor actions (FA-1.84). Only an admin writes (`requireAdmin()` first, then the service
 * role); the browser keys have no write path to `blog_posts` (FA-1.83 migration).
 *
 *   saveBlogPost         create or edit; the target status decides whether it is also a publication
 *   setBlogPostStatus    publish / unpublish an existing post without touching its content — so an
 *                        urgent unpublish never waits on a field that fails validation
 *
 * Every successful write records one `audit_log` row (tj decision 1 → A): the table has no other
 * event log for content. The row is written after the post; if it fails the failure is logged and the
 * author's save stands — a lost audit row must not undo a save.
 *
 * Rules the editor enforces on the server, whatever the form sent: SEO title ≤ 60 and description ≤ 155
 * (E1), a slug that never changes once the post has been published (E2), the fields a published
 * post needs named in the message (E4). Publishing sets `published_at` if it is empty and keeps it
 * afterwards, so an unpublished-then-republished post keeps its original date.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { env } from '@/lib/env'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { CACHE_TAG_BLOG } from '@/lib/supabase/queries'
import { blogAuditDiff, type AuditedPost } from '@/lib/blog/audit'
import {
  BlogPostPayloadSchema,
  blogConstraintMessage,
  isBlogImageUrl,
  missingForPublish,
  missingForPublishMessage,
  slugLockedFor,
  type BlogPostPayload,
  type BlogStatus,
  type PublishField,
} from '@/lib/blog/editor'

export type BlogActionResult =
  | { success: true; id: string; slug: string; status: BlogStatus }
  | { success: false; error: string; missing?: PublishField[] }

const IdSchema = z.string().uuid()

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation error'
}

function fail(error: string, missing?: PublishField[]): BlogActionResult {
  return missing == null ? { success: false, error } : { success: false, error, missing }
}

/** A database error → a sentence for the form; the raw text goes to the log, not to the author. */
function dbFailure(context: string, message: string): BlogActionResult {
  const human = blogConstraintMessage(message)
  if (human != null) return fail(human)
  console.error(`[${context}]`, message)
  return fail('The post could not be saved. Try again, and tell a developer if it keeps happening.')
}

type PostRow = {
  id: string
  slug: string
  title: string
  seo_title: string | null
  description: string | null
  body_md: string
  image_url: string | null
  image_alt: string | null
  category: string
  country: string | null
  guide_id: string | null
  status: string
  published_at: string | null
}

const ROW_COLUMNS =
  'id, slug, title, seo_title, description, body_md, image_url, image_alt, category, country, guide_id, status, published_at'

const toAudited = (r: PostRow): AuditedPost => ({
  slug: r.slug, title: r.title, seo_title: r.seo_title, description: r.description,
  body_md: r.body_md, image_url: r.image_url, image_alt: r.image_alt, category: r.category,
  country: r.country, guide_id: r.guide_id, status: r.status, published_at: r.published_at,
})

/** One `audit_log` row. Never throws and never fails the caller's save. */
async function recordChange(
  userId: string,
  operation: 'INSERT' | 'UPDATE',
  recordId: string,
  before: PostRow | null,
  after: PostRow,
): Promise<void> {
  try {
    const { old_data, new_data } = blogAuditDiff(before == null ? null : toAudited(before), toAudited(after))
    const { error } = await createServiceClient().from('audit_log').insert({
      table_name: 'blog_posts',
      operation,
      record_id: recordId,
      old_data,
      new_data,
      changed_by: userId,
    })
    if (error != null) console.error('[blog audit] insert failed:', error.message)
  } catch (err) {
    console.error('[blog audit] failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Everything a public page may have cached from this post: the article, the list, the sitemap
 * (all read through the `blog` tag) and the hubs that link to it. Called after a change that
 * touches a published post — publish, edit of a published post, unpublish.
 */
function refreshPublicPages(slug: string, previousSlug?: string): void {
  revalidateTag(CACHE_TAG_BLOG, {})
  revalidatePath('/blog')
  revalidatePath(`/blog/${slug}`)
  if (previousSlug != null && previousSlug !== slug) revalidatePath(`/blog/${previousSlug}`)
  revalidatePath('/sitemap.xml')
  for (const hub of DESTINATION_HUBS) revalidatePath(`/${hub.slug}`)
}

function refreshAdmin(): void {
  revalidatePath('/admin/blog')
}

// ─── saveBlogPost ─────────────────────────────────────────────────────────────

export async function saveBlogPost(
  id: string | null,
  payload: BlogPostPayload,
): Promise<BlogActionResult> {
  const { userId } = await requireAdmin()

  if (id != null && !IdSchema.safeParse(id).success) return fail('Invalid post id')

  const parsed = BlogPostPayloadSchema.safeParse(payload)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const values = parsed.data

  if (values.image_url != null && !isBlogImageUrl(values.image_url, env.NEXT_PUBLIC_SUPABASE_URL)) {
    return fail('The hero image must be uploaded with the image field, or be a site path starting with "/".')
  }

  if (values.status === 'published') {
    const missing = missingForPublish(values)
    if (missing.length > 0) return fail(missingForPublishMessage(missing), missing)
  }

  const supabase = createServiceClient()

  let current: PostRow | null = null
  if (id != null) {
    const { data, error } = await supabase.from('blog_posts').select(ROW_COLUMNS).eq('id', id).maybeSingle()
    if (error != null) return dbFailure('saveBlogPost read', error.message)
    if (data == null) return fail('Post not found')
    current = data

    if (slugLockedFor(current) && values.slug !== current.slug) {
      return fail('The slug of a post that has been published cannot be changed — its address is already indexed by search engines.')
    }
  }

  // Publishing stamps the date once; an existing date is kept, also through an unpublish.
  const publishedAt = values.status === 'published'
    ? (current?.published_at ?? new Date().toISOString())
    : (current?.published_at ?? null)

  const columns = {
    slug: values.slug,
    title: values.title,
    seo_title: values.seo_title,
    description: values.description,
    body_md: values.body_md,
    image_url: values.image_url,
    image_alt: values.image_alt,
    category: values.category,
    country: values.country,
    guide_id: values.guide_id,
    status: values.status,
    published_at: publishedAt,
  }

  let saved: PostRow
  if (current == null) {
    const { data, error } = await supabase.from('blog_posts').insert(columns).select(ROW_COLUMNS).single()
    if (error != null) return dbFailure('saveBlogPost insert', error.message)
    saved = data
  } else {
    let update = supabase.from('blog_posts').update(columns).eq('id', current.id)
    if (values.slug !== current.slug) {
      // The slug is changing, which the check above allowed because the post was a never-published
      // draft. Hold the write to that same state: if another admin published it in between, this
      // matches nothing instead of moving an indexed URL.
      update = update.eq('status', 'draft').is('published_at', null)
    }
    const { data, error } = await update.select(ROW_COLUMNS)
    if (error != null) return dbFailure('saveBlogPost update', error.message)
    if ((data ?? []).length === 0) return fail('The post was changed by someone else while you were editing. Reload the page and try again.')
    saved = data[0]
  }

  await recordChange(userId, current == null ? 'INSERT' : 'UPDATE', saved.id, current, saved)

  refreshAdmin()
  if (current?.status === 'published' || saved.status === 'published') {
    refreshPublicPages(saved.slug, current?.slug)
  }

  return { success: true, id: saved.id, slug: saved.slug, status: saved.status as BlogStatus }
}

// ─── setBlogPostStatus ────────────────────────────────────────────────────────

export async function setBlogPostStatus(
  id: string,
  status: BlogStatus,
): Promise<BlogActionResult> {
  const { userId } = await requireAdmin()

  if (!IdSchema.safeParse(id).success) return fail('Invalid post id')
  if (!z.enum(['draft', 'published']).safeParse(status).success) return fail('Invalid status')

  const supabase = createServiceClient()

  const { data: current, error: readError } = await supabase
    .from('blog_posts').select(ROW_COLUMNS).eq('id', id).maybeSingle()
  if (readError != null) return dbFailure('setBlogPostStatus read', readError.message)
  if (current == null) return fail('Post not found')

  if (status === 'published') {
    const missing = missingForPublish(current)
    if (missing.length > 0) return fail(missingForPublishMessage(missing), missing)
  }

  if (current.status === status) {
    return { success: true, id: current.id, slug: current.slug, status }
  }

  const publishedAt = status === 'published'
    ? (current.published_at ?? new Date().toISOString())
    : current.published_at

  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status, published_at: publishedAt })
    .eq('id', id)
    .select(ROW_COLUMNS)
  if (error != null) return dbFailure('setBlogPostStatus update', error.message)
  if ((data ?? []).length === 0) return fail('Post not found')

  await recordChange(userId, 'UPDATE', current.id, current, data[0])

  refreshAdmin()
  refreshPublicPages(current.slug)

  return { success: true, id: current.id, slug: current.slug, status }
}
