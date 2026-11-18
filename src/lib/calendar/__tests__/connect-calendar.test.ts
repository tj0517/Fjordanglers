/**
 * FA-M.09 — signed "connect calendar" link, its page, access to the new tables, the admin action,
 * the cron route and the guide's own availability actions. LOCAL database only.
 *
 * Mocks: `@/lib/supabase/server` — createClient() returns a real supabase-js session client for the
 * account the test signs in; createServiceClient() a real service client. Nothing else is mocked
 * except the calendar server (scripted hop) and next/cache.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-only-cron-secret'
  return { sessionClient: null as unknown }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
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

// The cron route's success path is checked through a spy: a real "sync every calendar" would reach
// the guides of other test files running in parallel on the same database (the real sync is covered,
// per guide, in calendar-sync.test.ts). The 401 and 503 cases fail before any read and stay real.
vi.mock('@/lib/calendar/connections', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/calendar/connections')>()
  return { ...real, syncAllCalendars: vi.fn(real.syncAllCalendars) }
})

import { NextRequest } from 'next/server'
import { issueCalendarConnectLink } from '@/actions/calendar'
import { setAvailability, setOpenSeason } from '@/actions/availability'
import { GET as cronGET } from '@/app/api/cron/calendar-sync/route'
import ConnectCalendarPage from '@/app/connect-calendar/[token]/page'
import { connectCalendar } from '@/app/connect-calendar/[token]/actions'
import { UnauthorizedError } from '@/lib/auth/guards'
import { connectLinkRefusal, connectWithLink, issueConnectLink, syncAllCalendars } from '../connections'
import { hashCalendarConnectToken } from '../connect-token'
import type { HopFn } from '../fetch'
import { CALENDAR_DISABLED_MESSAGE } from '../link-crypto'
import { TEST_CALENDAR_LINK_KEY } from './test-key'

type Db = SupabaseClient<Database>

const GUIDE = 'ca1e0000-0000-4000-8000-0000000000c1'
const PREFIX = 'fam09-'
const GUIDE_EMAIL = `${PREFIX}guide@seed.test`
const PASSWORD = 'fam09-test-password-2026'
const ADMIN = { email: 'admin@seed.test', password: 'seed-admin-password-2026' }
const ANGLER = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }
const LINK = 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-CONNECT-SECRET'
const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:c1@fixture.test', 'DTSTAMP:20261101T000000Z',
  'DTSTART;VALUE=DATE:20270310', 'DTEND;VALUE=DATE:20270312', 'SUMMARY:Synthetic', 'END:VEVENT',
  'END:VCALENDAR',
].join('\n')
const hop: HopFn = async () => ({ status: 200, location: null, body: Buffer.from(ICS) })
const deps = { fetch: { hop }, now: new Date('2026-12-15T12:00:00Z') }

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
  const { data: links } = await s.from('guide_calendar_connect_links').select('id').eq('guide_id', GUIDE)
  const ids = (links ?? []).map(l => l.id)
  if (ids.length > 0) await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connect_links').in('record_id', ids)
  await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connections').eq('record_id', GUIDE)
  await s.from('guides').delete().eq('id', GUIDE)
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) if (u.email?.startsWith(PREFIX)) await s.auth.admin.deleteUser(u.id)
}

let guideSession: Db

const savedKey = process.env.CALENDAR_LINK_KEY
beforeAll(async () => {
  process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
  await sweep()
  const s = svc()
  const { data: user, error } = await s.auth.admin.createUser({ email: GUIDE_EMAIL, password: PASSWORD, email_confirm: true })
  if (error != null || user.user == null) throw new Error(`createUser: ${error?.message}`)
  const ins = await s.from('guides').insert({ id: GUIDE, full_name: 'Connect Test', country: 'Iceland', is_beta_listing: true, user_id: user.user.id })
  if (ins.error != null) throw new Error(ins.error.message)
  await s.from('profiles').update({ role: 'guide' }).eq('id', user.user.id)
  guideSession = await signedIn(GUIDE_EMAIL, PASSWORD)
})
afterAll(async () => {
  await sweep()
  if (savedKey == null) delete process.env.CALENDAR_LINK_KEY
  else process.env.CALENDAR_LINK_KEY = savedKey
})
beforeEach(async () => {
  process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
  await svc().from('guide_calendar_connections').delete().eq('guide_id', GUIDE)
  await svc().from('guide_unavailable_dates').delete().eq('guide_id', GUIDE)
})

async function freshToken(): Promise<string> {
  return (await issueConnectLink(svc(), GUIDE, '00000000-0000-4000-8000-0000000000ad')).token
}
async function connectionRow() {
  const { data } = await svc().from('guide_calendar_connections').select('guide_id').eq('guide_id', GUIDE).maybeSingle()
  return data
}

// ─── signed link ─────────────────────────────────────────────────────────────

describe('the signed link works once and expires', () => {
  it('a fresh link is usable; connecting uses it; the second use is refused', async () => {
    const token = await freshToken()
    expect(await connectLinkRefusal(svc(), token)).toBeNull()
    expect(await connectWithLink(svc(), token, LINK, deps)).toEqual({ kind: 'connected', busyDays: 2 })
    expect(await connectLinkRefusal(svc(), token)).toBe('used')
    expect(await connectWithLink(svc(), token, LINK, deps)).toEqual({ kind: 'refused', reason: 'used' })
  })

  it('RED: an expired link is refused and writes nothing', async () => {
    const token = await freshToken()
    await svc().from('guide_calendar_connect_links')
      .update({ created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-08T00:00:00Z' })
      .eq('token_hash', hashCalendarConnectToken(token))
    expect(await connectLinkRefusal(svc(), token)).toBe('expired')
    expect(await connectWithLink(svc(), token, LINK, deps)).toEqual({ kind: 'refused', reason: 'expired' })
    expect(await connectionRow()).toBeNull()
  })

  it('RED: issuing a new link revokes the unused one', async () => {
    const first = await freshToken()
    await freshToken()
    expect(await connectLinkRefusal(svc(), first)).toBe('revoked')
  })

  it('RED: a wrong or malformed token → not_found, nothing written', async () => {
    expect(await connectLinkRefusal(svc(), 'A'.repeat(43))).toBe('not_found')
    expect(await connectLinkRefusal(svc(), 'short')).toBe('not_found')
    expect(await connectWithLink(svc(), 'A'.repeat(43), LINK, deps)).toEqual({ kind: 'refused', reason: 'not_found' })
    expect(await connectionRow()).toBeNull()
  })

  it('only the hash is stored; issue writes an ISSUE audit row without the token', async () => {
    const token = await freshToken()
    const { data } = await svc().from('guide_calendar_connect_links').select('id, token_hash').eq('token_hash', hashCalendarConnectToken(token)).single()
    expect(data?.token_hash).toMatch(/^[0-9a-f]{64}$/)
    const { data: rows } = await svc().from('audit_log').select('operation, new_data').eq('record_id', data!.id)
    expect(rows?.map(r => r.operation)).toEqual(['ISSUE'])
    expect(JSON.stringify(rows)).not.toContain(token)
  })
})

describe('the page', () => {
  it('RED: a wrong link renders not-found — no guide data', async () => {
    await expect(ConnectCalendarPage({ params: Promise.resolve({ token: 'A'.repeat(43) }) }))
      .rejects.toMatchObject({ digest: expect.stringContaining('404') })
  })

  it('RED: a used link renders not-found', async () => {
    const token = await freshToken()
    await connectWithLink(svc(), token, LINK, deps)
    await expect(ConnectCalendarPage({ params: Promise.resolve({ token }) }))
      .rejects.toMatchObject({ digest: expect.stringContaining('404') })
  })

  it('opening a valid link writes nothing and does not use it up', async () => {
    const token = await freshToken()
    const el = await ConnectCalendarPage({ params: Promise.resolve({ token }) })
    expect(JSON.stringify(el)).not.toContain('Connect Test')
    expect(await connectLinkRefusal(svc(), token)).toBeNull()
  })

  it('RED: a link to a private address is refused; the link stays usable, nothing stored', async () => {
    const token = await freshToken()
    expect(await connectCalendar(token, 'https://127.0.0.1/calendar.ics')).toEqual({ kind: 'fetch_failed', error: 'blocked_address' })
    expect(await connectCalendar(token, 'https://localhost/calendar.ics')).toEqual({ kind: 'fetch_failed', error: 'blocked_address' })
    expect(await connectCalendar(token, 'http://cal.example/x.ics')).toEqual({ kind: 'invalid_link' })
    expect(await connectLinkRefusal(svc(), token)).toBeNull()
    expect(await connectionRow()).toBeNull()
  })

  it('RED: no CALENDAR_LINK_KEY → connect refuses ("disabled"), the page shows it, nothing written', async () => {
    const token = await freshToken()
    process.env.CALENDAR_LINK_KEY = ''
    expect(await connectWithLink(svc(), token, LINK, deps)).toEqual({ kind: 'disabled' })
    const el = await ConnectCalendarPage({ params: Promise.resolve({ token }) })
    expect(JSON.stringify(el)).toContain('"available":false')
    expect(await connectLinkRefusal(svc(), token)).toBeNull()
    expect(await connectionRow()).toBeNull()
  })
})

// ─── access ──────────────────────────────────────────────────────────────────

describe('RED: the calendar link is not readable by anon or authenticated', () => {
  it('anon: both tables and the functions are refused', async () => {
    await connectWithLink(svc(), await freshToken(), LINK, deps)
    const a = anon()
    const conn = await a.from('guide_calendar_connections').select('link_ciphertext')
    const links = await a.from('guide_calendar_connect_links').select('token_hash')
    const fn = await a.rpc('calendar_connect_link_refusal', { p_token_hash: '0'.repeat(64) })
    expect(conn.error?.message).toMatch(/permission denied/)
    expect(links.error?.message).toMatch(/permission denied/)
    expect(fn.error?.message).toMatch(/permission denied/)
  })

  it('authenticated (angler, and the guide who owns the calendar): refused', async () => {
    await connectWithLink(svc(), await freshToken(), LINK, deps)
    for (const c of [await signedIn(ANGLER.email, ANGLER.password), guideSession]) {
      const conn = await c.from('guide_calendar_connections').select('link_ciphertext')
      const fn = await c.rpc('record_calendar_sync', { p_guide_id: GUIDE, p_connected_at: new Date().toISOString(), p_dates: [] })
      expect(conn.error?.message).toMatch(/permission denied/)
      expect(fn.error?.message).toMatch(/permission denied/)
    }
  })
})

describe('busy days: guides read their own, writes are server-only (D6 b)', () => {
  it('the guide reads their own busy days', async () => {
    await svc().from('guide_unavailable_dates').insert({ guide_id: GUIDE, date: '2027-05-05', source: 'manual' })
    const { data, error } = await guideSession.from('guide_unavailable_dates').select('date, source').eq('guide_id', GUIDE)
    expect(error).toBeNull()
    expect(data).toEqual([{ date: '2027-05-05', source: 'manual' }])
  })

  it('RED: a signed-in guide inserting or deleting a row directly is refused', async () => {
    await svc().from('guide_unavailable_dates').insert({ guide_id: GUIDE, date: '2027-05-06', source: 'calendar' })
    const ins = await guideSession.from('guide_unavailable_dates').insert({ guide_id: GUIDE, date: '2027-05-07', source: 'manual' })
    const del = await guideSession.from('guide_unavailable_dates').delete().eq('guide_id', GUIDE).select()
    expect(ins.error?.message).toMatch(/permission denied/)
    expect(del.error?.message).toMatch(/permission denied/)
    const { data } = await svc().from('guide_unavailable_dates').select('date').eq('guide_id', GUIDE)
    expect(data).toEqual([{ date: '2027-05-06' }])
  })

  it('RED: anon reads no busy days at all', async () => {
    const { error } = await anon().from('guide_unavailable_dates').select('date').limit(1)
    expect(error?.message).toMatch(/permission denied/)
  })
})

describe('the guide\'s availability actions (D2 b, open season re-read)', () => {
  beforeEach(() => { h.sessionClient = guideSession })

  it('RED: unblocking a calendar-busy day is refused with a reason; the day stays', async () => {
    await svc().from('guide_unavailable_dates').insert({ guide_id: GUIDE, date: '2027-06-10', source: 'calendar' })
    const res = await setAvailability(['2027-06-10'], false)
    expect(res).toEqual({ success: false, error: expect.stringContaining('busy in your connected calendar') })
    const { data } = await svc().from('guide_unavailable_dates').select('date, source').eq('guide_id', GUIDE)
    expect(data).toEqual([{ date: '2027-06-10', source: 'calendar' }])
  })

  it('blocking a calendar-busy day adds a manual row; unblocking a manual day removes only it', async () => {
    await svc().from('guide_unavailable_dates').insert({ guide_id: GUIDE, date: '2027-06-11', source: 'calendar' })
    expect(await setAvailability(['2027-06-11', '2027-06-12'], true)).toEqual({ success: true })
    expect(await setAvailability(['2027-06-12'], false)).toEqual({ success: true })
    const { data } = await svc().from('guide_unavailable_dates').select('date, source').eq('guide_id', GUIDE).order('date').order('source')
    expect(data).toEqual([{ date: '2027-06-11', source: 'calendar' }, { date: '2027-06-11', source: 'manual' }])
  })

  it('open season keeps calendar days and returns the server\'s busy days', async () => {
    const inSeason = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
    const from = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
    await svc().from('guide_unavailable_dates').insert([
      { guide_id: GUIDE, date: inSeason, source: 'calendar' },
      { guide_id: GUIDE, date: inSeason, source: 'manual' },
    ])
    const res = await setOpenSeason(from, to)
    if (!res.success) throw new Error(res.error)
    expect(res.blockedDates).toContain(inSeason)                     // calendar day inside the season stays
    expect(res.blockedDates).not.toContain(from)                      // season opened
    expect(res.blockedDates.length).toBe(new Set(res.blockedDates).size)
    const { data } = await svc().from('guide_unavailable_dates').select('source').eq('guide_id', GUIDE).eq('date', inSeason)
    expect(data).toEqual([{ source: 'calendar' }])                   // manual block inside the season cleared
  })
})

// ─── admin action ────────────────────────────────────────────────────────────

describe('issuing the link from admin', () => {
  it('admin gets a one-time link to the connect page', async () => {
    h.sessionClient = await signedIn(ADMIN.email, ADMIN.password)
    const res = await issueCalendarConnectLink(GUIDE)
    if (!res.success) throw new Error(res.error)
    expect(res.link).toMatch(/^http:\/\/localhost:3000\/connect-calendar\/[A-Za-z0-9_-]{43}$/)
    expect(await connectLinkRefusal(svc(), res.link.split('/connect-calendar/')[1]!)).toBeNull()
  })

  it('RED: an angler or a guide session is refused', async () => {
    h.sessionClient = await signedIn(ANGLER.email, ANGLER.password)
    await expect(issueCalendarConnectLink(GUIDE)).rejects.toBeInstanceOf(UnauthorizedError)
    h.sessionClient = guideSession
    await expect(issueCalendarConnectLink(GUIDE)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('RED: no CALENDAR_LINK_KEY → no link, the reason named', async () => {
    h.sessionClient = await signedIn(ADMIN.email, ADMIN.password)
    process.env.CALENDAR_LINK_KEY = ''
    expect(await issueCalendarConnectLink(GUIDE)).toEqual({ success: false, error: CALENDAR_DISABLED_MESSAGE })
  })
})

// ─── cron route ──────────────────────────────────────────────────────────────

describe('cron route', () => {
  const call = (auth?: string) =>
    cronGET(new NextRequest('http://localhost:3000/api/cron/calendar-sync', auth != null ? { headers: { authorization: auth } } : {}))

  it('RED: no secret or a wrong secret → 401, nothing runs', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
  })

  it('RED: no CALENDAR_LINK_KEY → 503 with the reason, nothing written', async () => {
    await connectWithLink(svc(), await freshToken(), LINK, deps)
    const { data: before } = await svc().from('guide_calendar_connections').select('*').eq('guide_id', GUIDE).single()
    process.env.CALENDAR_LINK_KEY = ''
    const res = await call('Bearer test-only-cron-secret')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: CALENDAR_DISABLED_MESSAGE })
    const { data: after } = await svc().from('guide_calendar_connections').select('*').eq('guide_id', GUIDE).single()
    expect(after).toEqual(before)
  })

  it('with the secret → runs the sync and returns its summary (200)', async () => {
    const summary = { total: 2, ok: 1, failed: 1, stale: 0, disconnected: 0, skipped: 0, failures: [{ guideId: GUIDE, error: 'not_found' as const }] }
    vi.mocked(syncAllCalendars).mockClear()
    vi.mocked(syncAllCalendars).mockResolvedValueOnce(summary)
    const res = await call('Bearer test-only-cron-secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(summary)
    expect(vi.mocked(syncAllCalendars)).toHaveBeenCalledTimes(1)
  })
})
