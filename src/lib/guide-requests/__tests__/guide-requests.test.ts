/**
 * FA-M.03 — guide requests against the real local stack (.env.test, 127.0.0.1 only).
 *
 * Covers: token stored only as sha256; wrong / expired / another request's token; refusal
 * precedence; first open only; answer once (idempotent replay, refusal of a different answer);
 * alt_dates bounds and "after today" in the trip country's zone; events for every mutation and the
 * `inquiries` summary; the dashboard path (D2 b) incl. the legacy variant without request_id;
 * withdraw; no access for anon / angler / guide sessions; table CHECKs on direct inserts.
 *
 * Self-contained: fixed ids under f3a0…, users under `fam03-`; swept in beforeAll / afterAll.
 * Tokens are never printed — assertions compare them, failures show only booleans.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  createGuideRequest,
  findGuideRequestByToken,
  recordGuideRequestOpened,
  answerGuideRequest,
  answerGuideRequestFromDashboard,
  withdrawGuideRequest,
} from '../requests'

type Db = SupabaseClient<Database>

const GUIDE_A     = 'f3a00000-0000-4000-8000-00000000000a'
const GUIDE_B     = 'f3a00000-0000-4000-8000-00000000000b'
const GUIDE_GONE  = 'f3a00000-0000-4000-8000-0000000000dd'
const INQ_NZ      = 'f3a00000-0000-4000-8000-000000000001'   // trip_country New Zealand
const INQ_TWO     = 'f3a00000-0000-4000-8000-000000000002'   // two guides, latest-request rule
const INQ_PREC    = 'f3a00000-0000-4000-8000-000000000003'   // refusal precedence
const INQ_DASH    = 'f3a00000-0000-4000-8000-000000000004'   // dashboard path
const INQ_LEGACY  = 'f3a00000-0000-4000-8000-000000000005'   // assignment without a request
const INQ_CHECKS  = 'f3a00000-0000-4000-8000-000000000006'   // direct-insert CHECKs
const INQUIRIES   = [INQ_NZ, INQ_TWO, INQ_PREC, INQ_DASH, INQ_LEGACY, INQ_CHECKS]
const GUIDE_USER  = 'fam03-guide@seed.test'
const PASSWORD    = 'fam03-test-password-2026'
const ANGLER      = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }
const PERMISSION_DENIED = '42501'

let ADMIN_ID = ''

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

/** YYYY-MM-DD of `now + days` in an IANA zone. */
function localDate(zone: string, days = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date())
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function events(inquiryId: string, type?: string) {
  let q = svc().from('inquiry_events').select('type, actor_kind, actor_id, channel, payload').eq('inquiry_id', inquiryId)
  if (type != null) q = q.eq('type', type)
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error != null) throw new Error(error.message)
  return data
}

async function summary(inquiryId: string) {
  const { data, error } = await svc()
    .from('inquiries')
    .select('assigned_guide_id, assigned_at, guide_acceptance, guide_decline_reason, guide_responded_at')
    .eq('id', inquiryId)
    .single()
  if (error != null) throw new Error(error.message)
  return data
}

async function row(requestId: string) {
  const { data, error } = await svc().from('guide_requests').select('*').eq('id', requestId).single()
  if (error != null) throw new Error(error.message)
  return data
}

async function create(inquiryId: string, guideId = GUIDE_A) {
  return createGuideRequest(svc(), { inquiryId, guideId, channel: 'whatsapp', adminId: ADMIN_ID })
}

/** Moves a request's window into the past so its link is expired (keeps expires > sent). */
async function expire(requestId: string, sentDaysAgo = 10) {
  const { error } = await svc().from('guide_requests').update({
    sent_at: new Date(Date.now() - sentDaysAgo * 86_400_000).toISOString(),
    token_expires_at: new Date(Date.now() - (sentDaysAgo - 7) * 86_400_000).toISOString(),
  }).eq('id', requestId)
  if (error != null) throw new Error(error.message)
}

async function sweep(): Promise<void> {
  const s = svc()
  await s.from('inquiries').delete().in('id', INQUIRIES)
  await s.from('guides').delete().in('id', [GUIDE_A, GUIDE_B, GUIDE_GONE])
  const { data } = await s.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data?.users ?? []) if (u.email?.startsWith('fam03-')) await s.auth.admin.deleteUser(u.id)
}

beforeAll(async () => {
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')

  const g = await s.from('guides').insert([
    { id: GUIDE_A,    full_name: 'Aroha Fam03', country: 'New Zealand', is_beta_listing: true },
    { id: GUIDE_B,    full_name: 'Bryn Fam03',  country: 'New Zealand', is_beta_listing: true },
    { id: GUIDE_GONE, full_name: 'Gone Fam03',  country: 'Iceland',     is_beta_listing: true },
  ])
  if (g.error != null) throw new Error(g.error.message)

  const i = await s.from('inquiries').insert(INQUIRIES.map(id => ({
    id, angler_name: 'FA-M.03 Test', angler_email: 'fam03-angler@seed.test', status: 'waiting_guide',
    trip_country: id === INQ_NZ ? 'New Zealand' : 'Iceland',
  })))
  if (i.error != null) throw new Error(i.error.message)
  const legacy = await s.from('inquiries').update({ assigned_guide_id: GUIDE_A, assigned_at: new Date().toISOString() }).eq('id', INQ_LEGACY)
  if (legacy.error != null) throw new Error(legacy.error.message)

  const { data: gu, error } = await s.auth.admin.createUser({ email: GUIDE_USER, password: PASSWORD, email_confirm: true })
  if (error != null || gu.user == null) throw new Error(`guide user: ${error?.message}`)
  await s.from('profiles').upsert({ id: gu.user.id, role: 'guide' })
  await s.from('guides').update({ user_id: gu.user.id }).eq('id', GUIDE_A)
})

afterAll(sweep)

// ─── token storage ────────────────────────────────────────────────────────────

describe('token storage', () => {
  it('a select on guide_requests returns only the sha256 of the token, never the token', async () => {
    const created = await create(INQ_NZ)
    const stored = await row(created.requestId)
    const asText = JSON.stringify(stored)
    expect(asText.includes(created.token)).toBe(false)
    expect(stored.token_hash).toBe(createHash('sha256').update(created.token, 'utf8').digest('hex'))
    // and no event payload carries it either
    expect(JSON.stringify(await events(INQ_NZ)).includes(created.token)).toBe(false)
  })

  it('the table refuses a plain token in token_hash (format CHECK)', async () => {
    const plain = randomBytes(32).toString('base64url')
    const { error } = await svc().from('guide_requests').insert({
      inquiry_id: INQ_CHECKS, guide_id: GUIDE_A, token_hash: plain, channel: 'whatsapp',
      token_expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_by: ADMIN_ID,
    })
    expect(error?.message).toMatch(/guide_requests_token_hash_format/)
  })
})

// ─── create ───────────────────────────────────────────────────────────────────

describe('createGuideRequest', () => {
  it('sets the inquiries summary to the new request, 7-day link, emits guide.request_sent', async () => {
    await svc().from('inquiries').update({ guide_acceptance: 'declined', guide_decline_reason: 'old', guide_responded_at: new Date().toISOString() }).eq('id', INQ_TWO)
    const created = await create(INQ_TWO, GUIDE_A)
    const s = await summary(INQ_TWO)
    expect(s).toMatchObject({ assigned_guide_id: GUIDE_A, guide_acceptance: null, guide_decline_reason: null, guide_responded_at: null })
    expect(new Date(s.assigned_at!).getTime()).toBe(new Date(created.sentAt).getTime())
    expect(new Date(created.expiresAt).getTime() - new Date(created.sentAt).getTime()).toBe(7 * 86_400_000)

    const sent = await events(INQ_TWO, 'guide.request_sent')
    expect(sent.at(-1)).toMatchObject({
      actor_kind: 'admin', actor_id: ADMIN_ID, channel: 'whatsapp',
      payload: { request_id: created.requestId, guide_id: GUIDE_A, channel: 'whatsapp' },
    })
    // FA-M.05 D4: trip_country_set (null here — the inquiry has a country)
    expect(Object.keys(sent.at(-1)!.payload as object).sort()).toEqual(['channel', 'expires_at', 'guide_id', 'request_id', 'trip_country_set'])
  })
})

// ─── access by token ──────────────────────────────────────────────────────────

describe('access by token — wrong, expired, another request’s token', () => {
  it('a wrong token (right shape, never issued) and a malformed one give not_found', async () => {
    expect(await findGuideRequestByToken(svc(), randomBytes(32).toString('base64url'))).toEqual({ ok: false, reason: 'not_found' })
    expect(await findGuideRequestByToken(svc(), 'not-a-token')).toEqual({ ok: false, reason: 'not_found' })
    expect(await answerGuideRequest(svc(), randomBytes(32).toString('base64url'), { answer: 'accepted' }))
      .toEqual({ status: 'refused', reason: 'not_found' })
  })

  it('an expired token is refused for find, open and answer — and nothing is written', async () => {
    const created = await create(INQ_NZ)
    await expire(created.requestId)
    expect(await findGuideRequestByToken(svc(), created.token)).toEqual({ ok: false, reason: 'expired' })
    expect(await recordGuideRequestOpened(svc(), created.token)).toEqual({ ok: false, reason: 'expired' })
    expect(await answerGuideRequest(svc(), created.token, { answer: 'accepted' })).toEqual({ status: 'refused', reason: 'expired' })
    const r = await row(created.requestId)
    expect({ opened: r.first_opened_at, answered: r.answered_at }).toEqual({ opened: null, answered: null })
  })

  it('another request’s token reaches only that request, never this one', async () => {
    const mine  = await create(INQ_TWO, GUIDE_A)
    const other = await create(INQ_NZ, GUIDE_B)
    const viaOther = await findGuideRequestByToken(svc(), other.token)
    expect(viaOther.ok && viaOther.request.requestId).toBe(other.requestId)

    const res = await answerGuideRequest(svc(), other.token, { answer: 'declined', note: 'not mine' })
    expect(res.status).toBe('answered')
    const untouched = await row(mine.requestId)
    expect({ answer: untouched.answer, answered_at: untouched.answered_at }).toEqual({ answer: null, answered_at: null })
  })
})

describe('refusal precedence: not_found > guide_removed > withdrawn > expired > already_answered', () => {
  it('each request reports the highest-ranked reason it has', async () => {
    const s = svc()
    // all four conditions: guide removed + withdrawn + expired + answered
    const p1 = await create(INQ_PREC, GUIDE_GONE)
    // withdrawn + expired + answered
    const p2 = await create(INQ_PREC, GUIDE_B)
    // expired + answered
    const p3 = await create(INQ_PREC, GUIDE_B)
    // answered only
    const p4 = await create(INQ_PREC, GUIDE_B)

    for (const p of [p1, p2, p3, p4]) {
      expect((await answerGuideRequest(s, p.token, { answer: 'accepted' })).status).toBe('answered')
    }
    for (const p of [p1, p2, p3]) await expire(p.requestId)
    for (const p of [p1, p2]) expect(await withdrawGuideRequest(s, { requestId: p.requestId, adminId: ADMIN_ID })).toBe('withdrawn')
    await s.from('guides').delete().eq('id', GUIDE_GONE)

    const attempt = { answer: 'declined', note: 'changed my mind' }
    expect(await answerGuideRequest(s, randomBytes(32).toString('base64url'), attempt)).toEqual({ status: 'refused', reason: 'not_found' })
    expect(await answerGuideRequest(s, p1.token, attempt)).toEqual({ status: 'refused', reason: 'guide_removed' })
    expect(await answerGuideRequest(s, p2.token, attempt)).toEqual({ status: 'refused', reason: 'withdrawn' })
    expect(await answerGuideRequest(s, p3.token, attempt)).toEqual({ status: 'refused', reason: 'expired' })
    expect((await answerGuideRequest(s, p4.token, attempt)).status).toBe('already_answered')

    expect(await findGuideRequestByToken(s, p1.token)).toEqual({ ok: false, reason: 'guide_removed' })
    expect(await findGuideRequestByToken(s, p2.token)).toEqual({ ok: false, reason: 'withdrawn' })
    expect(await findGuideRequestByToken(s, p3.token)).toEqual({ ok: false, reason: 'expired' })
  })
})

// ─── open ─────────────────────────────────────────────────────────────────────

describe('recordGuideRequestOpened', () => {
  it('records only the first opening, with one guide.request_opened event', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    expect(await recordGuideRequestOpened(svc(), created.token)).toEqual({ ok: true, firstOpen: true })
    const first = (await row(created.requestId)).first_opened_at
    expect(first).not.toBeNull()
    expect(await recordGuideRequestOpened(svc(), created.token)).toEqual({ ok: true, firstOpen: false })
    expect((await row(created.requestId)).first_opened_at).toBe(first)

    const opened = (await events(INQ_NZ, 'guide.request_opened')).filter(e => (e.payload as { request_id?: string }).request_id === created.requestId)
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatchObject({ actor_kind: 'guide', actor_id: GUIDE_A, channel: 'app', payload: { guide_id: GUIDE_A } })
  })
})

// ─── answer ───────────────────────────────────────────────────────────────────

describe('answerGuideRequest — once, idempotent', () => {
  it('accepted: records the answer, updates the inquiries summary, emits guide.request_answered', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const res = await answerGuideRequest(svc(), created.token, { answer: 'accepted' })
    expect(res).toMatchObject({ status: 'answered', summaryUpdated: true, stored: { answer: 'accepted', altDates: [], note: null } })
    const s = await summary(INQ_NZ)
    expect(s).toMatchObject({ assigned_guide_id: GUIDE_A, guide_acceptance: 'accepted', guide_decline_reason: null })
    expect(s.guide_responded_at).not.toBeNull()
    const ans = (await events(INQ_NZ, 'guide.request_answered')).filter(e => (e.payload as { request_id?: string }).request_id === created.requestId)
    expect(ans).toHaveLength(1)
    expect(ans[0]).toMatchObject({ actor_kind: 'guide', actor_id: GUIDE_A, channel: 'app' })
    expect(ans[0].payload).toEqual({ request_id: created.requestId, guide_id: GUIDE_A, answer: 'accepted', alt_dates: [], has_note: false })
  })

  it('a second, different answer does not overwrite the first (already_answered, stored answer returned)', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    await answerGuideRequest(svc(), created.token, { answer: 'accepted' })
    const before = await row(created.requestId)
    const second = await answerGuideRequest(svc(), created.token, { answer: 'declined', note: 'sorry' })
    expect(second).toMatchObject({ status: 'already_answered', stored: { answer: 'accepted', note: null } })
    const after = await row(created.requestId)
    expect({ answer: after.answer, note: after.note, answered_at: after.answered_at })
      .toEqual({ answer: before.answer, note: before.note, answered_at: before.answered_at })
    expect((await summary(INQ_NZ)).guide_acceptance).toBe('accepted')
  })

  it('the same answer again (dates as a set, same note) is a no-op success with no second event', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const d1 = localDate('Pacific/Auckland', 10)
    const d2 = localDate('Pacific/Auckland', 12)
    const first = await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: [d2, d1], note: 'mornings only' })
    expect(first).toMatchObject({ status: 'answered', stored: { altDates: [d1, d2] } })
    const replay = await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: [d1, d2], note: '  mornings only ' })
    expect(replay.status).toBe('unchanged')
    const differentNote = await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: [d1, d2], note: 'evenings' })
    expect(differentNote.status).toBe('already_answered')
    const differentDates = await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: [d1], note: 'mornings only' })
    expect(differentDates.status).toBe('already_answered')
    const answered = (await events(INQ_NZ, 'guide.request_answered')).filter(e => (e.payload as { request_id?: string }).request_id === created.requestId)
    expect(answered).toHaveLength(1)
    expect(answered[0].payload).toEqual({ request_id: created.requestId, guide_id: GUIDE_A, answer: 'other_dates', alt_dates: [d1, d2], has_note: true })
    expect(JSON.stringify(answered[0].payload).includes('mornings')).toBe(false)
    expect(await summary(INQ_NZ)).toMatchObject({ guide_acceptance: 'other_dates', guide_decline_reason: null })
  })

  it('declined with a note: the note lands on the request and in the summary, the event says only has_note', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const res = await answerGuideRequest(svc(), created.token, { answer: 'declined', note: '<b>Booked</b> that week' })
    expect(res.status).toBe('answered')
    expect((await row(created.requestId)).note).toBe('<b>Booked</b> that week')
    expect(await summary(INQ_NZ)).toMatchObject({ guide_acceptance: 'declined', guide_decline_reason: '<b>Booked</b> that week' })
  })
})

describe('alt_dates — 0–3 dates strictly after today in the trip country', () => {
  it('accepts 3 future dates', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const dates = [5, 6, 7].map(n => localDate('Pacific/Auckland', n))
    expect((await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: dates })).status).toBe('answered')
  })

  it('rejects 4 dates (schema) and the database refuses them too', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const four = [5, 6, 7, 8].map(n => localDate('Pacific/Auckland', n))
    expect((await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: four })).status).toBe('invalid')
    const { error } = await svc().rpc('answer_guide_request', {
      p_token_hash: createHash('sha256').update(created.token).digest('hex'),
      p_answer: 'other_dates', p_alt_dates: four, p_note: '', p_timezone: 'Pacific/Auckland',
    })
    expect(error?.message).toMatch(/invalid_answer/)
    expect((await row(created.requestId)).answered_at).toBeNull()
  })

  it('table CHECK refuses 4 dates and other_dates without dates on a direct insert', async () => {
    const base = {
      inquiry_id: INQ_CHECKS, guide_id: GUIDE_A, channel: 'whatsapp', created_by: ADMIN_ID,
      token_expires_at: new Date(Date.now() + 86_400_000).toISOString(), answered_at: new Date().toISOString(),
    }
    const four = await svc().from('guide_requests').insert({ ...base, token_hash: 'a'.repeat(64), answer: 'other_dates', alt_dates: ['2030-01-01', '2030-01-02', '2030-01-03', '2030-01-04'] })
    // both alt_dates_max_3 and alt_dates_coherent forbid it; Postgres names the first one it checks
    expect(four.error?.message).toMatch(/guide_requests_alt_dates_(max_3|coherent)/)
    const none = await svc().from('guide_requests').insert({ ...base, token_hash: 'b'.repeat(64), answer: 'other_dates', alt_dates: [] })
    expect(none.error?.message).toMatch(/guide_requests_alt_dates_coherent/)
    const noteOnAccept = await svc().from('guide_requests').insert({ ...base, token_hash: 'c'.repeat(64), answer: 'accepted', note: 'x' })
    expect(noteOnAccept.error?.message).toMatch(/guide_requests_note_with_answer/)
    const answerNoTime = await svc().from('guide_requests').insert({ ...base, token_hash: 'd'.repeat(64), answer: 'accepted', answered_at: null })
    expect(answerNoTime.error?.message).toMatch(/guide_requests_answer_needs_time/)
  })

  it('a past local date is refused (date_not_in_future) and nothing is written', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const res = await answerGuideRequest(svc(), created.token, { answer: 'other_dates', altDates: [localDate('Pacific/Auckland', -1)] })
    expect(res).toEqual({ status: 'date_not_in_future' })
    expect((await row(created.requestId)).answered_at).toBeNull()
  })

  it('today in the trip zone (Pacific/Auckland) is refused, tomorrow there is accepted', async () => {
    const a = await create(INQ_NZ, GUIDE_A)
    expect(await answerGuideRequest(svc(), a.token, { answer: 'other_dates', altDates: [localDate('Pacific/Auckland', 0)] }))
      .toEqual({ status: 'date_not_in_future' })
    expect((await answerGuideRequest(svc(), a.token, { answer: 'other_dates', altDates: [localDate('Pacific/Auckland', 1)] })).status)
      .toBe('answered')
  })

  it('"today" follows the zone, not UTC — a zone whose date differs from UTC right now', async () => {
    // At every moment one of these two zones is on a different calendar day than UTC:
    // Pacific/Kiritimati (UTC+14) is a day ahead from 10:00 UTC, Pacific/Pago_Pago (UTC−11) a day
    // behind until 11:00 UTC. A UTC-based "today" gets exactly one of the two answers below wrong.
    const utcToday = localDate('UTC', 0)
    const ahead = localDate('Pacific/Kiritimati', 0) !== utcToday
    const zone = ahead ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago'
    const created = await create(INQ_NZ, GUIDE_A)
    const hash = createHash('sha256').update(created.token).digest('hex')
    const call = (date: string) => svc().rpc('answer_guide_request', {
      p_token_hash: hash, p_answer: 'other_dates', p_alt_dates: [date], p_note: '', p_timezone: zone,
    })
    if (ahead) {
      // Local today = UTC tomorrow: refused although UTC would call it "tomorrow".
      expect(localDate(zone, 0)).toBe(localDate('UTC', 1))
      expect((await call(localDate(zone, 0))).data?.[0].outcome).toBe('date_not_in_future')
    } else {
      // Local tomorrow = UTC today: accepted although UTC would call it "today".
      expect(localDate(zone, 1)).toBe(utcToday)
      expect((await call(localDate(zone, 1))).data?.[0].outcome).toBe('answered')
    }
  })

  it('an unknown time zone name is refused by the database', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    const { error } = await svc().rpc('answer_guide_request', {
      p_token_hash: createHash('sha256').update(created.token).digest('hex'),
      p_answer: 'other_dates', p_alt_dates: [localDate('UTC', 5)], p_note: '', p_timezone: 'Mars/Olympus_Mons',
    })
    expect(error?.message).toMatch(/invalid_timezone/)
    expect((await row(created.requestId)).answered_at).toBeNull()
  })
})

// ─── summary: latest request only ─────────────────────────────────────────────

describe('inquiries summary follows the latest request only', () => {
  it('an answer to an older request is recorded but does not touch the summary of a newer one', async () => {
    const older = await create(INQ_TWO, GUIDE_A)
    await create(INQ_TWO, GUIDE_B)
    const res = await answerGuideRequest(svc(), older.token, { answer: 'accepted' })
    expect(res).toMatchObject({ status: 'answered', summaryUpdated: false })
    expect(await summary(INQ_TWO)).toMatchObject({ assigned_guide_id: GUIDE_B, guide_acceptance: null })
  })
})

// ─── withdraw ─────────────────────────────────────────────────────────────────

describe('withdrawGuideRequest', () => {
  // FA-M.05 D2 (a): withdrawing the inquiry's latest request detaches its guide.
  it('kills the link, emits guide.request_withdrawn once, detaches the guide (latest request)', async () => {
    const created = await create(INQ_NZ, GUIDE_A)
    expect(await withdrawGuideRequest(svc(), { requestId: created.requestId, adminId: ADMIN_ID })).toBe('withdrawn')
    expect(await withdrawGuideRequest(svc(), { requestId: created.requestId, adminId: ADMIN_ID })).toBe('already_withdrawn')
    expect(await findGuideRequestByToken(svc(), created.token)).toEqual({ ok: false, reason: 'withdrawn' })
    const w = (await events(INQ_NZ, 'guide.request_withdrawn')).filter(e => (e.payload as { request_id?: string }).request_id === created.requestId)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, payload: { guide_id: GUIDE_A, was_answered: false, detached: true } })
    expect(await summary(INQ_NZ)).toMatchObject({ assigned_guide_id: null, guide_acceptance: null, guide_responded_at: null })
  })
})

// ─── dashboard (D2 b) ─────────────────────────────────────────────────────────

describe('answerGuideRequestFromDashboard', () => {
  it('answers the guide’s latest request — not blocked by expiry', async () => {
    const older  = await create(INQ_DASH, GUIDE_A)
    const latest = await create(INQ_DASH, GUIDE_A)
    await expire(older.requestId, 20)   // still the older one by sent_at
    await expire(latest.requestId, 10)
    const res = await answerGuideRequestFromDashboard(svc(), { inquiryId: INQ_DASH, guideId: GUIDE_A, answer: 'accepted' })
    expect(res).toMatchObject({ status: 'answered', stored: { requestId: latest.requestId, answer: 'accepted' } })
    expect((await summary(INQ_DASH)).guide_acceptance).toBe('accepted')
  })

  it('is blocked when the latest request is withdrawn', async () => {
    const latest = await create(INQ_DASH, GUIDE_A)
    await withdrawGuideRequest(svc(), { requestId: latest.requestId, adminId: ADMIN_ID })
    expect(await answerGuideRequestFromDashboard(svc(), { inquiryId: INQ_DASH, guideId: GUIDE_A, answer: 'declined', note: 'no' }))
      .toEqual({ status: 'refused', reason: 'withdrawn' })
  })

  it('legacy assignment without a request: summary as before + guide.request_answered without request_id', async () => {
    const res = await answerGuideRequestFromDashboard(svc(), { inquiryId: INQ_LEGACY, guideId: GUIDE_A, answer: 'declined', note: 'fully booked' })
    expect(res).toMatchObject({ status: 'answered', stored: { requestId: null, answer: 'declined', note: 'fully booked' } })
    expect(await summary(INQ_LEGACY)).toMatchObject({ guide_acceptance: 'declined', guide_decline_reason: 'fully booked' })
    const ev = await events(INQ_LEGACY, 'guide.request_answered')
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ actor_kind: 'guide', actor_id: GUIDE_A, channel: 'app' })
    expect(ev[0].payload).toEqual({ guide_id: GUIDE_A, answer: 'declined', alt_dates: [], has_note: true })
  })
})

// ─── every mutation emits an event ────────────────────────────────────────────

describe('every mutation emits its event', () => {
  it('create → sent, open → opened, answer → answered, withdraw → withdrawn (one each, same request)', async () => {
    const created = await create(INQ_TWO, GUIDE_B)
    await recordGuideRequestOpened(svc(), created.token)
    await answerGuideRequest(svc(), created.token, { answer: 'accepted' })
    await withdrawGuideRequest(svc(), { requestId: created.requestId, adminId: ADMIN_ID })
    const mine = (await events(INQ_TWO)).filter(e => (e.payload as { request_id?: string }).request_id === created.requestId)
    expect(mine.map(e => e.type)).toEqual(['guide.request_sent', 'guide.request_opened', 'guide.request_answered', 'guide.request_withdrawn'])
  })
})

// ─── no client access ─────────────────────────────────────────────────────────

describe('anon and authenticated neither read nor write guide_requests', () => {
  const probe = {
    inquiry_id: INQ_CHECKS, guide_id: GUIDE_A, channel: 'whatsapp', token_hash: 'e'.repeat(64),
    token_expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_by: '00000000-0000-4000-8000-000000000000',
  }

  for (const [who, client] of [
    ['anon', async () => anonClient()],
    ['angler@seed.test session', async () => signedIn(ANGLER.email, ANGLER.password)],
    ['guide session (owner of GUIDE_A)', async () => signedIn(GUIDE_USER, PASSWORD)],
  ] as const) {
    it(`${who}: select, insert, update and the functions are refused`, async () => {
      await create(INQ_CHECKS, GUIDE_A)
      const c = await client()
      const sel = await c.from('guide_requests').select('id, token_hash')
      const ins = await c.from('guide_requests').insert(probe)
      const upd = await c.from('guide_requests').update({ note: 'x' }).eq('inquiry_id', INQ_CHECKS)
      const fn  = await c.rpc('find_guide_request', { p_token_hash: 'e'.repeat(64) })
      expect({
        select: sel.error?.code, selectRows: sel.data?.length ?? 0,
        insert: ins.error?.code, update: upd.error?.code, rpc: fn.error?.code,
      }).toEqual({
        select: PERMISSION_DENIED, selectRows: 0,
        insert: PERMISSION_DENIED, update: PERMISSION_DENIED, rpc: PERMISSION_DENIED,
      })
    })
  }
})
