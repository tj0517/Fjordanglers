/**
 * FA-M.12 — notifyGuideOfNewRequest against the real local stack with a FAKE push sender (no push
 * service is called). Covers: one push per subscription of the guide's login, a 410 subscription
 * deleted (with its EXPIRE audit row), one guide.request_push_sent with counts only; keys absent →
 * nothing sent, no event, one log line; a throwing sender or a failing event write never throws.
 * The /r/<token> path is only in the payload handed to the sender — never in the event or a log.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { generateVAPIDKeys } from 'web-push'
import { notifyGuideOfNewRequest, type GuideRequestPushJob } from '../guide-request-push'
import type { PushOutcome, PushSender, PushTarget } from '../sender'
import type { VapidConfig } from '../config'

type Db = SupabaseClient<Database>

function svc(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const INQ      = 'f5d00000-0000-4000-8000-000000000001'
const GUIDE    = 'f5d00000-0000-4000-8000-00000000000a'
const NO_LOGIN = 'f5d00000-0000-4000-8000-00000000000b'
const REQUEST  = 'f5d00000-0000-4000-8000-0000000000aa'
const LOGIN    = { email: 'fam12-notify@seed.test', password: 'fam12-notify-password-2026' }
const TOKEN    = randomBytes(32).toString('base64url')

let USER_ID = ''
let endpoints: string[] = []
let logSpies: Array<ReturnType<typeof vi.spyOn>> = []

const VAPID: VapidConfig = (() => {
  const k = generateVAPIDKeys()
  return { ok: true, publicKey: k.publicKey, privateKey: k.privateKey, subject: 'mailto:push-test@seed.test' }
})()

function job(guideId = GUIDE): GuideRequestPushJob {
  return {
    inquiryId: INQ, requestId: REQUEST, guideId,
    title: 'New request · New Zealand, 14–15 Jan', body: '2 anglers. Tap to accept, decline or suggest dates.',
    path: `/r/${TOKEN}`,
  }
}

function fakeSender(outcomes: (target: PushTarget) => PushOutcome | Promise<PushOutcome>) {
  const calls: Array<{ target: PushTarget; payload: string }> = []
  const sender: PushSender = {
    async send(target, payload) {
      calls.push({ target, payload })
      return outcomes(target)
    },
  }
  return { sender, calls }
}

function browserKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
}

async function addSubscriptions(count: number) {
  endpoints = []
  for (let i = 0; i < count; i++) {
    const endpoint = `https://fcm.googleapis.com/fcm/send/fam12-notify-${Date.now()}-${i}`
    const keys = browserKeys()
    const { error } = await svc().rpc('save_push_subscription', { p_user_id: USER_ID, p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth })
    if (error != null) throw new Error(error.message)
    endpoints.push(endpoint)
  }
}

async function subscriptionRows() {
  const { data, error } = await svc().from('guide_push_subscriptions').select('id, endpoint').eq('user_id', USER_ID)
  if (error != null) throw new Error(error.message)
  return data
}

async function pushEvents() {
  const { data, error } = await svc().from('inquiry_events').select('type, actor_kind, source, channel, payload')
    .eq('inquiry_id', INQ).eq('type', 'guide.request_push_sent')
  if (error != null) throw new Error(error.message)
  return data
}

function loggedText(): string {
  return logSpies.flatMap(spy => spy.mock.calls.flat()).map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join('\n')
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  if (USER_ID !== '') await s.from('guide_push_subscriptions').delete().eq('user_id', USER_ID)
  await s.from('guides').delete().in('id', [GUIDE, NO_LOGIN])
}

beforeAll(async () => {
  const s = svc()
  const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 })
  USER_ID = list?.users.find(u => u.email === LOGIN.email)?.id ?? ''
  if (USER_ID === '') {
    const { data, error } = await s.auth.admin.createUser({ email: LOGIN.email, password: LOGIN.password, email_confirm: true })
    if (error != null || data.user == null) throw new Error(error?.message ?? 'createUser failed')
    USER_ID = data.user.id
  }
  await sweep()
  const g = await s.from('guides').insert([
    { id: GUIDE,    full_name: 'Notify Fam12',   country: 'New Zealand', is_beta_listing: true, user_id: USER_ID },
    { id: NO_LOGIN, full_name: 'Nologin Fam12',  country: 'New Zealand', is_beta_listing: true },
  ])
  if (g.error != null) throw new Error(g.error.message)
})

afterAll(async () => {
  await sweep()
  if (USER_ID !== '') await svc().auth.admin.deleteUser(USER_ID)
})

beforeEach(async () => {
  logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => vi.spyOn(console, m))
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  const i = await s.from('inquiries').insert({ id: INQ, angler_name: 'FA-M.12 Test', angler_email: 'fam12-angler@seed.test', status: 'waiting_guide' })
  if (i.error != null) throw new Error(i.error.message)
  await s.from('guide_push_subscriptions').delete().eq('user_id', USER_ID)
})

afterEach(() => logSpies.forEach(spy => spy.mockRestore()))

describe('notifyGuideOfNewRequest', () => {
  it('pushes to every subscription of the guide’s login; a 410 one is deleted; one event with counts only', async () => {
    await addSubscriptions(3)
    const goneEndpoint = endpoints[1]
    const { sender, calls } = fakeSender(t => (t.endpoint === goneEndpoint ? 'gone' : 'sent'))

    const result = await notifyGuideOfNewRequest(svc(), job(), { config: VAPID, sender })
    expect(result).toEqual({ status: 'attempted', sent: 2, failed: 1, removed: 1 })

    expect(calls.map(c => c.target.endpoint).sort()).toEqual([...endpoints].sort())
    for (const call of calls) {
      expect(JSON.parse(call.payload)).toEqual({
        title: 'New request · New Zealand, 14–15 Jan',
        body:  '2 anglers. Tap to accept, decline or suggest dates.',
        url:   `/r/${TOKEN}`,
        tag:   `request-${REQUEST}`,
      })
    }

    const left = await subscriptionRows()
    expect(left.map(r => r.endpoint).sort()).toEqual(endpoints.filter(e => e !== goneEndpoint).sort())
    const { data: expired } = await svc().from('audit_log').select('operation, changed_by, new_data')
      .eq('table_name', 'guide_push_subscriptions').eq('operation', 'EXPIRE').eq('old_data->>user_id', USER_ID)
    expect(expired).toEqual([{ operation: 'EXPIRE', changed_by: null, new_data: { reason: 'push_service_gone' } }])

    const events = await pushEvents()
    expect(events).toEqual([{
      type: 'guide.request_push_sent', actor_kind: 'system', source: 'app', channel: 'app',
      payload: { request_id: REQUEST, guide_id: GUIDE, sent: 2, failed: 1, removed: 1 },
    }])
    const eventText = JSON.stringify(events)
    expect(eventText.includes(TOKEN)).toBe(false)
    for (const e of endpoints) expect(eventText.includes(e)).toBe(false)
    const logs = loggedText()
    expect(logs.includes(TOKEN)).toBe(false)
    for (const e of endpoints) expect(logs.includes(e)).toBe(false)
  })

  it('a sender that throws → every push counted failed, nothing deleted, never throws', async () => {
    await addSubscriptions(2)
    const sender: PushSender = { send: async () => { throw new Error('push service down') } }
    const result = await notifyGuideOfNewRequest(svc(), job(), { config: VAPID, sender })
    expect(result).toEqual({ status: 'attempted', sent: 0, failed: 2, removed: 0 })
    expect(await subscriptionRows()).toHaveLength(2)
    expect((await pushEvents()).map(e => e.payload)).toEqual([{ request_id: REQUEST, guide_id: GUIDE, sent: 0, failed: 2, removed: 0 }])
  })

  it('no subscriptions → nothing sent, no event (tj D3 A)', async () => {
    const { sender, calls } = fakeSender(() => 'sent')
    expect(await notifyGuideOfNewRequest(svc(), job(), { config: VAPID, sender })).toEqual({ status: 'no_subscriptions' })
    expect(calls).toHaveLength(0)
    expect(await pushEvents()).toEqual([])
  })

  it('a guide with no login linked → nothing sent, no event', async () => {
    const { sender, calls } = fakeSender(() => 'sent')
    expect(await notifyGuideOfNewRequest(svc(), job(NO_LOGIN), { config: VAPID, sender })).toEqual({ status: 'no_subscriptions' })
    expect(calls).toHaveLength(0)
  })

  it('VAPID keys absent → nothing sent, no event, one log line without values (per server instance)', async () => {
    await addSubscriptions(1)
    vi.resetModules()
    const fresh = await import('../guide-request-push')
    const { parseVapidConfig } = await import('../config')
    const { sender, calls } = fakeSender(() => 'sent')
    const off = parseVapidConfig({})
    expect(await fresh.notifyGuideOfNewRequest(svc(), job(), { config: off, sender })).toEqual({ status: 'push_off' })
    expect(await fresh.notifyGuideOfNewRequest(svc(), job(), { config: off, sender })).toEqual({ status: 'push_off' })
    expect(calls).toHaveLength(0)
    expect(await pushEvents()).toEqual([])
    const warns = logSpies[2].mock.calls
    expect(warns).toEqual([['[push] VAPID keys missing or malformed — web push is off (requests still go out on WhatsApp)']])
  })

  it('the event write failing (inquiry gone) → status error, never throws, log line has no token or endpoint', async () => {
    await addSubscriptions(1)
    await svc().from('inquiries').delete().eq('id', INQ)
    const { sender } = fakeSender(() => 'sent')
    expect(await notifyGuideOfNewRequest(svc(), job(), { config: VAPID, sender })).toEqual({ status: 'error' })
    const logs = loggedText()
    expect(logs).toContain(`[push] request ${REQUEST}: push failed at event`)
    expect(logs.includes(TOKEN)).toBe(false)
    expect(logs.includes(endpoints[0])).toBe(false)
  })
})
