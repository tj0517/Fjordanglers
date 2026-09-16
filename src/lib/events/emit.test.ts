import { describe, it, expect } from 'vitest'
import { emitEvent, EventError, type EventClient } from './emit'
import { EVENT_TYPES, isEventType, MANUAL_TOUCH_EVENT_TYPES } from './types'

function fakeClient() {
  const rows: Record<string, unknown>[] = []

  const client = {
    from(_table: string) {
      return {
        insert(row: Record<string, unknown>) {
          rows.push(row)
          return {
            select: () => ({
              single: async () => ({ data: { id: `event-${rows.length}` }, error: null }),
            }),
          }
        },
      }
    },
  }

  return { client: client as unknown as EventClient, rows }
}

describe('event type catalogue', () => {
  it('has no duplicates', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length)
  })

  it('recognises a catalogue type and rejects anything else', () => {
    expect(isEventType('status.changed')).toBe(true)
    expect(isEventType('offer.sent')).toBe(false)   // removed from the catalogue
    expect(isEventType('deposit.paid')).toBe(false) // replaced by payment.received
  })

  it('counts only admin actions as manual touches', () => {
    for (const type of MANUAL_TOUCH_EVENT_TYPES) expect(isEventType(type)).toBe(true)
    expect(MANUAL_TOUCH_EVENT_TYPES).not.toContain('message.received')
  })
})

describe('emitEvent', () => {
  it('writes one row with the fields the metrics layer needs', async () => {
    const { client, rows } = fakeClient()

    const id = await emitEvent(client, {
      inquiryId: 'inq-1',
      type:      'inquiry.created',
      actor:     { kind: 'system' },
      source:    'app',
      channel:   'app',
      payload:   { source: 'web_form' },
    })

    expect(id).toBe('event-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      inquiry_id: 'inq-1',
      type:       'inquiry.created',
      actor_kind: 'system',
      actor_id:   null,
      source:     'app',
      channel:    'app',
      payload:    { source: 'web_form' },
    })
  })

  it('rejects an unknown type and writes nothing', async () => {
    const { client, rows } = fakeClient()

    await expect(emitEvent(client, {
      // @ts-expect-error — the point of the test is the runtime guard
      type:      'inquiry.teleported',
      inquiryId: 'inq-1',
      actor:     { kind: 'admin', id: 'a' },
      source:    'app',
    })).rejects.toThrow(EventError)

    expect(rows).toHaveLength(0)
  })

  it('rejects a missing source', async () => {
    const { client, rows } = fakeClient()

    await expect(emitEvent(client, {
      inquiryId: 'inq-1',
      type:      'status.changed',
      actor:     { kind: 'admin', id: 'a' },
      // @ts-expect-error — source is not optional
      source:    undefined,
    })).rejects.toThrow(/source must be one of/)

    expect(rows).toHaveLength(0)
  })

  it('rejects an unknown actor kind and an unknown channel', async () => {
    const { client } = fakeClient()

    await expect(emitEvent(client, {
      inquiryId: 'inq-1',
      type:      'status.changed',
      // @ts-expect-error — runtime guard
      actor:     { kind: 'robot' },
      source:    'app',
    })).rejects.toThrow(/actor.kind must be one of/)

    await expect(emitEvent(client, {
      inquiryId: 'inq-1',
      type:      'status.changed',
      actor:     { kind: 'admin', id: 'a' },
      source:    'app',
      // @ts-expect-error — runtime guard
      channel:   'carrier-pigeon',
    })).rejects.toThrow(/channel must be one of/)
  })

  it('passes occurred_at through for backfilled history', async () => {
    const { client, rows } = fakeClient()

    await emitEvent(client, {
      inquiryId:  'inq-1',
      type:       'inquiry.created',
      actor:      { kind: 'system' },
      source:     'backfill',
      occurredAt: new Date('2026-03-01T10:00:00Z'),
    })

    expect(rows[0]).toMatchObject({ source: 'backfill', occurred_at: '2026-03-01T10:00:00.000Z' })
  })
})
