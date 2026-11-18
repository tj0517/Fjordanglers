/**
 * FA-M.13 — the guide panel against the real local stack, two guide accounts:
 *   * the requests list: own requests only, newest first, statuses, request records merged with
 *     assignments from before FA-M.03 (tj decision B, 2026-11-18);
 *   * answering from the panel writes the same event as answering through the link (regression guard);
 *   * the calendar preview: busy days by source, connection status, last sync — for the own guide only;
 *   * the account's Apple link and disconnect act only on the signed-in guide's own calendar.
 *
 * Env comes from .env.test through src/tests/setup.ts (127.0.0.1 only). Mocks: @/lib/supabase/server
 * (createClient → a real signed-in session, createServiceClient → a real service client), next/cache,
 * next/navigation (redirect / notFound throw a marker the test reads). Users under `fam13-`, fixed ids,
 * swept in beforeAll / afterAll.
 */

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { TEST_CALENDAR_LINK_KEY } from '@/lib/calendar/__tests__/test-key'

const h = vi.hoisted(() => ({ sessionClient: null as unknown }))

class NavigationMarker extends Error {
  constructor(readonly kind: 'redirect' | 'notFound', readonly url: string | null) { super(kind) }
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T,>(fn: T) => fn }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new NavigationMarker('redirect', url) },
  notFound: () => { throw new NavigationMarker('notFound', null) },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/dashboard',
}))
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

import { disconnectCalendar, startAppleCalendarConnect } from '@/actions/calendar'
import { respondToAssignment } from '@/actions/inquiries'
import GuideRequestsPage from '@/app/dashboard/trips/page'
import CalendarPage from '@/app/dashboard/calendar/page'
import { UnauthorizedError } from '@/lib/auth/guards'
import { answerGuideRequest, createGuideRequest, withdrawGuideRequest } from '@/lib/guide-requests/requests'
import { guideCalendarPreview, guideRequestList, sessionGuide } from '../queries'

type Db = SupabaseClient<Database>

const PREFIX   = 'fam13-'
const PASSWORD = 'fam13-test-password-2026'
const GUIDE_A  = 'f13a0000-0000-4000-8000-00000000000a'
const GUIDE_B  = 'f13a0000-0000-4000-8000-00000000000b'
const EMAIL_A  = `${PREFIX}guide-a@seed.test`
const EMAIL_B  = `${PREFIX}guide-b@seed.test`

const INQ_A_LINK      = 'f13a0000-0000-4000-8000-0000000000a1'  // request to A, answered through the link
const INQ_MOVED       = 'f13a0000-0000-4000-8000-0000000000a2'  // request to A withdrawn, then sent to B
const INQ_A_NEW       = 'f13a0000-0000-4000-8000-0000000000a3'  // request to A, waiting
const INQ_A_LEGACY    = 'f13a0000-0000-4000-8000-0000000000a4'  // assigned to A before FA-M.03, no request
const INQ_A_CANCELLED = 'f13a0000-0000-4000-8000-0000000000a5'  // assigned to A, trip cancelled
const INQ_B           = 'f13a0000-0000-4000-8000-0000000000b1'  // request to B
const INQUIRIES = [INQ_A_LINK, INQ_MOVED, INQ_A_NEW, INQ_A_LEGACY, INQ_A_CANCELLED, INQ_B]

let ADMIN_ID = ''
let USER_A = ''
let linkTokenA = ''
const requestIds: Record<string, string> = {}

function svc(): Db {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function signIn(email: string): Promise<void> {
  const c = createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error != null) throw new Error(`sign-in failed for test account: ${error.message}`)
  h.sessionClient = c
}

async function sessionGuideId(): Promise<string> {
  const me = await sessionGuide()
  if (me.kind !== 'guide') throw new Error(`expected a guide session, got ${me.kind}`)
  return me.guideId
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().in('id', INQUIRIES)
  for (const g of [GUIDE_A, GUIDE_B]) {
    const { data: links } = await s.from('guide_calendar_connect_links').select('id').eq('guide_id', g)
    const ids = (links ?? []).map(l => l.id)
    if (ids.length > 0) await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connect_links').in('record_id', ids)
    await s.from('audit_log').delete().eq('table_name', 'guide_calendar_connections').eq('record_id', g)
  }
  await s.from('guides').delete().in('id', [GUIDE_A, GUIDE_B])
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) if (u.email?.startsWith(PREFIX)) await s.auth.admin.deleteUser(u.id)
}

async function createGuide(id: string, email: string, name: string): Promise<string> {
  const s = svc()
  const { data: user, error } = await s.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error != null || user.user == null) throw new Error(`createUser: ${error?.message}`)
  const ins = await s.from('guides').insert({ id, full_name: name, country: 'Iceland', is_beta_listing: true, user_id: user.user.id })
  if (ins.error != null) throw new Error(ins.error.message)
  await s.from('profiles').update({ role: 'guide' }).eq('id', user.user.id)
  return user.user.id
}

async function send(inquiryId: string, guideId: string) {
  const created = await createGuideRequest(svc(), { inquiryId, guideId, channel: 'whatsapp', adminId: ADMIN_ID })
  return created
}

async function answeredEvents(inquiryId: string) {
  const { data, error } = await svc().from('inquiry_events')
    .select('type, actor_kind, payload').eq('inquiry_id', inquiryId).eq('type', 'guide.request_answered')
  if (error != null) throw new Error(error.message)
  return data
}

async function linksOf(guideId: string) {
  const { data, error } = await svc().from('guide_calendar_connect_links')
    .select('id, created_by, revoked_at, used_at').eq('guide_id', guideId).order('created_at')
  if (error != null) throw new Error(error.message)
  return data
}

async function connectionOf(guideId: string) {
  const { data } = await svc().from('guide_calendar_connections')
    .select('provider, status, link_host, last_synced_at').eq('guide_id', guideId).maybeSingle()
  return data
}

async function busyOf(guideId: string) {
  const { data } = await svc().from('guide_unavailable_dates').select('date, source').eq('guide_id', guideId).order('date')
  return data ?? []
}

const savedKey = process.env.CALENDAR_LINK_KEY
const SYNCED_AT = new Date(Date.now() - 3 * 3_600_000).toISOString()   // 3 h ago
const DAY_CAL = '2027-01-12'
const DAY_MANUAL = '2027-01-14'

beforeAll(async () => {
  process.env.CALENDAR_LINK_KEY = TEST_CALENDAR_LINK_KEY
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')
  USER_A = await createGuide(GUIDE_A, EMAIL_A, 'Anna Fam13')
  await createGuide(GUIDE_B, EMAIL_B, 'Bjorn Fam13')

  const base = { angler_email: 'fam13-angler@seed.test', trip_country: 'Iceland', party_size: 2, requested_dates: ['2027-06-10', '2027-06-11'] }
  const ins = await s.from('inquiries').insert([
    { ...base, id: INQ_A_LINK,      angler_name: 'Fam13 Link',      status: 'waiting_guide' },
    { ...base, id: INQ_MOVED,       angler_name: 'Fam13 Moved',     status: 'waiting_guide' },
    { ...base, id: INQ_A_NEW,       angler_name: 'Fam13 New',       status: 'waiting_guide' },
    { ...base, id: INQ_A_LEGACY,    angler_name: 'Fam13 Legacy',    status: 'waiting_guide',
      assigned_guide_id: GUIDE_A, assigned_at: '2026-10-01T09:00:00Z', guide_acceptance: 'accepted' },
    { ...base, id: INQ_A_CANCELLED, angler_name: 'Fam13 Cancelled', status: 'cancelled',
      assigned_guide_id: GUIDE_A, assigned_at: '2026-10-02T09:00:00Z' },
    { ...base, id: INQ_B,           angler_name: 'Fam13 Bjorn Only', status: 'waiting_guide' },
  ])
  if (ins.error != null) throw new Error(ins.error.message)

  // Order of sending = order of sent_at: link, moved (A), new; then moved goes to B, then B's own.
  const link = await send(INQ_A_LINK, GUIDE_A)
  requestIds.link = link.requestId
  linkTokenA = link.token
  const movedA = await send(INQ_MOVED, GUIDE_A)
  requestIds.movedA = movedA.requestId
  requestIds.newA = (await send(INQ_A_NEW, GUIDE_A)).requestId
  expect(await withdrawGuideRequest(s, { requestId: movedA.requestId, adminId: ADMIN_ID })).toBe('withdrawn')
  requestIds.movedB = (await send(INQ_MOVED, GUIDE_B)).requestId
  requestIds.b = (await send(INQ_B, GUIDE_B)).requestId

  // A answers INQ_A_LINK through the link (FA-M.04 path).
  const answered = await answerGuideRequest(s, linkTokenA, { answer: 'accepted' })
  expect(answered.status).toBe('answered')

  // A's calendar: one calendar-busy day, one manual block, an Apple connection synced 3 h ago.
  const conn = await s.from('guide_calendar_connections').insert({
    guide_id: GUIDE_A, provider: 'apple_ics', link_ciphertext: 'v1:fam13:fixture:notakey',
    link_host: 'p01-caldav.icloud.com', status: 'ok', last_synced_at: SYNCED_AT,
  })
  if (conn.error != null) throw new Error(conn.error.message)
  const busy = await s.from('guide_unavailable_dates').insert([
    { guide_id: GUIDE_A, date: DAY_CAL, source: 'calendar' },
    { guide_id: GUIDE_A, date: DAY_MANUAL, source: 'manual' },
  ])
  if (busy.error != null) throw new Error(busy.error.message)
}, 60_000)

afterAll(async () => {
  await sweep()
  if (savedKey == null) delete process.env.CALENDAR_LINK_KEY
  else process.env.CALENDAR_LINK_KEY = savedKey
}, 60_000)

// ─── Requests list ────────────────────────────────────────────────────────────

describe('guide-panel requests list (decision B)', () => {
  it('guide A: own requests newest first, latest per trip, legacy assignment merged, cancelled hidden', async () => {
    await signIn(EMAIL_A)
    const list = await guideRequestList(await sessionGuideId())
    expect(list.map(r => [r.inquiryId, r.status, r.requestId, r.canOpen])).toEqual([
      [INQ_A_NEW,    'waiting',   requestIds.newA,   true],
      [INQ_MOVED,    'withdrawn', requestIds.movedA, false],
      [INQ_A_LINK,   'accepted',  requestIds.link,   true],
      [INQ_A_LEGACY, 'accepted',  null,              true],
    ])
  })

  it('RED: guide B sees none of guide A’s requests — only their own two', async () => {
    await signIn(EMAIL_B)
    const list = await guideRequestList(await sessionGuideId())
    expect(list.map(r => [r.inquiryId, r.status, r.requestId])).toEqual([
      [INQ_B,     'waiting', requestIds.b],
      [INQ_MOVED, 'waiting', requestIds.movedB],
    ])
    for (const id of [INQ_A_LINK, INQ_A_NEW, INQ_A_LEGACY, INQ_A_CANCELLED]) {
      expect(list.some(r => r.inquiryId === id)).toBe(false)
    }
  })

  it('RED: the page rendered for guide B carries none of guide A’s trips', async () => {
    await signIn(EMAIL_B)
    const html = renderToStaticMarkup(await GuideRequestsPage())
    expect(html).toContain('Fam13 Bjorn Only')
    expect(html).toContain('Fam13 Moved')
    for (const name of ['Fam13 Link', 'Fam13 New', 'Fam13 Legacy', 'Fam13 Cancelled']) expect(html).not.toContain(name)
    for (const id of [INQ_A_LINK, INQ_A_NEW, INQ_A_LEGACY]) expect(html).not.toContain(id)
  })

  it('page for guide A: waiting on top with "Answer now", withdrawn not linked', async () => {
    await signIn(EMAIL_A)
    const html = renderToStaticMarkup(await GuideRequestsPage())
    expect(html).toContain('Waiting for you · 1')
    expect(html.indexOf('Fam13 New')).toBeLessThan(html.indexOf('Fam13 Link'))
    expect(html).toContain(`href="/dashboard/trips/${INQ_A_NEW}"`)
    expect(html).not.toContain(`href="/dashboard/trips/${INQ_MOVED}"`)
    expect(html).toContain('data-status="withdrawn"')
  })
})

// ─── Answer: panel = link ─────────────────────────────────────────────────────

describe('answering from the panel writes the same event as the link (regression guard)', () => {
  it('respondToAssignment → one guide.request_answered shaped like the link’s', async () => {
    await signIn(EMAIL_A)
    expect(await respondToAssignment(INQ_A_NEW, true)).toEqual({ success: true })

    const [fromLink] = await answeredEvents(INQ_A_LINK)
    const fromPanel = await answeredEvents(INQ_A_NEW)
    expect(fromPanel).toHaveLength(1)
    expect(fromPanel[0]!.type).toBe(fromLink!.type)
    expect(fromPanel[0]!.actor_kind).toBe(fromLink!.actor_kind)
    expect(fromPanel[0]!.payload).toMatchObject({ request_id: requestIds.newA, answer: 'accepted' })
    expect(fromLink!.payload).toMatchObject({ request_id: requestIds.link, answer: 'accepted' })

    const list = await guideRequestList(await sessionGuideId())
    expect(list.find(r => r.inquiryId === INQ_A_NEW)?.status).toBe('accepted')
  })
})

// ─── Calendar preview ─────────────────────────────────────────────────────────

describe('guide-panel calendar preview', () => {
  it('guide A: busy days with their source, status ok, last successful sync', async () => {
    await signIn(EMAIL_A)
    const preview = await guideCalendarPreview(await sessionGuideId())
    expect(preview.busyDays).toEqual([
      { date: DAY_CAL, sources: ['calendar'] },
      { date: DAY_MANUAL, sources: ['manual'] },
    ])
    expect(preview.connection).toMatchObject({ provider: 'apple_ics', status: 'ok', host: 'p01-caldav.icloud.com' })
    expect(new Date(preview.connection!.lastSyncedAt!).toISOString()).toBe(SYNCED_AT)
  })

  it('RED: guide B’s preview has none of guide A’s days and no connection', async () => {
    await signIn(EMAIL_B)
    expect(await guideCalendarPreview(await sessionGuideId())).toEqual({ busyDays: [], connection: null })
  })

  it('page for guide A shows the status line and the ?google= return', async () => {
    await signIn(EMAIL_A)
    const html = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ google: 'connected' }) }))
    expect(html).toContain('data-testid="google-return" data-ok="true"')
    expect(html).toContain('Apple Calendar connected')
    expect(html).toContain('Last sync 3 h ago')
    const stamp = /<time dateTime="([^"]+)">Last sync 3 h ago/.exec(html)?.[1]
    expect(stamp != null && new Date(stamp).toISOString()).toBe(SYNCED_AT)
  })

  it('page for a denied Google return says so; an unknown value shows nothing', async () => {
    await signIn(EMAIL_A)
    const denied = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ google: 'denied' }) }))
    expect(denied).toContain('data-ok="false"')
    const junk = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ google: '<script>' }) }))
    expect(junk).not.toContain('google-return')
  })
})

// ─── Account: Apple link and disconnect ───────────────────────────────────────

describe('account calendar actions act only on the signed-in guide', () => {
  it('guide A: Apple issues a link for A (created_by = A’s user id) and redirects to the connect page', async () => {
    await signIn(EMAIL_A)
    const before = await linksOf(GUIDE_A)
    const err = await startAppleCalendarConnect(GUIDE_A).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(NavigationMarker)
    const marker = err as NavigationMarker
    expect(marker.kind).toBe('redirect')
    expect(marker.url).toMatch(/^\/connect-calendar\/[A-Za-z0-9_-]+$/)
    const after = await linksOf(GUIDE_A)
    expect(after).toHaveLength(before.length + 1)
    expect(after.at(-1)).toMatchObject({ created_by: USER_A, revoked_at: null, used_at: null })
  })

  it('guide A again: the new link revokes A’s open unused one (D5)', async () => {
    await signIn(EMAIL_A)
    await startAppleCalendarConnect(GUIDE_A).catch(() => null)
    const links = await linksOf(GUIDE_A)
    expect(links.filter(l => l.revoked_at == null && l.used_at == null)).toHaveLength(1)
    expect(links.at(-2)?.revoked_at).not.toBeNull()
  })

  it('RED: guide B cannot issue an Apple link for guide A — refused, A’s links untouched, none for A by B', async () => {
    await signIn(EMAIL_B)
    const before = await linksOf(GUIDE_A)
    await expect(startAppleCalendarConnect(GUIDE_A)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await linksOf(GUIDE_A)).toEqual(before)
    expect(await linksOf(GUIDE_B)).toEqual([])
  })

  it('RED: guide B cannot disconnect guide A’s calendar — refused, A’s connection and days untouched', async () => {
    await signIn(EMAIL_B)
    const conn = await connectionOf(GUIDE_A)
    const days = await busyOf(GUIDE_A)
    await expect(disconnectCalendar(GUIDE_A)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await connectionOf(GUIDE_A)).toEqual(conn)
    expect(await busyOf(GUIDE_A)).toEqual(days)
  })

  it('guide A disconnects their own: connection gone, calendar days removed, manual block kept', async () => {
    await signIn(EMAIL_A)
    expect(await disconnectCalendar(GUIDE_A)).toEqual({ success: true, provider: 'apple_ics', busyDaysRemoved: 1 })
    expect(await connectionOf(GUIDE_A)).toBeNull()
    expect(await busyOf(GUIDE_A)).toEqual([{ date: DAY_MANUAL, source: 'manual' }])
  })
})
