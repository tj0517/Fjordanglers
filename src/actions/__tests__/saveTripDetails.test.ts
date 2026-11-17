/**
 * saveTripDetails — FA-M.07, against the real local stack (.env.test, 127.0.0.1 only).
 *
 * `requireAdmin` is mocked (no session in a unit run) and `createServiceClient` returns the local
 * service client; everything else is real: the upsert, the CHECKs, `emitEvent`, and the request
 * page read. Every write is checked by reading `inquiry_trip_details` and `inquiry_events`.
 *
 * Covers: non-admin refused (nothing written); invalid licence / over-long text refused (nothing
 * written); values at the limits save; the first save on an inquiry with no row (red on `main`:
 * guide_options null → NOT NULL, tj decision 2); one `inquiry.brief_updated` naming the changed
 * fields only; no change → no event; clearing the note → NULL in the row and gone from the
 * request page (tj decision 3); the guide's `guide_options` survive an admin save.
 *
 * Self-contained: fixed ids under f7a0…; swept in beforeAll / afterAll.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { saveTripDetails } from '../inquiries'
import { UnauthorizedError } from '@/lib/auth/guards'
import { createGuideRequest } from '@/lib/guide-requests/requests'
import { getGuideRequestPage } from '@/lib/guide-requests/page'
import type { TripBriefInput } from '@/lib/inquiries/trip-brief'

const INQ   = 'f7a00000-0000-4000-8000-000000000001'
const GUIDE = 'f7a00000-0000-4000-8000-00000000000a'

let ADMIN_ID = ''

const EMPTY: TripBriefInput = {
  confirmed_date: null, confirmed_party_size: null, price_range: null, date_flexibility: null,
  target_species: null, accommodation: null, guide_notes: null, licence_buyer: null, licence_note: null,
}

const BRIEF: TripBriefInput = {
  ...EMPTY,
  confirmed_date: '14–15 Jan 2027', confirmed_party_size: 2,
  accommodation: 'Client books — Tūrangi', licence_buyer: 'client', licence_note: 'Taupō licence',
  guide_notes: 'Early start on day 1.',
}

async function tripRow() {
  const { data, error } = await svc().from('inquiry_trip_details').select('*').eq('inquiry_id', INQ).maybeSingle()
  if (error != null) throw new Error(error.message)
  return data
}

async function briefEvents() {
  const { data, error } = await svc().from('inquiry_events')
    .select('type, actor_kind, actor_id, source, channel, payload')
    .eq('inquiry_id', INQ).eq('type', 'inquiry.brief_updated').order('occurred_at')
  if (error != null) throw new Error(error.message)
  return data
}

async function resetTrip() {
  // inquiry_events is append-only; a fresh inquiry per test keeps event counts exact.
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  const i = await s.from('inquiries').insert({
    id: INQ, angler_name: 'FA-M.07 Test', angler_email: 'fam07-angler@seed.test',
    status: 'waiting_guide', trip_country: 'New Zealand', party_size: 2,
  })
  if (i.error != null) throw new Error(i.error.message)
}

async function sweep() {
  const s = svc()
  await s.from('inquiries').delete().eq('id', INQ)
  await s.from('guides').delete().eq('id', GUIDE)
}

beforeAll(async () => {
  await sweep()
  const s = svc()
  const { data: users } = await s.auth.admin.listUsers({ perPage: 1000 })
  ADMIN_ID = users?.users.find(u => u.email === 'admin@seed.test')?.id ?? ''
  if (ADMIN_ID === '') throw new Error('admin@seed.test missing — run supabase db reset')
  const g = await s.from('guides').insert({ id: GUIDE, full_name: 'Tama Fam07', country: 'New Zealand', is_beta_listing: true })
  if (g.error != null) throw new Error(g.error.message)
})

afterAll(sweep)

beforeEach(async () => {
  requireAdmin.mockReset()
  requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  await resetTrip()
})

describe('saveTripDetails — who may call it', () => {
  it('a non-admin caller is refused and nothing is written', async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedError('Not authorized — admin role required'))
    await expect(saveTripDetails(INQ, BRIEF)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(await tripRow()).toBeNull()
    expect(await briefEvents()).toHaveLength(0)
  })
})

describe('saveTripDetails — validation', () => {
  it('red proof: an invalid licence buyer is refused, nothing written', async () => {
    const bad = { ...BRIEF, licence_buyer: 'fa' }
    const res = await saveTripDetails(INQ, bad)
    expect(res).toEqual({ success: false, error: 'Invalid trip brief: licence_buyer' })
    expect(await tripRow()).toBeNull()
    expect(await briefEvents()).toHaveLength(0)
  })

  it('over-long text is refused, nothing written — and an existing row is left as it was', async () => {
    expect((await saveTripDetails(INQ, BRIEF)).success).toBe(true)
    const before = await tripRow()
    for (const [field, len] of [['accommodation', 301], ['guide_notes', 2001], ['licence_note', 301]] as const) {
      const res = await saveTripDetails(INQ, { ...BRIEF, [field]: 'x'.repeat(len) })
      expect(res, field).toEqual({ success: false, error: `Invalid trip brief: ${field}` })
    }
    expect(await tripRow()).toEqual(before)
    expect(await briefEvents()).toHaveLength(1)
  })

  it('values at the limits (accommodation 300, FA note 2000, licence note 300) still save', async () => {
    const res = await saveTripDetails(INQ, {
      ...BRIEF, accommodation: 'a'.repeat(300), guide_notes: 'n'.repeat(2000), licence_note: 'l'.repeat(300),
    })
    expect(res).toEqual({ success: true })
    const row = await tripRow()
    expect([row?.accommodation?.length, row?.guide_notes?.length, row?.licence_note?.length]).toEqual([300, 2000, 300])
  })

  it('guide_options cannot be smuggled in through the admin save', async () => {
    const res = await saveTripDetails(INQ, { ...BRIEF, guide_options: [] } as unknown as TripBriefInput)
    expect(res.success).toBe(false)
    expect(await tripRow()).toBeNull()
  })
})

describe('saveTripDetails — the write and the event', () => {
  it('red on main (tj decision 2): the first save on an inquiry with no row writes the row', async () => {
    expect(await tripRow()).toBeNull()
    const res = await saveTripDetails(INQ, BRIEF)
    expect(res).toEqual({ success: true })
    expect(await tripRow()).toMatchObject({
      accommodation: 'Client books — Tūrangi', licence_buyer: 'client', licence_note: 'Taupō licence',
      guide_notes: 'Early start on day 1.', guide_options: [],
    })
  })

  it('writes one inquiry.brief_updated naming the changed fields — names only, never the text', async () => {
    await saveTripDetails(INQ, BRIEF)
    const events = await briefEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ actor_kind: 'admin', actor_id: ADMIN_ID, source: 'app', channel: 'app' })
    expect(events[0].payload).toEqual({
      fields: ['confirmed_date', 'confirmed_party_size', 'accommodation', 'guide_notes', 'licence_buyer', 'licence_note'],
    })
    expect(JSON.stringify(events[0].payload)).not.toMatch(/Tūrangi|Taupō|Early start/)
  })

  it('the same brief again: nothing changed → no second event', async () => {
    await saveTripDetails(INQ, BRIEF)
    expect(await saveTripDetails(INQ, { ...BRIEF, accommodation: '  Client books — Tūrangi  ' })).toEqual({ success: true })
    expect(await briefEvents()).toHaveLength(1)
  })

  it('the guide\'s offer options survive an admin save', async () => {
    const options = [{ id: 'o1', label: 'Two days', price: 1000, currency: 'NZD' }]
    const ins = await svc().from('inquiry_trip_details').insert({ inquiry_id: INQ, guide_options: options })
    if (ins.error != null) throw new Error(ins.error.message)
    expect(await saveTripDetails(INQ, BRIEF)).toEqual({ success: true })
    expect((await tripRow())?.guide_options).toEqual(options)
  })
})

describe('saveTripDetails — clearing a field (tj decision 3)', () => {
  it('save a note, clear it: the row holds NULL, the event names guide_notes, the request page no longer shows it', async () => {
    await saveTripDetails(INQ, BRIEF)
    const created = await createGuideRequest(svc(), { inquiryId: INQ, guideId: GUIDE, channel: 'whatsapp', adminId: ADMIN_ID })
    const shown = await getGuideRequestPage(svc(), created.token)
    expect(shown.ok && shown.view.faNote).toBe('Early start on day 1.')

    expect(await saveTripDetails(INQ, { ...BRIEF, guide_notes: '' })).toEqual({ success: true })

    expect((await tripRow())?.guide_notes).toBeNull()
    const events = await briefEvents()
    expect(events).toHaveLength(2)
    expect(events[1].payload).toEqual({ fields: ['guide_notes'] })
    const after = await getGuideRequestPage(svc(), created.token)
    expect(after.ok && after.view.faNote).toBeNull()
    expect(after.ok && after.view.licence).toBe('Client buys — Taupō licence')
  })
})
