/**
 * FA-1.56 — the "Offer v2" editor actions, against the real local stack.
 *
 * Env comes from .env.test through src/tests/setup.ts (safety fuse included). Nothing here
 * is mocked except the two things that only exist inside a Next request:
 *
 *   next/cache            — revalidatePath/revalidateTag need a request store;
 *                           unstable_cache is passed through so reads are never stale
 *   @/lib/supabase/server — createClient() reads cookies; here it returns a real
 *                           supabase-js client holding a real session (admin@seed.test,
 *                           angler@seed.test, or none), so requireAdmin() runs unchanged
 *                           against local Auth and the profiles table
 *
 * Self-contained: every page, guide, price and alias is created here under the fixed ids
 * below and deleted in afterAll. The seed's pages are never read or written.
 */

import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
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

import { createServiceClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/guards'
import { getExperienceRouting } from '@/lib/supabase/queries'
import {
  addExperienceSlugAlias,
  getExperienceGuideCounts,
  getExperienceV2Editor,
  removeExperienceSlugAlias,
  saveExperienceV2Content,
  saveExperienceV2Guides,
  saveExperienceV2Offer,
  saveExperienceV2Prices,
  setExperiencePageVersion,
  updateExperienceOptionV2,
} from '@/actions/experience-pages'
import type { ContentInput, GuideRowInput, OfferInput } from '@/lib/experiences/v2-editor'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const G1 = '56a00000-0000-4000-8000-000000000001'
const G2 = '56a00000-0000-4000-8000-000000000002'
const G3 = '56a00000-0000-4000-8000-000000000003'

const PAGE = {
  guides:   '56b00000-0000-4000-8000-000000000001',
  override: '56b00000-0000-4000-8000-000000000002',
  version:  '56b00000-0000-4000-8000-000000000003',
  target:   '56b00000-0000-4000-8000-000000000004',
  live:     '56b00000-0000-4000-8000-000000000005',
  archived: '56b00000-0000-4000-8000-000000000006',
  prices:   '56b00000-0000-4000-8000-000000000007',
  content:  '56b00000-0000-4000-8000-000000000008',
  auth:     '56b00000-0000-4000-8000-000000000009',
} as const

const OPTION = '56c00000-0000-4000-8000-000000000001'

const slugOf = (key: keyof typeof PAGE) => `fa156-test-${key}`

type Db = SupabaseClient<Database>

/** Service-role client for arranging and reading — not the mocked factory, so its call count stays the actions'. */
function db(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function anonClient(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function signedIn(email: string, password: string): Promise<Db> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error != null) throw new Error(`sign-in as ${email} failed: ${error.message}`)
  return client
}

let admin:  Db
let angler: Db

const actAs = (client: Db) => { h.sessionClient = client }

async function cleanup() {
  const svc = db()
  // Pages first: experience_guides → guides is ON DELETE RESTRICT, the rest cascades from the page.
  await svc.from('experience_pages').delete().in('id', Object.values(PAGE))
  await svc.from('guides').delete().in('id', [G1, G2, G3])
}

const guide = (guideId: string, over: Partial<GuideRowInput> = {}): GuideRowInput => ({
  guideId, role: 'backup', status: 'active', showOnPage: true, sortOrder: 0, overrideCents: null, ...over,
})

async function readGuides(experienceId: string) {
  const { data, error } = await db()
    .from('experience_guides')
    .select('guide_id, role, status, show_on_page, sort_order, guide_price_override_cents')
    .eq('experience_id', experienceId)
    .order('guide_id', { ascending: true })
  expect(error).toBeNull()
  return data ?? []
}

async function readPage(experienceId: string) {
  const { data, error } = await db().from('experience_pages').select('*').eq('id', experienceId).single()
  if (error != null || data == null) throw new Error(`page ${experienceId} not readable: ${error?.message}`)
  return data
}

/** The "pasted read" of the acceptance criteria: what the database holds after the action. */
function show(label: string, rows: unknown) {
  console.log(`[read] ${label}\n${JSON.stringify(rows, null, 1)}`)
}

beforeAll(async () => {
  await cleanup()
  const svc = db()

  const guides = await svc.from('guides').insert([
    { id: G1, full_name: 'FA-1.56 guide one',   country: 'New Zealand' },
    { id: G2, full_name: 'FA-1.56 guide two',   country: 'New Zealand' },
    { id: G3, full_name: 'FA-1.56 guide three', country: 'New Zealand' },
  ])
  expect(guides.error).toBeNull()

  const page = (key: keyof typeof PAGE, over: Partial<Database['public']['Tables']['experience_pages']['Insert']> = {}) => ({
    id: PAGE[key], experience_name: `FA-1.56 ${key}`, slug: slugOf(key),
    country: 'New Zealand', region: 'Test', currency: 'NZD', status: 'draft', ...over,
  })

  const pages = await svc.from('experience_pages').insert([
    page('guides',   { guide_id: G1 }),
    page('override', { guide_id: G1 }),
    page('version',  { price_from_cents: 120000, suited_for: ['you cast 12 m in wind'] }),
    page('target',   { status: 'active' }),
    page('live',     { status: 'active' }),
    page('archived', { status: 'archived' }),
    page('prices'),
    page('content'),
    page('auth',     { guide_id: G1 }),
    // Rows differ in which columns they set; without this a missing key is sent as NULL.
  ], { defaultToNull: false })
  expect(pages.error).toBeNull()

  // Upsert: inserting the pages above with guide_id already created these rows (trg_sync_guide_id, FA-1.51).
  const links = await svc.from('experience_guides').upsert([
    { experience_id: PAGE.guides,   guide_id: G1, role: 'primary' },
    { experience_id: PAGE.override, guide_id: G1, role: 'primary' },
    { experience_id: PAGE.auth,     guide_id: G1, role: 'primary' },
  ], { onConflict: 'experience_id,guide_id' })
  expect(links.error).toBeNull()

  const option = await svc.from('experience_page_options').insert({
    id: OPTION, experience_page_id: PAGE.content, label: 'FA-1.56 option', price_from: 0,
  })
  expect(option.error).toBeNull()

  admin  = await signedIn('admin@seed.test', 'seed-admin-password-2026')
  angler = await signedIn('angler@seed.test', 'seed-angler-password-2026')
})

afterAll(cleanup)

beforeEach(() => actAs(admin))

// ─── Guides ───────────────────────────────────────────────────────────────────

describe('saveExperienceV2Guides', () => {
  it('adds a second guide as backup: two rows, experience_pages.guide_id untouched', async () => {
    const result = await saveExperienceV2Guides(PAGE.guides, [
      guide(G1, { role: 'primary' }),
      guide(G2, { role: 'backup', sortOrder: 1 }),
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const rows = await readGuides(PAGE.guides)
    const page = await readPage(PAGE.guides)
    show('after adding G2 as backup — experience_guides', rows)
    show('after adding G2 as backup — experience_pages.guide_id', page.guide_id)

    expect(rows).toHaveLength(2)
    expect(rows.map(r => [r.guide_id, r.role, r.status])).toEqual([
      [G1, 'primary', 'active'],
      [G2, 'backup',  'active'],
    ])
    expect(page.guide_id).toBe(G1)
  })

  it('switches the primary: exactly one active primary, the previous one demoted', async () => {
    const result = await saveExperienceV2Guides(PAGE.guides, [
      guide(G1, { role: 'backup' }),
      guide(G2, { role: 'primary', sortOrder: 1 }),
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const rows = await readGuides(PAGE.guides)
    const page = await readPage(PAGE.guides)
    show('after switching primary to G2 — experience_guides', rows)
    show('after switching primary to G2 — experience_pages.guide_id (synced by trg_sync_primary)', page.guide_id)

    const activePrimaries = rows.filter(r => r.role === 'primary' && r.status === 'active')
    expect(activePrimaries.map(r => r.guide_id)).toEqual([G2])
    expect(rows.find(r => r.guide_id === G1)).toMatchObject({ role: 'backup', status: 'active' })
    // The sync to guide_id is trg_sync_primary (FA-1.51); this action must not do it by hand.
    expect(page.guide_id).toBe(G2)
  })

  it('removes the primary and names a new one in the same save', async () => {
    const result = await saveExperienceV2Guides(PAGE.guides, [
      guide(G1, { role: 'primary' }),
      guide(G3, { role: 'backup', showOnPage: false, sortOrder: 2 }),
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const rows = await readGuides(PAGE.guides)
    expect(rows.map(r => [r.guide_id, r.role, r.status, r.show_on_page, r.sort_order])).toEqual([
      [G1, 'primary', 'active', true,  0],
      [G3, 'backup',  'active', false, 2],
    ])
  })

  it('refuses two active primaries and writes nothing', async () => {
    const before = await readGuides(PAGE.guides)
    const result = await saveExperienceV2Guides(PAGE.guides, [
      guide(G1, { role: 'primary' }),
      guide(G3, { role: 'primary' }),
    ])
    expect(result).toEqual({ success: false, error: 'Only one guide can be the active primary' })
    expect(await readGuides(PAGE.guides)).toEqual(before)
  })

  it('refuses a guide id that is not a uuid, a duplicate guide and an unknown guide', async () => {
    const before = await readGuides(PAGE.guides)

    const notUuid = await saveExperienceV2Guides(PAGE.guides, [guide('1; drop table guides')])
    expect(notUuid).toMatchObject({ success: false, error: 'Not a valid id' })

    const twice = await saveExperienceV2Guides(PAGE.guides, [guide(G1, { role: 'primary' }), guide(G1)])
    expect(twice).toMatchObject({ success: false, error: 'The same guide is listed twice' })

    const unknown = await saveExperienceV2Guides(PAGE.guides, [
      guide(G1, { role: 'primary' }),
      guide('56a00000-0000-4000-8000-0000000000ff'),
    ])
    expect(unknown).toMatchObject({ success: false, error: expect.stringContaining('no longer exists') })

    expect(await readGuides(PAGE.guides)).toEqual(before)
  })

  it('the role statement is all-or-nothing: a failing promotion does not keep the demotion', async () => {
    // The same single upsert the action sends, with a second row the database must reject.
    const before = await readGuides(PAGE.guides)
    const { error } = await db().from('experience_guides').upsert([
      { experience_id: PAGE.guides, guide_id: G1, role: 'backup', status: 'active' },
      { experience_id: PAGE.guides, guide_id: G3, role: 'not-a-role', status: 'active' },
    ], { onConflict: 'experience_id,guide_id' })

    expect(error?.message).toContain('experience_guides_role_check')
    expect(await readGuides(PAGE.guides)).toEqual(before)
  })
})

// ─── Price override — red proof 2 ─────────────────────────────────────────────

describe('price override (≤ 115% of the base row)', () => {
  it('without a base row: refused by the action and by the trigger', async () => {
    const viaAction = await saveExperienceV2Guides(PAGE.override, [guide(G1, { role: 'primary', overrideCents: 100000 })])
    expect(viaAction).toMatchObject({ success: false, error: expect.stringContaining('no current base row') })

    const direct = await db()
      .from('experience_guides')
      .update({ guide_price_override_cents: 100000 })
      .eq('experience_id', PAGE.override).eq('guide_id', G1)
    console.log(`[red] no base row — action: ${JSON.stringify(viaAction)}\n[red] no base row — database: ${direct.error?.message}`)
    expect(direct.error?.message).toContain('has no valid base price row')

    expect((await readGuides(PAGE.override))[0].guide_price_override_cents).toBeNull()
  })

  it('+30% of the base row: zod error in the action AND the trigger exception on a direct write', async () => {
    // Base row: 1 day × 2 anglers (max_anglers_per_guide defaults to 2) = 1000.00 NZD.
    const grid = await saveExperienceV2Prices(PAGE.override, [
      { days: 1, anglers: 2, guidePriceCents: 100000, validFrom: null, validTo: null },
      { days: 2, anglers: 2, guidePriceCents: 190000, validFrom: null, validTo: null },
    ])
    expect(grid).toEqual({ success: true, warnings: [] })

    const viaAction = await saveExperienceV2Guides(PAGE.override, [guide(G1, { role: 'primary', overrideCents: 130000 })])
    expect(viaAction).toEqual({
      success: false,
      error: 'Price override 130000 exceeds 115% of the base price 100000 (limit 115000)',
    })

    const direct = await db()
      .from('experience_guides')
      .update({ guide_price_override_cents: 130000 })
      .eq('experience_id', PAGE.override).eq('guide_id', G1)
    console.log(`[red] +30% — action: ${JSON.stringify(viaAction)}\n[red] +30% — database: ${direct.error?.message} (code ${direct.error?.code})`)
    expect(direct.error?.message).toBe('guide_price_override_cents 130000 exceeds 115% of the base price 100000 (limit 115000)')

    expect((await readGuides(PAGE.override))[0].guide_price_override_cents).toBeNull()
  })

  it('exactly 115% is accepted and stored; one cent more is not', async () => {
    const atLimit = await saveExperienceV2Guides(PAGE.override, [guide(G1, { role: 'primary', overrideCents: 115000 })])
    expect(atLimit).toEqual({ success: true, warnings: [] })
    expect((await readGuides(PAGE.override))[0].guide_price_override_cents).toBe(115000)

    const overLimit = await saveExperienceV2Guides(PAGE.override, [guide(G1, { role: 'primary', overrideCents: 115001 })])
    expect(overLimit).toMatchObject({ success: false })
    expect((await readGuides(PAGE.override))[0].guide_price_override_cents).toBe(115000)
  })

  it('prices moving under a stored override warn, and do not block an unrelated guide edit', async () => {
    const cheaper = await saveExperienceV2Prices(PAGE.override, [
      { days: 1, anglers: 2, guidePriceCents: 50000, validFrom: null, validTo: null },
    ])
    expect(cheaper).toEqual({
      success: true,
      warnings: ['1 guide price override(s) are now above 115% of the base price — see Guides'],
    })

    // Same override, different order: the trigger does not re-check it, and neither does the action.
    const reorder = await saveExperienceV2Guides(PAGE.override, [
      guide(G1, { role: 'primary', overrideCents: 115000, sortOrder: 5 }),
      guide(G2, { sortOrder: 6 }),
    ])
    expect(reorder).toEqual({ success: true, warnings: [] })
    expect((await readGuides(PAGE.override)).map(r => [r.guide_id, r.sort_order, r.guide_price_override_cents])).toEqual([
      [G1, 5, 115000],
      [G2, 6, null],
    ])

    const noBase = await saveExperienceV2Prices(PAGE.override, [])
    expect(noBase).toEqual({
      success: true,
      warnings: ['1 guide price override(s) now have no base row to apply to (1 day × max anglers per guide) — see Guides'],
    })
  })
})

// ─── page_version — red proof 1 ───────────────────────────────────────────────

describe('setExperiencePageVersion', () => {
  it('refuses v2 without an active primary guide and leaves page_version at 1', async () => {
    const result = await setExperiencePageVersion(PAGE.version, 2)
    console.log(`[red] page_version=2 without a primary — ${JSON.stringify(result)}`)
    expect(result).toEqual({ success: false, error: 'Cannot switch to v2 — missing: an active primary guide (Guides)' })
    expect((await readPage(PAGE.version)).page_version).toBe(1)
  })

  it('a paused primary does not count', async () => {
    expect(await saveExperienceV2Guides(PAGE.version, [guide(G1, { role: 'primary', status: 'paused' })]))
      .toEqual({ success: true, warnings: [] })
    expect(await setExperiencePageVersion(PAGE.version, 2)).toMatchObject({ success: false })
    expect((await readPage(PAGE.version)).page_version).toBe(1)
  })

  it('lists everything that is missing at once', async () => {
    const result = await setExperiencePageVersion(PAGE.prices, 2)
    expect(result).toEqual({
      success: false,
      error: 'Cannot switch to v2 — missing: a "from" price greater than 0 (Mode and price); '
        + 'an active primary guide (Guides); at least one "Suited for" line (Content)',
    })
    expect((await readPage(PAGE.prices)).page_version).toBe(1)
  })

  it('accepts v2 once the page has a price, an active primary and a "suited for" line', async () => {
    expect(await saveExperienceV2Guides(PAGE.version, [guide(G1, { role: 'primary' })])).toMatchObject({ success: true })
    expect(await setExperiencePageVersion(PAGE.version, 2)).toEqual({ success: true, warnings: [] })
    expect((await readPage(PAGE.version)).page_version).toBe(2)
  })

  it('a v2 page cannot lose what v2 needs through the other sections', async () => {
    const noPrimary = await saveExperienceV2Guides(PAGE.version, [guide(G1, { role: 'backup' })])
    expect(noPrimary).toMatchObject({ success: false, error: expect.stringContaining('needs an active primary guide') })

    const noPrice = await saveExperienceV2Offer(PAGE.version, offer({ priceFromCents: null }))
    expect(noPrice).toMatchObject({ success: false, error: expect.stringContaining('"from" price greater than 0') })

    const noSuitedFor = await saveExperienceV2Content(PAGE.version, content({ suitedFor: [] }))
    expect(noSuitedFor).toMatchObject({ success: false, error: expect.stringContaining('"Suited for"') })

    const page = await readPage(PAGE.version)
    expect(page.page_version).toBe(2)
    expect(page.price_from_cents).toBe(120000)
    expect(page.suited_for).toEqual(['you cast 12 m in wind'])
    expect((await readGuides(PAGE.version))[0]).toMatchObject({ role: 'primary', status: 'active' })
  })

  it('switches back to v1 without conditions, and refuses a version that is not 1 or 2', async () => {
    expect(await setExperiencePageVersion(PAGE.version, 3)).toEqual({ success: false, error: 'Page version must be 1 or 2' })
    expect((await readPage(PAGE.version)).page_version).toBe(2)

    expect(await setExperiencePageVersion(PAGE.version, 1)).toEqual({ success: true, warnings: [] })
    expect((await readPage(PAGE.version)).page_version).toBe(1)
  })
})

// ─── Slug aliases ─────────────────────────────────────────────────────────────

describe('slug aliases', () => {
  const readAliases = async (experienceId: string) =>
    ((await db().from('experience_slug_aliases').select('slug').eq('experience_id', experienceId).order('slug')).data ?? []).map(r => r.slug)

  it('a saved alias resolves to the page it was added to — the router redirects on exactly this', async () => {
    expect(await getExperienceRouting('fa156-old-twin')).toBeNull()

    expect(await addExperienceSlugAlias(PAGE.target, 'fa156-old-twin')).toEqual({ success: true, warnings: [] })

    expect(await readAliases(PAGE.target)).toEqual(['fa156-old-twin'])
    // Read with the publishable key, as the public page does.
    expect(await getExperienceRouting('fa156-old-twin')).toEqual({ pageVersion: 1, canonicalSlug: slugOf('target') })
  })

  it('accepts the slug of an archived page — that is the merge case', async () => {
    expect(await addExperienceSlugAlias(PAGE.target, slugOf('archived'))).toEqual({ success: true, warnings: [] })
    expect(await getExperienceRouting(slugOf('archived'))).toEqual({ pageVersion: 1, canonicalSlug: slugOf('target') })
  })

  it('refuses the slug of a live page', async () => {
    const result = await addExperienceSlugAlias(PAGE.target, slugOf('live'))
    console.log(`[red] alias = live slug — ${JSON.stringify(result)}`)
    expect(result).toEqual({
      success: false,
      error: `"${slugOf('live')}" is the slug of the live page "FA-1.56 live" — archive that page first, then add the alias`,
    })
    expect(await readAliases(PAGE.target)).not.toContain(slugOf('live'))
  })

  it("refuses another page's alias, this page's alias twice, and its own slug", async () => {
    const elsewhere = await addExperienceSlugAlias(PAGE.live, 'fa156-old-twin')
    console.log(`[red] alias of another page — ${JSON.stringify(elsewhere)}`)
    expect(elsewhere).toEqual({ success: false, error: '"fa156-old-twin" is already an alias of another page' })
    expect(await readAliases(PAGE.live)).toEqual([])

    expect(await addExperienceSlugAlias(PAGE.target, 'fa156-old-twin'))
      .toEqual({ success: false, error: '"fa156-old-twin" is already an alias of this page' })
    expect(await addExperienceSlugAlias(PAGE.target, slugOf('target')))
      .toEqual({ success: false, error: `"${slugOf('target')}" is this page's own slug` })
  })

  it('the primary key refuses a second page for the same alias even past the action', async () => {
    const direct = await db().from('experience_slug_aliases').insert({ slug: 'fa156-old-twin', experience_id: PAGE.live })
    expect(direct.error?.code).toBe('23505')
  })

  it('refuses anything that is not a slug', async () => {
    for (const bad of ['Old Slug', 'old_slug', '../admin', 'https://evil.example/x', '']) {
      const result = await addExperienceSlugAlias(PAGE.target, bad)
      expect(result.success, bad).toBe(false)
    }
    expect(await readAliases(PAGE.target)).toEqual([slugOf('archived'), 'fa156-old-twin'].sort())
  })

  it('removes an alias only through the page that owns it', async () => {
    expect(await removeExperienceSlugAlias(PAGE.live, 'fa156-old-twin')).toEqual({ success: true, warnings: [] })
    expect(await readAliases(PAGE.target)).toContain('fa156-old-twin')

    expect(await removeExperienceSlugAlias(PAGE.target, 'fa156-old-twin')).toEqual({ success: true, warnings: [] })
    expect(await readAliases(PAGE.target)).toEqual([slugOf('archived')])
    expect(await getExperienceRouting('fa156-old-twin')).toBeNull()
  })
})

// ─── Price grid ───────────────────────────────────────────────────────────────

describe('saveExperienceV2Prices', () => {
  const readPrices = async () =>
    (await db()
      .from('experience_prices')
      .select('id, days, anglers, guide_price_cents, currency, valid_from, valid_to')
      .eq('experience_id', PAGE.prices)
      .order('valid_from', { ascending: true, nullsFirst: true })
      .order('days').order('anglers')).data ?? []

  it('stores the grid in the page currency, one row per days × anglers × season', async () => {
    const result = await saveExperienceV2Prices(PAGE.prices, [
      { days: 1, anglers: 1, guidePriceCents: 90000,  validFrom: null, validTo: null },
      { days: 1, anglers: 2, guidePriceCents: 110000, validFrom: null, validTo: null },
      { days: 2, anglers: 2, guidePriceCents: 210000, validFrom: null, validTo: null },
      { days: 1, anglers: 2, guidePriceCents: 125000, validFrom: '2027-10-01', validTo: '2028-04-30' },
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const rows = await readPrices()
    show('experience_prices after the first save', rows.map(r => `${r.days}d × ${r.anglers}a = ${r.guide_price_cents} ${r.currency} [${r.valid_from ?? '—'} → ${r.valid_to ?? '—'}]`))
    expect(rows.map(r => [r.days, r.anglers, r.guide_price_cents, r.currency, r.valid_from, r.valid_to])).toEqual([
      [1, 1, 90000,  'NZD', null, null],
      [1, 2, 110000, 'NZD', null, null],
      [2, 2, 210000, 'NZD', null, null],
      [1, 2, 125000, 'NZD', '2027-10-01', '2028-04-30'],
    ])
  })

  it('a second save updates kept cells in place and removes the ones left out', async () => {
    const before = await readPrices()
    const result = await saveExperienceV2Prices(PAGE.prices, [
      { days: 1, anglers: 2, guidePriceCents: 115000, validFrom: null, validTo: null },
      { days: 3, anglers: 2, guidePriceCents: 300000, validFrom: null, validTo: null },
    ])
    expect(result).toEqual({ success: true, warnings: [] })

    const after = await readPrices()
    expect(after.map(r => [r.days, r.anglers, r.guide_price_cents])).toEqual([[1, 2, 115000], [3, 2, 300000]])
    // Same slot → same row, not delete + insert.
    expect(after[0].id).toBe(before.find(r => r.days === 1 && r.anglers === 2 && r.valid_from == null)?.id)
  })

  it('refuses a duplicate slot, a float, a zero price and an inverted season — and writes nothing', async () => {
    const before = await readPrices()
    const cell = { days: 1, anglers: 2, guidePriceCents: 100000, validFrom: null, validTo: null }

    expect(await saveExperienceV2Prices(PAGE.prices, [cell, cell])).toMatchObject({ success: false, error: expect.stringContaining('Two prices for 1 day(s) × 2 angler(s)') })
    expect(await saveExperienceV2Prices(PAGE.prices, [{ ...cell, guidePriceCents: 1000.5 }])).toMatchObject({ success: false, error: 'Amount must be a whole number of minor units' })
    expect(await saveExperienceV2Prices(PAGE.prices, [{ ...cell, guidePriceCents: 0 }])).toMatchObject({ success: false, error: 'Amount must be greater than 0' })
    expect(await saveExperienceV2Prices(PAGE.prices, [{ ...cell, validFrom: '2027-05-01', validTo: '2027-04-01' }])).toMatchObject({ success: false, error: '"Valid to" cannot be before "valid from"' })

    expect(await readPrices()).toEqual(before)
  })
})

// ─── Mode and price, content, options ─────────────────────────────────────────

function offer(over: Partial<OfferInput> = {}): OfferInput {
  return {
    offerMode: 'fixed', priceFromCents: 120000, priceToCents: null, feeBp: 2000,
    maxAnglersPerGuide: 2, minDays: 1, maxDays: null, ...over,
  }
}

function content(over: Partial<ContentInput> = {}): ContentInput {
  return {
    suitedFor: ['you cast 12 m in wind'], notSuitedFor: [], expectationsText: null, skillLevel: null,
    walkingKmMin: null, walkingKmMax: null, daySchedule: [], nearestAirport: null, suggestedLodging: [],
    licenseInfo: null, tipGuidanceText: null, weatherPolicyText: null, responseSlaHours: 24, offerEtaText: null,
    ...over,
  }
}

describe('saveExperienceV2Offer', () => {
  it('stores mode, cents, the fee as numeric(5,4) and the limits', async () => {
    const result = await saveExperienceV2Offer(PAGE.content, offer({
      offerMode: 'custom', priceFromCents: 250000, priceToCents: 900000, feeBp: 1750,
      maxAnglersPerGuide: 3, minDays: 2, maxDays: 7,
    }))
    expect(result).toEqual({ success: true, warnings: [] })

    const page = await readPage(PAGE.content)
    expect([page.offer_mode, page.price_from_cents, page.price_to_cents, page.fee_pct, page.max_anglers_per_guide, page.min_days, page.max_days])
      .toEqual(['custom', 250000, 900000, 0.175, 3, 2, 7])
  })

  it('refuses a float amount, max days below min days and a fee of 100%', async () => {
    expect(await saveExperienceV2Offer(PAGE.content, offer({ priceFromCents: 1200.5 }))).toMatchObject({ success: false })
    expect(await saveExperienceV2Offer(PAGE.content, offer({ minDays: 5, maxDays: 2 }))).toMatchObject({ success: false, error: 'Max days cannot be below min days' })
    expect(await saveExperienceV2Offer(PAGE.content, offer({ feeBp: 10000 }))).toMatchObject({ success: false, error: 'Fee must be below 100%' })
    expect((await readPage(PAGE.content)).fee_pct).toBe(0.175)
  })
})

describe('saveExperienceV2Content', () => {
  it('stores the content columns in the documented jsonb shapes and reads them back', async () => {
    const input = content({
      suitedFor: ['you cast 12 m in wind', 'you can walk 8 km on rocks'],
      notSuitedFor: ['you count fish'],
      expectationsText: 'No guarantee of a trophy fish.',
      skillLevel: 3, walkingKmMin: 3, walkingKmMax: 6.5,
      daySchedule: [
        { time: '7:30', title: 'Pick-up from your lodging', meta: { drive_min: null, walk_km: null, wading: false } },
        { time: '9:00', title: 'Fishing upstream',          meta: { drive_min: 60,  walk_km: 4.5,  wading: true } },
      ],
      nearestAirport: 'Queenstown (ZQN)',
      suggestedLodging: [{ name: 'Lake lodge', url: 'https://example.com/lodge', note: '10 min from pick-up' }],
      licenseInfo: { required: true, buy_url: 'https://example.com/licence', steps: ['Pick "non-resident"', 'Pay online'], price_text: 'about NZ$40 a day' },
      tipGuidanceText: '10% is customary.', weatherPolicyText: 'The guide picks other water.',
      responseSlaHours: 12, offerEtaText: '48–72 h',
    })
    expect(await saveExperienceV2Content(PAGE.content, input)).toEqual({ success: true, warnings: [] })

    const page = await readPage(PAGE.content)
    expect(page.suited_for).toEqual(input.suitedFor)
    expect(page.day_schedule).toEqual(input.daySchedule)
    expect(page.suggested_lodging).toEqual(input.suggestedLodging)
    expect(page.license_info).toEqual(input.licenseInfo)
    expect([page.skill_level, page.walking_km_min, page.walking_km_max, page.response_sla_hours]).toEqual([3, 3, 6.5, 12])

    const editor = await getExperienceV2Editor(PAGE.content)
    expect(editor?.shapeWarnings).toEqual([])
    expect(editor?.page.daySchedule).toEqual(input.daySchedule)
    expect(editor?.page.licenseInfo).toEqual(input.licenseInfo)
    expect(editor?.page.feeBp).toBe(1750)
  })

  it('refuses a URL that is not http(s)', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//example.com', 'example.com']) {
      const lodging = await saveExperienceV2Content(PAGE.content, content({ suggestedLodging: [{ name: 'x', url, note: null }] }))
      expect(lodging, url).toEqual({ success: false, error: 'URL must start with http:// or https://' })

      const licence = await saveExperienceV2Content(PAGE.content, content({ licenseInfo: { required: true, buy_url: url, steps: [], price_text: null } }))
      expect(licence, url).toEqual({ success: false, error: 'URL must start with http:// or https://' })
    }
    expect((await readPage(PAGE.content)).suggested_lodging).toEqual([{ name: 'Lake lodge', url: 'https://example.com/lodge', note: '10 min from pick-up' }])
  })
})

describe('updateExperienceOptionV2', () => {
  it('stores kind, cents in the page currency, duration and the sample itinerary', async () => {
    const itinerary = [{ day: 1, title: 'Arrival', waters: 'Home pool', lodging: 'Lodge', meals: 'Dinner', transfer: 'From KEF', notes: '' }]
    const result = await updateExperienceOptionV2(OPTION, {
      kind: 'archetype', priceFromCents: 300000, priceToCents: 450000,
      durationDaysMin: 3, durationDaysMax: 5, sampleItinerary: itinerary,
    })
    expect(result).toEqual({ success: true, warnings: [] })

    const { data } = await db().from('experience_page_options').select('*').eq('id', OPTION).single()
    expect([data?.kind, data?.price_from_cents, data?.price_to_cents, data?.currency, data?.duration_days_min, data?.duration_days_max])
      .toEqual(['archetype', 300000, 450000, 'NZD', 3, 5])
    expect(data?.sample_itinerary).toEqual(itinerary)
  })

  it('refuses an unknown kind and an unknown option', async () => {
    const base = { priceFromCents: null, priceToCents: null, durationDaysMin: null, durationDaysMax: null, sampleItinerary: [] }
    // @ts-expect-error — the point of the test is a value the type forbids
    expect(await updateExperienceOptionV2(OPTION, { ...base, kind: 'bundle' })).toMatchObject({ success: false })
    expect(await updateExperienceOptionV2('56c00000-0000-4000-8000-0000000000ff', { ...base, kind: 'addon' }))
      .toEqual({ success: false, error: 'Trip option not found' })
  })
})

describe('getExperienceGuideCounts', () => {
  it('counts all guides of a page and how many are active', async () => {
    const counts = await getExperienceGuideCounts()
    expect(counts[PAGE.guides]).toEqual({ total: 2, active: 2 })
    expect(counts[PAGE.prices]).toBeUndefined()
  })
})

// ─── Authorization — red proof 3 ──────────────────────────────────────────────

describe('every new action refuses a caller who is not an admin', () => {
  const calls: [name: string, call: () => Promise<unknown>][] = [
    ['getExperienceV2Editor',     () => getExperienceV2Editor(PAGE.auth)],
    ['getExperienceGuideCounts',  () => getExperienceGuideCounts()],
    ['saveExperienceV2Guides',    () => saveExperienceV2Guides(PAGE.auth, [])],
    ['saveExperienceV2Offer',     () => saveExperienceV2Offer(PAGE.auth, offer({ priceFromCents: 1 }))],
    ['saveExperienceV2Prices',    () => saveExperienceV2Prices(PAGE.auth, [{ days: 1, anglers: 2, guidePriceCents: 1, validFrom: null, validTo: null }])],
    ['saveExperienceV2Content',   () => saveExperienceV2Content(PAGE.auth, content({ suitedFor: ['written by a non-admin'] }))],
    ['updateExperienceOptionV2',  () => updateExperienceOptionV2(OPTION, { kind: 'addon', priceFromCents: 1, priceToCents: null, durationDaysMin: null, durationDaysMax: null, sampleItinerary: [] })],
    ['setExperiencePageVersion',  () => setExperiencePageVersion(PAGE.auth, 2)],
    ['addExperienceSlugAlias',    () => addExperienceSlugAlias(PAGE.auth, 'fa156-written-by-a-non-admin')],
    ['removeExperienceSlugAlias', () => removeExperienceSlugAlias(PAGE.target, slugOf('archived'))],
  ]

  const callers: [who: string, use: () => void][] = [
    ['anonymous (no session)',  () => actAs(anonClient())],
    ['angler@seed.test',        () => actAs(angler)],
  ]

  const snapshot = async () => ({
    page:    await readPage(PAGE.auth),
    guides:  await readGuides(PAGE.auth),
    prices:  (await db().from('experience_prices').select('id').eq('experience_id', PAGE.auth)).data,
    aliases: (await db().from('experience_slug_aliases').select('slug, experience_id').order('slug')).data
      ?.filter(a => a.slug.startsWith('fa156-')),
    option:  (await db().from('experience_page_options').select('*').eq('id', OPTION).single()).data,
  })

  for (const [who, use] of callers) {
    describe(who, () => {
      it.each(calls)('%s → UnauthorizedError, no service-role client, nothing written', async (_name, call) => {
        const before = await snapshot()
        use()
        vi.mocked(createServiceClient).mockClear()

        await expect(call()).rejects.toBeInstanceOf(UnauthorizedError)

        expect(createServiceClient).not.toHaveBeenCalled()
        expect(await snapshot()).toEqual(before)
      })
    })
  }

  it('the same calls go through for admin@seed.test — the refusals above are about the caller', async () => {
    actAs(admin)
    expect(await getExperienceV2Editor(PAGE.auth)).toMatchObject({ page: { id: PAGE.auth, legacyGuideId: G1 } })
    expect(await saveExperienceV2Guides(PAGE.auth, [guide(G1, { role: 'primary' })])).toEqual({ success: true, warnings: [] })
  })
})
