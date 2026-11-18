/**
 * FA-M.10 — "Connect with Google": OAuth start and callback, Google sync, revoked consent, disconnect,
 * access to the token, and which Google fields FA asks for. LOCAL database only (src/tests/setup.ts).
 *
 * Google is scripted: every request to a Google host goes to `fakeGoogle` (anything unexpected throws),
 * so no test can reach the real Google. The database functions, constraints and audit rows are real.
 * Mocks: `@/lib/supabase/server` (session client for the signed-in test account, real service client),
 * `next/headers` cookies() (a jar per test), `next/cache`, the Google client config (test values).
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({
  sessionClient: null as unknown,
  jar: new Map<string, string>(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: (name: string, value: string) => { h.jar.set(name, value) },
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name) } : undefined),
  }),
  headers: async () => new Headers(),
}))
vi.mock('@/lib/env', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/env')>()
  return { ...real, env: { ...real.env, NEXT_PUBLIC_APP_URL: 'http://localhost:3000' } }
})
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
// Test OAuth client — synthetic values, not a real client.
vi.mock('@/lib/calendar/google', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/calendar/google')>()
  return {
    ...real,
    googleClientFromEnv: () => ({
      clientId: 'test-only-client-id.apps.example',
      clientSecret: 'test-only-client-secret',
      redirectUri: 'http://localhost:3000/api/calendar/google/callback',
    }),
  }
})

import { NextRequest } from 'next/server'
import { disconnectCalendar, startGoogleCalendarConnect } from '@/actions/calendar'
import { GET as callbackGET } from '@/app/api/calendar/google/callback/route'
import { startGoogleFromLink } from '@/app/connect-calendar/[token]/actions'
import ConnectCalendarDonePage from '@/app/connect-calendar/done/page'
import { CalendarConnectStatus } from '@/app/admin/inquiries/[id]/CalendarConnectStatus'
import { UnauthorizedError } from '@/lib/auth/guards'
import { calendarStatusByGuide, connectWithLink, issueConnectLink, syncAllCalendars } from '../connections'
import { finishGoogleConnect } from '../google-connect'
import { busyDaysFromGoogleEvents, type GoogleEvent } from '../google-events'
import { GOOGLE_CALENDAR_SCOPE, GOOGLE_EVENT_FIELDS, googleAuthUrl, listGoogleEvents } from '../google'
import { decryptCalendarLink, decryptGoogleToken, encryptCalendarLink, encryptGoogleToken } from '../link-crypto'
import { GOOGLE_STATE_COOKIE } from '../google-state-cookie'
import type { HopFn } from '../fetch'
import { TEST_CALENDAR_LINK_KEY } from './test-key'

type Db = SupabaseClient<Database>

const PREFIX = 'fam10-'
const GUIDE_A = 'ca1e0000-0000-4000-8000-0000000010a1'
const GUIDE_B = 'ca1e0000-0000-4000-8000-0000000010b2'
const EMAIL_A = `${PREFIX}guide-a@seed.test`
const EMAIL_B = `${PREFIX}guide-b@seed.test`
const PASSWORD = 'fam10-test-password-2026'
const ANGLER = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }
const ADMIN_ID = '00000000-0000-4000-8000-0000000010ad'
const NOW = new Date('2026-12-15T12:00:00Z')          // Oslo horizon 2026-12-15 → 2027-12-14

// Synthetic tokens — never real Google values.
const REFRESH_1 = 'test-refresh-token-ONE'
const REFRESH_2 = 'test-refresh-token-TWO'
const ACCESS = 'test-access-token'

// ─── the scripted Google ──────────────────────────────────────────────────────
const EVENTS: GoogleEvent[] = [
  // timed, busy, crosses midnight in Oslo → 10 and 11 Jan
  { start: { dateTime: '2027-01-10T22:30:00+01:00' }, end: { dateTime: '2027-01-11T01:00:00+01:00' } },
  // timed, "Available" → skipped
  { start: { dateTime: '2027-01-20T10:00:00+01:00' }, end: { dateTime: '2027-01-20T12:00:00+01:00' }, transparency: 'transparent' },
  // all-day, "Available" (Google's default for all-day) → still busy, three days
  { start: { date: '2027-02-01' }, end: { date: '2027-02-04' }, transparency: 'transparent' },
  // all-day, busy → one day
  { start: { date: '2027-03-05' }, end: { date: '2027-03-06' } },
  // ends exactly at midnight → only 1 Apr
  { start: { dateTime: '2027-04-01T20:00:00+02:00' }, end: { dateTime: '2027-04-02T00:00:00+02:00' } },
  // beyond the 12-month horizon → dropped
  { start: { date: '2028-06-01' }, end: { date: '2028-06-02' } },
]
const EXPECTED = ['2027-01-10', '2027-01-11', '2027-02-01', '2027-02-02', '2027-02-03', '2027-03-05', '2027-04-01']

const google = {
  calls: [] as { url: URL; body: string }[],
  exchange: { status: 200, json: { access_token: ACCESS, refresh_token: REFRESH_1, scope: GOOGLE_CALENDAR_SCOPE } } as { status: number; json: unknown },
  refresh: { status: 200, json: { access_token: ACCESS } } as { status: number; json: unknown },
  events: { status: 200, json: { timeZone: 'Europe/Oslo', items: EVENTS } } as { status: number; json: unknown },
  revoke: { status: 200, json: {} } as { status: number; json: unknown },
  reset() {
    this.calls = []
    this.exchange = { status: 200, json: { access_token: ACCESS, refresh_token: REFRESH_1, scope: GOOGLE_CALENDAR_SCOPE } }
    this.refresh = { status: 200, json: { access_token: ACCESS } }
    this.events = { status: 200, json: { timeZone: 'Europe/Oslo', items: EVENTS } }
    this.revoke = { status: 200, json: {} }
  },
  callsTo(path: string) {
    return this.calls.filter(c => c.url.pathname === path)
  },
}
const GOOGLE_HOSTS = ['oauth2.googleapis.com', 'www.googleapis.com', 'accounts.google.com']

async function fakeGoogle(url: URL, init: RequestInit | undefined): Promise<Response> {
  const body = typeof init?.body === 'string' ? init.body : ''
  google.calls.push({ url, body })
  const answer = (a: { status: number; json: unknown }) => new Response(JSON.stringify(a.json), { status: a.status })
  if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
    return answer(new URLSearchParams(body).get('grant_type') === 'refresh_token' ? google.refresh : google.exchange)
  }
  if (url.host === 'oauth2.googleapis.com' && url.pathname === '/revoke') return answer(google.revoke)
  if (url.host === 'www.googleapis.com' && url.pathname === '/calendar/v3/calendars/primary/events') return answer(google.events)
  throw new Error(`unexpected Google request: ${url.host}${url.pathname}`)
}

const realFetch = globalThis.fetch
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
  if (GOOGLE_HOSTS.includes(url.host)) return fakeGoogle(url, init)
  return realFetch(input, init)
})

// ─── database helpers ─────────────────────────────────────────────────────────
function svc(): Db {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
function anon(): Db {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function signedIn(email: string, password: string): Promise<Db> {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error != null) throw new Error(`sign-in failed for test account: ${error.message}`)
  return c
}

async function sweep() {
  const s = svc()
  for (const g of [GUIDE_A, GUIDE_B]) {
    const { data: links } = await s.from('guide_calendar_connect_links').select('id').eq('guide_id', g)
    const ids = (links ?? []).map(l => l.id)
    if (ids.length > 0) await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connect_links').in('record_id', ids)
    await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connections').eq('record_id', g)
    await s.from('guides').delete().eq('id', g)
  }
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) if (u.email?.startsWith(PREFIX)) await s.auth.admin.deleteUser(u.id)
}

async function createGuide(id: string, email: string): Promise<string> {
  const s = svc()
  const { data: user, error } = await s.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error != null || user.user == null) throw new Error(`createUser: ${error?.message}`)
  const ins = await s.from('guides').insert({ id, full_name: `Google Test ${id.slice(-2)}`, country: 'Norway', is_beta_listing: true, user_id: user.user.id })
  if (ins.error != null) throw new Error(ins.error.message)
  await s.from('profiles').update({ role: 'guide' }).eq('id', user.user.id)
  return user.user.id
}

async function connectionRow(guideId = GUIDE_A) {
  const { data } = await svc().from('guide_calendar_connections')
    .select('provider, status, last_error, link_host, link_ciphertext, token_ciphertext, connected_via')
    .eq('guide_id', guideId).maybeSingle()
  return data
}
async function busy(source: 'manual' | 'calendar', guideId = GUIDE_A): Promise<string[]> {
  const { data, error } = await svc().from('guide_unavailable_dates').select('date')
    .eq('guide_id', guideId).eq('source', source).order('date')
  if (error != null) throw new Error(error.message)
  return (data ?? []).map(r => r.date)
}
async function audit(operation: string, guideId = GUIDE_A) {
  const { data } = await svc().from('audit_log').select('operation, new_data, changed_by')
    .eq('table_name', 'guide_calendar_connections').eq('record_id', guideId).eq('operation', operation)
    .order('changed_at', { ascending: true })
  return data ?? []
}
async function stateRows(guideId = GUIDE_A) {
  const { data } = await svc().from('guide_calendar_oauth_states').select('entry, used_at').eq('guide_id', guideId)
  return data ?? []
}

function callback(query: Record<string, string>, cookie?: string): Promise<Response> {
  const url = new URL('http://localhost:3000/api/calendar/google/callback')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const headers = new Headers()
  if (cookie != null) headers.set('cookie', `${GOOGLE_STATE_COOKIE}=${cookie}`)
  return callbackGET(new NextRequest(url, { headers }))
}

/** Signed link → "Connect Google Calendar" → the state Google would send back, and the cookie. */
async function startFromLink(): Promise<{ state: string; token: string }> {
  const { token } = await issueConnectLink(svc(), GUIDE_A, ADMIN_ID)
  h.jar.clear()
  const res = await startGoogleFromLink(token)
  if (res.kind !== 'redirect') throw new Error(`start refused: ${res.kind}`)
  const state = new URL(res.url).searchParams.get('state')
  if (state == null || h.jar.get(GOOGLE_STATE_COOKIE) !== state) throw new Error('state cookie not set')
  return { state, token }
}

let userA: string
let sessionA: Db
let sessionB: Db
const savedKey = process.env.CALENDAR_LINK_KEY

beforeAll(async () => {
  process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
  await sweep()
  userA = await createGuide(GUIDE_A, EMAIL_A)
  await createGuide(GUIDE_B, EMAIL_B)
  sessionA = await signedIn(EMAIL_A, PASSWORD)
  sessionB = await signedIn(EMAIL_B, PASSWORD)
})
afterAll(async () => {
  await sweep()
  vi.unstubAllGlobals()
  if (savedKey == null) delete process.env.CALENDAR_LINK_KEY
  else process.env.CALENDAR_LINK_KEY = savedKey
})
beforeEach(async () => {
  process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
  google.reset()
  h.jar.clear()
  h.sessionClient = null
  const s = svc()
  for (const g of [GUIDE_A, GUIDE_B]) {
    await s.from('guide_calendar_connections').delete().eq('guide_id', g)
    await s.from('guide_unavailable_dates').delete().eq('guide_id', g)
    await s.from('guide_calendar_oauth_states').delete().eq('guide_id', g)
    await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connections').eq('record_id', g)
  }
})

/** Guide A connected to Google through the full link flow, plus two manual blocks. */
async function connectedA(): Promise<void> {
  await svc().from('guide_unavailable_dates').insert([
    { guide_id: GUIDE_A, date: '2027-05-01', source: 'manual' },
    { guide_id: GUIDE_A, date: '2027-01-10', source: 'manual' },
  ])
  const { state } = await startFromLink()
  const res = await callback({ state, code: 'test-auth-code' }, state)
  expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=connected')
  google.reset()
}

// ─── pure: busy-day rule and fields ──────────────────────────────────────────

describe('Google events → busy days (same rule as Apple)', () => {
  it('timed busy blocks and all-day events (also "Available") are busy; timed "Available" and out-of-horizon are not', () => {
    const { dates, zone } = busyDaysFromGoogleEvents({ events: EVENTS, guideCountry: 'Norway', calendarZone: null, now: NOW })
    expect(zone).toBe('Europe/Oslo')
    expect(dates).toEqual(EXPECTED)
  })

  it('without a country the calendar zone decides (D3 a): a late-evening Oslo event is not the next UTC day', () => {
    const late: GoogleEvent[] = [{ start: { dateTime: '2027-01-10T23:30:00+01:00' }, end: { dateTime: '2027-01-10T23:50:00+01:00' } }]
    expect(busyDaysFromGoogleEvents({ events: late, guideCountry: null, calendarZone: 'Europe/Oslo', now: NOW }).dates).toEqual(['2027-01-10'])
    expect(busyDaysFromGoogleEvents({ events: late, guideCountry: null, calendarZone: null, now: NOW }).dates).toEqual(['2027-01-10'])
  })
})

describe('what FA asks Google for', () => {
  it('the consent URL asks for calendar.events.freebusy only, offline, with the state', () => {
    const url = new URL(googleAuthUrl({ clientId: 'c', clientSecret: 's', redirectUri: 'http://localhost:3000/api/calendar/google/callback' }, 'STATE'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events.freebusy')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('state')).toBe('STATE')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/calendar/google/callback')
    expect(url.searchParams.has('client_secret')).toBe(false)
  })

  it('the event list asks only for start, end, busy/free and the calendar zone — never titles, descriptions, attendees, locations', async () => {
    await listGoogleEvents(ACCESS, '2026-12-14T00:00:00Z', '2027-12-16T00:00:00Z')
    const [call] = google.callsTo('/calendar/v3/calendars/primary/events')
    expect(call.url.searchParams.get('fields')).toBe(GOOGLE_EVENT_FIELDS)
    expect(GOOGLE_EVENT_FIELDS).toBe('nextPageToken,timeZone,items(start(date,dateTime),end(date,dateTime),transparency)')
    expect(GOOGLE_EVENT_FIELDS).not.toMatch(/summary|description|attendees|location|organizer|creator/)
    expect(call.url.searchParams.get('singleEvents')).toBe('true')
  })

  it('a response with extra fields keeps only start / end / transparency', async () => {
    google.events = { status: 200, json: { items: [{ start: { date: '2027-03-05' }, end: { date: '2027-03-06' }, summary: 'SYNTHETIC TITLE', location: 'X' }] } }
    const listed = await listGoogleEvents(ACCESS, '2026-12-14T00:00:00Z', '2027-12-16T00:00:00Z')
    expect(listed.ok && JSON.stringify(listed.events)).toBe('[{"start":{"date":"2027-03-05"},"end":{"date":"2027-03-06"}}]')
  })
})

describe('token encryption — purpose labels (tj STOP 1, 2)', () => {
  const key = Buffer.from(TEST_CALENDAR_LINK_KEY, 'base64')
  it('a Google token decrypts as a Google token only; an Apple link as an Apple link only', () => {
    const tokenBlob = encryptGoogleToken(REFRESH_1, key)
    const linkBlob = encryptCalendarLink('https://p00-caldav.icloud.example/published/2/SYNTHETIC', key)
    expect(decryptGoogleToken(tokenBlob, key)).toBe(REFRESH_1)
    expect(decryptCalendarLink(linkBlob, key)).toBe('https://p00-caldav.icloud.example/published/2/SYNTHETIC')
    expect(decryptCalendarLink(tokenBlob, key)).toBeNull()
    expect(decryptGoogleToken(linkBlob, key)).toBeNull()
  })
})

// ─── access to the token ────────────────────────────────────────────────────

describe('the refresh token is not readable by anon / authenticated', () => {
  it('anon, guide (own row) and angler sessions are refused on the connection and the OAuth states', async () => {
    await connectedA()
    expect((await connectionRow())?.token_ciphertext).toMatch(/^v1:/)
    const angler = await signedIn(ANGLER.email, ANGLER.password)
    for (const [who, c] of [['anon', anon()], ['guide', sessionA], ['angler', angler]] as const) {
      const conn = await c.from('guide_calendar_connections').select('token_ciphertext').eq('guide_id', GUIDE_A)
      expect(conn.error?.code, `${who} connections`).toBe('42501')
      expect(conn.data, `${who} connections`).toBeNull()
      const states = await c.from('guide_calendar_oauth_states').select('state_hash')
      expect(states.error?.code, `${who} states`).toBe('42501')
    }
  })

  it('anon and guide sessions cannot execute the new functions', async () => {
    for (const c of [anon(), sessionA]) {
      const take = await c.rpc('take_google_calendar_state', { p_state_hash: 'a'.repeat(64) })
      expect(take.error?.code).toBe('42501')
      const disc = await c.rpc('disconnect_calendar', { p_guide_id: GUIDE_A, p_actor: userA })
      expect(disc.error?.code).toBe('42501')
      const conn = await c.rpc('connect_google_calendar', { p_guide_id: GUIDE_A, p_ciphertext: 'v1:a:b:c', p_dates: [] })
      expect(conn.error?.code).toBe('42501')
    }
  })
})

// ─── OAuth callback ─────────────────────────────────────────────────────────

describe('callback: the state protects the flow', () => {
  it('connect from the signed link → busy days with source calendar, link used, audit row, landing "connected"', async () => {
    const { state, token } = await startFromLink()
    expect(await stateRows()).toEqual([{ entry: 'link', used_at: null }])
    const res = await callback({ state, code: 'test-auth-code' }, state)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=connected')
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${GOOGLE_STATE_COOKIE}=;`))

    expect(await busy('calendar')).toEqual(EXPECTED)
    const row = await connectionRow()
    expect(row).toMatchObject({ provider: 'google', status: 'ok', link_host: 'calendar.google.com', link_ciphertext: null })
    expect(row?.token_ciphertext).toMatch(/^v1:/)
    expect(row?.token_ciphertext).not.toContain(REFRESH_1)
    const key = Buffer.from(TEST_CALENDAR_LINK_KEY, 'base64')
    expect(decryptGoogleToken(row!.token_ciphertext!, key)).toBe(REFRESH_1)

    const { data: link } = await svc().from('guide_calendar_connect_links').select('used_at').eq('guide_id', GUIDE_A).order('created_at', { ascending: false }).limit(1).single()
    expect(link?.used_at).not.toBeNull()
    expect(await startGoogleFromLink(token)).toEqual({ kind: 'refused' })

    const [connect] = await audit('CONNECT')
    expect(connect.new_data).toMatchObject({ provider: 'google', entry: 'link', busy_days: EXPECTED.length, replaced: false })
    expect(JSON.stringify(connect.new_data)).not.toMatch(/test-refresh|test-access|test-auth-code|v1:/)

    // the code went to Google's token endpoint once; nothing else but the event list
    expect(google.callsTo('/token')).toHaveLength(1)
    expect(new URLSearchParams(google.callsTo('/token')[0].body).get('redirect_uri')).toBe('http://localhost:3000/api/calendar/google/callback')
  })

  it('RED: missing state → refused, nothing stored, Google never called', async () => {
    const { state } = await startFromLink()
    const res = await callback({ code: 'test-auth-code' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toBeNull()
    expect(await busy('calendar')).toEqual([])
    expect(await stateRows()).toEqual([{ entry: 'link', used_at: null }])
    expect(google.calls).toHaveLength(0)
  })

  it('RED: tampered state (one character changed, cookie unchanged) → refused, nothing stored, Google never called', async () => {
    const { state } = await startFromLink()
    const tampered = (state[0] === 'A' ? 'B' : 'A') + state.slice(1)
    const res = await callback({ state: tampered, code: 'test-auth-code' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toBeNull()
    expect(await busy('calendar')).toEqual([])
    expect(google.calls).toHaveLength(0)
  })

  it('RED: forged state with a matching cookie (not issued by FA) → refused by the database, nothing stored', async () => {
    await startFromLink()
    const forged = 'f'.repeat(43)
    const res = await callback({ state: forged, code: 'test-auth-code' }, forged)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toBeNull()
    expect(google.calls).toHaveLength(0)
  })

  it('RED: a state from another browser (no cookie) → refused, nothing stored', async () => {
    const { state } = await startFromLink()
    const res = await callback({ state, code: 'test-auth-code' })
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toBeNull()
  })

  it('RED: replay — the same state a second time is refused and changes nothing', async () => {
    const { state } = await startFromLink()
    await callback({ state, code: 'test-auth-code' }, state)
    const before = await connectionRow()
    google.reset()
    google.exchange = { status: 200, json: { access_token: ACCESS, refresh_token: REFRESH_2, scope: GOOGLE_CALENDAR_SCOPE } }
    const res = await callback({ state, code: 'test-auth-code-2' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toEqual(before)
    expect(google.calls).toHaveLength(0)
  })

  it('the guide presses Cancel on Google → landing "denied", nothing stored, the link still works', async () => {
    const { state, token } = await startFromLink()
    const res = await callback({ state, error: 'access_denied' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=denied')
    expect(await connectionRow()).toBeNull()
    expect((await startGoogleFromLink(token)).kind).toBe('redirect')
  })

  it('the guide unticks the calendar permission → error, nothing stored', async () => {
    const { state } = await startFromLink()
    google.exchange = { status: 200, json: { access_token: ACCESS, refresh_token: REFRESH_1, scope: 'openid' } }
    const res = await callback({ state, code: 'test-auth-code' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=error')
    expect(await connectionRow()).toBeNull()
  })

  it('an open-redirect attempt cannot change where the guide lands', async () => {
    const { state } = await startFromLink()
    const res = await callback({ state, code: 'test-auth-code', redirect: 'https://evil.example', next: '//evil.example' }, state)
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect-calendar/done?status=connected')
  })

  it('start from the guide session → lands on /dashboard/calendar; another guide finishing it is refused', async () => {
    h.sessionClient = sessionA
    const started = await startGoogleCalendarConnect()
    if (!started.success) throw new Error(started.error)
    const state = new URL(started.url).searchParams.get('state')!
    expect(await stateRows()).toEqual([{ entry: 'session', used_at: null }])

    h.sessionClient = sessionB                     // guide B's browser holds A's state and cookie
    const refused = await callback({ state, code: 'test-auth-code' }, state)
    expect(refused.headers.get('location')).toBe('http://localhost:3000/dashboard/calendar?google=error')
    expect(await connectionRow()).toBeNull()

    h.sessionClient = sessionA
    h.jar.clear()
    const again = await startGoogleCalendarConnect()
    if (!again.success) throw new Error(again.error)
    const state2 = new URL(again.url).searchParams.get('state')!
    const ok = await callback({ state: state2, code: 'test-auth-code' }, state2)
    expect(ok.headers.get('location')).toBe('http://localhost:3000/dashboard/calendar?google=connected')
    const [connect] = await audit('CONNECT')
    expect(connect.new_data).toMatchObject({ provider: 'google', entry: 'session', link_id: null })
  })

  it('an expired state is refused (database)', async () => {
    const { state } = await startFromLink()
    await svc().from('guide_calendar_oauth_states').update({ created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-01T00:10:00Z' }).eq('guide_id', GUIDE_A)
    const out = await finishGoogleConnect(svc(), { state, code: 'test-auth-code' }, { sessionGuideId: null })
    expect(out).toEqual({ kind: 'refused', entry: null })
    expect(await connectionRow()).toBeNull()
  })
})

// ─── sync, revoked consent ────────────────────────────────────────────────

describe('sync through the cron path', () => {
  const deps = { now: NOW, guideIds: [GUIDE_A] }

  it('refreshes the access token and replaces the calendar busy days; manual blocks stay', async () => {
    await connectedA()
    google.events = { status: 200, json: { items: [{ start: { date: '2027-06-01' }, end: { date: '2027-06-03' } }] } }
    const summary = await syncAllCalendars(svc(), deps)
    expect(summary).toMatchObject({ total: 1, ok: 1, failed: 0, disconnected: 0 })
    expect(await busy('calendar')).toEqual(['2027-06-01', '2027-06-02'])
    expect(await busy('manual')).toEqual(['2027-01-10', '2027-05-01'])
    expect(new URLSearchParams(google.callsTo('/token')[0].body).get('refresh_token')).toBe(REFRESH_1)
  })

  it('RED: invalid_grant → "disconnected", token cleared, calendar days kept, audit row, admin shows it, cron skips it', async () => {
    await connectedA()
    google.refresh = { status: 400, json: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }
    const summary = await syncAllCalendars(svc(), deps)
    expect(summary).toMatchObject({ total: 1, ok: 0, disconnected: 1 })

    const row = await connectionRow()
    expect(row).toMatchObject({ provider: 'google', status: 'disconnected', last_error: 'invalid_grant', token_ciphertext: null })
    expect(await busy('calendar')).toEqual(EXPECTED)
    expect(await busy('manual')).toEqual(['2027-01-10', '2027-05-01'])
    const [ev] = await audit('SYNC_DISCONNECTED')
    expect(ev.new_data).toMatchObject({ provider: 'google', error: 'invalid_grant' })

    const status = (await calendarStatusByGuide(svc(), [GUIDE_A])).get(GUIDE_A)!
    expect(status.status).toBe('disconnected')
    const html = renderToStaticMarkup(createElement(CalendarConnectStatus, { guideId: GUIDE_A, calendar: status }))
    expect(html).toContain('Google Calendar disconnected')
    expect(html).toContain('busy days kept')

    google.reset()
    const next = await syncAllCalendars(svc(), deps)
    expect(next.total).toBe(0)
    expect(google.calls).toHaveLength(0)
  })

  it('a Google outage is an error, not a disconnect: days and token kept', async () => {
    await connectedA()
    google.events = { status: 503, json: {} }
    await syncAllCalendars(svc(), deps)
    const row = await connectionRow()
    expect(row).toMatchObject({ status: 'error', last_error: 'http_error' })
    expect(row?.token_ciphertext).toMatch(/^v1:/)
    expect(await busy('calendar')).toEqual(EXPECTED)
  })
})

// ─── disconnect, replacement, revoke ────────────────────────────────────────

describe('disconnect (server action, guide session)', () => {
  it('removes the token and the calendar days, keeps manual ones, audit row, revokes at Google', async () => {
    await connectedA()
    h.sessionClient = sessionA
    expect(await disconnectCalendar(GUIDE_A)).toEqual({ success: true, provider: 'google', busyDaysRemoved: EXPECTED.length })
    expect(await connectionRow()).toBeNull()
    expect(await busy('calendar')).toEqual([])
    expect(await busy('manual')).toEqual(['2027-01-10', '2027-05-01'])
    const [ev] = await audit('DISCONNECT')
    expect(ev).toMatchObject({ changed_by: userA, new_data: { provider: 'google', busy_days_removed: EXPECTED.length } })
    const revokes = google.callsTo('/revoke')
    expect(revokes).toHaveLength(1)
    expect(new URLSearchParams(revokes[0].body).get('token')).toBe(REFRESH_1)
  })

  it('RED: signed-in guide B disconnecting guide A is refused; nothing changes; Google not called', async () => {
    await connectedA()
    const before = await connectionRow()
    h.sessionClient = sessionB
    await expect(disconnectCalendar(GUIDE_A)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await connectionRow()).toEqual(before)
    expect(await busy('calendar')).toEqual(EXPECTED)
    expect(await audit('DISCONNECT')).toEqual([])
    expect(google.calls).toHaveLength(0)
  })

  it('RED: no session → refused', async () => {
    await connectedA()
    h.sessionClient = anon()
    await expect(disconnectCalendar(GUIDE_A)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await connectionRow()).not.toBeNull()
  })

  it('a failed revoke does not block the local disconnect', async () => {
    await connectedA()
    google.revoke = { status: 500, json: {} }
    h.sessionClient = sessionA
    const res = await disconnectCalendar(GUIDE_A)
    expect(res).toMatchObject({ success: true, provider: 'google' })
    expect(await connectionRow()).toBeNull()
    expect(google.callsTo('/revoke')).toHaveLength(1)
  })

  it('disconnecting a guide whose Google access was already revoked works, without calling Google', async () => {
    await connectedA()
    google.refresh = { status: 400, json: { error: 'invalid_grant' } }
    await syncAllCalendars(svc(), { now: NOW, guideIds: [GUIDE_A] })
    google.reset()
    h.sessionClient = sessionA
    expect(await disconnectCalendar(GUIDE_A)).toMatchObject({ success: true, provider: 'google' })
    expect(await busy('calendar')).toEqual([])
    expect(google.calls).toHaveLength(0)
  })
})

describe('one calendar per guide: replacement and revoke (tj STOP 3)', () => {
  it('Google → Google: the token is overwritten and Google is NOT asked to revoke', async () => {
    await connectedA()
    google.exchange = { status: 200, json: { access_token: ACCESS, refresh_token: REFRESH_2, scope: GOOGLE_CALENDAR_SCOPE } }
    const { state } = await startFromLink()
    await callback({ state, code: 'test-auth-code-2' }, state)
    const key = Buffer.from(TEST_CALENDAR_LINK_KEY, 'base64')
    expect(decryptGoogleToken((await connectionRow())!.token_ciphertext!, key)).toBe(REFRESH_2)
    expect(google.callsTo('/revoke')).toHaveLength(0)
    const connects = await audit('CONNECT')
    expect(connects.at(-1)?.new_data).toMatchObject({ replaced: true, previous_provider: 'google' })
  })

  it('Google → Apple: Apple replaces the connection and the Google grant is revoked', async () => {
    await connectedA()
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:a@fixture.test', 'DTSTAMP:20261101T000000Z',
      'DTSTART;VALUE=DATE:20270710', 'DTEND;VALUE=DATE:20270711', 'END:VEVENT', 'END:VCALENDAR'].join('\n')
    const hop: HopFn = async () => ({ status: 200, location: null, body: Buffer.from(ics) })
    const { token } = await issueConnectLink(svc(), GUIDE_A, ADMIN_ID)
    const out = await connectWithLink(svc(), token, 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-G2A', { fetch: { hop }, now: NOW })
    expect(out).toEqual({ kind: 'connected', busyDays: 1 })
    const row = await connectionRow()
    expect(row).toMatchObject({ provider: 'apple_ics', token_ciphertext: null })
    expect(await busy('calendar')).toEqual(['2027-07-10'])
    const revokes = google.callsTo('/revoke')
    expect(revokes).toHaveLength(1)
    expect(new URLSearchParams(revokes[0].body).get('token')).toBe(REFRESH_1)
    const connects = await audit('CONNECT')
    expect(connects.at(-1)?.new_data).toMatchObject({ provider: 'apple_ics', previous_provider: 'google' })
  })

  it('Apple → Google: the Apple link and its days are replaced in one step', async () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:b@fixture.test', 'DTSTAMP:20261101T000000Z',
      'DTSTART;VALUE=DATE:20270910', 'DTEND;VALUE=DATE:20270911', 'END:VEVENT', 'END:VCALENDAR'].join('\n')
    const hop: HopFn = async () => ({ status: 200, location: null, body: Buffer.from(ics) })
    const { token } = await issueConnectLink(svc(), GUIDE_A, ADMIN_ID)
    await connectWithLink(svc(), token, 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-A2G', { fetch: { hop }, now: NOW })
    expect(await busy('calendar')).toEqual(['2027-09-10'])
    const { state } = await startFromLink()
    await callback({ state, code: 'test-auth-code' }, state)
    expect(await connectionRow()).toMatchObject({ provider: 'google', link_ciphertext: null })
    expect(await busy('calendar')).toEqual(EXPECTED)
    expect(google.callsTo('/revoke')).toHaveLength(0)
  })
})

describe('the database keeps one secret per provider', () => {
  it('RED: a Google row without a token, or an Apple row with one, is rejected', async () => {
    const s = svc()
    const noToken = await s.from('guide_calendar_connections').insert({ guide_id: GUIDE_A, provider: 'google', link_host: 'calendar.google.com' })
    expect(noToken.error?.message).toMatch(/secret_per_provider/)
    const both = await s.from('guide_calendar_connections').insert({ guide_id: GUIDE_A, provider: 'apple_ics', link_host: 'p00-caldav.icloud.example', link_ciphertext: 'v1:a:b:c', token_ciphertext: 'v1:a:b:c' })
    expect(both.error?.message).toMatch(/secret_per_provider/)
    const disconnectedApple = await s.from('guide_calendar_connections').insert({ guide_id: GUIDE_A, provider: 'apple_ics', link_host: 'p00-caldav.icloud.example', link_ciphertext: 'v1:a:b:c', status: 'disconnected', last_error: 'invalid_grant' })
    expect(disconnectedApple.error?.message).toMatch(/disconnected_is_google_grant/)
  })
})

describe('landing page /connect-calendar/done', () => {
  it('shows only the status; an unknown status reads as an error', async () => {
    for (const [status, text] of [['connected', 'Google Calendar connected'], ['denied', 'Nothing was connected'], ['error', 'That didn’t work'], ['<script>', 'That didn’t work']] as const) {
      const html = renderToStaticMarkup(await ConnectCalendarDonePage({ searchParams: Promise.resolve({ status }) }))
      expect(html).toContain(text)
      expect(html).not.toContain('<script>')
    }
  })
})
