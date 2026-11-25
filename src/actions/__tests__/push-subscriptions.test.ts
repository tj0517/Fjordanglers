/**
 * FA-M.12 — guide push subscriptions against the real local stack (.env.test, 127.0.0.1 only).
 *
 * Two guide logins are created by this test (the seed has one guide). `requireGuide` is mocked to
 * the login under test and `createClient` returns that login's real signed-in session client, so
 * RLS is exercised for real; `createServiceClient` is the local service client.
 *
 * Covers (tj D1a/D1b/D2 A): a guide reads only own rows — another guide's session sees nothing;
 * no direct INSERT / UPDATE / DELETE for a guide session (42501); the DB functions are not
 * executable by a guide session; the actions write only for the session's login (B cannot delete
 * A's row by endpoint); non-allowlisted endpoints are refused with nothing written; the same device
 * under another login moves; every change writes one audit_log row without endpoint or keys.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Db = SupabaseClient<Database>

function svc(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function anon(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const requireGuide = vi.fn()
let sessionClient: Db | null = null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => svc(),
  createClient: async () => {
    if (sessionClient == null) throw new Error('no session in this test')
    return sessionClient
  },
}))
vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireGuide: () => requireGuide(),
}))

import {
  savePushSubscriptionAction, deletePushSubscriptionAction, pushSubscriptionStatusAction,
} from '../push'
import { UnauthorizedError } from '@/lib/auth/guards'

const GUIDE_A = 'f5c00000-0000-4000-8000-00000000000a'
const GUIDE_B = 'f5c00000-0000-4000-8000-00000000000b'
const LOGIN_A = { email: 'fam12-guide-a@seed.test', password: 'fam12-guide-a-password-2026' }
const LOGIN_B = { email: 'fam12-guide-b@seed.test', password: 'fam12-guide-b-password-2026' }
const PERMISSION_DENIED = '42501'

const login = { A: { id: '', db: null as Db | null }, B: { id: '', db: null as Db | null } }

function browserKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
}

let n = 0
function subscription(host = 'fcm.googleapis.com', path = '/fcm/send/') {
  n += 1
  return { endpoint: `https://${host}${path}fam12-${Date.now()}-${n}`, expirationTime: null, keys: browserKeys() }
}

function as(who: 'A' | 'B') {
  requireGuide.mockResolvedValue({ userId: login[who].id, guide: { id: who === 'A' ? GUIDE_A : GUIDE_B } })
  sessionClient = login[who].db
}

async function rows(userId: string) {
  const { data, error } = await svc().from('guide_push_subscriptions').select('*').eq('user_id', userId)
  if (error != null) throw new Error(error.message)
  return data
}

async function auditRows(recordId: string) {
  const { data, error } = await svc().from('audit_log').select('operation, old_data, new_data, changed_by')
    .eq('table_name', 'guide_push_subscriptions').eq('record_id', recordId).order('changed_at')
  if (error != null) throw new Error(error.message)
  return data
}

async function ensureUser(cred: { email: string; password: string }): Promise<string> {
  const s = svc()
  const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find(u => u.email === cred.email)
  if (existing != null) return existing.id
  const { data, error } = await s.auth.admin.createUser({ email: cred.email, password: cred.password, email_confirm: true })
  if (error != null || data.user == null) throw new Error(error?.message ?? 'createUser failed')
  return data.user.id
}

async function signedIn(cred: { email: string; password: string }): Promise<Db> {
  const db = anon()
  const { error } = await db.auth.signInWithPassword(cred)
  if (error != null) throw new Error(error.message)
  return db
}

async function sweep() {
  const s = svc()
  const ids = [login.A.id, login.B.id].filter(id => id !== '')
  if (ids.length > 0) await s.from('guide_push_subscriptions').delete().in('user_id', ids)
  await s.from('guides').delete().in('id', [GUIDE_A, GUIDE_B])
}

beforeAll(async () => {
  login.A.id = await ensureUser(LOGIN_A)
  login.B.id = await ensureUser(LOGIN_B)
  await sweep()
  const g = await svc().from('guides').insert([
    { id: GUIDE_A, full_name: 'Aroha Fam12', country: 'New Zealand', is_beta_listing: true, user_id: login.A.id },
    { id: GUIDE_B, full_name: 'Bjorn Fam12', country: 'Iceland',     is_beta_listing: true, user_id: login.B.id },
  ])
  if (g.error != null) throw new Error(g.error.message)
  login.A.db = await signedIn(LOGIN_A)
  login.B.db = await signedIn(LOGIN_B)
})

afterAll(async () => {
  await sweep()
  const s = svc()
  for (const id of [login.A.id, login.B.id]) if (id !== '') await s.auth.admin.deleteUser(id)
})

beforeEach(async () => {
  requireGuide.mockReset()
  sessionClient = null
  const s = svc()
  await s.from('guide_push_subscriptions').delete().in('user_id', [login.A.id, login.B.id])
})

describe('savePushSubscriptionAction', () => {
  it('stores the subscription for the session’s login, with one SUBSCRIBE audit row without endpoint or keys', async () => {
    as('A')
    const sub = subscription()
    expect(await savePushSubscriptionAction(sub)).toEqual({ success: true })

    const stored = await rows(login.A.id)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })

    const audit = await auditRows(stored[0].id)
    expect(audit).toEqual([{ operation: 'SUBSCRIBE', old_data: null, new_data: { user_id: login.A.id }, changed_by: login.A.id }])
    const auditText = JSON.stringify(audit)
    expect(auditText.includes(sub.endpoint)).toBe(false)
    expect(auditText.includes(sub.keys.p256dh)).toBe(false)
    expect(auditText.includes(sub.keys.auth)).toBe(false)
  })

  it('an identical repeat changes nothing and writes no second audit row', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    await savePushSubscriptionAction(sub)
    const stored = await rows(login.A.id)
    expect(stored).toHaveLength(1)
    expect(await auditRows(stored[0].id)).toHaveLength(1)
  })

  it('many devices per login', async () => {
    as('A')
    await savePushSubscriptionAction(subscription())
    await savePushSubscriptionAction(subscription('web.push.apple.com', '/'))
    await savePushSubscriptionAction(subscription('updates.push.services.mozilla.com', '/wpush/v2/'))
    expect(await rows(login.A.id)).toHaveLength(3)
  })

  it('the same device subscribing under another login moves to that login (audit: moved)', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    as('B')
    expect(await savePushSubscriptionAction(sub)).toEqual({ success: true })

    expect(await rows(login.A.id)).toHaveLength(0)
    const moved = await rows(login.B.id)
    expect(moved).toHaveLength(1)
    const audit = await auditRows(moved[0].id)
    expect(audit[1]).toMatchObject({ operation: 'SUBSCRIBE', old_data: { user_id: login.A.id }, new_data: { user_id: login.B.id, moved: true } })
  })

  it('refuses every endpoint that is not https on a known push service — nothing written', async () => {
    as('A')
    const keys = browserKeys()
    const refused = [
      'http://fcm.googleapis.com/fcm/send/x',               // not https
      'https://evil.example.com/fcm/send/x',                 // unknown host
      'https://fcm.googleapis.com.evil.example.com/x',       // allowlisted name as a prefix
      'https://evilpush.apple.com/x',                        // suffix without the dot
      'https://user:pw@fcm.googleapis.com/fcm/send/x',       // credentials
      'https://fcm.googleapis.com:8443/fcm/send/x',          // other port
      'https://127.0.0.1/x',                                 // an address, not a push service
      'https://fcm.googleapis.com/',                         // no subscription path
      'javascript:alert(1)',
      `https://fcm.googleapis.com/${'a'.repeat(2050)}`,      // too long
    ]
    for (const endpoint of refused) {
      const res = await savePushSubscriptionAction({ endpoint, keys })
      expect(res, endpoint).toEqual({ success: false, error: 'This browser’s push service is not supported.' })
    }
    expect(await savePushSubscriptionAction({ endpoint: subscription().endpoint, keys: { p256dh: 'short', auth: keys.auth } }))
      .toMatchObject({ success: false })
    expect(await savePushSubscriptionAction('not an object')).toMatchObject({ success: false })
    expect(await rows(login.A.id)).toHaveLength(0)
  })

  it('a caller who is not a guide is refused before anything is written', async () => {
    requireGuide.mockRejectedValue(new UnauthorizedError('Guide profile not found'))
    await expect(savePushSubscriptionAction(subscription())).rejects.toThrow(UnauthorizedError)
    await expect(deletePushSubscriptionAction(subscription().endpoint)).rejects.toThrow(UnauthorizedError)
    await expect(pushSubscriptionStatusAction(subscription().endpoint)).rejects.toThrow(UnauthorizedError)
    expect(await rows(login.A.id)).toHaveLength(0)
  })
})

describe('deletePushSubscriptionAction', () => {
  it('deletes the login’s own row, with one UNSUBSCRIBE audit row', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    const [row] = await rows(login.A.id)
    expect(await deletePushSubscriptionAction(sub.endpoint)).toEqual({ success: true })
    expect(await rows(login.A.id)).toHaveLength(0)
    expect((await auditRows(row.id)).map(a => a.operation)).toEqual(['SUBSCRIBE', 'UNSUBSCRIBE'])
  })

  it('guide B cannot delete guide A’s subscription by its endpoint', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    as('B')
    expect(await deletePushSubscriptionAction(sub.endpoint)).toEqual({ success: true })   // nothing of B's to delete
    expect(await rows(login.A.id)).toHaveLength(1)
  })
})

describe('RLS — a guide reads only own rows, writes nothing directly (tj D1b A)', () => {
  it('guide A’s session sees A’s row; guide B’s session sees none of it', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)

    const ownRead = await login.A.db!.from('guide_push_subscriptions').select('endpoint')
    expect(ownRead.error).toBeNull()
    expect(ownRead.data?.map(r => r.endpoint)).toEqual([sub.endpoint])

    const otherRead = await login.B.db!.from('guide_push_subscriptions').select('endpoint')
    expect(otherRead.error).toBeNull()
    expect(otherRead.data).toEqual([])

    as('B')
    expect(await pushSubscriptionStatusAction(sub.endpoint)).toEqual({ saved: false })   // B's session: RLS hides A's row
    as('A')
    expect(await pushSubscriptionStatusAction(sub.endpoint)).toEqual({ saved: true })
  })

  it('anon reads nothing', async () => {
    as('A')
    await savePushSubscriptionAction(subscription())
    const read = await anon().from('guide_push_subscriptions').select('id')
    expect(read.data ?? []).toEqual([])
  })

  it('a guide session cannot INSERT, UPDATE or DELETE directly — not even its own rows', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    const a = login.A.db!
    const b = login.B.db!

    const insertOwn = await b.from('guide_push_subscriptions').insert({ user_id: login.B.id, endpoint: subscription().endpoint, ...browserKeys() })
    expect(insertOwn.error?.code).toBe(PERMISSION_DENIED)

    const insertOther = await b.from('guide_push_subscriptions').insert({ user_id: login.A.id, endpoint: 'https://evil.example.com/x', ...browserKeys() })
    expect(insertOther.error?.code).toBe(PERMISSION_DENIED)

    const updateOther = await b.from('guide_push_subscriptions').update({ endpoint: 'https://evil.example.com/x' }).eq('user_id', login.A.id)
    expect(updateOther.error?.code).toBe(PERMISSION_DENIED)

    const deleteOther = await b.from('guide_push_subscriptions').delete().eq('user_id', login.A.id)
    expect(deleteOther.error?.code).toBe(PERMISSION_DENIED)

    const deleteOwn = await a.from('guide_push_subscriptions').delete().eq('endpoint', sub.endpoint)
    expect(deleteOwn.error?.code).toBe(PERMISSION_DENIED)

    const [row] = await rows(login.A.id)
    expect(row.endpoint).toBe(sub.endpoint)
  })

  it('a guide session cannot execute the write functions', async () => {
    as('A')
    const sub = subscription()
    await savePushSubscriptionAction(sub)
    const b = login.B.db!
    const save = await b.rpc('save_push_subscription', {
      p_user_id: login.B.id, p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth,
    })
    expect(save.error?.code).toBe(PERMISSION_DENIED)
    const del = await b.rpc('delete_push_subscription', { p_user_id: login.A.id, p_endpoint: sub.endpoint })
    expect(del.error?.code).toBe(PERMISSION_DENIED)
    const gone = await b.rpc('remove_gone_push_subscriptions', { p_ids: [(await rows(login.A.id))[0].id] })
    expect(gone.error?.code).toBe(PERMISSION_DENIED)
    expect(await rows(login.A.id)).toHaveLength(1)
  })
})

describe('database guards behind the app check', () => {
  it('save_push_subscription refuses a login that is not a guide, and a non-https endpoint', async () => {
    const s = svc()
    const keys = browserKeys()
    const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
    const angler = users?.users.find(u => u.email === 'angler@seed.test')?.id
    expect(angler).toBeDefined()
    const notGuide = await s.rpc('save_push_subscription', {
      p_user_id: angler!, p_endpoint: subscription().endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
    })
    expect(notGuide.error?.code).toBe(PERMISSION_DENIED)

    const http = await s.rpc('save_push_subscription', {
      p_user_id: login.A.id, p_endpoint: 'http://fcm.googleapis.com/fcm/send/x', p_p256dh: keys.p256dh, p_auth: keys.auth,
    })
    expect(http.error?.code).toBe('23514')   // check_violation
    expect(await rows(login.A.id)).toHaveLength(0)
  })
})
