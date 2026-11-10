/**
 * Integration test for the blog editor actions against the local Supabase stack (FA-1.84).
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * The guard is the real `requireAdmin`: `createClient` (the cookie session) is replaced by a client
 * signed in as one of the seed users (supabase/seed.sql), so "an angler is refused" is the real role
 * check against the real `profiles` row, not a stub. The service client is the real one too — every
 * assertion about "the table did not change" is a SELECT.
 *
 * Rows the test makes have slugs starting `fa184-`; they and their audit rows are deleted afterwards.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({
  as: 'admin' as 'admin' | 'angler' | 'anon',
  failAudit: false,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: h.revalidateTag,
  revalidatePath: h.revalidatePath,
  unstable_cache: <T,>(fn: T) => fn,
}))

// The table only takes an `https://` image address (`blog_posts_image_url_shape`), and the local
// Storage URL is http://127.0.0.1 — so the action sees a production-shaped project URL here. The
// database it writes to is still the local one.
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fa184.supabase.co' },
}))

const ACCOUNTS = {
  admin:  { email: 'admin@seed.test',  password: 'seed-admin-password-2026' },
  angler: { email: 'angler@seed.test', password: 'seed-angler-password-2026' },
} as const

const signedIn: Partial<Record<'admin' | 'angler', SupabaseClient<Database>>> = {}

async function sessionClient(who: 'admin' | 'angler' | 'anon'): Promise<SupabaseClient<Database>> {
  const client = createSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  if (who === 'anon') return client
  const cached = signedIn[who]
  if (cached != null) return cached
  const { error } = await client.auth.signInWithPassword(ACCOUNTS[who])
  if (error != null) throw new Error(`seed sign-in failed for ${who}: ${error.message}`)
  signedIn[who] = client
  return client
}

vi.mock('@/lib/supabase/server', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/supabase/server')>()
  return {
    ...original,
    createClient: async () => sessionClient(h.as),
    // The real service client; when `failAudit` is set, a write to audit_log reports an error.
    createServiceClient: () => {
      const real = original.createServiceClient()
      if (!h.failAudit) return real
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop !== 'from') return Reflect.get(target, prop, receiver)
          return (table: string) =>
            table === 'audit_log'
              ? { insert: async () => ({ error: { message: 'simulated audit failure' } }) }
              : target.from(table as 'blog_posts')
        },
      })
    },
  }
})

import { saveBlogPost, setBlogPostStatus } from '@/actions/blog'
import { UnauthorizedError } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { getBlogPost, getBlogPosts } from '@/lib/supabase/queries'
import { blogConstraintMessage, type BlogPostPayload } from '@/lib/blog/editor'

const ADMIN_ID = '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01'
const svc = () => createServiceClient()
const PROJECT_URL = 'https://fa184.supabase.co'
const BLOG_IMAGE = `${PROJECT_URL}/storage/v1/object/public/guide-photos/blog/test.jpg`

const complete = (slug: string, over: Partial<BlogPostPayload> = {}): BlogPostPayload => ({
  title: `FA-1.84 ${slug}`,
  slug,
  seo_title: 'A good SEO title',
  description: 'A description of the article, short enough for Google.',
  body_md: '## Heading\n\nSome text.',
  image_url: BLOG_IMAGE,
  image_alt: 'A river at dawn',
  category: 'Planning',
  country: 'Norway',
  guide_id: null,
  status: 'draft',
  ...over,
})

async function rowBySlug(slug: string) {
  const { data, error } = await svc().from('blog_posts').select('*').eq('slug', slug).maybeSingle()
  if (error != null) throw new Error(error.message)
  return data
}

async function auditRows(recordId: string) {
  const { data } = await svc().from('audit_log').select('*').eq('record_id', recordId).eq('table_name', 'blog_posts').order('changed_at')
  return data ?? []
}

async function cleanup() {
  const { data } = await svc().from('blog_posts').select('id').like('slug', 'fa184-%')
  const ids = (data ?? []).map(r => r.id)
  if (ids.length > 0) {
    await svc().from('audit_log').delete().in('record_id', ids)
    await svc().from('blog_posts').delete().in('id', ids)
  }
}

beforeAll(cleanup)
afterAll(cleanup)
beforeEach(() => {
  h.as = 'admin'
  h.failAudit = false
  h.revalidateTag.mockClear()
  h.revalidatePath.mockClear()
})

// ─── Authorization (red proofs) ───────────────────────────────────────────────

describe('who may write', () => {
  it('RED: an angler is refused and the table does not change', async () => {
    h.as = 'angler'
    await expect(saveBlogPost(null, complete('fa184-angler'))).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await rowBySlug('fa184-angler')).toBeNull()
    expect(h.revalidateTag).not.toHaveBeenCalled()
  })

  it('RED: an angler cannot edit or publish an existing post either', async () => {
    const made = await saveBlogPost(null, complete('fa184-existing'))
    expect(made).toMatchObject({ success: true })
    const before = await rowBySlug('fa184-existing')

    h.as = 'angler'
    await expect(saveBlogPost(before!.id, complete('fa184-existing', { title: 'Hijacked', status: 'published' }))).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(setBlogPostStatus(before!.id, 'published')).rejects.toBeInstanceOf(UnauthorizedError)

    expect(await rowBySlug('fa184-existing')).toEqual(before)
    expect((await auditRows(before!.id)).length).toBe(1) // only the admin's create
  })

  it('RED: a visitor with no session is refused', async () => {
    h.as = 'anon'
    await expect(saveBlogPost(null, complete('fa184-anon'))).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await rowBySlug('fa184-anon')).toBeNull()
  })
})

// ─── Draft → published → unpublished ──────────────────────────────────────────

describe('the life of a post', () => {
  it('a draft is not public; publishing makes it public; unpublishing hides it again', async () => {
    const created = await saveBlogPost(null, complete('fa184-life'))
    expect(created).toMatchObject({ success: true, slug: 'fa184-life', status: 'draft' })
    expect(await getBlogPost('fa184-life')).toBeNull()
    expect((await getBlogPosts()).some(p => p.slug === 'fa184-life')).toBe(false)
    expect(h.revalidateTag).not.toHaveBeenCalled() // a draft touches nothing public

    const id = created.success ? created.id : ''
    const published = await setBlogPostStatus(id, 'published')
    expect(published).toMatchObject({ success: true, status: 'published' })
    expect((await getBlogPost('fa184-life'))?.title).toBe('FA-1.84 fa184-life')
    expect((await getBlogPosts()).some(p => p.slug === 'fa184-life')).toBe(true)
    expect(h.revalidateTag).toHaveBeenCalledWith('blog', {})
    expect(h.revalidatePath).toHaveBeenCalledWith('/blog')
    expect(h.revalidatePath).toHaveBeenCalledWith('/blog/fa184-life')
    expect(h.revalidatePath).toHaveBeenCalledWith('/sitemap.xml')

    const firstDate = (await rowBySlug('fa184-life'))!.published_at
    expect(firstDate).not.toBeNull()

    h.revalidateTag.mockClear()
    await setBlogPostStatus(id, 'draft')
    expect(await getBlogPost('fa184-life')).toBeNull()
    expect((await getBlogPosts()).some(p => p.slug === 'fa184-life')).toBe(false)
    expect(h.revalidateTag).toHaveBeenCalledWith('blog', {}) // an unpublish is refreshed too

    // The date survives an unpublish and is not restamped by the next publication.
    await setBlogPostStatus(id, 'published')
    expect((await rowBySlug('fa184-life'))!.published_at).toBe(firstDate)
  })

  it('editing a published post refreshes the public pages; editing a draft does not', async () => {
    const made = await saveBlogPost(null, complete('fa184-edit', { status: 'published' }))
    expect(made).toMatchObject({ success: true })
    const id = made.success ? made.id : ''
    h.revalidateTag.mockClear()

    const edited = await saveBlogPost(id, complete('fa184-edit', { status: 'published', title: 'New headline' }))
    expect(edited).toMatchObject({ success: true })
    expect((await getBlogPost('fa184-edit'))?.title).toBe('New headline')
    expect(h.revalidateTag).toHaveBeenCalledWith('blog', {})
  })
})

// ─── Slug immutability (E2) ───────────────────────────────────────────────────

describe('slug after the first publication', () => {
  it('RED: changing the slug of a published post is rejected and the row keeps its slug', async () => {
    const made = await saveBlogPost(null, complete('fa184-slug-pub', { status: 'published' }))
    const id = made.success ? made.id : ''
    h.revalidateTag.mockClear()

    const result = await saveBlogPost(id, complete('fa184-slug-changed', { status: 'published' }))
    expect(result).toMatchObject({ success: false })
    expect(result.success === false && result.error).toMatch(/slug.*cannot be changed/i)
    expect((await rowBySlug('fa184-slug-pub'))?.id).toBe(id)
    expect(await rowBySlug('fa184-slug-changed')).toBeNull()
    expect(h.revalidateTag).not.toHaveBeenCalled()
  })

  it('RED: unpublishing does not unlock the slug', async () => {
    const made = await saveBlogPost(null, complete('fa184-slug-unpub', { status: 'published' }))
    const id = made.success ? made.id : ''
    await setBlogPostStatus(id, 'draft')

    const result = await saveBlogPost(id, complete('fa184-slug-other', { status: 'draft' }))
    expect(result.success).toBe(false)
    expect((await rowBySlug('fa184-slug-unpub'))?.id).toBe(id)
    expect(await rowBySlug('fa184-slug-other')).toBeNull()
  })

  it('a never-published draft may change its slug', async () => {
    const made = await saveBlogPost(null, complete('fa184-slug-draft'))
    const id = made.success ? made.id : ''
    const result = await saveBlogPost(id, complete('fa184-slug-draft-2'))
    expect(result).toMatchObject({ success: true, slug: 'fa184-slug-draft-2' })
    expect(await rowBySlug('fa184-slug-draft')).toBeNull()
  })

  it('RED: a slug already used by another post is refused with a sentence, not a database error', async () => {
    await saveBlogPost(null, complete('fa184-dup'))
    const result = await saveBlogPost(null, complete('fa184-dup'))
    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/already uses this slug/)
    expect(result.success === false && result.error).not.toMatch(/violates|constraint|23505/i)
  })
})

// ─── SEO limits (E1) ──────────────────────────────────────────────────────────

describe('SEO title and description limits, enforced on the server', () => {
  it('RED: a 61-character SEO title and a 156-character description are refused — as drafts too', async () => {
    for (const [field, length, message] of [
      ['seo_title', 61, 'SEO title is too long — 60 characters at most'],
      ['description', 156, 'Meta description is too long — 155 characters at most'],
    ] as const) {
      const slug = `fa184-seo-${field.replace('_', '')}`
      // The server's own message — the action refused it before the database was asked.
      expect(await saveBlogPost(null, complete(slug, { [field]: 'x'.repeat(length) }))).toEqual({ success: false, error: message })
      expect(await rowBySlug(slug)).toBeNull()
    }
  })

  it('accepts exactly 60 and 155', async () => {
    const result = await saveBlogPost(null, complete('fa184-seo-edge', { seo_title: 'x'.repeat(60), description: 'y'.repeat(155) }))
    expect(result).toMatchObject({ success: true })
  })
})

// ─── Publishing an incomplete post (E4) ───────────────────────────────────────

describe('publishing without what a published post needs', () => {
  it('RED: without a hero image and alt text the message names both fields; nothing is written', async () => {
    const result = await saveBlogPost(null, complete('fa184-noimg', { status: 'published', image_url: null, image_alt: '' }))
    expect(result).toMatchObject({ success: false, missing: ['image_url', 'image_alt'] })
    expect(result.success === false && result.error).toBe('Hero image and Image alt text are required to publish.')
    expect(await rowBySlug('fa184-noimg')).toBeNull()
  })

  it('the same draft saves fine as a draft, and publishing it later names the gap', async () => {
    const made = await saveBlogPost(null, complete('fa184-gap', { image_url: null, image_alt: null, seo_title: null }))
    expect(made).toMatchObject({ success: true })
    const id = made.success ? made.id : ''

    const result = await setBlogPostStatus(id, 'published')
    expect(result).toMatchObject({ success: false, missing: ['seo_title', 'image_url', 'image_alt'] })
    expect((await rowBySlug('fa184-gap'))?.status).toBe('draft')
  })

  it('the database error for the same case is turned into a sentence by constraint name (fallback)', async () => {
    const { error } = await svc().from('blog_posts').insert({
      slug: 'fa184-raw', title: 'raw', status: 'published', published_at: new Date().toISOString(),
    })
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('blog_posts_published_complete')
    expect(blogConstraintMessage(error!.message)).toMatch(/published post needs/)
  })
})

// ─── Image address ────────────────────────────────────────────────────────────

describe('the hero image address', () => {
  it('accepts an upload in guide-photos/blog/ and a site path', async () => {
    expect(await saveBlogPost(null, complete('fa184-img-ok'))).toMatchObject({ success: true })
    expect(await saveBlogPost(null, complete('fa184-img-path', { image_url: '/fish_catalog/salmon.png' }))).toMatchObject({ success: true })
  })

  it('RED: another host, another folder and javascript: are refused', async () => {
    for (const [i, url] of [
      'https://evil.example/x.jpg',
      `${PROJECT_URL}/storage/v1/object/public/guide-photos/testimonials/x.jpg`,
      'javascript:alert(1)',
    ].entries()) {
      const result = await saveBlogPost(null, complete(`fa184-img-bad-${i}`, { image_url: url }))
      expect(result.success).toBe(false)
      expect(await rowBySlug(`fa184-img-bad-${i}`)).toBeNull()
    }
  })
})

// ─── audit_log (decision 1 → A) ───────────────────────────────────────────────

describe('audit_log', () => {
  it('writes one row per change, with the admin as actor and no article text', async () => {
    const body = '## Heading\n\n' + 'a long paragraph of text. '.repeat(50)
    const made = await saveBlogPost(null, complete('fa184-audit', { body_md: body }))
    const id = made.success ? made.id : ''
    await saveBlogPost(id, complete('fa184-audit', { body_md: body + ' More.', title: 'Retitled' }))
    await setBlogPostStatus(id, 'published')

    const rows = await auditRows(id)
    expect(rows.map(r => r.operation)).toEqual(['INSERT', 'UPDATE', 'UPDATE'])
    expect(rows.every(r => r.changed_by === ADMIN_ID && r.table_name === 'blog_posts')).toBe(true)

    // INSERT: no old data; the text is a length and a hash, never the text.
    expect(rows[0].old_data).toBeNull()
    expect(rows[0].new_data).toMatchObject({ slug: 'fa184-audit', status: 'draft', body_md: { length: body.length, sha256_12: expect.stringMatching(/^[0-9a-f]{12}$/) } })

    // UPDATE: only what changed.
    expect(rows[1].old_data).toMatchObject({ title: 'FA-1.84 fa184-audit', body_md: { length: body.length } })
    expect(rows[1].new_data).toMatchObject({ title: 'Retitled', body_md: { length: body.length + 6 } })
    expect(Object.keys(rows[1].new_data as object).sort()).toEqual(['body_md', 'title'])

    // Publish: status and the date, nothing else.
    expect(Object.keys(rows[2].new_data as object).sort()).toEqual(['published_at', 'status'])
    expect(rows[2].old_data).toMatchObject({ status: 'draft', published_at: null })

    expect(JSON.stringify(rows)).not.toContain('a long paragraph')
  })

  it('a failed audit insert does not fail or undo the save', async () => {
    h.failAudit = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await saveBlogPost(null, complete('fa184-auditfail'))
    errors.mockRestore()
    expect(result).toMatchObject({ success: true })
    expect(await rowBySlug('fa184-auditfail')).not.toBeNull()
  })

  it('a refused save writes no audit row', async () => {
    const before = (await svc().from('audit_log').select('*', { count: 'exact', head: true }).eq('table_name', 'blog_posts')).count
    await saveBlogPost(null, complete('fa184-noaudit', { seo_title: 'x'.repeat(61) }))
    const after = (await svc().from('audit_log').select('*', { count: 'exact', head: true }).eq('table_name', 'blog_posts')).count
    expect(after).toBe(before)
  })
})
