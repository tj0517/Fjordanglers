/**
 * FA-M.05 — sendGuideRequest / withdrawGuideRequestAction / saveGuideWhatsAppNumber against the real
 * local stack (.env.test, 127.0.0.1 only).
 *
 * `requireAdmin` is mocked (no session in a unit run), `createServiceClient` returns the local
 * service client, `getAppUrl` is fixed. Everything else is real: guide_contacts, the
 * create_guide_request / withdraw_guide_request functions and their inquiry_events rows.
 * No network: wa.me is only a URL string here; nothing is sent (no WhatsApp API, no Resend).
 *
 * Covers: send with a number → one request + one guide.request_sent (channel whatsapp), wa.me URL
 * with the E.164 digits and `/r/<token>` in the decoded text, token only in the response (not in
 * any row, event or log line); send without a number → error, zero requests, zero events;
 * non-admin refused on all three actions with nothing written; invalid number rejected, valid one
 * stored normalised, empty clears; withdraw → withdrawn + one guide.request_withdrawn.
 *
 * Self-contained: fixed ids under f5a0…; swept in beforeAll / afterAll. Tokens are never printed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
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

const requireAdmin = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => svc() }))
vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: () => requireAdmin(),
}))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'https://fa.test' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  sendGuideRequest, withdrawGuideRequestAction, saveGuideWhatsAppNumber,
  acceptGuideRequestOnBehalfAction, unassignGuideWithoutRequestAction,
} from '../guide-requests'
import { UnauthorizedError } from '@/lib/auth/guards'
import { listGuideRequestsForInquiry } from '@/lib/guide-requests/requests'

const INQ        = 'f5a00000-0000-4000-8000-000000000001'
const GUIDE      = 'f5a00000-0000-4000-8000-00000000000a'   // has a number
const GUIDE_NONE = 'f5a00000-0000-4000-8000-00000000000b'   // no number
const GUIDE_2    = 'f5a00000-0000-4000-8000-00000000000c'   // second guide, has a number (guide change)
const PHONE      = '+64211234567'
const ANGLER     = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }
const PERMISSION_DENIED = '42501'

let ADMIN_ID = ''
let logSpies: Array<ReturnType<typeof vi.spyOn>> = []

async function requestRows() {
  const { data, error } = await svc().from('guide_requests').select('*').eq('inquiry_id', INQ)
  if (error != null) throw new Error(error.message)
  return data
}

async function events(type?: string) {
  let q = svc().from('inquiry_events').select('type, actor_kind, actor_id, channel, payload').eq('inquiry_id', INQ)
  if (type != null) q = q.eq('type', type)
  const { data, error } = await q.order('occurred_at')
  if (error != null) throw new Error(error.message)
  return data
}

async function contact(guideId: string) {
  const { data, error } = await svc().from('guide_contacts').select('phone_e164').eq('guide_id', guideId).maybeSingle()
  if (error != null) throw new Error(error.message)
  return data
}

async function resetInquiry() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  const i = await s.from('inquiries').insert({
    id: INQ, angler_name: 'FA-M.05 Test', angler_email: 'fam05-angler@seed.test',
    status: 'waiting_guide', trip_country: 'New Zealand', party_size: 2,
    requested_dates: ['2027-01-14', '2027-01-15'],
  })
  if (i.error != null) throw new Error(i.error.message)
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  await s.from('guide_contacts').delete().in('guide_id', [GUIDE, GUIDE_NONE, GUIDE_2])
  await s.from('guides').delete().in('id', [GUIDE, GUIDE_NONE, GUIDE_2])
}

async function inquiry() {
  const { data, error } = await svc().from('inquiries')
    .select('assigned_guide_id, assigned_at, guide_acceptance, guide_responded_at, trip_country').eq('id', INQ).single()
  if (error != null) throw new Error(error.message)
  return data
}

function anon(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Every argument of every console call so far, as one string. */
function loggedText(): string {
  return logSpies.flatMap(spy => spy.mock.calls.flat()).map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join('\n')
}

beforeAll(async () => {
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')
  const g = await s.from('guides').insert([
    { id: GUIDE,      full_name: 'Tama Fam05 Ngata', country: 'New Zealand', is_beta_listing: true },
    { id: GUIDE_NONE, full_name: 'Nopho Fam05',      country: 'New Zealand', is_beta_listing: true },
    { id: GUIDE_2,    full_name: 'Second Fam05',     country: 'Iceland',     is_beta_listing: true },
  ])
  if (g.error != null) throw new Error(g.error.message)
})

afterAll(sweep)

beforeEach(async () => {
  requireAdmin.mockReset()
  requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => vi.spyOn(console, m))
  await resetInquiry()
  await svc().from('guide_contacts').delete().in('guide_id', [GUIDE, GUIDE_NONE, GUIDE_2])
  const c = await svc().from('guide_contacts').insert([
    { guide_id: GUIDE, phone_e164: PHONE }, { guide_id: GUIDE_2, phone_e164: '+3545551234' },
  ])
  if (c.error != null) throw new Error(c.error.message)
})

afterEach(() => {
  logSpies.forEach(s => s.mockRestore())
})

describe('sendGuideRequest', () => {
  it('creates exactly one request and one guide.request_sent (whatsapp) and returns a wa.me link with /r/<token>', async () => {
    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    if (!res.success) return

    const url = new URL(res.waUrl)
    expect(url.origin).toBe('https://wa.me')
    expect(url.pathname).toBe('/64211234567')                        // E.164 digits, no '+'
    const text = url.searchParams.get('text') ?? ''
    const token = res.link.split('/r/')[1] ?? ''
    expect(res.link).toMatch(/^https:\/\/fa\.test\/r\/[A-Za-z0-9_-]{43}$/)
    expect(text.includes(`/r/${token}`)).toBe(true)
    expect(text).toContain('Hi Tama,')
    expect(text).toContain('New request · New Zealand, 14–15 Jan')
    expect(text).toContain('2 anglers. Tap to accept, decline or suggest dates:')

    const rows = await requestRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ guide_id: GUIDE, channel: 'whatsapp', created_by: ADMIN_ID })
    const sent = await events('guide.request_sent')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, channel: 'whatsapp' })
    expect(sent[0].payload).toMatchObject({ request_id: rows[0].id, guide_id: GUIDE, channel: 'whatsapp' })

    // The token is only in the response: the row holds its sha256, no row / event / log line holds it.
    expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(rows).includes(token)).toBe(false)
    expect(JSON.stringify(await events()).includes(token)).toBe(false)
    expect(loggedText().includes(token)).toBe(false)

    // The summary on inquiries points at the guide (the offer path reads it).
    const { data: inq } = await svc().from('inquiries').select('assigned_guide_id, guide_acceptance').eq('id', INQ).single()
    expect(inq).toEqual({ assigned_guide_id: GUIDE, guide_acceptance: null })
  })

  it('guide without a WhatsApp number → error, zero requests, zero events', async () => {
    const res = await sendGuideRequest(INQ, GUIDE_NONE)
    expect(res).toEqual({ success: false, error: expect.stringContaining('no WhatsApp number') })
    expect(await requestRows()).toHaveLength(0)
    expect(await events()).toHaveLength(0)
  })

  it('non-admin is refused before anything is written', async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(sendGuideRequest(INQ, GUIDE)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await requestRows()).toHaveLength(0)
    expect(await events()).toHaveLength(0)
  })
})

describe('listGuideRequestsForInquiry (what the card renders after a reload)', () => {
  it('lists two requests after a guide change, newest first, with no token or token hash', async () => {
    const first = await sendGuideRequest(INQ, GUIDE)
    const second = await sendGuideRequest(INQ, GUIDE_2)
    if (!first.success || !second.success) throw new Error('send failed')
    const list = await listGuideRequestsForInquiry(svc(), INQ)
    expect(list.map(r => r.guideName)).toEqual(['Second Fam05', 'Tama Fam05 Ngata'])
    const rendered = JSON.stringify(list)
    for (const link of [first.link, second.link]) expect(rendered.includes(link.split('/r/')[1])).toBe(false)
    expect(rendered.includes('token_hash')).toBe(false)
    expect(Object.keys(list[0]).sort()).toEqual([
      'altDates', 'answer', 'answeredAt', 'channel', 'expired', 'expiresAt', 'firstOpenedAt', 'guideId', 'guideName',
      'note', 'requestId', 'sentAt', 'withdrawnAt',
    ])
  })
})

describe('D5 (a) — a new request withdraws the inquiry’s other open requests', () => {
  it('guide change: the previous open request is withdrawn (not detached), the new guide is attached, no warning', async () => {
    const first = await sendGuideRequest(INQ, GUIDE)
    const second = await sendGuideRequest(INQ, GUIDE_2)
    expect(first).toMatchObject({ success: true, warning: null })
    expect(second).toMatchObject({ success: true, warning: null })

    const rows = await requestRows()
    const byGuide = Object.fromEntries(rows.map(r => [r.guide_id, r]))
    expect(byGuide[GUIDE].withdrawn_at).not.toBeNull()
    expect(byGuide[GUIDE_2].withdrawn_at).toBeNull()
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE_2)

    expect(await events('guide.request_sent')).toHaveLength(2)
    const withdrawn = await events('guide.request_withdrawn')
    expect(withdrawn).toHaveLength(1)
    expect(withdrawn[0].payload).toMatchObject({ request_id: byGuide[GUIDE].id, detached: false })
  })

  it('sending again to the same guide withdraws the old link; an answered request is left alone', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [old] = await requestRows()
    await svc().from('guide_requests').update({ answer: 'declined', answered_at: new Date().toISOString() }).eq('id', old.id)
    await sendGuideRequest(INQ, GUIDE_2)                       // answered → not withdrawn
    await sendGuideRequest(INQ, GUIDE_2)                       // the first GUIDE_2 request → withdrawn
    const rows = (await requestRows()).sort((a, b) => a.sent_at.localeCompare(b.sent_at))
    expect(rows.map(r => r.withdrawn_at != null)).toEqual([false, true, false])
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE_2)
  })
})

describe('withdrawGuideRequestAction', () => {
  it('withdraws the request and writes one guide.request_withdrawn', async () => {
    const res = await sendGuideRequest(INQ, GUIDE)
    expect(res.success).toBe(true)
    const [row] = await requestRows()

    expect(await withdrawGuideRequestAction(INQ, row.id)).toEqual({ success: true })
    const [after] = await requestRows()
    expect(after.withdrawn_at).not.toBeNull()
    expect(after.withdrawn_by).toBe(ADMIN_ID)
    expect(await events('guide.request_withdrawn')).toHaveLength(1)
  })

  it('D2 (a): withdrawing the latest request detaches the guide ("No guide") in the same transaction', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE)
    expect(await withdrawGuideRequestAction(INQ, row.id)).toEqual({ success: true })
    expect(await inquiry()).toMatchObject({ assigned_guide_id: null, assigned_at: null, guide_acceptance: null, guide_responded_at: null })
    const [ev] = await events('guide.request_withdrawn')
    expect(ev).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID })
    expect(ev.payload).toMatchObject({ request_id: row.id, guide_id: GUIDE, detached: true })
  })

  it('withdrawing an older request after a guide change leaves the new guide attached', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [older] = await requestRows()
    await sendGuideRequest(INQ, GUIDE_2)                       // D5 withdrew `older` already
    expect(await withdrawGuideRequestAction(INQ, older.id)).toEqual({ success: true })   // already withdrawn → no-op
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE_2)
    expect(await events('guide.request_withdrawn')).toHaveLength(1)
  })

  it('double withdraw: the second call writes nothing (no second event)', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    await withdrawGuideRequestAction(INQ, row.id)
    const first = await requestRows()
    expect(await withdrawGuideRequestAction(INQ, row.id)).toEqual({ success: true })
    expect(await requestRows()).toEqual(first)
    expect(await events('guide.request_withdrawn')).toHaveLength(1)
  })

  it('wrong request id → error, nothing written', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const res = await withdrawGuideRequestAction(INQ, 'f5a00000-0000-4000-8000-0000000000ff')
    expect(res).toEqual({ success: false, error: 'Request not found.' })
    expect(await events('guide.request_withdrawn')).toHaveLength(0)
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE)
  })

  it('non-admin is refused; the request stays open, no event', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(withdrawGuideRequestAction(INQ, row.id)).rejects.toBeInstanceOf(UnauthorizedError)
    const [after] = await requestRows()
    expect(after.withdrawn_at).toBeNull()
    expect(await events('guide.request_withdrawn')).toHaveLength(0)
  })
})

describe('saveGuideWhatsAppNumber', () => {
  it('rejects a value that is not E.164 and keeps the stored number', async () => {
    for (const bad of ['0211234567', '+64 21', 'call me', '+0211234567', '+1234567890123456']) {
      const res = await saveGuideWhatsAppNumber(GUIDE, bad)
      expect(res.success, bad).toBe(false)
    }
    expect(await contact(GUIDE)).toEqual({ phone_e164: PHONE })
  })

  it('stores a valid number normalised to E.164 (new row) and clears it with an empty value', async () => {
    expect(await contact(GUIDE_NONE)).toBeNull()
    expect(await saveGuideWhatsAppNumber(GUIDE_NONE, ' +47 (912) 34-567 ')).toEqual({ success: true, phoneE164: '+4791234567' })
    expect(await contact(GUIDE_NONE)).toEqual({ phone_e164: '+4791234567' })

    expect(await saveGuideWhatsAppNumber(GUIDE_NONE, '')).toEqual({ success: true, phoneE164: null })
    expect(await contact(GUIDE_NONE)).toEqual({ phone_e164: null })
  })

  it('non-admin is refused; nothing is written', async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(saveGuideWhatsAppNumber(GUIDE_NONE, '+4791234567')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await contact(GUIDE_NONE)).toBeNull()
  })
})

describe('D4 (a) — trip country from the guide', () => {
  it('an inquiry with no trip country takes the guide’s; the event says so', async () => {
    await svc().from('inquiries').update({ trip_country: null }).eq('id', INQ)
    const res = await sendGuideRequest(INQ, GUIDE_2)
    expect((await inquiry()).trip_country).toBe('Iceland')
    // the message names the same area the inquiry now has
    if (!res.success) throw new Error('send failed')
    expect(new URL(res.waUrl).searchParams.get('text')).toContain('New request · Iceland, 14–15 Jan')
    const [ev] = await events('guide.request_sent')
    expect(ev.payload).toMatchObject({ trip_country_set: 'Iceland' })
  })

  it('a country already on the inquiry is never overwritten', async () => {
    await sendGuideRequest(INQ, GUIDE_2)                       // inquiry is New Zealand, guide Iceland
    expect((await inquiry()).trip_country).toBe('New Zealand')
    const [ev] = await events('guide.request_sent')
    expect(ev.payload).toMatchObject({ trip_country_set: null })
  })
})

describe('D1 (b) — acceptGuideRequestOnBehalfAction', () => {
  it('records accepted with the ADMIN as the actor; guide_responded_at stays NULL', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    expect(await acceptGuideRequestOnBehalfAction(INQ, row.id)).toEqual({ success: true })

    const [after] = await requestRows()
    expect(after).toMatchObject({ answer: 'accepted', note: null, alt_dates: [] })
    expect(after.answered_at).not.toBeNull()
    expect(await inquiry()).toMatchObject({ assigned_guide_id: GUIDE, guide_acceptance: 'accepted', guide_responded_at: null })

    const answered = await events('guide.request_answered')
    expect(answered).toHaveLength(1)
    expect(answered[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, channel: 'app' })
    expect(answered[0].payload).toMatchObject({ request_id: row.id, guide_id: GUIDE, answer: 'accepted', on_behalf_of_guide: true })

    // again: no-op, no second event
    expect(await acceptGuideRequestOnBehalfAction(INQ, row.id)).toEqual({ success: true })
    expect(await events('guide.request_answered')).toHaveLength(1)
  })

  it('a request the guide already declined is not overwritten', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    await svc().from('guide_requests').update({ answer: 'declined', answered_at: new Date().toISOString() }).eq('id', row.id)
    expect(await acceptGuideRequestOnBehalfAction(INQ, row.id)).toEqual({ success: false, error: 'The guide has already answered this request.' })
    expect((await requestRows())[0].answer).toBe('declined')
    expect(await events('guide.request_answered')).toHaveLength(0)
  })

  it('withdrawn request / wrong request id → refused, nothing written', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    await withdrawGuideRequestAction(INQ, row.id)
    expect(await acceptGuideRequestOnBehalfAction(INQ, row.id)).toEqual({ success: false, error: 'This request was withdrawn.' })
    expect(await acceptGuideRequestOnBehalfAction(INQ, 'f5a00000-0000-4000-8000-0000000000ff')).toEqual({ success: false, error: 'Request not found.' })
    expect((await requestRows())[0].answer).toBeNull()
    expect(await events('guide.request_answered')).toHaveLength(0)
  })

  it('non-admin is refused; nothing written', async () => {
    await sendGuideRequest(INQ, GUIDE)
    const [row] = await requestRows()
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(acceptGuideRequestOnBehalfAction(INQ, row.id)).rejects.toBeInstanceOf(UnauthorizedError)
    expect((await requestRows())[0].answer).toBeNull()
    expect(await events('guide.request_answered')).toHaveLength(0)
  })
})

describe('D3 (a) — unassignGuideWithoutRequestAction', () => {
  it('detaches a guide attached without a request (pre-FA-M.03) and emits guide.unassigned', async () => {
    await svc().from('inquiries').update({ assigned_guide_id: GUIDE, assigned_at: new Date().toISOString(), guide_acceptance: 'accepted', guide_responded_at: new Date().toISOString() }).eq('id', INQ)
    expect(await unassignGuideWithoutRequestAction(INQ)).toEqual({ success: true })
    expect(await inquiry()).toMatchObject({ assigned_guide_id: null, assigned_at: null, guide_acceptance: null, guide_responded_at: null })
    const ev = await events('guide.unassigned')
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, channel: 'app', payload: { guide_id: GUIDE } })
  })

  it('a guide with an open request → refused (withdraw instead), nothing changed', async () => {
    await sendGuideRequest(INQ, GUIDE)
    expect(await unassignGuideWithoutRequestAction(INQ)).toEqual({ success: false, error: 'This guide has an open request — withdraw the request instead.' })
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE)
    expect(await events('guide.unassigned')).toHaveLength(0)
  })

  it('no guide attached → refused', async () => {
    expect(await unassignGuideWithoutRequestAction(INQ)).toEqual({ success: false, error: 'No guide is attached.' })
    expect(await events('guide.unassigned')).toHaveLength(0)
  })

  it('non-admin is refused; nothing changed', async () => {
    await svc().from('inquiries').update({ assigned_guide_id: GUIDE }).eq('id', INQ)
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(unassignGuideWithoutRequestAction(INQ)).rejects.toBeInstanceOf(UnauthorizedError)
    expect((await inquiry()).assigned_guide_id).toBe(GUIDE)
    expect(await events('guide.unassigned')).toHaveLength(0)
  })
})

describe('database guards on the two new functions (tj condition 2)', () => {
  const FNS = ['accept_guide_request_on_behalf', 'unassign_guide_without_request'] as const

  async function call(client: Db, fn: typeof FNS[number], adminId: string | null) {
    const id = fn === 'accept_guide_request_on_behalf' ? { p_request_id: INQ } : { p_inquiry_id: INQ }
    // adminId null is passed on purpose (the red case); the generated Args type says string.
    return client.rpc(fn, { ...id, p_admin_id: adminId as string } as never)
  }

  it.each(FNS)('%s: anon is denied', async fn => {
    const { error } = await call(anon(), fn, ADMIN_ID)
    expect(error?.code).toBe(PERMISSION_DENIED)
    // the FUNCTION refuses (EXECUTE revoked) — not merely a table behind it
    expect(error?.message).toContain(`permission denied for function ${fn}`)
  })

  it.each(FNS)('%s: an authenticated (angler) session is denied', async fn => {
    const c = anon()
    const { error: signInError } = await c.auth.signInWithPassword(ANGLER)
    expect(signInError).toBeNull()
    const { error } = await call(c, fn, ADMIN_ID)
    expect(error?.code).toBe(PERMISSION_DENIED)
    expect(error?.message).toContain(`permission denied for function ${fn}`)
  })

  it.each(FNS)('%s: NULL admin id raises', async fn => {
    await svc().from('inquiries').update({ assigned_guide_id: GUIDE }).eq('id', INQ)
    const { error } = await call(svc(), fn, null)
    expect(error?.code).toBe('22004')
    expect(error?.message).toContain('admin id is required')
  })
})

