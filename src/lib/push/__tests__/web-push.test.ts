/**
 * FA-M.12 — web push units: endpoint allowlist, VAPID config, the web-push sender's outcome
 * mapping (no network: `sendNotification` is replaced), and the real request web-push would send
 * (built locally with generateRequestDetails — encrypted, VAPID-signed, never sent).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'

// A plain recorder, not vi.fn(): Vitest reports an error thrown by a reset vi.fn() implementation
// even when the code under test catches it, which is exactly what these tests exercise.
let sendImpl: (...args: unknown[]) => Promise<unknown> = async () => ({})
const sendCalls: unknown[][] = []
const sendNotification = (...args: unknown[]) => { sendCalls.push(args); return sendImpl(...args) }
vi.mock('web-push', async importOriginal => {
  // web-push is CommonJS: its functions sit on the default export.
  const actual = await importOriginal<typeof import('web-push') & { default: typeof import('web-push') }>()
  const lib = { ...actual.default, sendNotification: (...args: unknown[]) => sendNotification(...args) }
  return { ...lib, default: lib }
})

import { generateVAPIDKeys, generateRequestDetails, WebPushError } from 'web-push'
import { isAllowedPushEndpoint, pushSubscriptionSchema } from '../subscription'
import { parseVapidConfig } from '../config'
import { pushRequestOptions, webPushSender } from '../sender'

function browserKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
}

function testVapid() {
  const keys = generateVAPIDKeys()   // throwaway, generated per run — never a real key
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:push-test@seed.test' }
}

describe('isAllowedPushEndpoint — https on a known push service only', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QAbc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('accepts %s', endpoint => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/fcm/send/x',
    'https://evil.example.com/fcm/send/x',
    'https://fcm.googleapis.com.evil.example.com/x',
    'https://evilpush.apple.com/x',
    'https://push.apple.com.evil.example.com/x',
    'https://user:pw@fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://localhost/x',
    'https://fcm.googleapis.com/',
    'ftp://fcm.googleapis.com/x',
    'not a url',
    '',
  ])('refuses %s', endpoint => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false)
  })

  it('the schema drops extra fields and refuses malformed keys', () => {
    const keys = browserKeys()
    const ok = pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', expirationTime: null, keys })
    expect(ok.success && ok.data).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys })
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { ...keys, auth: 'a b' } }).success).toBe(false)
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x' }).success).toBe(false)
  })
})

describe('parseVapidConfig', () => {
  it('push is off when any key is missing or malformed', () => {
    const v = testVapid()
    expect(parseVapidConfig({})).toEqual({ ok: false })
    expect(parseVapidConfig({ VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: v.privateKey })).toEqual({ ok: false })
    expect(parseVapidConfig({ VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: 'short', VAPID_SUBJECT: v.subject })).toEqual({ ok: false })
    expect(parseVapidConfig({ VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: v.privateKey, VAPID_SUBJECT: 'push-test@seed.test' })).toEqual({ ok: false })
  })

  it('on with all three well-formed', () => {
    const v = testVapid()
    expect(parseVapidConfig({ VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: v.privateKey, VAPID_SUBJECT: v.subject }))
      .toEqual({ ok: true, ...v })
  })
})

describe('webPushSender — outcome mapping', () => {
  beforeEach(() => { sendCalls.length = 0; sendImpl = async () => ({}) })

  const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: browserKeys() }

  it('2xx → sent, with the VAPID options, a 24 h TTL, high urgency and a 5 s timeout', async () => {
    sendImpl = async () => ({ statusCode: 201, body: '', headers: {} })
    const v = testVapid()
    expect(await webPushSender(v).send(target, '{"title":"t"}')).toBe('sent')
    expect(sendCalls).toEqual([[target, '{"title":"t"}', {
      vapidDetails: v, TTL: 86_400, urgency: 'high', timeout: 5_000,
    }]])
  })

  it.each([404, 410])('%i → gone', async status => {
    sendImpl = (async () => { throw new WebPushError('Received unexpected response code', status, {}, '', target.endpoint) })
    expect(await webPushSender(testVapid()).send(target, '{}')).toBe('gone')
  })

  it.each([400, 413, 429, 500])('%i → failed (kept)', async status => {
    sendImpl = (async () => { throw new WebPushError('Received unexpected response code', status, {}, '', target.endpoint) })
    expect(await webPushSender(testVapid()).send(target, '{}')).toBe('failed')
  })

  it('a network error → failed, never thrown', async () => {
    sendImpl = (async () => { throw new Error('ECONNRESET') })
    expect(await webPushSender(testVapid()).send(target, '{}')).toBe('failed')
  })
})

describe('the request web-push builds from our options (local, not sent)', () => {
  it('POST to the endpoint, aes128gcm-encrypted body, VAPID authorization, TTL and urgency headers', () => {
    const v = testVapid()
    const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: browserKeys() }
    const payload = JSON.stringify({ title: 'New request · Taupō, 14–15 Jan', url: '/r/abc' })
    const details = generateRequestDetails(target, payload, pushRequestOptions(v))

    expect(details.method).toBe('POST')
    expect(details.endpoint).toBe(target.endpoint)
    expect(details.headers['Content-Encoding']).toBe('aes128gcm')
    expect(details.headers.TTL).toBe(86_400)
    expect(details.headers.Urgency).toBe('high')
    expect(String(details.headers.Authorization)).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${v.publicKey}$`))
    // Encrypted: the plaintext (and so the /r/ path) is not in the body.
    const body = Buffer.from(details.body as Buffer)
    expect(body.includes(Buffer.from('/r/abc'))).toBe(false)
    expect(body.includes(Buffer.from('Taup'))).toBe(false)
  })
})
