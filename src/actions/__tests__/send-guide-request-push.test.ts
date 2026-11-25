/**
 * FA-M.12 — the push hook in sendGuideRequest, against the real local stack (.env.test, 127.0.0.1).
 *
 * `after` (next/server) is replaced by a recorder, so the test controls when the after-response
 * work runs — exactly as the platform does: on Vercel, after() hands its promise to waitUntil and
 * the function stays alive until that promise settles. The push sender is a fake (no push service);
 * the VAPID config is the real parser fed with throwaway keys, or nothing ("keys absent").
 *
 * Covers: keys absent / sender throwing / after() itself throwing → the send still succeeds with
 * exactly one request and one guide.request_sent; the push runs only inside the callback handed to
 * after(), and that callback's promise does not settle before every push has gone out (so
 * waitUntil keeps the function alive for it); the push carries /r/<token> of the link returned to
 * the admin; a 410 subscription is deleted. The token never appears in an event or log line.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateVAPIDKeys } from 'web-push'
import type { Database } from '@/lib/supabase/database.types'
import type { PushOutcome, PushTarget } from '@/lib/push/sender'
import { parseVapidConfig, type VapidConfig } from '@/lib/push/config'

type Db = SupabaseClient<Database>

function svc(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const requireAdmin = vi.fn()
const afterCallbacks: Array<() => unknown> = []
let afterThrows = false
let vapid: VapidConfig = { ok: false }
let send: (target: PushTarget, payload: string) => Promise<PushOutcome> = async () => 'sent'
const pushes: Array<{ target: PushTarget; payload: string }> = []

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => svc() }))
vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: () => requireAdmin(),
}))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'https://fa.test' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    // Like Next outside a request with waitUntil: after() throws synchronously at the call site.
    if (afterThrows) throw new Error('`after()` will not work correctly, because `waitUntil` is not available in the current environment.')
    afterCallbacks.push(task)
  },
}))
vi.mock('@/lib/push/config', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/push/config')>()),
  vapidConfigFromEnv: () => vapid,
}))
vi.mock('@/lib/push/sender', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/push/sender')>()),
  webPushSender: () => ({
    send: (target: PushTarget, payload: string) => { pushes.push({ target, payload }); return send(target, payload) },
  }),
}))

import { sendGuideRequest } from '../guide-requests'

const INQ   = 'f5e00000-0000-4000-8000-000000000001'
const GUIDE = 'f5e00000-0000-4000-8000-00000000000a'
const PHONE = '+64211234599'
const LOGIN = { email: 'fam12-send@seed.test', password: 'fam12-send-password-2026' }

let ADMIN_ID = ''
let USER_ID = ''
let endpoints: string[] = []
let logSpies: Array<ReturnType<typeof vi.spyOn>> = []

const TEST_VAPID: VapidConfig = (() => {
  const k = generateVAPIDKeys()   // throwaway, per run
  return parseVapidConfig({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, VAPID_SUBJECT: 'mailto:push-test@seed.test' })
})()

async function counts() {
  const s = svc()
  const requests = await s.from('guide_requests').select('id', { count: 'exact', head: true }).eq('inquiry_id', INQ)
  const sent = await s.from('inquiry_events').select('id', { count: 'exact', head: true }).eq('inquiry_id', INQ).eq('type', 'guide.request_sent')
  return { requests: requests.count, requestSent: sent.count }
}

async function pushEvents() {
  const { data, error } = await svc().from('inquiry_events').select('payload').eq('inquiry_id', INQ).eq('type', 'guide.request_push_sent')
  if (error != null) throw new Error(error.message)
  return data.map(e => e.payload)
}

async function allEventsText() {
  const { data } = await svc().from('inquiry_events').select('*').eq('inquiry_id', INQ)
  return JSON.stringify(data)
}

function loggedText(): string {
  return logSpies.flatMap(spy => spy.mock.calls.flat()).map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join('\n')
}

async function runAfterCallbacks() {
  const tasks = afterCallbacks.splice(0)
  return Promise.all(tasks.map(t => t()))
}

function browserKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
}

async function addSubscriptions(count: number) {
  endpoints = []
  for (let i = 0; i < count; i++) {
    const endpoint = `https://fcm.googleapis.com/fcm/send/fam12-send-${Date.now()}-${i}`
    const keys = browserKeys()
    const { error } = await svc().rpc('save_push_subscription', { p_user_id: USER_ID, p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth })
    if (error != null) throw new Error(error.message)
    endpoints.push(endpoint)
  }
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  await s.from('guide_contacts').delete().eq('guide_id', GUIDE)
  if (USER_ID !== '') await s.from('guide_push_subscriptions').delete().eq('user_id', USER_ID)
  await s.from('guides').delete().eq('id', GUIDE)
}

beforeAll(async () => {
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')
  USER_ID = users?.users.find(u => u.email === LOGIN.email)?.id ?? ''
  if (USER_ID === '') {
    const { data, error } = await s.auth.admin.createUser({ email: LOGIN.email, password: LOGIN.password, email_confirm: true })
    if (error != null || data.user == null) throw new Error(error?.message ?? 'createUser failed')
    USER_ID = data.user.id
  }
  await sweep()
  const g = await s.from('guides').insert({ id: GUIDE, full_name: 'Push Fam12 Sender', country: 'New Zealand', is_beta_listing: true, user_id: USER_ID })
  if (g.error != null) throw new Error(g.error.message)
  const c = await s.from('guide_contacts').insert({ guide_id: GUIDE, phone_e164: PHONE })
  if (c.error != null) throw new Error(c.error.message)
})

afterAll(async () => {
  await sweep()
  if (USER_ID !== '') await svc().auth.admin.deleteUser(USER_ID)
})

beforeEach(async () => {
  requireAdmin.mockReset()
  requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  afterCallbacks.length = 0
  afterThrows = false
  vapid = TEST_VAPID
  send = async () => 'sent'
  pushes.length = 0
  logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => vi.spyOn(console, m))
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  const i = await s.from('inquiries').insert({
    id: INQ, angler_name: 'FA-M.12 Send', angler_email: 'fam12-send-angler@seed.test',
    status: 'waiting_guide', trip_country: 'New Zealand', party_size: 2, requested_dates: ['2027-01-14', '2027-01-15'],
  })
  if (i.error != null) throw new Error(i.error.message)
  await s.from('guide_push_subscriptions').delete().eq('user_id', USER_ID)
})

afterEach(() => logSpies.forEach(spy => spy.mockRestore()))

describe('push after the response — the send never depends on it', () => {
  it('VAPID keys absent → send succeeds: one request, one guide.request_sent; no push, no push event', async () => {
    vapid = parseVapidConfig({})
    await addSubscriptions(2)
    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    await runAfterCallbacks()

    expect(await counts()).toEqual({ requests: 1, requestSent: 1 })
    expect(pushes).toHaveLength(0)
    expect(await pushEvents()).toEqual([])
  })

  it('the push sender throwing → send succeeds: one request, one guide.request_sent; the after task resolves', async () => {
    send = async () => { throw new Error('push service down') }
    await addSubscriptions(2)
    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    await expect(runAfterCallbacks()).resolves.toEqual([{ status: 'attempted', sent: 0, failed: 2, removed: 0 }])

    expect(await counts()).toEqual({ requests: 1, requestSent: 1 })
    expect(await pushEvents()).toEqual([{ request_id: expect.any(String), guide_id: GUIDE, sent: 0, failed: 2, removed: 0 }])
  })

  it('after() itself throwing (no waitUntil) → send succeeds: one request, one guide.request_sent; log line without token', async () => {
    afterThrows = true
    await addSubscriptions(1)
    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(await counts()).toEqual({ requests: 1, requestSent: 1 })
    expect(pushes).toHaveLength(0)
    const token = res.link.split('/r/')[1] ?? ''
    expect(loggedText()).toContain('could not schedule the push; the request itself was sent')
    expect(loggedText().includes(token)).toBe(false)
  })
})

describe('push after the response — it survives the response (Vercel waitUntil)', () => {
  it('the action returns before any push; the after() task settles only once every push went out', async () => {
    await addSubscriptions(2)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    send = async () => { await gate; return 'sent' }

    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    expect(afterCallbacks).toHaveLength(1)                  // registered once, with the platform
    expect(pushes).toHaveLength(0)                          // nothing started before the response

    let settled = false
    const task = Promise.resolve(afterCallbacks.splice(0)[0]()).then(r => { settled = true; return r })
    await vi.waitFor(() => expect(pushes).toHaveLength(2))  // pushes are in flight inside the task…
    await new Promise(r => setTimeout(r, 50))
    expect(settled).toBe(false)                             // …and the task (what waitUntil awaits) is still open
    expect(await pushEvents()).toEqual([])

    release()
    expect(await task).toEqual({ status: 'attempted', sent: 2, failed: 0, removed: 0 })
    expect(await pushEvents()).toHaveLength(1)
  })
})

describe('push content', () => {
  it('every subscription gets the request page of the link returned to the admin; a 410 one is deleted', async () => {
    await addSubscriptions(3)
    const gone = endpoints[2]
    send = async target => (target.endpoint === gone ? 'gone' : 'sent')

    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    if (!res.success) return
    await runAfterCallbacks()

    const token = res.link.split('/r/')[1] ?? ''
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pushes.map(p => p.target.endpoint).sort()).toEqual([...endpoints].sort())
    for (const p of pushes) {
      expect(JSON.parse(p.payload)).toMatchObject({
        title: 'New request · New Zealand, 14–15 Jan',
        body:  '2 anglers. Tap to accept, decline or suggest dates.',
        url:   `/r/${token}`,
      })
    }

    const { data: left } = await svc().from('guide_push_subscriptions').select('endpoint').eq('user_id', USER_ID)
    expect(left?.map(r => r.endpoint).sort()).toEqual(endpoints.slice(0, 2).sort())
    expect(await pushEvents()).toEqual([{ request_id: expect.any(String), guide_id: GUIDE, sent: 2, failed: 1, removed: 1 }])

    const eventsText = await allEventsText()
    expect(eventsText.includes(token)).toBe(false)
    for (const e of endpoints) expect(eventsText.includes(e)).toBe(false)
    expect(loggedText().includes(token)).toBe(false)
  })
})
