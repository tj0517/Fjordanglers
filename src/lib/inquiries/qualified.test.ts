import { vi, describe, it, expect, beforeEach } from 'vitest'
import { computeQualified, setQualified, QualifiedError } from './qualified'
import type { EventClient } from '@/lib/events/emit'

// ─── computeQualified — pure function, six cases from D1 ─────────────────────

describe('computeQualified', () => {
  it('not_viable + country in list → no (disqualifier wins)', () => {
    expect(computeQualified({ priority: 'not_viable', tripCountry: 'Iceland' })).toBe('no')
  })

  it('not_viable + country null → no (disqualifier known, country cannot rescue)', () => {
    expect(computeQualified({ priority: 'not_viable', tripCountry: null })).toBe('no')
  })

  it('high + country null → unknown (cannot evaluate yet)', () => {
    expect(computeQualified({ priority: 'high', tripCountry: null })).toBe('unknown')
  })

  it('high + country not in COUNTRIES → no', () => {
    expect(computeQualified({ priority: 'high', tripCountry: 'Spain' })).toBe('no')
  })

  it('high + country in COUNTRIES → yes', () => {
    expect(computeQualified({ priority: 'high', tripCountry: 'New Zealand' })).toBe('yes')
  })

  it('priority null + country in list → unknown (cannot evaluate yet)', () => {
    expect(computeQualified({ priority: null, tripCountry: 'Norway' })).toBe('unknown')
  })

  it('case-insensitive country match', () => {
    expect(computeQualified({ priority: 'medium', tripCountry: 'norway' })).toBe('yes')
  })
})

// ─── setQualified — mocked Supabase ──────────────────────────────────────────

function makeMockClient() {
  const eventsInserted: Record<string, unknown>[] = []
  let updatePayload: Record<string, unknown> | null = null
  let updateError: { message: string } | null = null

  const client = {
    from: (table: string) => {
      if (table === 'inquiries') {
        return {
          update: (payload: Record<string, unknown>) => {
            updatePayload = payload
            return {
              eq: () => Promise.resolve({ error: updateError }),
            }
          },
        }
      }
      if (table === 'inquiry_events') {
        return {
          insert: (row: Record<string, unknown>) => {
            eventsInserted.push(row)
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'evt-1' }, error: null }),
              }),
            }
          },
        }
      }
      return {}
    },
  } as unknown as EventClient

  return { client, eventsInserted, getUpdatePayload: () => updatePayload, setUpdateError: (e: { message: string } | null) => { updateError = e } }
}

describe('setQualified', () => {
  it('agent: writes yes, qualified_set_by=agent, emits one qualified_set event', async () => {
    const { client, eventsInserted, getUpdatePayload } = makeMockClient()

    await setQualified(client, 'inq-1', 'yes', { kind: 'agent' })

    const update = getUpdatePayload()
    expect(update?.qualified).toBe('yes')
    expect(update?.qualified_set_by).toBe('agent')
    expect(update?.qualified_set_at).toBeTruthy()

    expect(eventsInserted).toHaveLength(1)
    expect(eventsInserted[0]).toMatchObject({
      type:       'inquiry.qualified_set',
      actor_kind: 'agent',
      payload:    { value: 'yes', rule: 'O-10' },
    })
  })

  it('admin yes: writes yes, qualified_set_by=admin, emits one event with rule=manual', async () => {
    const { client, eventsInserted, getUpdatePayload } = makeMockClient()

    await setQualified(client, 'inq-1', 'yes', { kind: 'admin', id: 'uid-1' })

    const update = getUpdatePayload()
    expect(update?.qualified_set_by).toBe('admin')

    expect(eventsInserted).toHaveLength(1)
    expect(eventsInserted[0]).toMatchObject({
      type:       'inquiry.qualified_set',
      actor_kind: 'admin',
      payload:    { value: 'yes', rule: 'manual' },
    })
  })

  it('admin unknown: qualified_set_by=null (lock released), emits one event', async () => {
    const { client, eventsInserted, getUpdatePayload } = makeMockClient()

    await setQualified(client, 'inq-1', 'unknown', { kind: 'admin', id: 'uid-1' })

    const update = getUpdatePayload()
    expect(update?.qualified).toBe('unknown')
    expect(update?.qualified_set_by).toBeNull()

    expect(eventsInserted).toHaveLength(1)
    expect(eventsInserted[0]).toMatchObject({
      type:    'inquiry.qualified_set',
      payload: { value: 'unknown', rule: 'manual' },
    })
  })

  it('throws QualifiedError when DB update fails', async () => {
    const { client, setUpdateError } = makeMockClient()
    setUpdateError({ message: 'connection refused' })

    await expect(
      setQualified(client, 'inq-1', 'yes', { kind: 'agent' }),
    ).rejects.toBeInstanceOf(QualifiedError)
  })
})
