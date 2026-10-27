/**
 * FA-1.74 — editable offer: updateOfferOptions + markAsGuideOffer without a source message.
 *
 * Pure — no network. The service client is an in-memory fake of the four tables the
 * actions touch (inquiries, offers, offer_options, inquiry_events). Each write commits on
 * its own, like a PostgREST call; a delete that leaves an offer with no options is
 * rejected and undone, like the DEFERRABLE `offer_options_preserve_min` trigger.
 * `failOn` makes the n-th write to a table fail, to prove the rollback.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/inquiries/state', () => ({
  transition:      vi.fn().mockResolvedValue(undefined),
  TransitionError: class TransitionError extends Error {},
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient:        vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/stripe/client', () => ({ stripe: {} }))
vi.mock('@/lib/ai/draft-deposit-link', () => ({
  draftDepositLinkMessage:       vi.fn(),
  buildStripeProductName:        vi.fn(),
  buildStripeProductDescription: vi.fn(),
}))
vi.mock('@/lib/ai/knowledge', () => ({ loadKnowledge: vi.fn() }))
vi.mock('@/lib/inquiries/experience-lookup', () => ({
  getInquiryExperience: vi.fn(),
  tripTitleOf:          vi.fn(),
  TRIP_TITLE_FALLBACK:  'Your trip',
}))
vi.mock('@/lib/guide-contacts', () => ({ getGuidePhone: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://test.example.com' } }))

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { updateOfferOptions, markAsGuideOffer } from '@/actions/messages'

// ─── In-memory fake ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>
type Table = 'inquiries' | 'offers' | 'offer_options' | 'inquiry_events' | 'messages'
type Db = Record<Table, Row[]>

interface FakeOpts {
  /** Fail the n-th (1-based) write of this kind to this table. */
  failOn?: Array<{ table: Table; op: 'upsert' | 'delete' | 'insert'; nth: number }>
}

let seq = 0
const newId = (p: string) => `${p}-new-${++seq}`

function makeFake(db: Db, opts: FakeOpts = {}) {
  const writes: Record<string, number> = {}
  function shouldFail(table: Table, op: string): boolean {
    const k = `${table}:${op}`
    writes[k] = (writes[k] ?? 0) + 1
    return (opts.failOn ?? []).some(f => f.table === table && f.op === op && f.nth === writes[k])
  }

  function from(table: Table) {
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'upsert' | 'delete' | 'insert' = 'select'
    let payload: Row[] = []
    let returning = false
    let sortKey: string | null = null

    function run(): { data: unknown; error: { message: string } | null } {
      const rows = db[table]
      if (op === 'select') {
        let out = rows.filter(r => filters.every(f => f(r)))
        if (sortKey != null) {
          const k = sortKey
          out = [...out].sort((a, b) => String(a[k]).localeCompare(String(b[k])))
        }
        return { data: out.map(r => ({ ...r })), error: null }
      }
      if (shouldFail(table, op)) return { data: null, error: { message: `injected ${op} failure on ${table}` } }
      if (op === 'upsert' || op === 'insert') {
        const written: Row[] = []
        for (const p of payload) {
          const existing = p.id != null ? rows.find(r => r.id === p.id) : undefined
          if (existing != null) { Object.assign(existing, p); written.push(existing); continue }
          const row: Row = {
            id: p.id ?? newId(table),
            created_at: `2026-10-27T12:00:${String(++seq).padStart(2, '0')}Z`,
            ...(table === 'offer_options' ? { is_accepted: false, notes: null, includes: [] } : {}),
            ...p,
          }
          rows.push(row)
          written.push(row)
        }
        return { data: returning ? written.map(r => ({ ...r })) : null, error: null }
      }
      // delete — then the deferred min-one trigger at "commit"
      const snapshot = rows.map(r => ({ ...r }))
      const gone = rows.filter(r => filters.every(f => f(r)))
      db[table] = rows.filter(r => !gone.includes(r))
      if (table === 'offer_options') {
        for (const g of gone) {
          const offerAlive = db.offers.some(o => o.id === g.offer_id)
          if (offerAlive && !db.offer_options.some(o => o.offer_id === g.offer_id)) {
            db[table] = snapshot
            return { data: null, error: { message: `offer ${String(g.offer_id)} must retain at least one option` } }
          }
        }
      }
      return { data: null, error: null }
    }

    const q = {
      select(_cols?: string) { if (op !== 'select') returning = true; return q },
      eq(col: string, val: unknown) { filters.push(r => r[col] === val); return q },
      in(col: string, vals: unknown[]) { filters.push(r => vals.includes(r[col])); return q },
      order(col: string) { sortKey = col; return q },
      upsert(rows: Row[]) { op = 'upsert'; payload = rows; return q },
      insert(row: Row | Row[]) { op = 'insert'; payload = Array.isArray(row) ? row : [row]; return q },
      delete() { op = 'delete'; return q },
      async maybeSingle() {
        const { data, error } = run()
        return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
      },
      async single() {
        const { data, error } = run()
        const one = Array.isArray(data) ? (data[0] ?? null) : data
        return { data: one, error: error ?? (one == null ? { message: 'no row' } : null) }
      },
      then<T>(resolve: (v: { data: unknown; error: { message: string } | null }) => T) {
        return Promise.resolve(run()).then(resolve)
      },
    }
    return q
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    if (name !== 'create_offer_with_options') return { data: null, error: { message: 'unknown rpc' } }
    const offerId = newId('offer')
    db.offers.push({
      id: offerId, inquiry_id: args.p_inquiry_id, guide_id: args.p_guide_id,
      source_message_id: args.p_source_message_id, status: 'draft',
    })
    for (const o of args.p_options as Row[]) {
      db.offer_options.push({
        id: newId('opt'), offer_id: offerId, label: o.label, price_cents: o.price_cents,
        currency: o.currency, is_accepted: false, created_at: `2026-10-27T12:00:${String(++seq).padStart(2, '0')}Z`,
      })
    }
    return { data: offerId, error: null }
  }

  return { from, rpc }
}

function useDb(db: Db, opts?: FakeOpts) {
  vi.mocked(createServiceClient).mockReturnValue(makeFake(db, opts) as unknown as ReturnType<typeof createServiceClient>)
}

function mockAdmin(userId = 'admin-1') {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'admin' }, error: null }) }) }) }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function seed(over: { offerStatus?: string; inquiryStatus?: string; accepted?: boolean } = {}): Db {
  return {
    inquiries: [{ id: 'inq-1', status: over.inquiryStatus ?? 'offer_presented' }],
    offers:    [{ id: 'off-1', inquiry_id: 'inq-1', status: over.offerStatus ?? 'presented', source_message_id: null }],
    offer_options: [
      { id: 'opt-1', offer_id: 'off-1', label: '3 days', price_cents: 300000, currency: 'eur', is_accepted: over.accepted ?? false, created_at: '2026-10-01T00:00:01Z', notes: null, includes: [] },
      { id: 'opt-2', offer_id: 'off-1', label: '5 days', price_cents: 450000, currency: 'eur', is_accepted: false, created_at: '2026-10-01T00:00:02Z', notes: 'lodge', includes: ['lodge'] },
    ],
    inquiry_events: [],
    messages: [],
  }
}

const opts = (db: Db) => db.offer_options.filter(o => o.offer_id === 'off-1')
const events = (db: Db, type: string) => db.inquiry_events.filter(e => e.type === type)

beforeEach(() => { vi.clearAllMocks(); mockAdmin() })

// ─── updateOfferOptions ───────────────────────────────────────────────────────

describe('updateOfferOptions — price change keeps the stage', () => {
  for (const [offerStatus, inquiryStatus, accepted] of [
    ['presented', 'offer_presented', false],
    ['accepted',  'offer_presented', true],
  ] as const) {
    it(`${offerStatus} offer: new price saved, statuses unchanged, exactly one offer.updated with before/after`, async () => {
      const db = seed({ offerStatus, inquiryStatus, accepted })
      useDb(db)

      const res = await updateOfferOptions('off-1', [
        { id: 'opt-1', label: '3 days', priceCents: 320000, currency: 'eur' },
        { id: 'opt-2', label: '5 days', priceCents: 450000, currency: 'eur' },
      ])

      expect(res).toEqual({ success: true })
      expect(opts(db).find(o => o.id === 'opt-1')?.price_cents).toBe(320000)
      expect(opts(db).find(o => o.id === 'opt-1')?.is_accepted).toBe(accepted)
      expect(db.offers[0].status).toBe(offerStatus)
      expect(db.inquiries[0].status).toBe(inquiryStatus)
      const evts = events(db, 'offer.updated')
      expect(evts).toHaveLength(1)
      expect(db.inquiry_events).toHaveLength(1)
      const payload = evts[0].payload as { offer_id: string; before: Row[]; after: Row[] }
      expect(payload.offer_id).toBe('off-1')
      expect(payload.before.find(o => o.id === 'opt-1')).toEqual({ id: 'opt-1', label: '3 days', price_cents: 300000, currency: 'eur' })
      expect(payload.after.find(o => o.id === 'opt-1')).toEqual({ id: 'opt-1', label: '3 days', price_cents: 320000, currency: 'eur' })
      expect(evts[0].actor_kind).toBe('admin')
      expect(evts[0].actor_id).toBe('admin-1')
    })
  }
})

describe('updateOfferOptions — add and remove', () => {
  it('adds a new option and removes a non-accepted one in one save', async () => {
    const db = seed({ offerStatus: 'draft', inquiryStatus: 'waiting_guide' })
    useDb(db)

    const res = await updateOfferOptions('off-1', [
      { id: 'opt-1', label: '3 days', priceCents: 300000, currency: 'eur' },
      { label: '7 days', priceCents: 600000, currency: 'nzd' },
    ])

    expect(res).toEqual({ success: true })
    expect(opts(db).map(o => o.label)).toEqual(['3 days', '7 days'])
    expect(opts(db).find(o => o.label === '7 days')?.currency).toBe('nzd')
    const payload = events(db, 'offer.updated')[0].payload as { before: Row[]; after: Row[] }
    expect(payload.before.map(o => o.id)).toEqual(['opt-1', 'opt-2'])
    expect(payload.after.map(o => o.label)).toEqual(['3 days', '7 days'])
  })

  it('no change → success, no event', async () => {
    const db = seed()
    useDb(db)
    const res = await updateOfferOptions('off-1', [
      { id: 'opt-1', label: '3 days', priceCents: 300000, currency: 'eur' },
      { id: 'opt-2', label: '5 days', priceCents: 450000, currency: 'eur' },
    ])
    expect(res).toEqual({ success: true })
    expect(db.inquiry_events).toHaveLength(0)
  })
})

describe('updateOfferOptions — refusals leave the database unchanged (red proof)', () => {
  it('REFUSES removing the last option', async () => {
    const db = seed()
    const before = structuredClone(db)
    useDb(db)
    const res = await updateOfferOptions('off-1', [])
    expect(res).toEqual({ success: false, error: 'An offer needs at least one option' })
    expect(db).toEqual(before)
  })

  it('REFUSES removing the accepted option', async () => {
    const db = seed({ offerStatus: 'accepted', accepted: true })
    const before = structuredClone(db)
    useDb(db)
    const res = await updateOfferOptions('off-1', [
      { id: 'opt-2', label: '5 days', priceCents: 450000, currency: 'eur' },
    ])
    expect(res).toEqual({
      success: false,
      error:   'The accepted option cannot be removed — change the accepted option first',
    })
    expect(db).toEqual(before)
  })

  it('REFUSES editing an offer on a paid inquiry', async () => {
    const db = seed({ offerStatus: 'accepted', inquiryStatus: 'paid', accepted: true })
    const before = structuredClone(db)
    useDb(db)
    const res = await updateOfferOptions('off-1', [
      { id: 'opt-1', label: '3 days', priceCents: 999900, currency: 'eur' },
      { id: 'opt-2', label: '5 days', priceCents: 450000, currency: 'eur' },
    ])
    expect(res).toEqual({ success: false, error: 'The offer cannot be edited — the inquiry is paid' })
    expect(db).toEqual(before)
  })

  it.each(['handed_over', 'completed', 'lost', 'cancelled'])('refuses on a %s inquiry (tj D-D)', async status => {
    const db = seed({ inquiryStatus: status })
    const before = structuredClone(db)
    useDb(db)
    const res = await updateOfferOptions('off-1', [{ id: 'opt-1', label: 'x', priceCents: 1, currency: 'eur' }])
    expect(res.success).toBe(false)
    expect(db).toEqual(before)
  })

  it.each(['declined', 'superseded'])('refuses a %s offer', async status => {
    const db = seed({ offerStatus: status })
    const before = structuredClone(db)
    useDb(db)
    const res = await updateOfferOptions('off-1', [{ id: 'opt-1', label: 'x', priceCents: 1, currency: 'eur' }])
    expect(res).toEqual({ success: false, error: `A ${status} offer cannot be edited` })
    expect(db).toEqual(before)
  })

  it('refuses an option id from another offer, bad price, empty label, unknown currency', async () => {
    const db = seed()
    db.offer_options.push({ id: 'opt-foreign', offer_id: 'off-2', label: 'x', price_cents: 1, currency: 'eur', is_accepted: false, created_at: '2026-10-01T00:00:03Z' })
    const before = structuredClone(db)
    useDb(db)
    expect(await updateOfferOptions('off-1', [{ id: 'opt-foreign', label: 'x', priceCents: 1, currency: 'eur' }]))
      .toEqual({ success: false, error: 'Option not found or does not belong to this offer' })
    expect(await updateOfferOptions('off-1', [{ id: 'opt-1', label: '3 days', priceCents: 12.5, currency: 'eur' }]))
      .toEqual({ success: false, error: 'Option 1: price must be a positive amount' })
    expect(await updateOfferOptions('off-1', [{ id: 'opt-1', label: '3 days', priceCents: -100, currency: 'eur' }]))
      .toEqual({ success: false, error: 'Option 1: price must be a positive amount' })
    expect(await updateOfferOptions('off-1', [{ id: 'opt-1', label: '  ', priceCents: 100, currency: 'eur' }]))
      .toEqual({ success: false, error: 'Option 1: name is required' })
    expect(await updateOfferOptions('off-1', [{ id: 'opt-1', label: '3 days', priceCents: 100, currency: 'gbp' }]))
      .toEqual({ success: false, error: 'Option 1: currency is not supported' })
    expect(db).toEqual(before)
  })

  it('rejects a non-admin before reading anything', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    useDb(seed())
    await expect(updateOfferOptions('off-1', [])).rejects.toThrow()
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  })
})

describe('updateOfferOptions — rollback (tj D-A)', () => {
  it('second write (delete) fails → options back to the original state, no offer.updated', async () => {
    const db = seed()
    const before = structuredClone(db)
    useDb(db, { failOn: [{ table: 'offer_options', op: 'delete', nth: 1 }] })

    const res = await updateOfferOptions('off-1', [
      { id: 'opt-1', label: '3 days — new name', priceCents: 350000, currency: 'usd' },
      { label: '7 days', priceCents: 600000, currency: 'eur' },
    ])

    expect(res).toEqual({ success: false, error: 'Could not save the offer options — nothing was changed' })
    expect(db).toEqual(before)
    expect(events(db, 'offer.updated')).toHaveLength(0)
  })

  it('event write fails → options back to the original state', async () => {
    const db = seed()
    const before = structuredClone(db)
    useDb(db, { failOn: [{ table: 'inquiry_events', op: 'insert', nth: 1 }] })

    const res = await updateOfferOptions('off-1', [
      { id: 'opt-1', label: '3 days', priceCents: 350000, currency: 'eur' },
    ])

    expect(res).toEqual({ success: false, error: 'Could not save the offer options — nothing was changed' })
    expect(db).toEqual(before)
  })

  it('rollback itself fails → error says the offer may be partly saved', async () => {
    const db = seed()
    // event insert fails, then the rollback's restore (the 2nd upsert) fails too
    useDb(db, { failOn: [
      { table: 'inquiry_events', op: 'insert', nth: 1 },
      { table: 'offer_options',  op: 'upsert', nth: 2 },
    ] })

    const res = await updateOfferOptions('off-1', [{ id: 'opt-1', label: '3 days', priceCents: 350000, currency: 'eur' }])

    expect(res).toEqual({
      success: false,
      error:   'Saving failed and the offer may be partly saved — reload the page and check the options',
    })
    expect(events(db, 'offer.updated')).toHaveLength(0)
  })
})

// ─── markAsGuideOffer without a source message (D2.1) ─────────────────────────

describe('markAsGuideOffer — no reply in the thread', () => {
  it('creates a two-option offer with source_message_id = null and emits guide.offer_received', async () => {
    const db: Db = { inquiries: [{ id: 'inq-1', status: 'waiting_guide' }], offers: [], offer_options: [], inquiry_events: [], messages: [] }
    useDb(db)

    const res = await markAsGuideOffer('inq-1', {
      messageId: null,
      options: [
        { label: '3 days', priceCents: 300000, currency: 'eur' },
        { label: '5 days', priceCents: 450000, currency: 'EUR' },
      ],
    })

    expect(res.success).toBe(true)
    expect(db.offers).toHaveLength(1)
    expect(db.offers[0].source_message_id).toBeNull()
    expect(db.offers[0].inquiry_id).toBe('inq-1')
    expect(db.offer_options.map(o => [o.label, o.price_cents, o.currency])).toEqual([
      ['3 days', 300000, 'eur'],
      ['5 days', 450000, 'eur'],
    ])
    const evts = events(db, 'guide.offer_received')
    expect(evts).toHaveLength(1)
    expect(evts[0].message_id).toBeNull()
  })

  it('still links the thread reply when one is given', async () => {
    const db: Db = { inquiries: [{ id: 'inq-1', status: 'waiting_guide' }], offers: [], offer_options: [], inquiry_events: [], messages: [{ id: 'msg-1', inquiry_id: 'inq-1' }] }
    useDb(db)
    const res = await markAsGuideOffer('inq-1', { messageId: 'msg-1', options: [{ label: '3 days', priceCents: 300000, currency: 'eur' }] })
    expect(res.success).toBe(true)
    expect(db.offers[0].source_message_id).toBe('msg-1')
    expect(events(db, 'guide.offer_received')[0].message_id).toBe('msg-1')
  })

  it('refuses a message from another inquiry and invalid options', async () => {
    const db: Db = { inquiries: [{ id: 'inq-1', status: 'waiting_guide' }], offers: [], offer_options: [], inquiry_events: [], messages: [{ id: 'msg-x', inquiry_id: 'inq-2' }] }
    useDb(db)
    expect(await markAsGuideOffer('inq-1', { messageId: 'msg-x', options: [{ label: 'a', priceCents: 1, currency: 'eur' }] }))
      .toEqual({ success: false, error: 'Message not found in this inquiry' })
    expect(await markAsGuideOffer('inq-1', { options: [{ label: 'a', priceCents: 0, currency: 'eur' }] }))
      .toEqual({ success: false, error: 'Option 1: price must be a positive amount' })
    expect(db.offers).toHaveLength(0)
    expect(db.inquiry_events).toHaveLength(0)
  })
})
