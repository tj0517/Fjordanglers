/**
 * FA-M.06 — record_guide_request_reminder, listReminderStates and remindGuideOnWhatsAppAction against
 * the real local stack (.env.test, 127.0.0.1 only).
 *
 * `requireAdmin` is mocked (no session in a unit run), `createServiceClient` returns the local service
 * client. Everything else is real: the DB function, its refusals and its inquiry_events row, the guide's
 * number in guide_contacts, the season months of the guide's experience page. Nothing is sent — wa.me
 * is only a URL string here (no WhatsApp API, no Resend, no push).
 *
 * Request rows are fixture-inserted with chosen timestamps (sent 30 h ago, opened, expired, …): the
 * clock is controlled through those timestamps and through listReminderStates' `nowMs`.
 *
 * Self-contained: fixed ids under f6a0…; swept in beforeAll / afterAll.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
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

const requireAdmin = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => svc() }))
vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: () => requireAdmin(),
}))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'https://fa.test' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: vi.fn() }))

import { remindGuideOnWhatsAppAction } from '../guide-requests'
import { UnauthorizedError } from '@/lib/auth/guards'
import { listReminderStates, recordGuideRequestReminder, type ReminderOutcome } from '@/lib/guide-requests/reminder'

const INQ    = 'f6a00000-0000-4000-8000-000000000001'
const GUIDE  = 'f6a00000-0000-4000-8000-00000000000a'   // has a number, NZ season page
const PAGE   = 'f6a00000-0000-4000-8000-0000000000e1'
const PHONE  = '+64211234567'
const ANGLER = { email: 'angler@seed.test', password: 'seed-angler-password-2026' }
const PERMISSION_DENIED = '42501'
const HOUR = 3_600_000
const FN = 'record_guide_request_reminder'

let ADMIN_ID = ''

const ago    = (h: number) => new Date(Date.now() - h * HOUR).toISOString()
const future = (h: number) => new Date(Date.now() + h * HOUR).toISOString()

type RequestInsert = Database['public']['Tables']['guide_requests']['Insert']

/** A request row with chosen timestamps. Default: WhatsApp, sent 30 h ago, link valid 6 more days. */
async function makeRequest(over: Partial<RequestInsert> = {}): Promise<string> {
  const { data, error } = await svc().from('guide_requests').insert({
    inquiry_id: INQ, guide_id: GUIDE, channel: 'whatsapp',
    token_hash: randomBytes(32).toString('hex'),
    sent_at: ago(30), token_expires_at: future(6 * 24), created_by: ADMIN_ID,
    ...over,
  }).select('id').single()
  if (error != null) throw new Error(error.message)
  return data.id
}

async function remindedAt(id: string) {
  const { data, error } = await svc().from('guide_requests').select('reminded_at').eq('id', id).single()
  if (error != null) throw new Error(error.message)
  return data.reminded_at
}

async function events() {
  const { data, error } = await svc().from('inquiry_events')
    .select('type, actor_kind, actor_id, source, channel, payload').eq('inquiry_id', INQ).order('occurred_at')
  if (error != null) throw new Error(error.message)
  return data
}

async function resetInquiry() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  const i = await s.from('inquiries').insert({
    id: INQ, angler_name: 'FA-M.06 Angler Secret', angler_email: 'fam06-angler@seed.test',
    angler_phone: '+48500100200', status: 'waiting_guide', trip_country: 'New Zealand', party_size: 2,
    requested_dates: ['2027-01-14', '2027-01-15'],
  })
  if (i.error != null) throw new Error(i.error.message)
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  await s.from('experience_pages').delete().eq('id', PAGE)
  await s.from('guide_contacts').delete().eq('guide_id', GUIDE)
  await s.from('guides').delete().eq('id', GUIDE)
}

beforeAll(async () => {
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')
  const g = await s.from('guides').insert({ id: GUIDE, full_name: 'Tama Fam06 Ngata', country: 'New Zealand', is_beta_listing: true })
  if (g.error != null) throw new Error(g.error.message)
  // The guide's page: NZ season Oct–Apr. trg_sync_guide_id makes the active primary experience_guides row.
  const p = await s.from('experience_pages').insert({
    id: PAGE, experience_name: 'FA-M.06 Taupō', slug: 'fa-m06-taupo-test', country: 'New Zealand', region: 'Taupō',
    currency: 'NZD', status: 'draft', guide_id: GUIDE, price_from: 100, season_months: [10, 11, 12, 1, 2, 3, 4],
  })
  if (p.error != null) throw new Error(p.error.message)
  const c = await s.from('guide_contacts').insert({ guide_id: GUIDE, phone_e164: PHONE })
  if (c.error != null) throw new Error(c.error.message)
})

afterAll(sweep)

beforeEach(async () => {
  requireAdmin.mockReset()
  requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  await resetInquiry()
})

// ─── the DB function ────────────────────────────────────────────────────────────

describe('record_guide_request_reminder — one reminder per request', () => {
  it('first call → reminded (reminded_at set, one guide.request_reminded); second call → already_reminded, nothing more', async () => {
    const id = await makeRequest()
    expect(await recordGuideRequestReminder(svc(), { requestId: id, adminId: ADMIN_ID })).toBe('reminded')
    const first = await remindedAt(id)
    expect(first).not.toBeNull()

    expect(await recordGuideRequestReminder(svc(), { requestId: id, adminId: ADMIN_ID })).toBe('already_reminded')
    expect(await remindedAt(id)).toBe(first)

    const ev = (await events()).filter(e => e.type === 'guide.request_reminded')
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, source: 'app', channel: 'whatsapp' })
    // payload: request_id and guide_id only — no token, link, phone number or message text
    expect(ev[0].payload).toEqual({ request_id: id, guide_id: GUIDE })
  })
})

describe('record_guide_request_reminder — refusals write nothing', () => {
  const cases: Array<[Exclude<ReminderOutcome, 'reminded'>, () => Promise<string>]> = [
    ['not_found',        async () => 'f6a00000-0000-4000-8000-0000000000ff'],
    ['guide_removed',    () => makeRequest({ guide_id: null })],
    ['withdrawn',        () => makeRequest({ withdrawn_at: ago(1), withdrawn_by: ADMIN_ID })],
    ['already_answered', () => makeRequest({ answered_at: ago(2), answer: 'accepted' })],
    ['already_opened',   () => makeRequest({ first_opened_at: ago(2) })],
    ['already_reminded', () => makeRequest({ reminded_at: ago(3) })],
    ['wrong_channel',    () => makeRequest({ channel: 'email' })],
    ['expired',          () => makeRequest({ sent_at: ago(8 * 24), token_expires_at: ago(24) })],
  ]

  it.each(cases)('%s → refused; reminded_at unchanged, 0 events added', async (outcome, arrange) => {
    const id = await arrange()
    const before = outcome === 'not_found' ? null : await remindedAt(id)
    const eventsBefore = (await events()).length

    expect(await recordGuideRequestReminder(svc(), { requestId: id, adminId: ADMIN_ID })).toBe(outcome)

    if (outcome !== 'not_found') expect(await remindedAt(id)).toBe(before)
    expect(await events()).toHaveLength(eventsBefore)
  })

  it('an answered request whose link has also expired says already_answered (expired is checked last)', async () => {
    const id = await makeRequest({ sent_at: ago(8 * 24), token_expires_at: ago(24), answered_at: ago(7 * 24), answer: 'declined' })
    expect(await recordGuideRequestReminder(svc(), { requestId: id, adminId: ADMIN_ID })).toBe('already_answered')
  })

  it('p_admin_id NULL → SQLSTATE 22004, nothing written', async () => {
    const id = await makeRequest()
    // NULL is passed on purpose (the red case); the generated Args type says string.
    const { error } = await svc().rpc(FN, { p_request_id: id, p_admin_id: null as unknown as string })
    expect(error?.code).toBe('22004')
    expect(error?.message).toContain('admin id is required')
    expect(await remindedAt(id)).toBeNull()
    expect(await events()).toHaveLength(0)
  })
})

describe('record_guide_request_reminder — EXECUTE is service_role only', () => {
  it('anon is denied by the function grant', async () => {
    const id = await makeRequest()
    const { error } = await anon().rpc(FN, { p_request_id: id, p_admin_id: ADMIN_ID })
    expect(error?.code).toBe(PERMISSION_DENIED)
    expect(error?.message).toContain(`permission denied for function ${FN}`)
    expect(await remindedAt(id)).toBeNull()
  })

  it('an authenticated (angler) session is denied by the function grant', async () => {
    const id = await makeRequest()
    const c = anon()
    const { error: signInError } = await c.auth.signInWithPassword(ANGLER)
    expect(signInError).toBeNull()
    const { error } = await c.rpc(FN, { p_request_id: id, p_admin_id: ADMIN_ID })
    expect(error?.code).toBe(PERMISSION_DENIED)
    expect(error?.message).toContain(`permission denied for function ${FN}`)
    expect(await remindedAt(id)).toBeNull()
    expect(await events()).toHaveLength(0)
  })
})

// ─── the flag, read from the database with a controlled clock ───────────────────

describe('listReminderStates — flag computed at read time', () => {
  it('season rule from the guide page: January (in NZ season) flags after 12 h, not before', async () => {
    const sent = Date.now()
    const id = await makeRequest({ sent_at: new Date(sent).toISOString() })
    expect((await listReminderStates(svc(), { inquiryId: INQ }, sent + 11 * HOUR))[INQ]).toBeUndefined()
    expect((await listReminderStates(svc(), { inquiryId: INQ }, sent + 13 * HOUR))[INQ])
      .toMatchObject({ kind: 'not_opened', requestId: id, thresholdHours: 12, canRemind: true })
  })

  it('July (outside the season) waits 24 h', async () => {
    await svc().from('inquiries').update({ requested_dates: ['2027-07-10'] }).eq('id', INQ)
    const sent = Date.now()
    await makeRequest({ sent_at: new Date(sent).toISOString() })
    expect((await listReminderStates(svc(), { inquiryId: INQ }, sent + 13 * HOUR))[INQ]).toBeUndefined()
    expect((await listReminderStates(svc(), { inquiryId: INQ }, sent + 25 * HOUR))[INQ]).toMatchObject({ kind: 'not_opened', thresholdHours: 24 })
  })

  it('only the latest non-withdrawn request counts', async () => {
    await makeRequest({ sent_at: ago(40) })                                                     // older, still open
    const latest = await makeRequest({ sent_at: ago(20), first_opened_at: ago(19) })            // latest, opened
    await makeRequest({ sent_at: ago(10), withdrawn_at: ago(5), withdrawn_by: ADMIN_ID })       // newest but withdrawn
    expect((await listReminderStates(svc(), { inquiryId: INQ }))[INQ]).toBeUndefined()          // latest is opened → nothing
    expect(latest).toBeTruthy()
  })
})

// ─── the server action ─────────────────────────────────────────────────────────

describe('remindGuideOnWhatsAppAction', () => {
  it('records the reminder and returns a wa.me link whose text has no /r/ link, no token and no angler details', async () => {
    const id = await makeRequest()
    const res = await remindGuideOnWhatsAppAction(INQ, id)
    expect(res.success).toBe(true)
    if (!res.success) return

    const url = new URL(res.waUrl)
    expect(url.origin).toBe('https://wa.me')
    expect(url.pathname).toBe('/64211234567')
    const text = url.searchParams.get('text') ?? ''
    expect(text).toBe([
      'Hi Tama,',
      '',
      'Still waiting · Taupō, 14–15 Jan',
      '2 anglers. The client is waiting for an answer — the link is in my message above. One tap is enough.',
      '',
      'FjordAnglers',
    ].join('\n'))
    expect(text).not.toContain('/r/')
    expect(text).not.toMatch(/[A-Za-z0-9_-]{43}/)          // no token-shaped string
    expect(text).not.toContain('Angler Secret')
    expect(text).not.toContain('+48500100200')
    expect(text).not.toContain('fam06-angler')

    expect(await remindedAt(id)).not.toBeNull()
    expect((await events()).filter(e => e.type === 'guide.request_reminded')).toHaveLength(1)
    expect((await listReminderStates(svc(), { inquiryId: INQ }))[INQ]).toMatchObject({ kind: 'reminded', requestId: id })
  })

  it('second click is refused and changes nothing', async () => {
    const id = await makeRequest()
    expect((await remindGuideOnWhatsAppAction(INQ, id)).success).toBe(true)
    const at = await remindedAt(id)
    const res = await remindGuideOnWhatsAppAction(INQ, id)
    expect(res.success).toBe(false)
    expect(await remindedAt(id)).toBe(at)
    expect((await events()).filter(e => e.type === 'guide.request_reminded')).toHaveLength(1)
  })

  it('inside the threshold → refused on the server (not only by hiding the button), nothing written', async () => {
    const id = await makeRequest({ sent_at: ago(2) })
    expect(await remindGuideOnWhatsAppAction(INQ, id)).toEqual({ success: false, error: expect.stringContaining('does not need a reminder') })
    expect(await remindedAt(id)).toBeNull()
    expect(await events()).toHaveLength(0)
  })

  it('email request → refused, nothing written', async () => {
    const id = await makeRequest({ channel: 'email' })
    expect((await remindGuideOnWhatsAppAction(INQ, id)).success).toBe(false)
    expect(await remindedAt(id)).toBeNull()
    expect(await events()).toHaveLength(0)
  })

  it('guide without a WhatsApp number → refused before anything is recorded', async () => {
    await svc().from('guide_contacts').delete().eq('guide_id', GUIDE)
    try {
      const id = await makeRequest()
      expect(await remindGuideOnWhatsAppAction(INQ, id)).toEqual({ success: false, error: expect.stringContaining('no WhatsApp number') })
      expect(await remindedAt(id)).toBeNull()
      expect(await events()).toHaveLength(0)
    } finally {
      await svc().from('guide_contacts').insert({ guide_id: GUIDE, phone_e164: PHONE })
    }
  })

  it('non-admin (guide / angler session) is refused before anything is read or written', async () => {
    const id = await makeRequest()
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(remindGuideOnWhatsAppAction(INQ, id)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await remindedAt(id)).toBeNull()
    expect(await events()).toHaveLength(0)
  })
})
