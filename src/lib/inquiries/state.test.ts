import { describe, it, expect } from 'vitest'
import type { EventClient } from '@/lib/events/emit'
import {
  ALLOWED_TRANSITIONS,
  STATUSES,
  TransitionError,
  canTransition,
  isInquiryStatus,
  nextStatuses,
  stageReachedFor,
  transition,
  type InquiryStatus,
} from './state'

// ─── Fake client ──────────────────────────────────────────────────────────────
//
// Enough of the Supabase query builder for transition(): one inquiries row, an
// append-only list of events, and the compare-and-set on status.

interface FakeState {
  status:  string
  patches: Record<string, unknown>[]
  events:  Record<string, unknown>[]
  failEventTypes: string[]
}

function fakeClient(initialStatus: string, failEventTypes: string[] = []) {
  const state: FakeState = { status: initialStatus, patches: [], events: [], failEventTypes }

  const client = {
    from(table: string) {
      if (table === 'inquiry_events') {
        return {
          insert(row: Record<string, unknown>) {
            if (state.failEventTypes.includes(row.type as string)) {
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
            maybeSingle: async () => ({ data: { id: 'inq-1', status: state.status }, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_idCol: string, _id: string) => ({
            eq: (_statusCol: string, expected: string) => {
              // Compare-and-set, run either through .select().maybeSingle() (the
              // transition itself) or by awaiting the builder (the rollback).
              const run = async () => {
                if (state.status !== expected) return { data: null, error: null }
                state.status = patch.status as string
                state.patches.push(patch)
                return { data: { id: 'inq-1' }, error: null }
              }
              return {
                select: () => ({ maybeSingle: run }),
                then: (
                  resolve: (v: unknown) => unknown,
                  reject: (e: unknown) => unknown,
                ) => run().then(resolve, reject),
              }
            },
          }),
        }),
      }
    },
  }

  return { client: client as unknown as EventClient, state }
}

const admin = { kind: 'admin' as const, id: 'admin-uid' }

// ─── The transition table ─────────────────────────────────────────────────────

describe('ALLOWED_TRANSITIONS', () => {
  it('lists every status as a key and never names an unknown one', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...STATUSES].sort())
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) expect(isInquiryStatus(target)).toBe(true)
    }
  })

  it('paid is reachable only from awaiting_payment, and awaiting_payment only from offer_presented', () => {
    const sourcesOf = (to: InquiryStatus) =>
      STATUSES.filter(from => ALLOWED_TRANSITIONS[from].includes(to))

    expect(sourcesOf('paid')).toEqual(['awaiting_payment'])
    expect(sourcesOf('awaiting_payment')).toEqual(['offer_presented'])
  })

  it('a paid trip reaches completed only through handed_over', () => {
    expect(canTransition('paid', 'completed')).toBe(false)
    expect(canTransition('paid', 'handed_over')).toBe(true)
    expect(canTransition('handed_over', 'completed')).toBe(true)
  })

  it('a new inquiry with a complete brief can go straight to the guide', () => {
    expect(canTransition('new', 'waiting_guide')).toBe(true)
    expect(canTransition('new', 'qualifying')).toBe(true)
    // …but not past the guide: an offer still has to be presented first.
    expect(canTransition('new', 'offer_presented')).toBe(false)
    expect(canTransition('new', 'awaiting_payment')).toBe(false)
  })

  it('the middle of the process loops in both directions', () => {
    expect(canTransition('offer_presented', 'waiting_guide')).toBe(true)
    expect(canTransition('waiting_guide', 'offer_presented')).toBe(true)
    expect(canTransition('waiting_guide', 'qualifying')).toBe(true)
    expect(canTransition('qualifying', 'waiting_guide')).toBe(true)
  })

  it('terminal statuses have no way out', () => {
    expect(nextStatuses('completed')).toEqual([])
    expect(nextStatuses('lost')).toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
  })

  it('every non-terminal status can be lost or cancelled', () => {
    for (const status of STATUSES) {
      if (nextStatuses(status).length === 0) continue
      expect(canTransition(status, 'lost')).toBe(true)
      expect(canTransition(status, 'cancelled')).toBe(true)
    }
  })

  it('a legacy status value has no allowed transitions', () => {
    expect(nextStatuses('deposit_paid')).toEqual([])
    expect(canTransition('deposit_paid', 'completed')).toBe(false)
  })
})

describe('stageReachedFor', () => {
  it('maps the funnel and leaves lost/cancelled where they were', () => {
    expect(stageReachedFor('new')).toBe('inquiry')
    expect(stageReachedFor('offer_presented')).toBe('offer_sent')
    expect(stageReachedFor('awaiting_payment')).toBe('offer_sent')
    expect(stageReachedFor('paid')).toBe('deposit_paid')
    expect(stageReachedFor('handed_over')).toBe('deposit_paid')
    expect(stageReachedFor('completed')).toBe('completed')
    expect(stageReachedFor('lost')).toBeNull()
    expect(stageReachedFor('cancelled')).toBeNull()
  })
})

// ─── transition() ─────────────────────────────────────────────────────────────

describe('transition()', () => {
  it('rejects qualifying → paid and changes nothing', async () => {
    const { client, state } = fakeClient('qualifying')

    await expect(transition(client, 'inq-1', 'paid', { actor: admin }))
      .rejects.toThrow(TransitionError)

    expect(state.status).toBe('qualifying')
    expect(state.events).toHaveLength(0)
  })

  it('allows offer_presented → waiting_guide', async () => {
    const { client, state } = fakeClient('offer_presented')

    const result = await transition(client, 'inq-1', 'waiting_guide', { actor: admin })

    expect(result).toEqual({ from: 'offer_presented', to: 'waiting_guide' })
    expect(state.status).toBe('waiting_guide')
  })

  it('writes exactly one status.changed, with from/to, actor and source', async () => {
    const { client, state } = fakeClient('new')

    await transition(client, 'inq-1', 'qualifying', { actor: admin, reason: 'asked for dates' })

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({
      type:        'status.changed',
      from_status: 'new',
      to_status:   'qualifying',
      actor_kind:  'admin',
      actor_id:    'admin-uid',
      source:      'app',
      channel:     'app',
      payload:     { reason: 'asked for dates' },
    })
  })

  it('carries the source through for a webhook', async () => {
    const { client, state } = fakeClient('awaiting_payment')

    await transition(client, 'inq-1', 'paid', {
      actor: { kind: 'system' }, source: 'webhook', channel: 'stripe',
    })

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({ source: 'webhook', channel: 'stripe', actor_kind: 'system' })
  })

  it('refuses to mark an inquiry lost without a reason code', async () => {
    const { client, state } = fakeClient('qualifying')

    await expect(transition(client, 'inq-1', 'lost', { actor: admin }))
      .rejects.toThrow(/loss reason is required/i)

    expect(state.status).toBe('qualifying')
    expect(state.events).toHaveLength(0)
  })

  it('writes status.changed and inquiry.lost when losing an inquiry', async () => {
    const { client, state } = fakeClient('waiting_guide')

    await transition(client, 'inq-1', 'lost', {
      actor: admin, lostReasonCode: 'no_guide', lostReason: 'nobody free in week 34',
    })

    expect(state.events.map(e => e.type)).toEqual(['status.changed', 'inquiry.lost'])
    expect(state.events[1]).toMatchObject({
      payload: { lost_reason_code: 'no_guide', note: 'nobody free in week 34' },
    })
    expect(state.patches[0]).toMatchObject({ lost_reason_code: 'no_guide' })
  })

  it('does not advance stage_reached for lost', async () => {
    const { client, state } = fakeClient('offer_presented')

    await transition(client, 'inq-1', 'lost', { actor: admin, lostReasonCode: 'price' })

    expect(state.patches[0]).not.toHaveProperty('stage_reached')
  })

  it('rolls the status back when the event cannot be written', async () => {
    const { client, state } = fakeClient('new', ['status.changed'])

    await expect(transition(client, 'inq-1', 'qualifying', { actor: admin }))
      .rejects.toThrow(/rolled back/i)

    expect(state.events).toHaveLength(0)
    // last patch is the rollback back to 'new'
    expect(state.patches.at(-1)).toMatchObject({ status: 'new' })
  })

  it('rejects a move to the status the inquiry already has', async () => {
    const { client, state } = fakeClient('qualifying')

    await expect(transition(client, 'inq-1', 'qualifying', { actor: admin }))
      .rejects.toThrow(/already/i)

    expect(state.events).toHaveLength(0)
  })
})
