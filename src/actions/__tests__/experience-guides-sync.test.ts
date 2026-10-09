/**
 * FA-1.51 — the temporary triggers that keep the old columns and the new tables in step:
 *
 *   trg_sync_guide_id    experience_pages.guide_id  -> experience_guides (primary/active)
 *   trg_sync_primary     experience_guides          -> experience_pages.guide_id
 *   trg_sync_price_from  experience_pages.price_from -> price_from_cents
 *
 * Runs against the real local stack (env and safety fuse: src/tests/setup.ts). Every page,
 * guide and slug is created here under the fixed ids below and deleted in afterAll; the
 * seed's rows are never read or written. Each test arranges its own page, so a red run of
 * one test (trigger disabled) says nothing about the others.
 *
 * Arrangement does not depend on the triggers under test: pages are inserted with the
 * experience_guides rows spelled out (upsert), so the same arrangement is valid when a
 * trigger is DISABLE'd for the red proof.
 *
 * Mocked, because they only exist inside a Next request: next/cache and the session client
 * of @/lib/supabase/server (test (e) calls the old admin's createExperiencePage as admin).
 */

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({ sessionClient: null as unknown }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))

vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createClient: vi.fn(async () => h.sessionClient),
    createServiceClient: vi.fn(() =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    ),
  }
})

import { createExperiencePage, saveExperienceV2Guides } from '@/actions/experience-pages'
import type { GuideRowInput } from '@/lib/experiences/v2-editor'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const G1 = '51a00000-0000-4000-8000-000000000001'
const G2 = '51a00000-0000-4000-8000-000000000002'
const G3 = '51a00000-0000-4000-8000-000000000003'

const PAGE = {
  update:    '51b00000-0000-4000-8000-000000000001',
  promote:   '51b00000-0000-4000-8000-000000000002',
  clear:     '51b00000-0000-4000-8000-000000000003',
  insertNew: '51b00000-0000-4000-8000-000000000004',
  insert:    '51b00000-0000-4000-8000-000000000005',
  v2swap:    '51b00000-0000-4000-8000-000000000006',
  del:       '51b00000-0000-4000-8000-000000000007',
  price:     '51b00000-0000-4000-8000-000000000008',
  price2:    '51b00000-0000-4000-8000-000000000009',
  cents:     '51b00000-0000-4000-8000-00000000000a',
  loop:      '51b00000-0000-4000-8000-00000000000b',
  cascade:   '51b00000-0000-4000-8000-00000000000c',
} as const

const CREATED_SLUG = 'fa151-test-created-by-old-admin'
const slugOf = (key: keyof typeof PAGE) => `fa151-test-${key}`

type Db = SupabaseClient<Database>

function db(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function signedInAdmin(): Promise<Db> {
  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { error } = await client.auth.signInWithPassword({ email: 'admin@seed.test', password: 'seed-admin-password-2026' })
  if (error != null) throw new Error(`sign-in as admin@seed.test failed: ${error.message}`)
  return client
}

async function cleanup() {
  const svc = db()
  // Pages first: experience_guides -> guides is ON DELETE RESTRICT; the links cascade from the page.
  await svc.from('experience_pages').delete().in('id', Object.values(PAGE))
  await svc.from('experience_pages').delete().eq('slug', CREATED_SLUG)
  await svc.from('guides').delete().in('id', [G1, G2, G3])
}

/**
 * A page plus its experience_guides rows spelled out. The upsert makes this valid whether or
 * not trg_sync_guide_id already created the primary row when the page was inserted.
 */
async function arrangePage(
  key: keyof typeof PAGE,
  opts: { guideId?: string | null; links?: Array<{ guideId: string; role: 'primary' | 'backup'; status?: 'active' | 'paused' }>; extra?: Partial<Database['public']['Tables']['experience_pages']['Insert']> } = {},
) {
  const svc = db()
  const { error } = await svc.from('experience_pages').insert({
    id: PAGE[key], experience_name: `FA-1.51 ${key}`, slug: slugOf(key),
    country: 'New Zealand', region: 'Test', currency: 'NZD', status: 'draft',
    guide_id: opts.guideId ?? null, price_from: 100,
    ...opts.extra,
  })
  expect(error).toBeNull()

  if (opts.links != null && opts.links.length > 0) {
    const links = await svc.from('experience_guides').upsert(
      opts.links.map(l => ({ experience_id: PAGE[key], guide_id: l.guideId, role: l.role, status: l.status ?? 'active' })),
      { onConflict: 'experience_id,guide_id' },
    )
    expect(links.error).toBeNull()
  }
}

async function readLinks(key: keyof typeof PAGE) {
  const { data, error } = await db()
    .from('experience_guides')
    .select('guide_id, role, status')
    .eq('experience_id', PAGE[key])
    .order('guide_id', { ascending: true })
  expect(error).toBeNull()
  return (data ?? []).map(r => `${r.guide_id.slice(-1)}:${r.role}:${r.status}`)
}

async function readPage(id: string) {
  const { data, error } = await db()
    .from('experience_pages')
    .select('guide_id, price_from, price_from_cents')
    .eq('id', id)
    .single()
  if (error != null || data == null) throw new Error(`page ${id} not readable: ${error?.message}`)
  return data
}

const activePrimaries = async (id: string) => {
  const { count, error } = await db()
    .from('experience_guides')
    .select('guide_id', { count: 'exact', head: true })
    .eq('experience_id', id).eq('role', 'primary').eq('status', 'active')
  expect(error).toBeNull()
  return count
}

/** The "pasted read" of the acceptance criteria: what the database holds after the action. */
function show(label: string, rows: unknown) {
  console.log(`[read] ${label}\n${JSON.stringify(rows, null, 1)}`)
}

const guideRow = (guideId: string, over: Partial<GuideRowInput> = {}): GuideRowInput => ({
  guideId, role: 'backup', status: 'active', showOnPage: true, sortOrder: 0, overrideCents: null, ...over,
})

beforeAll(async () => {
  await cleanup()
  const guides = await db().from('guides').insert([
    { id: G1, full_name: 'FA-1.51 guide one',   country: 'New Zealand' },
    { id: G2, full_name: 'FA-1.51 guide two',   country: 'New Zealand' },
    { id: G3, full_name: 'FA-1.51 guide three', country: 'New Zealand' },
  ])
  expect(guides.error).toBeNull()
  h.sessionClient = await signedInAdmin()
})

afterAll(cleanup)

// ─── (a)–(d): one test per trigger direction ──────────────────────────────────

describe('trg_sync_guide_id — experience_pages.guide_id -> experience_guides', () => {
  it('(a) UPDATE guide_id: the new guide is primary/active, the old primary is paused', async () => {
    await arrangePage('update', { guideId: G1, links: [{ guideId: G1, role: 'primary' }] })
    expect(await readLinks('update')).toEqual(['1:primary:active'])

    const { error } = await db().from('experience_pages').update({ guide_id: G2 }).eq('id', PAGE.update)
    expect(error).toBeNull()

    const links = await readLinks('update')
    show('(a) experience_guides after UPDATE guide_id G1 -> G2', links)
    expect(links).toEqual(['1:primary:paused', '2:primary:active'])
    expect((await readPage(PAGE.update)).guide_id).toBe(G2)
  })

  it('(a2) UPDATE guide_id to a guide already on the page as backup promotes that row', async () => {
    await arrangePage('promote', { guideId: G1, links: [{ guideId: G1, role: 'primary' }, { guideId: G2, role: 'backup' }] })

    const { error } = await db().from('experience_pages').update({ guide_id: G2 }).eq('id', PAGE.promote)
    expect(error).toBeNull()

    const links = await readLinks('promote')
    show('(a2) experience_guides after promoting the backup G2 via guide_id', links)
    expect(links).toEqual(['1:primary:paused', '2:primary:active'])
  })

  it('(a3) UPDATE guide_id to NULL pauses the primary and keeps the row', async () => {
    await arrangePage('clear', { guideId: G1, links: [{ guideId: G1, role: 'primary' }] })

    const { error } = await db().from('experience_pages').update({ guide_id: null }).eq('id', PAGE.clear)
    expect(error).toBeNull()

    expect(await readLinks('clear')).toEqual(['1:primary:paused'])
    expect((await readPage(PAGE.clear)).guide_id).toBeNull()
  })

  it('(a4) INSERT of a page with guide_id creates the primary/active row (decision D1)', async () => {
    // No explicit links: the row must come from the trigger alone.
    await arrangePage('insertNew', { guideId: G3 })

    const links = await readLinks('insertNew')
    show('(a4) experience_guides after INSERT of a page with guide_id', links)
    expect(links).toEqual(['3:primary:active'])
  })
})

describe('trg_sync_primary — experience_guides -> experience_pages.guide_id', () => {
  it('(b) INSERT of a primary/active row sets guide_id', async () => {
    await arrangePage('insert', { guideId: null })
    expect((await readPage(PAGE.insert)).guide_id).toBeNull()

    const { error } = await db().from('experience_guides')
      .insert({ experience_id: PAGE.insert, guide_id: G1, role: 'primary', status: 'active' })
    expect(error).toBeNull()

    const page = await readPage(PAGE.insert)
    show('(b) experience_pages.guide_id after INSERT of a primary/active row', page.guide_id)
    expect(page.guide_id).toBe(G1)
  })

  it('(b2) the v2 admin swap — demote the old primary, promote another — ends with guide_id on the new one', async () => {
    await arrangePage('v2swap', { guideId: G1, links: [{ guideId: G1, role: 'primary' }] })

    const result = await saveExperienceV2Guides(PAGE.v2swap, [
      guideRow(G1, { role: 'backup' }),
      guideRow(G2, { role: 'primary', sortOrder: 1 }),
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const links = await readLinks('v2swap')
    show('(b2) experience_guides after saveExperienceV2Guides swap G1 -> G2', links)
    expect(links).toEqual(['1:backup:active', '2:primary:active'])
    expect((await readPage(PAGE.v2swap)).guide_id).toBe(G2)
  })

  it('(c) DELETE of the primary row sets guide_id to NULL', async () => {
    await arrangePage('del', { guideId: G1, links: [{ guideId: G1, role: 'primary' }, { guideId: G2, role: 'backup' }] })
    expect((await readPage(PAGE.del)).guide_id).toBe(G1)

    const { error } = await db().from('experience_guides').delete().eq('experience_id', PAGE.del).eq('guide_id', G1)
    expect(error).toBeNull()

    const page = await readPage(PAGE.del)
    show('(c) experience_pages.guide_id after DELETE of the primary row', page.guide_id)
    expect(page.guide_id).toBeNull()
  })
})

describe('trg_sync_price_from — price_from -> price_from_cents', () => {
  it('(d) UPDATE price_from: price_from_cents = price_from x 100, exact', async () => {
    await arrangePage('price', { extra: { price_from: 100 } })

    // 19.99 * 100 in floating point is 1998.9999999999998 — the column is numeric, so it must be 1999.
    const { error } = await db().from('experience_pages').update({ price_from: 19.99 }).eq('id', PAGE.price)
    expect(error).toBeNull()

    const page = await readPage(PAGE.price)
    show('(d) price_from / price_from_cents after UPDATE price_from = 19.99', page)
    expect(page.price_from_cents).toBe(1999)
  })

  it('(d2) INSERT without price_from_cents derives it; a writer that sets cents itself wins', async () => {
    await arrangePage('price2', { extra: { price_from: 250 } })
    expect((await readPage(PAGE.price2)).price_from_cents).toBe(25000)

    // The v2 admin writes cents only and leaves price_from alone: nothing may overwrite them.
    await db().from('experience_pages').update({ price_from_cents: 31250 }).eq('id', PAGE.price2)
    await db().from('experience_pages').update({ region: 'Elsewhere' }).eq('id', PAGE.price2)
    expect((await readPage(PAGE.price2)).price_from_cents).toBe(31250)

    // Both in one statement: the explicit cents are kept.
    await db().from('experience_pages').update({ price_from: 400, price_from_cents: 12345 }).eq('id', PAGE.price2)
    expect((await readPage(PAGE.price2)).price_from_cents).toBe(12345)

    // Cents supplied on INSERT are not replaced by round(price_from * 100).
    await arrangePage('cents', { extra: { price_from: 0, price_from_cents: 99900 } })
    expect((await readPage(PAGE.cents)).price_from_cents).toBe(99900)
  })
})

// ─── (e): the old admin, unchanged ────────────────────────────────────────────

describe('createExperiencePage — the old admin, no code change', () => {
  it('(e) a new page with a guide and a price ends with one primary/active row and price_from_cents', async () => {
    const result = await createExperiencePage({
      experience_name: 'FA-1.51 created by the old admin',
      slug:            CREATED_SLUG,
      country:         'New Zealand',
      region:          'Test',
      price_from:      250.5,
      currency:        'NZD',
      guide_id:        G1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return

    const { data: links } = await db().from('experience_guides')
      .select('guide_id, role, status').eq('experience_id', result.id)
    const page = await readPage(result.id)
    show('(e) experience_guides after createExperiencePage', links)
    show('(e) experience_pages row after createExperiencePage', page)

    expect(links).toEqual([{ guide_id: G1, role: 'primary', status: 'active' }])
    expect(page).toMatchObject({ guide_id: G1, price_from_cents: 25050 })
  })
})

// ─── Loop guard ───────────────────────────────────────────────────────────────

describe('loop guard', () => {
  it('UPDATE guide_id on a page with two guides ends with exactly one primary/active row and no error', async () => {
    await arrangePage('loop', { guideId: G1, links: [{ guideId: G1, role: 'primary' }, { guideId: G2, role: 'backup' }] })

    const { error } = await db().from('experience_pages').update({ guide_id: G2 }).eq('id', PAGE.loop)
    expect(error).toBeNull() // a missing guard raises "tuple to be updated was already modified ..."

    show('loop: experience_guides', await readLinks('loop'))
    expect(await activePrimaries(PAGE.loop)).toBe(1)
    expect(await readLinks('loop')).toEqual(['1:primary:paused', '2:primary:active'])
    expect((await readPage(PAGE.loop)).guide_id).toBe(G2)
  })

  it('deleting a page that has guides does not trip the sync on the vanishing row', async () => {
    await arrangePage('cascade', { guideId: G1, links: [{ guideId: G1, role: 'primary' }, { guideId: G2, role: 'backup' }] })
    const { error } = await db().from('experience_pages').delete().eq('id', PAGE.cascade)
    expect(error).toBeNull()

    const { count } = await db().from('experience_guides')
      .select('guide_id', { count: 'exact', head: true }).eq('experience_id', PAGE.cascade)
    expect(count).toBe(0)
  })
})
