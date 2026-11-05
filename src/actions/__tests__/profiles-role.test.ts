/**
 * FA-1.93 — profiles.role is set by the server only, against the real local stack.
 *
 * Four routes to `admin` existed: UPDATE own row, INSERT own row, the sign-up trigger copying
 * raw_user_meta_data.role, and auth/callback (that one is covered by auth-callback.test.ts).
 * Every assertion here reads the ROW afterwards through the service client — an RLS-denied
 * UPDATE answers 204 with nothing changed (FA-1.22), so the HTTP status proves nothing.
 *
 * Env comes from .env.test through src/tests/setup.ts (safety fuse included). The only mock is
 * @/lib/supabase/server: createClient() reads cookies, so here it returns the real supabase-js
 * client holding a real session, and requireAdmin() runs unchanged against local Auth + profiles.
 *
 * Self-contained: throw-away users are created under the `fa193-` prefix and deleted in afterAll
 * (a leftover run is swept in beforeAll). The seed angler's row is restored after every test.
 */

import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({ sessionClient: null as unknown }))

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

import { requireAdmin, UnauthorizedError } from '@/lib/auth/guards'

type Db = SupabaseClient<Database>

const PREFIX   = 'fa193-'
const PASSWORD = 'fa193-test-password-2026'
const ANGLER_PASSWORD = 'seed-angler-password-2026'
const ADMIN_PASSWORD  = 'seed-admin-password-2026'

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

async function signedIn(email: string, password: string): Promise<{ client: Db; userId: string }> {
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error != null || data.user == null) throw new Error(`sign-in as ${email} failed: ${error?.message}`)
  return { client, userId: data.user.id }
}

const created: string[] = []

/** A user made the way signUp makes one: service client, confirmed e-mail, optional metadata. */
async function createUser(name: string, metadata: Record<string, unknown> = {}): Promise<{ id: string; email: string }> {
  const email = `${PREFIX}${name}@seed.test`
  const { data, error } = await svc().auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: metadata,
  })
  if (error != null || data.user == null) throw new Error(`createUser ${email} failed: ${error?.message}`)
  created.push(data.user.id)
  return { id: data.user.id, email }
}

async function roleOf(userId: string): Promise<string | null> {
  const { data, error } = await svc().from('profiles').select('role').eq('id', userId).maybeSingle()
  expect(error).toBeNull()
  return data?.role ?? null
}

let anglerId = ''
let adminId  = ''
let anglerName: string | null = null

beforeAll(async () => {
  // Sweep users left behind by an interrupted run.
  const { data } = await svc().auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) {
    if (u.email?.startsWith(PREFIX)) await svc().auth.admin.deleteUser(u.id)
  }
  anglerId = (await signedIn('angler@seed.test', ANGLER_PASSWORD)).userId
  adminId  = (await signedIn('admin@seed.test',  ADMIN_PASSWORD)).userId
  const { data: row } = await svc().from('profiles').select('full_name').eq('id', anglerId).single()
  anglerName = row?.full_name ?? null
})

// Whatever a test did to the seed angler, put it back — the next test (and every other file) starts clean.
afterEach(async () => {
  await svc().from('profiles').update({ role: 'angler', full_name: anglerName }).eq('id', anglerId)
})

afterAll(async () => {
  for (const id of created) await svc().auth.admin.deleteUser(id)
})

describe('UPDATE route — a user cannot change their own role', () => {
  it('angler@seed.test sets role=admin on their own row → the row still says angler', async () => {
    const { client } = await signedIn('angler@seed.test', ANGLER_PASSWORD)

    await client.from('profiles').update({ role: 'admin' }).eq('id', anglerId)

    expect(await roleOf(anglerId)).toBe('angler')
  })

  it('angler cannot reach admin through requireAdmin() either', async () => {
    const { client } = await signedIn('angler@seed.test', ANGLER_PASSWORD)
    await client.from('profiles').update({ role: 'admin' }).eq('id', anglerId)

    h.sessionClient = client
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('angler still updates the columns that stay writable (full_name)', async () => {
    const { client } = await signedIn('angler@seed.test', ANGLER_PASSWORD)

    const { error } = await client.from('profiles').update({ full_name: 'FA-1.93 renamed' }).eq('id', anglerId)

    expect(error).toBeNull()
    const { data } = await svc().from('profiles').select('full_name, role').eq('id', anglerId).single()
    expect(data).toEqual({ full_name: 'FA-1.93 renamed', role: 'angler' })
  })

  it('anon cannot change any profile', async () => {
    await anonClient().from('profiles').update({ role: 'admin' }).eq('id', anglerId)

    expect(await roleOf(anglerId)).toBe('angler')
  })
})

describe('INSERT route — a user without a profile cannot create one as admin', () => {
  it('a seed-style user with no profiles row inserts their own profile with role=admin → no admin row appears', async () => {
    const u = await createUser('insert-admin')
    // Reproduce the 5 prod accounts that have no profile row (docs/deferred-tasks.md, FA-1.93).
    await svc().from('profiles').delete().eq('id', u.id)
    expect(await roleOf(u.id)).toBeNull()

    const { client } = await signedIn(u.email, PASSWORD)
    await client.from('profiles').insert({ id: u.id, role: 'admin', full_name: 'sneaky' })

    // Refused outright, or created as angler — never admin.
    expect(await roleOf(u.id)).not.toBe('admin')
  })

  it('the same user can still create their own profile without naming a role → angler', async () => {
    const u = await createUser('insert-plain')
    await svc().from('profiles').delete().eq('id', u.id)

    const { client } = await signedIn(u.email, PASSWORD)
    const { error } = await client.from('profiles').insert({ id: u.id, full_name: 'plain' })

    expect(error).toBeNull()
    expect(await roleOf(u.id)).toBe('angler')
  })
})

describe('sign-up trigger (handle_new_user) — the role in account metadata is ignored', () => {
  it('admin.createUser with user_metadata.role=admin → the new profile is angler', async () => {
    const u = await createUser('meta-admin', { role: 'admin', full_name: 'Meta Admin' })

    expect(await roleOf(u.id)).toBe('angler')
  })

  it('admin.createUser with user_metadata.role=guide → angler as well (guide is granted by server code only)', async () => {
    const u = await createUser('meta-guide', { role: 'guide' })

    expect(await roleOf(u.id)).toBe('angler')
  })

  it('admin.createUser still gets a profile row, with full_name taken from metadata (the trigger fires after the EXECUTE revoke)', async () => {
    const u = await createUser('meta-plain', { full_name: 'Plain Person' })

    const { data } = await svc().from('profiles').select('role, full_name').eq('id', u.id).maybeSingle()
    expect(data).toEqual({ role: 'angler', full_name: 'Plain Person' })
  })
})

describe('the server keeps the power to set a role', () => {
  it('service client changes a role (this is what signUp, linkGuideAccount and the invite autolink use)', async () => {
    const u = await createUser('svc-role')

    const { error } = await svc().from('profiles').update({ role: 'guide' }).eq('id', u.id)

    expect(error).toBeNull()
    expect(await roleOf(u.id)).toBe('guide')
  })

  it('admin@seed.test is an admin after a reset and passes requireAdmin()', async () => {
    expect(await roleOf(adminId)).toBe('admin')

    const { client } = await signedIn('admin@seed.test', ADMIN_PASSWORD)
    h.sessionClient = client

    await expect(requireAdmin()).resolves.toEqual({ userId: adminId })
  })
})
