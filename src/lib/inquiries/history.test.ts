import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EventClient } from '@/lib/events/emit'
import { HistoryError, recordPastPayment } from './history'

vi.mock('@/lib/fx', () => ({
  fetchEurRateOn: vi.fn(),
}))

import { fetchEurRateOn } from '@/lib/fx'
const mockFetchEurRateOn = vi.mocked(fetchEurRateOn)

// ─── Fake client ──────────────────────────────────────────────────────────────
//
// Enough of the Supabase query builder for recordPastPayment(): one inquiries row,
// an append-only list of events, and two write shapes on `inquiries` — the
// compare-and-set (`.eq('id', …).is('deposit_paid_at', null).select('id').maybeSingle()`)
// and the rollback (`.eq('id', …).eq('status', …)`, awaited directly, as in state.test.ts).

interface FakeState {
  status:               string
  deposit_paid_at:      string | null
  deposit_amount_cents: number | null
  deposit_currency:     string | null
  deposit_eur_rate:     number | null
  deposit_eur_rate_at:  string | null
  stage_reached:        string
  patches:              Record<string, unknown>[]
  events:               Record<string, unknown>[]
  failEvents:           boolean
}

function fakeClient(overrides: Partial<FakeState> = {}, failEvents = false) {
  const state: FakeState = {
    status:               'awaiting_payment',
    deposit_paid_at:      null,
    deposit_amount_cents: null,
    deposit_currency:     null,
    deposit_eur_rate:     null,
    deposit_eur_rate_at:  null,
    stage_reached:        'offer_sent',
    patches:              [],
    events:               [],
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
              data: { id: 'inq-1', status: state.status, deposit_paid_at: state.deposit_paid_at },
              error: null,
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          // Chain that collects filters, exposes both the compare-and-set path
          // (…is(…).select(…).maybeSingle()) and the direct-await rollback path.
          const run = async (matches: boolean) => {
            if (!matches) return { data: null, error: null }
            applyPatch(patch)
            return { data: { id: 'inq-1' }, error: null }
          }
          const afterId = {
            is: (_col: string, _val: null) => ({
              select: () => ({ maybeSingle: () => run(state.deposit_paid_at === null) }),
            }),
            eq: (_col: string, expected: string) => {
              const matches = state.status === expected
              const promise = run(matches)
              return { then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => promise.then(res, rej) }
            },
          }
          return { eq: (_idCol: string, _id: string) => afterId }
        },
      }
    },
  }

  return { client: client as unknown as EventClient, state }
}

const admin = { kind: 'admin' as const, id: 'admin-uid' }

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

  it('rolls back status and the deposit columns when the event write fails', async () => {
    const { client, state } = fakeClient({}, true)

    await expect(recordPastPayment(client, 'inq-1', {
      paidOn: '2026-06-15', amountCents: 85000, currency: 'EUR', finalStatus: 'paid', actor: admin,
    })).rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    expect(state.status).toBe('awaiting_payment')
    expect(state.deposit_paid_at).toBeNull()
    expect(state.deposit_amount_cents).toBeNull()
    expect(state.deposit_currency).toBeNull()
    expect(state.deposit_eur_rate).toBeNull()
    expect(state.deposit_eur_rate_at).toBeNull()
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
})
