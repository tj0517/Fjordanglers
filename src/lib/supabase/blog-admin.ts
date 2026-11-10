/**
 * Blog posts for the admin editor (FA-1.84) — the reader of drafts.
 *
 * The public reads (`getBlogPost`, `getBlogPosts` in queries.ts) use the anon client and see
 * published rows only. The editor must see drafts too, so these go through the service role, on
 * the server, and check the caller themselves — the same shape as `testimonials.ts`.
 *
 * Import only in Server Components or Server Actions — never in Client Components.
 */

import { createServiceClient } from './server'
import { requireAdmin } from '@/lib/auth/guards'
import type { Database } from './database.types'

export type BlogPostAdminRow = Database['public']['Tables']['blog_posts']['Row']

/** What the list shows — no body. */
export type BlogPostListItem = Pick<
  BlogPostAdminRow,
  'id' | 'slug' | 'title' | 'status' | 'published_at' | 'updated_at' | 'country' | 'category'
>

const LIST_COLUMNS = 'id, slug, title, status, published_at, updated_at, country, category'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Every post, drafts first, then newest change first. */
export async function listBlogPostsForAdmin(): Promise<BlogPostListItem[]> {
  await requireAdmin()

  const { data, error } = await createServiceClient()
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .order('updated_at', { ascending: false })

  if (error != null) throw new Error(`[listBlogPostsForAdmin] ${error.message}`)

  const rows = data ?? []
  return [...rows.filter(r => r.status !== 'published'), ...rows.filter(r => r.status === 'published')]
}

/** One post, whatever its status; null for an unknown or malformed id. */
export async function getBlogPostForAdmin(id: string): Promise<BlogPostAdminRow | null> {
  await requireAdmin()
  if (!UUID_RE.test(id)) return null

  const { data, error } = await createServiceClient()
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error != null) throw new Error(`[getBlogPostForAdmin] ${error.message}`)
  return data
}

export type BlogGuideOption = { id: string; name: string; country: string | null }

/** Guides the author can feature in a post — every guide with a name, by name. */
export async function listGuideOptionsForBlog(): Promise<BlogGuideOption[]> {
  await requireAdmin()

  const { data, error } = await createServiceClient()
    .from('guides')
    .select('id, full_name, country')
    .order('full_name')

  if (error != null) throw new Error(`[listGuideOptionsForBlog] ${error.message}`)
  return (data ?? []).map(g => ({ id: g.id, name: g.full_name, country: g.country }))
}
