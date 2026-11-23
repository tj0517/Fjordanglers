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

import { sendGuideRequest, withdrawGuideRequestAction, saveGuideWhatsAppNumber } from '../guide-requests'
import { UnauthorizedError } from '@/lib/auth/guards'
import { listGuideRequestsForInquiry } from '@/lib/guide-requests/requests'

const INQ        = 'f5a00000-0000-4000-8000-000000000001'
const GUIDE      = 'f5a00000-0000-4000-8000-00000000000a'   // has a number
const GUIDE_NONE = 'f5a00000-0000-4000-8000-00000000000b'   // no number
const PHONE      = '+64211234567'

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
  await s.from('guide_contacts').delete().in('guide_id', [GUIDE, GUIDE_NONE])
  await s.from('guides').delete().in('id', [GUIDE, GUIDE_NONE])
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
  ])
  if (g.error != null) throw new Error(g.error.message)
})

afterAll(sweep)

beforeEach(async () => {
  requireAdmin.mockReset()
  requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => vi.spyOn(console, m))
  await resetInquiry()
  await svc().from('guide_contacts').delete().in('guide_id', [GUIDE, GUIDE_NONE])
  const c = await svc().from('guide_contacts').insert({ guide_id: GUIDE, phone_e164: PHONE })
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
    const s = svc()
    const other = 'f5a00000-0000-4000-8000-00000000000c'
    await s.from('guides').insert({ id: other, full_name: 'Second Fam05', country: 'New Zealand', is_beta_listing: true })
    await s.from('guide_contacts').insert({ guide_id: other, phone_e164: '+64219876543' })
    try {
      const first = await sendGuideRequest(INQ, GUIDE)
      const second = await sendGuideRequest(INQ, other)
      if (!first.success || !second.success) throw new Error('send failed')
      const list = await listGuideRequestsForInquiry(s, INQ)
      expect(list.map(r => r.guideName)).toEqual(['Second Fam05', 'Tama Fam05 Ngata'])
      const rendered = JSON.stringify(list)
      for (const link of [first.link, second.link]) expect(rendered.includes(link.split('/r/')[1])).toBe(false)
      expect(rendered.includes('token_hash')).toBe(false)
      expect(Object.keys(list[0]).sort()).toEqual([
        'altDates', 'answer', 'answeredAt', 'channel', 'expiresAt', 'firstOpenedAt', 'guideId', 'guideName',
        'note', 'requestId', 'sentAt', 'withdrawnAt',
      ])
    } finally {
      await s.from('inquiries').delete().eq('id', INQ)
      await s.from('guide_contacts').delete().eq('guide_id', other)
      await s.from('guides').delete().eq('id', other)
    }
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
