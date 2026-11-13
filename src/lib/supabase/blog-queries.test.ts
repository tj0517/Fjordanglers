/**
 * Integration test for the blog reads against the local Supabase stack (FA-1.83).
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * The test brings its own rows (slugs starting `fa183-`) and deletes them afterwards.
 *
 *   draft rows      — never returned: not by getBlogPosts, not by getBlogPost, not to a raw anon client
 *   write path      — an anon client cannot INSERT (42501), UPDATE or DELETE
 *   malformed slug  — answered null before any query
 *   hub links       — a hub lists the published posts of its own countries, read from the table (FA-1.90)
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { DestinationHubSkeleton } from '@/lib/destinations'

const h = vi.hoisted(() => ({
  hub: {
    slug: 'fa183-test-hub', group: 'Nordic', countries: ['Denmark'],
  } as DestinationHubSkeleton,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/destinations', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/destinations')>()
  return {
    ...original,
    getHubForSlug: (slug: string) => (slug === h.hub.slug ? h.hub : original.getHubForSlug(slug)),
  }
})

import { createServiceClient } from '@/lib/supabase/server'
import { getBlogPost, getBlogPosts, getDestinationHub } from './queries'

const svc = createServiceClient()
const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const BODY = Array.from({ length: 450 }, (_, i) => `word${i}`).join(' ') // 450 words → 2 min

async function cleanup() {
  await svc.from('blog_posts').delete().like('slug', 'fa183-%')
  await svc.from('destination_hubs').delete().eq('slug', 'fa183-test-hub')
}

beforeAll(async () => {
  await cleanup()
  // The hub's copy is a table row since FA-1.85; the test hub (not in DESTINATION_HUBS) brings its own.
  const hubRow = await svc.from('destination_hubs').insert({
    slug: 'fa183-test-hub', h1: 'FA-1.83 test hub', intro: 'Test.', meta_title: 'Test', meta_description: 'Test',
  })
  if (hubRow.error != null) throw new Error(`hub content: ${hubRow.error.message}`)
  // Two inserts, not one array: a bulk insert sends NULL for a key a row lacks, which skips the column default.
  const published = await svc.from('blog_posts').insert({
    slug: 'fa183-published', title: 'A published article', seo_title: 'Published article', description: 'Short description.',
    body_md: BODY, image_url: '/fish_catalog/salmon.png', image_alt: 'Salmon', category: 'Planning', country: 'Norway',
    status: 'published', published_at: '2026-03-17T00:00:00Z', created_at: '2026-03-17T00:00:00Z', updated_at: '2026-04-02T09:30:00Z',
  })
  if (published.error) throw new Error(published.error.message)

  const draft = await svc.from('blog_posts').insert({ slug: 'fa183-draft', title: 'A draft', body_md: 'secret draft text', status: 'draft', country: 'Denmark' })
  if (draft.error) throw new Error(draft.error.message)

  // FA-1.90: a published post about the test hub's country (Denmark — no seed post has it).
  const denmark = await svc.from('blog_posts').insert({
    slug: 'fa183-denmark', title: 'Fishing in Denmark', seo_title: 'Fishing in Denmark', description: 'Short description.',
    body_md: BODY, image_url: '/fish_catalog/salmon.png', image_alt: 'Salmon', category: 'Planning', country: 'Denmark',
    status: 'published', published_at: '2026-05-01T00:00:00Z',
  })
  if (denmark.error) throw new Error(denmark.error.message)
})

afterAll(cleanup)

describe('blog reads — published only', () => {
  it('getBlogPosts returns the published post and not the draft', async () => {
    const slugs = (await getBlogPosts()).map(p => p.slug)
    expect(slugs).toContain('fa183-published')
    expect(slugs).not.toContain('fa183-draft')
  })

  it('the list entry carries ISO dates and a read time, and no body', async () => {
    const post = (await getBlogPosts()).find(p => p.slug === 'fa183-published')!
    expect(post.publishedAt).toBe('2026-03-17T00:00:00.000Z')
    expect(post.updatedAt).toBe('2026-04-02T09:30:00.000Z')
    expect(post.readMinutes).toBe(2)
    expect(post).not.toHaveProperty('bodyMd')
  })

  it('getBlogPost returns the whole published post', async () => {
    const post = await getBlogPost('fa183-published')
    expect(post?.seoTitle).toBe('Published article')
    expect(post?.bodyMd).toBe(BODY)
    expect(post?.imageAlt).toBe('Salmon')
  })

  it('getBlogPost returns null for a draft, an unknown slug and a malformed one', async () => {
    expect(await getBlogPost('fa183-draft')).toBeNull()
    expect(await getBlogPost('fa183-no-such-post')).toBeNull()
    expect(await getBlogPost('Not A Slug!')).toBeNull()
    expect(await getBlogPost("x'; drop table blog_posts; --")).toBeNull()
  })
})

describe('blog_posts — what the browser key can do (RLS, through supabase-js)', () => {
  it('anon sees the published row and 0 rows of the draft', async () => {
    const published = await anon.from('blog_posts').select('slug').eq('slug', 'fa183-published')
    expect(published.error).toBeNull()
    expect(published.data).toHaveLength(1)

    const draft = await anon.from('blog_posts').select('slug').eq('slug', 'fa183-draft')
    expect(draft.error).toBeNull()
    expect(draft.data).toHaveLength(0)
  })

  it('anon INSERT fails with 42501', async () => {
    const { error } = await anon.from('blog_posts').insert({ slug: 'fa183-anon-insert', title: 'x' })
    expect(error?.code).toBe('42501')
    const { data } = await svc.from('blog_posts').select('slug').eq('slug', 'fa183-anon-insert')
    expect(data).toHaveLength(0)
  })

  it('anon UPDATE and DELETE fail with 42501 and change nothing', async () => {
    const update = await anon.from('blog_posts').update({ title: 'hacked' }).eq('slug', 'fa183-published')
    expect(update.error?.code).toBe('42501')
    const del = await anon.from('blog_posts').delete().eq('slug', 'fa183-published')
    expect(del.error?.code).toBe('42501')

    const { data } = await svc.from('blog_posts').select('title').eq('slug', 'fa183-published').single()
    expect(data?.title).toBe('A published article')
  })
})

describe('hub article links (FA-1.90: from the table, by country)', () => {
  it('a hub lists the published posts of its countries — not a draft, not another country\'s post', async () => {
    const data = await getDestinationHub('fa183-test-hub')
    expect(data?.articles).toEqual([{ slug: 'fa183-denmark', title: 'Fishing in Denmark' }])
  })
})
