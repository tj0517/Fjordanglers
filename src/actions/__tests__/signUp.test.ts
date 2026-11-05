/**
 * FA-1.93 — the server-side paths that DO grant a role keep working: signUp (guide / angler,
 * never admin) and the admin's linkGuideAccount, against the real local stack.
 *
 * Mocked: next/cache (no request store), @/lib/email and @/lib/stripe/client (their modules
 * need keys we do not have locally and are irrelevant here), and @/lib/supabase/server —
 * createClient() returns a real supabase-js client, createServiceClient() a real service client.
 * Throw-away users and the guide row live under the `fa193-` prefix / a fixed id and are deleted in afterAll.
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
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: vi.fn() }))
vi.mock('@/lib/stripe/client', () => ({ stripe: {} }))

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

import { signUp } from '@/actions/auth'
import { linkGuideAccount } from '@/actions/admin'

type Db = SupabaseClient<Database>

const PREFIX   = 'fa193-signup-'
const PASSWORD = 'fa193-test-password-2026'
const GUIDE_ID = '93a00000-0000-4000-8000-000000000001'

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

async function sweep() {
  await svc().from('guides').delete().eq('id', GUIDE_ID)
  const { data } = await svc().auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) {
    if (u.email?.startsWith(PREFIX)) await svc().auth.admin.deleteUser(u.id)
  }
}

async function profileOf(email: string): Promise<{ id: string; role: string } | null> {
  const { data } = await svc().auth.admin.listUsers({ perPage: 1000 })
  const user = data.users.find(u => u.email === email)
  if (user == null) return null
  const { data: row } = await svc().from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  return row
}

beforeAll(sweep)
afterAll(sweep)

describe('signUp grants only angler or guide', () => {
  it('signUp as guide → a guide profile', async () => {
    h.sessionClient = anonClient()
    const email = `${PREFIX}guide@seed.test`

    const res = await signUp('FA-1.93 Guide', email, PASSWORD, 'guide')

    expect(res).toEqual({ success: true })
    expect((await profileOf(email))?.role).toBe('guide')
  })

  it('signUp with no role → an angler profile', async () => {
    h.sessionClient = anonClient()
    const email = `${PREFIX}angler@seed.test`

    const res = await signUp('FA-1.93 Angler', email, PASSWORD)

    expect(res).toEqual({ success: true })
    expect((await profileOf(email))?.role).toBe('angler')
  })

  it('a crafted request that passes role "admin" → an angler profile (server actions are publicly addressable)', async () => {
    h.sessionClient = anonClient()
    const email = `${PREFIX}hostile@seed.test`
    const hostile: string = 'admin'

    const res = await signUp('FA-1.93 Hostile', email, PASSWORD, hostile as 'angler')

    expect(res).toEqual({ success: true })
    expect((await profileOf(email))?.role).toBe('angler')
  })
})

describe('linkGuideAccount grants guide', () => {
  it('admin links an angler account to a guide listing → the profile becomes guide', async () => {
    const email = `${PREFIX}linked@seed.test`
    const { data: made, error } = await svc().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    expect(error).toBeNull()
    expect((await profileOf(email))?.role).toBe('angler')

    const ins = await svc().from('guides').insert({ id: GUIDE_ID, full_name: 'FA-1.93 listing', country: 'Iceland', invite_email: email })
    expect(ins.error).toBeNull()

    // Real admin session, so requireAdmin() inside the action runs unchanged.
    const admin = anonClient()
    const { error: signInErr } = await admin.auth.signInWithPassword({ email: 'admin@seed.test', password: 'seed-admin-password-2026' })
    expect(signInErr).toBeNull()
    h.sessionClient = admin

    const res = await linkGuideAccount(GUIDE_ID)

    expect(res).toEqual({ success: true })
    expect((await profileOf(email))?.role).toBe('guide')
    const { data: guide } = await svc().from('guides').select('user_id').eq('id', GUIDE_ID).single()
    expect(guide?.user_id).toBe(made.user?.id)
  })
})
