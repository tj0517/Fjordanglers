/**
 * FA-1.94 — `inquiry_events` is server-only: no session (anon, angler, guide, admin) reads it;
 * the service key — which is how the admin inquiry timeline reads it — still does.
 *
 * Runs against the local stack (.env.test, 127.0.0.1 only — src/tests/setup.ts). One inquiry with
 * one event and one guide account under the `fa194-` prefix; swept in beforeAll / afterAll.
 * The event row cannot be deleted by any API role (append-only), so the inquiry delete cascades it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { emitEvent } from '@/lib/events/emit'

type Db = SupabaseClient<Database>

const INQUIRY     = 'f1940000-0000-4000-8000-000000000001'
const GUIDE_EMAIL = 'fa194-guide@seed.test'
const PASSWORD    = 'fa194-test-password-2026'
const ADMIN       = { email: 'admin@seed.test',  password: 'seed-admin-password-2026' }
const ANGLER      = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }

/** Postgres "insufficient_privilege" — what PostgREST returns once SELECT is revoked. */
const PERMISSION_DENIED = '42501'

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

async function sweep(): Promise<void> {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQUIRY)
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data?.users ?? []) {
    if (u.email === GUIDE_EMAIL) await s.auth.admin.deleteUser(u.id)
  }
}

/** The read every session client must be refused: the events of one inquiry. */
async function readEvents(client: Db) {
  return client.from('inquiry_events').select('id, type, payload').eq('inquiry_id', INQUIRY)
}

beforeAll(async () => {
  await sweep()
  const s = svc()

  const ins = await s.from('inquiries').insert({
    id: INQUIRY, angler_name: 'FA-1.94 Access Test', angler_email: ANGLER.email, status: 'qualifying',
  })
  if (ins.error != null) throw new Error(`fixture inquiry: ${ins.error.message}`)

  await emitEvent(s, {
    inquiryId: INQUIRY,
    type:      'status.changed',
    actor:     { kind: 'admin' },
    source:    'app',
    channel:   'app',
    fromStatus: 'new',
    toStatus:   'qualifying',
    payload:   { note: 'internal note the angler and guides must not read' },
  })

  const { data: created, error } = await s.auth.admin.createUser({
    email: GUIDE_EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (error != null || created.user == null) throw new Error(`fixture guide user: ${error?.message}`)
  const prof = await s.from('profiles').upsert({ id: created.user.id, role: 'guide' })
  if (prof.error != null) throw new Error(`fixture guide profile: ${prof.error.message}`)
})

afterAll(sweep)

describe('inquiry_events — no session reads the log (FA-1.94)', () => {
  it('anon client is refused', async () => {
    const { data, error } = await readEvents(anonClient())
    expect({ rows: data?.length ?? 0, code: error?.code }).toEqual({ rows: 0, code: PERMISSION_DENIED })
  })

  it('angler session (angler@seed.test, owner of the inquiry by e-mail) is refused', async () => {
    const { data, error } = await readEvents(await signedIn(ANGLER.email, ANGLER.password))
    expect({ rows: data?.length ?? 0, code: error?.code }).toEqual({ rows: 0, code: PERMISSION_DENIED })
  })

  it('guide session is refused', async () => {
    const { data, error } = await readEvents(await signedIn(GUIDE_EMAIL, PASSWORD))
    expect({ rows: data?.length ?? 0, code: error?.code }).toEqual({ rows: 0, code: PERMISSION_DENIED })
  })

  it('admin session is refused too — admin screens read with the service key', async () => {
    const { data, error } = await readEvents(await signedIn(ADMIN.email, ADMIN.password))
    expect({ rows: data?.length ?? 0, code: error?.code }).toEqual({ rows: 0, code: PERMISSION_DENIED })
  })
})

describe('inquiry_events — the service key still reads and writes (FA-1.94)', () => {
  it('admin inquiry timeline query (service client, as in admin/inquiries/[id]/page.tsx) returns the event', async () => {
    // Same select as the timeline on the admin inquiry card.
    const { data, error } = await svc()
      .from('inquiry_events')
      .select('id, type, actor_kind, actor_id, occurred_at, payload')
      .eq('inquiry_id', INQUIRY)
      .order('occurred_at', { ascending: true })
    expect(error).toBeNull()
    expect(data?.map(e => e.type)).toEqual(['status.changed'])
  })

  it('emitEvent (service client) still writes', async () => {
    const id = await emitEvent(svc(), {
      inquiryId: INQUIRY, type: 'inquiry.qualified_set', actor: { kind: 'admin' }, source: 'app',
      channel: 'app', payload: { value: 'yes', rule: 'fa-1.94 test' },
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('append-only guard is untouched: service role cannot UPDATE an event', async () => {
    const { data: row } = await svc().from('inquiry_events').select('id').eq('inquiry_id', INQUIRY).limit(1).single()
    const { error } = await svc().from('inquiry_events').update({ payload: {} }).eq('id', row!.id)
    expect(error).not.toBeNull()
  })
})
