/**
 * FA-1.93 — GET /auth/callback never lets account metadata decide profiles.role.
 *
 * Unit test: both Supabase clients are replaced by one in-memory fake that models the two
 * tables the callback touches (profiles, guides) with the semantics that matter here —
 * `upsert(..., { ignoreDuplicates: true })` leaves an existing row alone, a plain upsert
 * overwrites it, and a row inserted without a role gets the column default 'angler'.
 * Every assertion reads the final state of the fake, not which calls were made, so it holds
 * for any implementation that keeps the role out of the metadata's hands.
 *
 * `user_metadata` is the thing a signed-in user can edit themselves; it is hostile input.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  user: null as { id: string; email: string; user_metadata: Record<string, unknown> } | null,
  profiles: new Map<string, Row>(),
  guides: [] as Row[],
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))

vi.mock('@/lib/supabase/server', () => {
  type Q = { table: string; op: 'select' | 'upsert' | 'update'; filters: Record<string, unknown>; payload?: Row; ignoreDuplicates?: boolean }

  function exec(q: Q): { data: unknown; error: null } {
    if (q.table === 'profiles') {
      if (q.op === 'select') return { data: h.profiles.get(q.filters.id as string) ?? null, error: null }
      if (q.op === 'upsert' && q.payload != null) {
        const id = q.payload.id as string
        const existing = h.profiles.get(id)
        if (existing != null && q.ignoreDuplicates === true) return { data: null, error: null }
        h.profiles.set(id, { role: 'angler', ...existing, ...q.payload })
      }
    }
    if (q.table === 'guides') {
      if (q.op === 'select') {
        const hit = h.guides.find(g => g.invite_email === q.filters.invite_email && g.user_id == null)
        return { data: hit ?? null, error: null }
      }
      if (q.op === 'update' && q.payload != null) {
        const hit = h.guides.find(g => g.id === q.filters.id)
        if (hit != null) Object.assign(hit, q.payload)
      }
    }
    return { data: null, error: null }
  }

  function from(table: string) {
    const q: Q = { table, op: 'select', filters: {} }
    const chain = {
      select: () => chain,
      eq:     (col: string, v: unknown) => { q.filters[col] = v; return chain },
      is:     (col: string, v: unknown) => { q.filters[col] = v; return chain },
      update: (payload: Row) => { q.op = 'update'; q.payload = payload; return chain },
      upsert: (payload: Row, opts?: { ignoreDuplicates?: boolean }) => {
        q.op = 'upsert'; q.payload = payload; q.ignoreDuplicates = opts?.ignoreDuplicates
        return chain
      },
      maybeSingle: async () => exec(q),
      single:      async () => exec(q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(exec(q)).then(resolve, reject),
    }
    return chain
  }

  return {
    createClient: vi.fn(async () => ({
      auth: { exchangeCodeForSession: async () => ({ data: { user: h.user }, error: null }) },
      from,
    })),
    createServiceClient: vi.fn(() => ({ from })),
  }
})

import { GET } from '../route'

const USER_ID = '93b00000-0000-4000-8000-000000000001'
const EMAIL   = 'someone@example.test'

function login(metadata: Record<string, unknown>) {
  h.user = { id: USER_ID, email: EMAIL, user_metadata: metadata }
}

async function callback(query = ''): Promise<string | null> {
  const res = await GET(new NextRequest(`http://localhost:3000/auth/callback?code=abc${query}`))
  return res.headers.get('location')
}

const roleNow = () => h.profiles.get(USER_ID)?.role

beforeEach(() => {
  h.profiles.clear()
  h.guides.length = 0
  h.user = null
})

describe('metadata role never reaches profiles.role', () => {
  it('new account with user_metadata.role = admin → angler profile', async () => {
    login({ role: 'admin' })

    await callback()

    expect(roleNow()).toBe('angler')
  })

  it('existing angler with user_metadata.role = admin → still angler', async () => {
    h.profiles.set(USER_ID, { id: USER_ID, role: 'angler' })
    login({ role: 'admin' })

    await callback()

    expect(roleNow()).toBe('angler')
  })

  it('existing admin whose metadata says angler (or nothing) → still admin, not demoted', async () => {
    h.profiles.set(USER_ID, { id: USER_ID, role: 'admin' })
    login({ role: 'angler' })

    await callback()

    expect(roleNow()).toBe('admin')
  })

  it('existing guide whose metadata says angler → still guide', async () => {
    h.profiles.set(USER_ID, { id: USER_ID, role: 'guide' })
    login({})

    await callback()

    expect(roleNow()).toBe('guide')
  })

  it('new account with user_metadata.role = guide → angler (guide is granted by server code, not by the account)', async () => {
    login({ role: 'guide' })

    await callback()

    expect(roleNow()).toBe('angler')
  })
})

describe('what the callback still does', () => {
  it('creates the profile row when the trigger did not (angler)', async () => {
    login({})

    await callback()

    expect(h.profiles.get(USER_ID)).toMatchObject({ id: USER_ID, role: 'angler' })
  })

  it('invite autolink: a guide listing whose invite_email matches pins the account and grants guide', async () => {
    h.guides.push({ id: 'g1', invite_email: EMAIL, user_id: null })
    login({ role: 'admin' }) // hostile metadata must not matter even here

    const location = await callback()

    expect(roleNow()).toBe('guide')
    expect(h.guides[0]).toMatchObject({ user_id: USER_ID, is_beta_listing: false })
    expect(location).toBe('http://localhost:3000/dashboard')
  })

  it('redirects to an explicit next (password reset must not be overridden)', async () => {
    h.profiles.set(USER_ID, { id: USER_ID, role: 'guide' })
    login({})

    expect(await callback('&next=/reset-password')).toBe('http://localhost:3000/reset-password')
  })

  it('redirects to /dashboard by default', async () => {
    h.profiles.set(USER_ID, { id: USER_ID, role: 'angler' })
    login({})

    expect(await callback()).toBe('http://localhost:3000/dashboard')
  })

  it('a failed code exchange still goes back to /login', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { exchangeCodeForSession: async () => ({ data: { user: null }, error: { message: 'bad code' } }) },
    } as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await callback()).toBe('http://localhost:3000/login?error=auth_callback_failed')
  })
})
