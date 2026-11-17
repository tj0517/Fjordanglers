/**
 * FA-M.04 — the request page `/r/[token]` against the real local stack (.env.test, 127.0.0.1 only).
 *
 * The server actions (`src/app/r/[token]/actions.ts`) and the page read (`getGuideRequestPage`)
 * are called directly; every write is checked by reading `guide_requests` and `inquiry_events`.
 *
 * Covers: the read writes nothing (D1 a); "opened" twice → one first_opened_at + one event;
 * Accept / Decline / Other dates each saved with one guide.request_answered; 0 / 4 / past dates
 * refused with nothing written; a second different answer refused with the stored one returned;
 * every refused token (wrong, malformed, expired, withdrawn, guide removed) gives one identical
 * result and writes nothing; the view carries an allowlisted set of fields only (D3 a: no FA notes); the brief without budget (D2 a);
 * region from the linked trip page, country only without one.
 *
 * Self-contained: fixed ids under f4a0…; swept in beforeAll / afterAll. Tokens are never printed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createGuideRequest, withdrawGuideRequest } from '../requests'
import { getGuideRequestPage, dateInZone } from '../page'
import { markRequestOpened, submitRequestAnswer } from '@/app/r/[token]/actions'

type Db = SupabaseClient<Database>

const GUIDE_A    = 'f4a00000-0000-4000-8000-00000000000a'
const GUIDE_GONE = 'f4a00000-0000-4000-8000-0000000000dd'
const INQ_IS     = 'f4a00000-0000-4000-8000-000000000001'   // Iceland, linked trip page, brief with budget
const INQ_BARE   = 'f4a00000-0000-4000-8000-000000000002'   // no trip page, no brief, no dates
const INQUIRIES  = [INQ_IS, INQ_BARE]
/** Seeded by supabase/seed.sql (Iceland / South-West); referenced, never changed. */
const SEED_PAGE  = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202'
const ZONE_IS    = 'Atlantic/Reykjavik'

let ADMIN_ID = ''

function svc(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function row(requestId: string) {
  const { data, error } = await svc().from('guide_requests')
    .select('first_opened_at, answered_at, answer, alt_dates, note').eq('id', requestId).single()
  if (error != null) throw new Error(error.message)
  return data
}

async function eventsFor(requestId: string, type: string) {
  const { data, error } = await svc().from('inquiry_events').select('type, payload')
    .eq('type', type).filter('payload->>request_id', 'eq', requestId)
  if (error != null) throw new Error(error.message)
  return data
}

async function create(inquiryId = INQ_IS, guideId = GUIDE_A) {
  return createGuideRequest(svc(), { inquiryId, guideId, channel: 'whatsapp', adminId: ADMIN_ID })
}

async function expire(requestId: string) {
  const { error } = await svc().from('guide_requests').update({
    sent_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    token_expires_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  }).eq('id', requestId)
  if (error != null) throw new Error(error.message)
}

async function sweep(): Promise<void> {
  const s = svc()
  await s.from('inquiries').delete().in('id', INQUIRIES)
  await s.from('guides').delete().in('id', [GUIDE_A, GUIDE_GONE])
}

beforeAll(async () => {
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')

  const g = await s.from('guides').insert([
    { id: GUIDE_A,    full_name: 'Ari Fam04',  country: 'Iceland', is_beta_listing: true },
    { id: GUIDE_GONE, full_name: 'Gone Fam04', country: 'Iceland', is_beta_listing: true },
  ])
  if (g.error != null) throw new Error(g.error.message)

  const i = await s.from('inquiries').insert([
    {
      id: INQ_IS, angler_name: 'FA-M.04 Test', angler_email: 'fam04-angler@seed.test', status: 'waiting_guide',
      trip_country: 'Iceland', experience_page_id: SEED_PAGE, party_size: 3,
      requested_dates: ['2027-06-14', '2027-06-12', '2027-06-13'],
      brief: {
        dates_mode: 'exact', date_from: '2027-06-12', date_to: '2027-06-14', days: 3,
        anglers: 3, non_anglers: 0, skill_level: 3, priority: 'trophy', fitness: 'mid', wading_ok: true,
        budget_ack: true, budget_band: 'EUR:200000-300000',
      },
    },
    {
      id: INQ_BARE, angler_name: 'FA-M.04 Test', angler_email: 'fam04-angler@seed.test', status: 'waiting_guide',
      trip_country: 'Iceland', party_size: 1,
    },
  ])
  if (i.error != null) throw new Error(i.error.message)
})

afterAll(sweep)

// ─── read ─────────────────────────────────────────────────────────────────────

describe('getGuideRequestPage', () => {
  it('returns the trip essentials: country + region from the trip page, sorted dates, party, brief without budget', async () => {
    const created = await create()
    const res = await getGuideRequestPage(svc(), created.token)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.view).toMatchObject({
      country: 'Iceland', region: 'South-West', partySize: 3,
      requestedDates: ['2027-06-12', '2027-06-13', '2027-06-14'],
      earliestAltDate: dateInZone(ZONE_IS, 1),
      answered: null,
    })
    expect(res.view.brief).toContain('Party: 3 angler(s)')
    expect(res.view.brief?.some(l => l.startsWith('Budget'))).toBe(false)
  })

  it('carries exactly the allowlisted fields — nothing else from the inquiry (D3 a: no FA notes)', async () => {
    const created = await create()
    const res = await getGuideRequestPage(svc(), created.token)
    expect(res.ok && Object.keys(res.view).sort()).toEqual(
      ['answered', 'brief', 'country', 'earliestAltDate', 'partySize', 'region', 'requestedDates'],
    )
  })

  it('without a trip page: country only (region null), no brief, no dates', async () => {
    const created = await create(INQ_BARE)
    const res = await getGuideRequestPage(svc(), created.token)
    expect(res.ok && res.view).toMatchObject({ country: 'Iceland', region: null, brief: null, requestedDates: [], partySize: 1 })
  })

  it('red proof (D1 a): the page read writes nothing — first_opened_at stays NULL, no guide.request_opened', async () => {
    const created = await create()
    await getGuideRequestPage(svc(), created.token)
    await getGuideRequestPage(svc(), created.token)
    expect((await row(created.requestId)).first_opened_at).toBeNull()
    expect(await eventsFor(created.requestId, 'guide.request_opened')).toHaveLength(0)
  })
})

// ─── opened ───────────────────────────────────────────────────────────────────

describe('markRequestOpened (server action, called by the rendered page)', () => {
  it('two calls → one first_opened_at, one guide.request_opened', async () => {
    const created = await create()
    await markRequestOpened(created.token)
    const first = (await row(created.requestId)).first_opened_at
    expect(first).not.toBeNull()
    await markRequestOpened(created.token)
    expect((await row(created.requestId)).first_opened_at).toBe(first)
    expect(await eventsFor(created.requestId, 'guide.request_opened')).toHaveLength(1)
  })

  it('a refused token records nothing and does not throw', async () => {
    const created = await create()
    await expire(created.requestId)
    await expect(markRequestOpened(created.token)).resolves.toBeUndefined()
    await expect(markRequestOpened(randomBytes(32).toString('base64url'))).resolves.toBeUndefined()
    await expect(markRequestOpened(42)).resolves.toBeUndefined()
    expect((await row(created.requestId)).first_opened_at).toBeNull()
    expect(await eventsFor(created.requestId, 'guide.request_opened')).toHaveLength(0)
  })
})

// ─── answers ──────────────────────────────────────────────────────────────────

describe('submitRequestAnswer — the three answers', () => {
  it('Accept is saved and writes one guide.request_answered', async () => {
    const created = await create()
    const out = await submitRequestAnswer(created.token, { answer: 'accepted' })
    expect(out).toMatchObject({ kind: 'saved', answered: { answer: 'accepted', altDates: [], note: null } })
    expect(await row(created.requestId)).toMatchObject({ answer: 'accepted', alt_dates: [], note: null })
    const ev = await eventsFor(created.requestId, 'guide.request_answered')
    expect(ev).toHaveLength(1)
    expect(ev[0].payload).toMatchObject({ answer: 'accepted', has_note: false })
  })

  it('Decline with a reason is saved (reason = request note) and writes one guide.request_answered', async () => {
    const created = await create()
    const out = await submitRequestAnswer(created.token, { answer: 'declined', note: 'Fully booked that week' })
    expect(out).toMatchObject({ kind: 'saved', answered: { answer: 'declined', note: 'Fully booked that week' } })
    expect(await row(created.requestId)).toMatchObject({ answer: 'declined', note: 'Fully booked that week' })
    const ev = await eventsFor(created.requestId, 'guide.request_answered')
    expect(ev).toHaveLength(1)
    expect(ev[0].payload).toMatchObject({ answer: 'declined', has_note: true })
  })

  it('Decline without a reason is saved with note null', async () => {
    const created = await create()
    expect(await submitRequestAnswer(created.token, { answer: 'declined', note: '' }))
      .toMatchObject({ kind: 'saved', answered: { answer: 'declined', note: null } })
  })

  it('Other dates (3) are saved and write one guide.request_answered with the dates', async () => {
    const created = await create()
    const dates = [dateInZone(ZONE_IS, 30), dateInZone(ZONE_IS, 10), dateInZone(ZONE_IS, 20)]
    const out = await submitRequestAnswer(created.token, { answer: 'other_dates', altDates: dates })
    expect(out).toMatchObject({ kind: 'saved', answered: { answer: 'other_dates', altDates: [...dates].sort() } })
    expect([...(await row(created.requestId)).alt_dates].sort()).toEqual([...dates].sort())
    const ev = await eventsFor(created.requestId, 'guide.request_answered')
    expect(ev).toHaveLength(1)
    expect(ev[0].payload).toMatchObject({ answer: 'other_dates' })
  })

  it('a later visit shows what was answered', async () => {
    const created = await create()
    await submitRequestAnswer(created.token, { answer: 'accepted' })
    const res = await getGuideRequestPage(svc(), created.token)
    expect(res.ok && res.view.answered).toMatchObject({ answer: 'accepted' })
  })
})

describe('submitRequestAnswer — refused on the server (red)', () => {
  async function nothingWritten(requestId: string) {
    expect(await row(requestId)).toMatchObject({ answered_at: null, answer: null })
    expect(await eventsFor(requestId, 'guide.request_answered')).toHaveLength(0)
  }

  it('0 dates → invalid, nothing written', async () => {
    const created = await create()
    expect(await submitRequestAnswer(created.token, { answer: 'other_dates', altDates: [] })).toEqual({ kind: 'invalid' })
    await nothingWritten(created.requestId)
  })

  it('4 dates → invalid, nothing written', async () => {
    const created = await create()
    const four = [10, 11, 12, 13].map(d => dateInZone(ZONE_IS, d))
    expect(await submitRequestAnswer(created.token, { answer: 'other_dates', altDates: four })).toEqual({ kind: 'invalid' })
    await nothingWritten(created.requestId)
  })

  it('a past date → date_not_in_future, nothing written', async () => {
    const created = await create()
    const out = await submitRequestAnswer(created.token, { answer: 'other_dates', altDates: [dateInZone(ZONE_IS, -1)] })
    expect(out).toEqual({ kind: 'date_not_in_future' })
    await nothingWritten(created.requestId)
  })

  it('today in the trip country → date_not_in_future (only from tomorrow there)', async () => {
    const created = await create()
    expect(await submitRequestAnswer(created.token, { answer: 'other_dates', altDates: [dateInZone(ZONE_IS, 0)] }))
      .toEqual({ kind: 'date_not_in_future' })
    await nothingWritten(created.requestId)
  })

  it('a note over 500 characters → invalid, nothing written', async () => {
    const created = await create()
    expect(await submitRequestAnswer(created.token, { answer: 'declined', note: 'x'.repeat(501) })).toEqual({ kind: 'invalid' })
    await nothingWritten(created.requestId)
  })

  it('a second, different answer is refused and the stored answer is returned', async () => {
    const created = await create()
    await submitRequestAnswer(created.token, { answer: 'accepted' })
    const second = await submitRequestAnswer(created.token, { answer: 'declined', note: 'changed my mind' })
    expect(second).toMatchObject({ kind: 'already_answered', answered: { answer: 'accepted', note: null } })
    expect(await row(created.requestId)).toMatchObject({ answer: 'accepted', note: null })
    expect(await eventsFor(created.requestId, 'guide.request_answered')).toHaveLength(1)
  })

  it('the same answer twice is saved once (no second event)', async () => {
    const created = await create()
    await submitRequestAnswer(created.token, { answer: 'accepted' })
    expect(await submitRequestAnswer(created.token, { answer: 'accepted' })).toMatchObject({ kind: 'saved' })
    expect(await eventsFor(created.requestId, 'guide.request_answered')).toHaveLength(1)
  })
})

// ─── refused links ────────────────────────────────────────────────────────────

describe('wrong, malformed, expired, withdrawn, guide-removed token — one identical result, nothing written', () => {
  it('the read gives { ok: false } with no reason, the answer gives { kind: expired }, for every case', async () => {
    const s = svc()
    const expired   = await create()
    const withdrawn = await create()
    const removed   = await create(INQ_IS, GUIDE_GONE)
    await expire(expired.requestId)
    expect(await withdrawGuideRequest(s, { requestId: withdrawn.requestId, adminId: ADMIN_ID })).toBe('withdrawn')
    await s.from('guides').delete().eq('id', GUIDE_GONE)

    const tokens = [randomBytes(32).toString('base64url'), 'not-a-token', expired.token, withdrawn.token, removed.token]
    for (const t of tokens) {
      expect(await getGuideRequestPage(s, t)).toEqual({ ok: false })
      expect(await submitRequestAnswer(t, { answer: 'accepted' })).toEqual({ kind: 'expired' })
    }
    for (const r of [expired, withdrawn]) {
      expect(await row(r.requestId)).toMatchObject({ first_opened_at: null, answered_at: null })
      expect(await eventsFor(r.requestId, 'guide.request_answered')).toHaveLength(0)
    }
  })
})
