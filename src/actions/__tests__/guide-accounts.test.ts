/**
 * FA-M.08 — guide accounts against the real local stack: invite links, binding, self sign-up,
 * the dashboard layout, cross-guide isolation, the narrow marketing-consent action, password
 * reset, and the database guards on `guide_invites`.
 *
 * Env comes from .env.test through src/tests/setup.ts (127.0.0.1 only). The only mocks:
 *   - @/lib/supabase/server: createClient() returns a real supabase-js client holding a real
 *     session (h.sessionClient); createServiceClient() a real service client. Guards and actions
 *     run unchanged against local Auth + Postgres.
 *   - next/cache (no request store) and @/lib/app-url (no request headers).
 *
 * Self-contained: users under the `fam08-` prefix, two listings and one inquiry with fixed ids;
 * all swept in beforeAll / afterAll.
 */

import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({ sessionClient: null as unknown }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'http://localhost:3000' }))
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

import {
  issueGuideInvite,
  revokeGuideInvite,
  acceptGuideInvite,
  claimGuideInvite,
  getGuideInviteByToken,
  getGuideAccountSummary,
} from '@/actions/guide-invites'
import { resetPassword, updatePassword } from '@/actions/auth'
import { respondToAssignment } from '@/actions/inquiries'
import { acceptGuideTerms, setPhotoMarketingConsent } from '@/actions/dashboard'
import { UnauthorizedError } from '@/lib/auth/guards'

type Db = SupabaseClient<Database>

const PREFIX     = 'fam08-'
const PASSWORD   = 'fam08-test-password-2026'
const GUIDE_A    = 'a8a00000-0000-4000-8000-00000000000a'
const GUIDE_B    = 'a8a00000-0000-4000-8000-00000000000b'
const INQUIRY_B  = 'a8a00000-0000-4000-8000-0000000000b1'
const INVALID    = 'This invite link is no longer valid — ask FjordAnglers for a new one.'
const ADMIN      = { email: 'admin@seed.test',  password: 'seed-admin-password-2026' }
const ANGLER     = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }

function svc(): Db {
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
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error != null) throw new Error(`sign-in failed for test account: ${error.message}`)
  return c
}

async function asAdmin() { h.sessionClient = await signedIn(ADMIN.email, ADMIN.password) }

async function userIdByEmail(email: string): Promise<string | null> {
  const { data } = await svc().auth.admin.listUsers({ perPage: 1000 })
  return data.users.find(u => u.email === email)?.id ?? null
}

async function guideRow(id: string) {
  const { data } = await svc().from('guides').select('id, user_id, is_beta_listing').eq('id', id).single()
  return data
}

async function roleOf(userId: string) {
  const { data } = await svc().from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role ?? null
}

/** Issue an invite as admin and return the code from the link. */
async function issue(guideId: string, email: string): Promise<string> {
  await asAdmin()
  const res = await issueGuideInvite(guideId, email)
  if (!('success' in res)) throw new Error(`issue failed: ${res.error}`)
  return res.link.split('/invite/')[1]!
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQUIRY_B)
  const { data: inv } = await s.from('guide_invites').select('id').in('guide_id', [GUIDE_A, GUIDE_B])
  const ids = (inv ?? []).map(r => r.id)
  if (ids.length > 0) await s.from('audit_log').delete().eq('table_name', 'guide_invites').in('record_id', ids)
  await s.from('guides').delete().in('id', [GUIDE_A, GUIDE_B])
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) {
    if (u.email?.startsWith(PREFIX)) await s.auth.admin.deleteUser(u.id)
  }
}

async function freshListings() {
  await sweep()
  const ins = await svc().from('guides').insert([
    { id: GUIDE_A, full_name: 'Anna Fam08', country: 'Iceland', is_beta_listing: true },
    { id: GUIDE_B, full_name: 'Bjorn Fam08', country: 'Norway', is_beta_listing: true },
  ])
  if (ins.error != null) throw new Error(ins.error.message)
}

beforeAll(freshListings)
afterAll(sweep)
afterEach(() => { vi.restoreAllMocks() })

// ─── Issuing ──────────────────────────────────────────────────────────────────

describe('issuing an invite', () => {
  it('admin gets a link once; the database holds only the sha256 of the code; an ISSUE audit row is written', async () => {
    const code = await issue(GUIDE_A, `  ${PREFIX}Anna@seed.test `)

    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const { data: rows } = await svc().from('guide_invites').select('*').eq('guide_id', GUIDE_A)
    expect(rows).toHaveLength(1)
    const row = rows![0]!
    expect(row.token_hash).toBe(createHash('sha256').update(code).digest('hex'))
    expect(JSON.stringify(row)).not.toContain(code)
    expect(row.email).toBe(`${PREFIX}anna@seed.test`)
    const days = (new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()) / 86_400_000
    expect(days).toBeCloseTo(7, 3)

    const { data: audit } = await svc().from('audit_log').select('operation, changed_by').eq('record_id', row.id)
    expect(audit).toEqual([{ operation: 'ISSUE', changed_by: row.created_by }])
  })

  it('a non-admin cannot issue (angler session) — refused, nothing written', async () => {
    h.sessionClient = await signedIn(ANGLER.email, ANGLER.password)
    const before = await svc().from('guide_invites').select('id', { count: 'exact', head: true })

    await expect(issueGuideInvite(GUIDE_B, `${PREFIX}x@seed.test`)).rejects.toThrow(UnauthorizedError)

    const after = await svc().from('guide_invites').select('id', { count: 'exact', head: true })
    expect(after.count).toBe(before.count)
  })

  it('a signed-out caller cannot issue or revoke', async () => {
    h.sessionClient = anonClient()
    await expect(issueGuideInvite(GUIDE_B, `${PREFIX}x@seed.test`)).rejects.toThrow(UnauthorizedError)
    await expect(revokeGuideInvite('00000000-0000-4000-8000-000000000000', GUIDE_B)).rejects.toThrow(UnauthorizedError)
  })

  it('"New link" revokes the open invite: the old code stops working, one open invite per listing', async () => {
    const oldCode = await issue(GUIDE_B, `${PREFIX}bjorn@seed.test`)
    const newCode = await issue(GUIDE_B, `${PREFIX}bjorn@seed.test`)

    expect(await getGuideInviteByToken(oldCode)).toBeNull()
    expect(await getGuideInviteByToken(newCode)).toEqual({ guideName: 'Bjorn Fam08', email: `${PREFIX}bjorn@seed.test` })
    const { data: open } = await svc().from('guide_invites').select('id')
      .eq('guide_id', GUIDE_B).is('redeemed_at', null).is('revoked_at', null)
    expect(open).toHaveLength(1)
  })
})

// ─── Redeeming: once, not after expiry, not after revoke ──────────────────────

describe('an invite link works once', () => {
  it('signed out: set a password → account for the invite e-mail, bound to the listing, role guide, signed in', async () => {
    const email = `${PREFIX}anna@seed.test`
    const code = await issue(GUIDE_A, email)
    h.sessionClient = anonClient()

    const res = await acceptGuideInvite(code, PASSWORD)

    expect(res).toEqual({ success: true })
    const userId = await userIdByEmail(email)
    expect(userId).not.toBeNull()
    expect(await guideRow(GUIDE_A)).toMatchObject({ user_id: userId, is_beta_listing: false })
    expect(await roleOf(userId!)).toBe('guide')
    const { data: { user } } = await (h.sessionClient as Db).auth.getUser()
    expect(user?.id).toBe(userId)

    const { data: inv } = await svc().from('guide_invites').select('id, redeemed_at, redeemed_by').eq('guide_id', GUIDE_A).not('redeemed_at', 'is', null).single()
    expect(inv?.redeemed_by).toBe(userId)
    const { data: audit } = await svc().from('audit_log').select('operation').eq('record_id', inv!.id).eq('operation', 'REDEEM')
    expect(audit).toHaveLength(1)
  })

  it('RED: the second use of the same code is refused — no second account, binding unchanged', async () => {
    const { data: inv } = await svc().from('guide_invites').select('token_hash').eq('guide_id', GUIDE_A).not('redeemed_at', 'is', null).single()
    const boundBefore = (await guideRow(GUIDE_A))?.user_id

    // Through the app: the code is no longer open.
    const code = await issue(GUIDE_B, `${PREFIX}second-use@seed.test`)
    h.sessionClient = anonClient()
    expect(await acceptGuideInvite(code, PASSWORD)).toEqual({ success: true })
    h.sessionClient = anonClient()
    const second = await acceptGuideInvite(code, 'another-password-2026')
    expect(second).toEqual({ error: INVALID })

    // Straight at the database (a race that passed the app's pre-check): refused as "used".
    const stranger = await svc().auth.admin.createUser({ email: `${PREFIX}racer@seed.test`, password: PASSWORD, email_confirm: true })
    const { data: out } = await svc().rpc('redeem_guide_invite', {
      p_token_hash: inv!.token_hash, p_user_id: stranger.data.user!.id, p_user_email: `${PREFIX}anna@seed.test`,
    })
    expect(out).toEqual([{ outcome: 'used', bound_guide_id: null }])
    expect((await guideRow(GUIDE_A))?.user_id).toBe(boundBefore)
    expect(await roleOf(stranger.data.user!.id)).toBe('angler')
  })

  it('RED: an expired invite is refused — no account is created for its e-mail', async () => {
    await freshListings()
    const email = `${PREFIX}expired@seed.test`
    const code = 'E'.repeat(43)
    const ins = await svc().from('guide_invites').insert({
      guide_id: GUIDE_A, email, token_hash: createHash('sha256').update(code).digest('hex'),
      created_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      created_by: (await userIdByEmail(ADMIN.email))!,
    })
    expect(ins.error).toBeNull()
    h.sessionClient = anonClient()

    expect(await getGuideInviteByToken(code)).toBeNull()
    expect(await acceptGuideInvite(code, PASSWORD)).toEqual({ error: INVALID })
    expect(await userIdByEmail(email)).toBeNull()
    expect((await guideRow(GUIDE_A))?.user_id).toBeNull()

    // And at the database, for a signed-in account with the right e-mail:
    const u = await svc().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    const { data: out } = await svc().rpc('redeem_guide_invite', {
      p_token_hash: createHash('sha256').update(code).digest('hex'), p_user_id: u.data.user!.id, p_user_email: email,
    })
    expect(out).toEqual([{ outcome: 'expired', bound_guide_id: null }])
    expect((await guideRow(GUIDE_A))?.user_id).toBeNull()
  })

  it('RED: a revoked invite is refused', async () => {
    await freshListings()
    const code = await issue(GUIDE_A, `${PREFIX}revoked@seed.test`)
    const { data: inv } = await svc().from('guide_invites').select('id').eq('guide_id', GUIDE_A).single()
    await asAdmin()
    expect(await revokeGuideInvite(inv!.id, GUIDE_A)).toEqual({ success: true })
    h.sessionClient = anonClient()

    expect(await acceptGuideInvite(code, PASSWORD)).toEqual({ error: INVALID })
    expect(await userIdByEmail(`${PREFIX}revoked@seed.test`)).toBeNull()
  })

  it('an unknown or malformed code is refused without touching the database rows', async () => {
    h.sessionClient = anonClient()
    expect(await getGuideInviteByToken('not-a-code')).toBeNull()
    expect(await acceptGuideInvite('x'.repeat(43), PASSWORD)).toEqual({ error: INVALID })
  })
})

// ─── Existing accounts (D5) ───────────────────────────────────────────────────

describe('binding an existing account (tj D5)', () => {
  it('RED: a different signed-in account presenting a valid code is refused, nothing is bound, the admin card shows why', async () => {
    await freshListings()
    const code = await issue(GUIDE_A, `${PREFIX}anna@seed.test`)
    const angler = await signedIn(ANGLER.email, ANGLER.password)
    const anglerId = (await angler.auth.getUser()).data.user!.id
    h.sessionClient = angler

    expect(await claimGuideInvite(code)).toEqual({ error: INVALID })

    expect((await guideRow(GUIDE_A))?.user_id).toBeNull()
    expect(await roleOf(anglerId)).toBe('angler')
    // The invite stays usable for the real guide.
    expect(await getGuideInviteByToken(code)).not.toBeNull()

    await asAdmin()
    const summary = await getGuideAccountSummary(GUIDE_A)
    expect(summary?.invite?.state).toBe('open')
    expect(summary?.invite?.lastRefusal?.reason).toBe('email_mismatch')
  })

  it('the matching existing account (same e-mail, any case) signs in and claims → bound, role guide', async () => {
    const email = `${PREFIX}anna@seed.test`
    await svc().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    const code = await issue(GUIDE_A, email.toUpperCase())

    // Signed out first: the page learns the e-mail already has an account; nothing is created or bound.
    h.sessionClient = anonClient()
    expect(await acceptGuideInvite(code, 'some-other-password')).toEqual({ existingAccount: true })
    expect((await guideRow(GUIDE_A))?.user_id).toBeNull()

    const session = await signedIn(email, PASSWORD)
    h.sessionClient = session
    expect(await claimGuideInvite(code)).toEqual({ success: true })

    const userId = await userIdByEmail(email)
    expect((await guideRow(GUIDE_A))?.user_id).toBe(userId)
    expect(await roleOf(userId!)).toBe('guide')
  })

  it('RED: an admin account is never bound, even with the matching e-mail', async () => {
    const code = await issue(GUIDE_B, ADMIN.email)
    await asAdmin()

    expect(await claimGuideInvite(code)).toEqual({ error: INVALID })
    expect((await guideRow(GUIDE_B))?.user_id).toBeNull()
    expect(await roleOf((await userIdByEmail(ADMIN.email))!)).toBe('admin')
  })

  it('RED: an account already bound to one listing cannot take a second one', async () => {
    const email = `${PREFIX}anna@seed.test` // bound to GUIDE_A by the test above
    const code = await issue(GUIDE_B, email)
    h.sessionClient = await signedIn(email, PASSWORD)

    expect(await claimGuideInvite(code)).toEqual({ error: INVALID })
    expect((await guideRow(GUIDE_B))?.user_id).toBeNull()
  })

  it('a listing that already has an account cannot get an invite', async () => {
    await asAdmin()
    expect(await issueGuideInvite(GUIDE_A, `${PREFIX}other@seed.test`)).toEqual({ error: 'This guide already has an account.' })
  })
})

// ─── Database guards on guide_invites ─────────────────────────────────────────

describe('guide_invites is closed to anon and authenticated', () => {
  it('RED: anon cannot read the table or call the redeem function', async () => {
    const anon = anonClient()
    const read = await anon.from('guide_invites').select('id')
    expect(read.error?.code).toBe('42501')

    const rpc = await anon.rpc('redeem_guide_invite', { p_token_hash: 'x', p_user_id: GUIDE_A, p_user_email: 'x' })
    expect(rpc.error?.code).toBe('42501')
  })

  it('RED: a signed-in guide cannot read invites or issue one through the function', async () => {
    const guide = await signedIn(`${PREFIX}anna@seed.test`, PASSWORD)
    expect((await guide.from('guide_invites').select('id')).error?.code).toBe('42501')
    const rpc = await guide.rpc('issue_guide_invite', {
      p_guide_id: GUIDE_B, p_email: 'x@y.z', p_token_hash: 'a'.repeat(64), p_admin_id: GUIDE_B,
    })
    expect(rpc.error?.code).toBe('42501')
  })

  it('RED: constraints refuse a plain-text code, a second open invite and a used+revoked row', async () => {
    const adminId = (await userIdByEmail(ADMIN.email))!
    const base = { guide_id: GUIDE_B, email: 'c@seed.test', created_by: adminId, expires_at: new Date(Date.now() + 86_400_000).toISOString() }

    const plain = await svc().from('guide_invites').insert({ ...base, token_hash: 'plain-text-code' })
    expect(plain.error?.message).toContain('guide_invites_token_hash_format')

    // GUIDE_B has an open invite from the test above.
    const second = await svc().from('guide_invites').insert({ ...base, token_hash: 'b'.repeat(64) })
    expect(second.error?.message).toContain('guide_invites_one_open_per_guide')

    const both = await svc().from('guide_invites').insert({
      ...base, token_hash: 'c'.repeat(64), redeemed_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(), revoked_by: adminId,
    })
    expect(both.error?.message).toContain('guide_invites_redeemed_or_revoked')
  })
})

// ─── Dashboard: cross-guide isolation ─────────────────────────

/** Two fresh listings, each bound to its own guide account (cross-a → A, cross-b → B). */
async function twoBoundGuides(): Promise<{ aEmail: string; bEmail: string }> {
  await freshListings()
  const aEmail = `${PREFIX}cross-a@seed.test`
  const bEmail = `${PREFIX}cross-b@seed.test`
  for (const [email, guideId] of [[aEmail, GUIDE_A], [bEmail, GUIDE_B]] as const) {
    const u = await svc().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    await svc().from('guides').update({ user_id: u.data.user!.id }).eq('id', guideId)
    await svc().from('profiles').update({ role: 'guide' }).eq('id', u.data.user!.id)
  }
  return { aEmail, bEmail }
}

describe('dashboard', () => {
  it('a signed-in guide sees only their own trip; another guide is refused (page 404, action throws)', async () => {
    const { aEmail, bEmail } = await twoBoundGuides()
    const ins = await svc().from('inquiries').insert({
      id: INQUIRY_B, angler_name: 'Cross Guide Test', angler_email: 'cross@seed.test',
      status: 'qualifying', assigned_guide_id: GUIDE_B, assigned_at: new Date().toISOString(),
    })
    expect(ins.error).toBeNull()

    const { default: TripPage } = await import('@/app/dashboard/trips/[id]/page')
    const props = { params: Promise.resolve({ id: INQUIRY_B }), searchParams: Promise.resolve({}) }

    // Guide A on guide B's trip
    h.sessionClient = await signedIn(aEmail, PASSWORD)
    await expect(TripPage(props)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/)
    await expect(respondToAssignment(INQUIRY_B, true)).rejects.toThrow(UnauthorizedError)
    const { data: untouched } = await svc().from('inquiries').select('guide_acceptance').eq('id', INQUIRY_B).single()
    expect(untouched?.guide_acceptance).toBeNull()

    // Guide B on their own trip
    h.sessionClient = await signedIn(bEmail, PASSWORD)
    await expect(TripPage(props)).resolves.toBeTruthy()
    expect(await respondToAssignment(INQUIRY_B, true)).toEqual({ success: true })
  })
})

// ─── Marketing consent — the only listing field a guide sets (tj decision E2) ─

describe('setPhotoMarketingConsent', () => {
  const LISTING_COLS = 'bio, status, is_hidden, full_name, photo_marketing_consent'
  type Crafted = (...args: unknown[]) => ReturnType<typeof setPhotoMarketingConsent>
  const crafted = setPhotoMarketingConsent as unknown as Crafted

  it('the signed-in guide sets their own consent, and only that column changes', async () => {
    const { aEmail } = await twoBoundGuides()
    const before = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()

    h.sessionClient = await signedIn(aEmail, PASSWORD)
    expect(await setPhotoMarketingConsent(true)).toEqual({ success: true })

    const after = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()
    expect(after.data).toEqual({ ...before.data, photo_marketing_consent: true })
  })

  it('RED: a crafted call that tries to change another field (bio, is_hidden) is refused and changes nothing', async () => {
    const { aEmail } = await twoBoundGuides()
    const before = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()

    h.sessionClient = await signedIn(aEmail, PASSWORD)
    const res = await crafted({ photo_marketing_consent: true, bio: 'fam08 crafted bio', is_hidden: true })

    expect(res).toEqual({ success: false, error: 'Invalid value.' })
    const after = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()
    expect(after.data).toEqual(before.data)
  })

  it("RED: a crafted call aimed at another guide's row is refused and changes neither row", async () => {
    const { aEmail } = await twoBoundGuides()
    const beforeA = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()
    const beforeB = await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_B).single()

    h.sessionClient = await signedIn(aEmail, PASSWORD)
    const res = await crafted(true, GUIDE_B)

    expect(res).toEqual({ success: false, error: 'Invalid value.' })
    expect((await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_A).single()).data).toEqual(beforeA.data)
    expect((await svc().from('guides').select(LISTING_COLS).eq('id', GUIDE_B).single()).data).toEqual(beforeB.data)
  })

  it('RED: an account that is not a guide (angler) is refused', async () => {
    h.sessionClient = await signedIn(ANGLER.email, ANGLER.password)
    await expect(setPhotoMarketingConsent(true)).rejects.toThrow(UnauthorizedError)
  })
})

// ─── Terms stamp — server only, own row only (tj decision 2026-11-15) ──────────

describe('acceptGuideTerms', () => {
  const COLS = 'bio, status, is_hidden, full_name, photo_marketing_consent, terms_accepted_at'
  type Crafted = (...args: unknown[]) => ReturnType<typeof acceptGuideTerms>
  const crafted = acceptGuideTerms as unknown as Crafted

  it("stamps terms_accepted_at on the signed-in guide's own row, and nothing else changes", async () => {
    const { aEmail } = await twoBoundGuides()
    const before = await svc().from('guides').select(COLS).eq('id', GUIDE_A).single()
    expect(before.data?.terms_accepted_at).toBeNull()

    h.sessionClient = await signedIn(aEmail, PASSWORD)
    expect(await acceptGuideTerms()).toEqual({ success: true })

    const after = await svc().from('guides').select(COLS).eq('id', GUIDE_A).single()
    expect(after.data?.terms_accepted_at).not.toBeNull()
    expect({ ...after.data, terms_accepted_at: null }).toEqual(before.data)
  })

  it("RED: a crafted call aimed at another guide's row is refused and changes neither row", async () => {
    const { aEmail } = await twoBoundGuides()
    const beforeA = await svc().from('guides').select(COLS).eq('id', GUIDE_A).single()
    const beforeB = await svc().from('guides').select(COLS).eq('id', GUIDE_B).single()

    h.sessionClient = await signedIn(aEmail, PASSWORD)
    expect(await crafted(GUIDE_B)).toEqual({ success: false, error: 'Invalid value.' })

    expect((await svc().from('guides').select(COLS).eq('id', GUIDE_A).single()).data).toEqual(beforeA.data)
    expect((await svc().from('guides').select(COLS).eq('id', GUIDE_B).single()).data).toEqual(beforeB.data)
  })

  it('RED: an account with no guide listing (angler) is refused', async () => {
    h.sessionClient = await signedIn(ANGLER.email, ANGLER.password)
    await expect(acceptGuideTerms()).rejects.toThrow(UnauthorizedError)
  })
})

// ─── No guide session writes `guides` directly (migration 20261115000000) ──────

describe('guides is closed to UPDATE from a signed-in session', () => {
  it("RED: a guide's own session updating its own row through the REST client gets 42501 — bio, consent or terms", async () => {
    const { aEmail } = await twoBoundGuides()
    const before = await svc().from('guides').select('*').eq('id', GUIDE_A).single()
    const session = await signedIn(aEmail, PASSWORD)

    const bio = await session.from('guides').update({ bio: 'fam08 REST bio' }).eq('id', GUIDE_A).select('id')
    expect({ error: bio.error?.code ?? null, rows: bio.data }).toEqual({ error: '42501', rows: null })
    const consent = await session.from('guides').update({ photo_marketing_consent: true }).eq('id', GUIDE_A).select('id')
    expect({ error: consent.error?.code ?? null, rows: consent.data }).toEqual({ error: '42501', rows: null })
    const terms = await session.from('guides').update({ terms_accepted_at: new Date().toISOString() }).eq('id', GUIDE_A).select('id')
    expect({ error: terms.error?.code ?? null, rows: terms.data }).toEqual({ error: '42501', rows: null })

    const after = await svc().from('guides').select('*').eq('id', GUIDE_A).single()
    expect(after.data).toEqual(before.data)
  })
})

// ─── Password reset ───────────────────────────────────────────────────────────

describe('password reset', () => {
  it('resetPassword goes up to the faked send: one masked log line, no link in any log', async () => {
    process.env.RESEND_DEV_FAKE = '1'
    const lines: string[] = []
    for (const m of ['info', 'log', 'warn', 'error'] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')) })
    }
    try {
      h.sessionClient = anonClient()
      expect(await resetPassword(`${PREFIX}cross-a@seed.test`)).toEqual({ success: true })
      await vi.waitFor(() => expect(lines.some(l => l.includes('RESEND_DEV_FAKE=1 — not sent'))).toBe(true))
    } finally {
      delete process.env.RESEND_DEV_FAKE
    }

    const sent = lines.filter(l => l.includes('not sent'))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('type=PasswordResetEmail')
    expect(lines.join('\n')).not.toMatch(/token_hash|\/auth\/reset\?|fam08-cross-a@/)
  })

  it('a recovery link from the local stack sets a new password, and the guide signs in with it', async () => {
    const email = `${PREFIX}cross-a@seed.test`
    const { data, error } = await svc().auth.admin.generateLink({ type: 'recovery', email })
    expect(error).toBeNull()

    // The real /auth/reset route verifies the token into the session client.
    const browser = anonClient()
    h.sessionClient = browser
    const { GET } = await import('@/app/auth/reset/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(new NextRequest(`http://localhost:3000/auth/reset?token_hash=${data.properties!.hashed_token}&type=recovery`))
    expect(res.headers.get('location')).toBe('http://localhost:3000/reset-password')

    const NEW = 'fam08-new-password-2026'
    expect(await updatePassword(NEW)).toEqual({})

    expect((await anonClient().auth.signInWithPassword({ email, password: NEW })).error).toBeNull()
    expect((await anonClient().auth.signInWithPassword({ email, password: PASSWORD })).error).not.toBeNull()

    // The same link does not work twice.
    h.sessionClient = anonClient()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const again = await GET(new NextRequest(`http://localhost:3000/auth/reset?token_hash=${data.properties!.hashed_token}&type=recovery`))
    expect(again.headers.get('location')).toBe('http://localhost:3000/forgot-password?error=invalid_link')
  })
})
