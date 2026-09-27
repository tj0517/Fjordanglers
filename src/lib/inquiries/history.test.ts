import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EventClient } from '@/lib/events/emit'
import {
  HistoryError,
  recordPastPayment,
  recordPastOffer,
  recordPastLoss,
  correctReceivedDate,
  type RecordPastPaymentDeps,
} from './history'

vi.mock('@/lib/fx', () => ({
  fetchEurRateOn: vi.fn(),
}))

import { fetchEurRateOn } from '@/lib/fx'
const mockFetchEurRateOn = vi.mocked(fetchEurRateOn)

// ─── Fake client ──────────────────────────────────────────────────────────────
//
// One inquiries row, an append-only list of events, and a generic `.update(patch)`
// chain: any number of `.eq(col, val)` / `.is(col, null)` filters (in any order),
// evaluated against the current row when the chain is finally read — either through
// `.select('id').maybeSingle()` (the compare-and-set path every recordPast* function
// uses) or by awaiting the chain directly (rollbacks, and the plain post-events
// stage_reached write). Column-generic so it serves recordPastPayment, recordPastOffer,
// recordPastLoss and correctReceivedDate without one fake per function.

interface FakeState {
  id:                        string
  status:                    string
  deposit_paid_at:           string | null
  deposit_amount_cents:      number | null
  deposit_currency:          string | null
  deposit_eur_rate:          number | null
  deposit_eur_rate_at:       string | null
  deposit_payment_link_id:   string | null
  deposit_payment_link_url:  string | null
  offer_sent_at:             string | null
  lost_reason_code:          string | null
  lost_reason:               string | null
  created_at:                string
  stage_reached:             string
  patches:                   Record<string, unknown>[]
  events:                    Record<string, unknown>[]
  failEvents:                boolean
}

function fakeClient(overrides: Partial<FakeState> = {}, failEvents = false) {
  const state: FakeState = {
    id:                        'inq-1',
    status:                    'awaiting_payment',
    deposit_paid_at:           null,
    deposit_amount_cents:      null,
    deposit_currency:          null,
    deposit_eur_rate:          null,
    deposit_eur_rate_at:       null,
    deposit_payment_link_id:   null,
    deposit_payment_link_url:  null,
    offer_sent_at:             null,
    lost_reason_code:          null,
    lost_reason:               null,
    created_at:                '2026-07-01T12:00:00.000Z',
    stage_reached:             'offer_sent',
    patches:                   [],
    events:                    [],
    failEvents,
    ...overrides,
  }

  function applyPatch(patch: Record<string, unknown>) {
    state.patches.push(patch)
    for (const [k, v] of Object.entries(patch)) {
      ;(state as unknown as Record<string, unknown>)[k] = v
    }
  }

  const client = {
    from(table: string) {
      if (table === 'inquiry_events') {
        return {
          insert(row: Record<string, unknown>) {
            if (state.failEvents) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'insert blocked by test' } }),
                }),
              }
            }
            state.events.push(row)
            return {
              select: () => ({
                single: async () => ({ data: { id: `event-${state.events.length}` }, error: null }),
              }),
            }
          },
        }
      }

      // table === 'inquiries'
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({
              data: {
                id:                       state.id,
                status:                   state.status,
                deposit_paid_at:          state.deposit_paid_at,
                deposit_payment_link_id:  state.deposit_payment_link_id,
                deposit_amount_cents:     state.deposit_amount_cents,
                deposit_currency:         state.deposit_currency,
                deposit_eur_rate:         state.deposit_eur_rate,
                deposit_eur_rate_at:      state.deposit_eur_rate_at,
                offer_sent_at:            state.offer_sent_at,
                lost_reason_code:         state.lost_reason_code,
                lost_reason:              state.lost_reason,
                created_at:               state.created_at,
              },
              error: null,
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          const filters: Array<(s: FakeState) => boolean> = []
          const evalMatch = () => filters.every(f => f(state))
          const run = async () => {
            const matches = evalMatch()
            if (!matches) return { data: null, error: null }
            applyPatch(patch)
            return { data: { id: state.id }, error: null }
          }
          const builder: {
            eq:     (col: string, val: unknown) => typeof builder
            is:     (col: string, val: null) => typeof builder
            select: () => { maybeSingle: () => Promise<{ data: { id: string } | null; error: null }> }
            then:   (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => unknown
          } = {
            eq(col, val) {
              filters.push(s => (s as unknown as Record<string, unknown>)[col] === val)
              return builder
            },
            is(col, val) {
              filters.push(s => (s as unknown as Record<string, unknown>)[col] === val)
              return builder
            },
            select: () => ({ maybeSingle: () => run() }),
            // Awaited directly with no `.select()` — rollbacks and the plain stage_reached write.
            then: (res, rej) => run().then(res, rej),
          }
          return builder
        },
      }
    },
  }

  return { client: client as unknown as EventClient, state }
}

const admin = { kind: 'admin' as const, id: 'admin-uid' }

function stubDeps(overrides: Partial<RecordPastPaymentDeps> = {}): RecordPastPaymentDeps {
  return {
    deactivatePaymentLink: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordPastPayment', () => {
  it('records a payment ~3 months ago and jumps straight to paid', async () => {
    const { client, state } = fakeClient()

    const result = await recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })

    expect(result).toEqual({ from: 'awaiting_payment', to: 'paid' })
    expect(state.status).toBe('paid')
    expect(state.deposit_paid_at).toBe(new Date('2026-06-15T12:00:00.000Z').toISOString())
    expect(state.deposit_amount_cents).toBe(85000)
    expect(state.deposit_currency).toBe('EUR')
    expect(state.deposit_eur_rate).toBe(1)
    expect(state.stage_reached).toBe('deposit_paid')
    expect(mockFetchEurRateOn).not.toHaveBeenCalled()

    expect(state.events.map(e => e.type)).toEqual(['status.changed', 'payment.received'])
    for (const e of state.events) {
      expect(e).toMatchObject({ source: 'backfill', occurred_at: state.deposit_paid_at })
    }
    expect(state.events[0]).toMatchObject({
      from_status: 'awaiting_payment', to_status: 'paid', payload: { historical: true },
    })
    expect(state.events[1]).toMatchObject({ payload: { amount_cents: 85000, currency: 'EUR', historical: true } })
  })

  it('fetches and freezes the historical rate for a non-EUR currency', async () => {
    mockFetchEurRateOn.mockResolvedValue(138.4)
    const { client, state } = fakeClient()

    await recordPastPayment(client, 'inq-1', {
      paidOn: '2026-01-10', amountCents: 500_000, currency: 'isk', finalStatus: 'completed', actor: admin,
    })

    expect(mockFetchEurRateOn).toHaveBeenCalledWith('2026-01-10', 'ISK')
    expect(state.deposit_eur_rate).toBe(138.4)
    expect(state.deposit_currency).toBe('ISK')
    expect(state.status).toBe('completed')
    expect(state.stage_reached).toBe('completed')
  })

  it('rejects a future date and changes nothing', async () => {
    const { client, state } = fakeClient()
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: future, amountCents: 1000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(HistoryError)

    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rejects an invalid calendar date', async () => {
    const { client, state } = fakeClient()

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-02-30', amountCents: 1000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/invalid date/i)

    expect(state.patches).toHaveLength(0)
  })

  it('rejects when deposit_paid_at is already set and does not overwrite it', async () => {
    const { client, state } = fakeClient({
      deposit_paid_at: '2026-01-01T12:00:00.000Z', deposit_amount_cents: 5000, deposit_currency: 'EUR',
    })

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/already has a deposit/)

    expect(state.deposit_amount_cents).toBe(5000)
    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rolls back status and restores the original deposit columns when the event write fails, without advancing stage_reached', async () => {
    // Realistic awaiting_payment inquiry: setDepositAmount (FA-1.28) already ran, so the
    // amount columns are non-null before recordPastPayment ever touches the row.
    const { client, state } = fakeClient({
      deposit_amount_cents: 5000,
      deposit_currency:     'EUR',
      deposit_eur_rate:     1,
      deposit_eur_rate_at:  '2026-05-01T00:00:00.000Z',
      stage_reached:        'offer_sent',
    }, true)

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    expect(state.status).toBe('awaiting_payment')
    expect(state.deposit_paid_at).toBeNull()
    // Restored to what they were — not nulled out.
    expect(state.deposit_amount_cents).toBe(5000)
    expect(state.deposit_currency).toBe('EUR')
    expect(state.deposit_eur_rate).toBe(1)
    expect(state.deposit_eur_rate_at).toBe('2026-05-01T00:00:00.000Z')
    // Never advanced — the write that advances it only happens after the events succeed.
    expect(state.stage_reached).toBe('offer_sent')
  })

  it('rejects a non-positive or non-integer amount', async () => {
    const { client } = fakeClient()
    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 0, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/positive integer/)
    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 99.5, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/positive integer/)
  })

  it('rejects an unsupported currency', async () => {
    const { client } = fakeClient()
    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 1000, currency: 'NOK', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/not supported/)
  })

  it('returns an error, not null, when the historical rate cannot be fetched', async () => {
    mockFetchEurRateOn.mockResolvedValue(null)
    const { client, state } = fakeClient()
    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 1000, currency: 'USD', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/could not fetch/i)
    expect(state.patches).toHaveLength(0)
  })

  // ─── Active payment link (round 2) ────────────────────────────────────────────

  it('deactivates an active Stripe payment link before writing, and clears the link columns', async () => {
    const deps = stubDeps()
    const { client, state } = fakeClient({
      deposit_payment_link_id:  'plink_123',
      deposit_payment_link_url: 'https://buy.stripe.com/plink_123',
    })

    await recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    }, deps)

    expect(deps.deactivatePaymentLink).toHaveBeenCalledWith('plink_123')
    expect(deps.deactivatePaymentLink).toHaveBeenCalledTimes(1)
    expect(state.deposit_payment_link_id).toBeNull()
    expect(state.deposit_payment_link_url).toBeNull()
    expect(state.status).toBe('paid')
  })

  it('never calls the deactivation dependency when there is no active link', async () => {
    const deps = stubDeps()
    const { client } = fakeClient()

    await recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    }, deps)

    expect(deps.deactivatePaymentLink).not.toHaveBeenCalled()
  })

  it('refuses and changes nothing when payment-link deactivation fails', async () => {
    const deps = stubDeps({ deactivatePaymentLink: vi.fn().mockRejectedValue(new Error('stripe down')) })
    const { client, state } = fakeClient({ deposit_payment_link_id: 'plink_123' })

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    }, deps)).rejects.toThrow(/deactivate/i)

    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
    expect(state.deposit_payment_link_id).toBe('plink_123')
    expect(state.status).toBe('awaiting_payment')
  })
})

// ─── recordPastOffer — FA-1.38 ─────────────────────────────────────────────────

describe('recordPastOffer', () => {
  it('records an offer date ~2 months ago and advances stage_reached', async () => {
    const { client, state } = fakeClient({ status: 'qualifying', offer_sent_at: null, stage_reached: 'inquiry' })

    const result = await recordPastOffer(client, 'inq-1', { sentOn: '2026-07-15', actor: admin })

    const expectedAt = new Date('2026-07-15T12:00:00.000Z').toISOString()
    expect(result).toEqual({ sentAt: expectedAt })
    expect(state.offer_sent_at).toBe(expectedAt)
    expect(state.stage_reached).toBe('offer_sent')

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({
      type: 'offer.presented', source: 'backfill', occurred_at: expectedAt, payload: { historical: true },
    })
  })

  it('rejects a future date and changes nothing', async () => {
    const { client, state } = fakeClient({ offer_sent_at: null })
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    await expect(recordPastOffer(client, 'inq-1', { sentOn: future, actor: admin }))
      .rejects.toThrow(HistoryError)

    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rejects when offer_sent_at is already set and does not overwrite it', async () => {
    const { client, state } = fakeClient({ offer_sent_at: '2026-07-01T12:00:00.000Z' })

    await expect(recordPastOffer(client, 'inq-1', { sentOn: '2026-07-15', actor: admin }))
      .rejects.toThrow(/already has an offer date/)

    expect(state.offer_sent_at).toBe('2026-07-01T12:00:00.000Z')
    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rolls back offer_sent_at when the event write fails, without advancing stage_reached', async () => {
    const { client, state } = fakeClient({ offer_sent_at: null, stage_reached: 'inquiry' }, true)

    await expect(recordPastOffer(client, 'inq-1', { sentOn: '2026-07-15', actor: admin }))
      .rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    expect(state.offer_sent_at).toBeNull()
    expect(state.stage_reached).toBe('inquiry')
  })
})

// ─── recordPastLoss — FA-1.38 ──────────────────────────────────────────────────

describe('recordPastLoss', () => {
  it('jumps straight to lost from an arbitrary status with a real date', async () => {
    const { client, state } = fakeClient({ status: 'waiting_guide', deposit_paid_at: null, stage_reached: 'inquiry' })

    const result = await recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: 'no_guide', note: 'Guide never replied', actor: admin,
    })

    const expectedAt = new Date('2026-05-20T12:00:00.000Z').toISOString()
    expect(result).toEqual({ from: 'waiting_guide', to: 'lost' })
    expect(state.status).toBe('lost')
    expect(state.lost_reason_code).toBe('no_guide')
    expect(state.lost_reason).toBe('Guide never replied')
    // stage_reached is deliberately untouched (lost/cancelled keep the funnel cache where it was).
    expect(state.stage_reached).toBe('inquiry')

    expect(state.events.map(e => e.type)).toEqual(['status.changed', 'inquiry.lost'])
    for (const e of state.events) {
      expect(e).toMatchObject({ source: 'backfill', occurred_at: expectedAt })
    }
    expect(state.events[0]).toMatchObject({ from_status: 'waiting_guide', to_status: 'lost' })
    expect(state.events[1]).toMatchObject({ payload: { lost_reason_code: 'no_guide', note: 'Guide never replied' } })
  })

  it('rejects a future date and changes nothing', async () => {
    const { client, state } = fakeClient({ status: 'qualifying' })
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: future, lostReasonCode: 'price', actor: admin,
    })).rejects.toThrow(HistoryError)

    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rejects a missing or unknown loss reason code', async () => {
    const { client } = fakeClient({ status: 'qualifying' })

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: '', actor: admin,
    })).rejects.toThrow(/unknown loss reason/i)

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: 'not_a_real_code', actor: admin,
    })).rejects.toThrow(/unknown loss reason/i)
  })

  it('rejects an inquiry that already has a deposit recorded', async () => {
    const { client, state } = fakeClient({ status: 'paid', deposit_paid_at: '2026-06-01T12:00:00.000Z' })

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: 'price', actor: admin,
    })).rejects.toThrow(/already has a deposit/)

    expect(state.status).toBe('paid')
    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rejects an inquiry that is already lost', async () => {
    const { client, state } = fakeClient({ status: 'lost' })

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: 'price', actor: admin,
    })).rejects.toThrow(/already lost/)

    expect(state.patches).toHaveLength(0)
  })

  it('rolls back status and the loss reason when the event write fails, without touching stage_reached', async () => {
    const { client, state } = fakeClient({ status: 'waiting_guide', deposit_paid_at: null, stage_reached: 'inquiry' }, true)

    await expect(recordPastLoss(client, 'inq-1', {
      lostOn: '2026-05-20', lostReasonCode: 'no_guide', actor: admin,
    })).rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    expect(state.status).toBe('waiting_guide')
    expect(state.lost_reason_code).toBeNull()
    expect(state.lost_reason).toBeNull()
    expect(state.stage_reached).toBe('inquiry')
  })
})

// ─── correctReceivedDate — FA-1.38 ─────────────────────────────────────────────

describe('correctReceivedDate', () => {
  it('moves created_at to an earlier real date', async () => {
    const { client, state } = fakeClient({ created_at: '2026-07-01T12:00:00.000Z' })

    const result = await correctReceivedDate(client, 'inq-1', { receivedOn: '2026-05-01', actor: admin })

    const expectedTo = new Date('2026-05-01T12:00:00.000Z').toISOString()
    expect(result).toEqual({ from: '2026-07-01T12:00:00.000Z', to: expectedTo })
    expect(state.created_at).toBe(expectedTo)

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({
      type: 'inquiry.history_corrected',
      source: 'backfill',
      occurred_at: expectedTo,
      payload: { field: 'created_at', from: '2026-07-01T12:00:00.000Z', to: expectedTo },
    })
  })

  it('rejects a future date and changes nothing', async () => {
    const { client, state } = fakeClient({ created_at: '2026-07-01T12:00:00.000Z' })
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    await expect(correctReceivedDate(client, 'inq-1', { receivedOn: future, actor: admin }))
      .rejects.toThrow(HistoryError)

    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rejects a date not earlier than the current created_at, and changes nothing', async () => {
    const { client, state } = fakeClient({ created_at: '2026-05-01T12:00:00.000Z' })

    await expect(correctReceivedDate(client, 'inq-1', { receivedOn: '2026-07-01', actor: admin }))
      .rejects.toThrow(/not earlier/)

    expect(state.created_at).toBe('2026-05-01T12:00:00.000Z')
    expect(state.patches).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('rolls back created_at when the event write fails', async () => {
    const { client, state } = fakeClient({ created_at: '2026-07-01T12:00:00.000Z' }, true)

    await expect(correctReceivedDate(client, 'inq-1', { receivedOn: '2026-05-01', actor: admin }))
      .rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    expect(state.created_at).toBe('2026-07-01T12:00:00.000Z')
  })
})
