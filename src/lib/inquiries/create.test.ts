/**
 * createInquiry — receivedOn (FA-1.38 round 2).
 *
 * tj's review: "today" is not a backdate — it's what `now()` already gives, down to
 * the second. Stamping it to noon UTC moved a lead entered at 10:00 Warsaw four hours
 * into the future, and one entered at 20:00 six hours into the past, corrupting the
 * 48h SLA counter and list ordering for every manually created inquiry, not just
 * genuine backfills. Only a receivedOn strictly earlier than today should be stamped.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue('event-1'),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { emitEvent } from '@/lib/events/emit'
import { createInquiry } from './create'
import { warsawToday } from './history'

const mockEmitEvent = vi.mocked(emitEvent)

function makeSvc(insertedId = 'inq-new') {
  let lastInsertPayload: Record<string, unknown> | null = null
  const svc = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'inquiries') return {}
      return {
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          lastInsertPayload = payload
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: insertedId, status: 'new' }, error: null }),
          }
        }),
      }
    }),
  }
  return { svc: svc as unknown as ReturnType<typeof createServiceClient>, getInsertPayload: () => lastInsertPayload }
}

const actor = { kind: 'admin' as const, id: 'admin-1' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createInquiry — receivedOn', () => {
  it('keeps the database default (now()) when receivedOn is today — does not stamp noon UTC', async () => {
    const { svc, getInsertPayload } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'Today Angler', anglerEmail: 'today@seed.test', partySize: 1,
      source: 'manual', actor, receivedOn: warsawToday(),
    })

    // No override sent — the DB's own `created_at default now()` applies, which by
    // construction lands within milliseconds of this call, not at noon UTC.
    const payload = getInsertPayload()
    expect(payload).not.toHaveProperty('created_at')

    expect(mockEmitEvent).toHaveBeenCalledTimes(1)
    const eventArg = mockEmitEvent.mock.calls[0][1] as { occurredAt?: unknown }
    expect(eventArg).not.toHaveProperty('occurredAt')
  })

  it('stamps created_at and occurredAt to noon UTC for a genuine past date', async () => {
    const { svc, getInsertPayload } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'Past Angler', anglerEmail: 'past@seed.test', partySize: 1,
      source: 'manual', actor, receivedOn: '2026-07-27',
    })

    const expectedInstant = new Date('2026-07-27T12:00:00.000Z').toISOString()
    expect(getInsertPayload()).toMatchObject({ created_at: expectedInstant })

    const eventArg = mockEmitEvent.mock.calls[0][1] as { occurredAt?: unknown }
    expect(eventArg.occurredAt).toBe(expectedInstant)
  })

  it('rejects a future receivedOn', async () => {
    const { svc } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    await expect(createInquiry({
      anglerName: 'Future Angler', anglerEmail: 'future@seed.test', partySize: 1,
      source: 'manual', actor, receivedOn: future,
    })).rejects.toThrow(/in the future/)
  })

  it('omits created_at and occurredAt entirely when receivedOn is not provided', async () => {
    const { svc, getInsertPayload } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'No Date Angler', anglerEmail: 'nodate@seed.test', partySize: 1,
      source: 'web_form', actor,
    })

    expect(getInsertPayload()).not.toHaveProperty('created_at')
    const eventArg = mockEmitEvent.mock.calls[0][1] as { occurredAt?: unknown }
    expect(eventArg).not.toHaveProperty('occurredAt')
  })
})

/**
 * FA-1.55 — the brief, and the two keys the pilot's metrics need on `inquiry.created`.
 *
 * `page_version` and `brief_completed` are added **only** with a brief, so a v1 inquiry's
 * event payload stays byte-identical to what it was before this task.
 */
describe('createInquiry — brief (FA-1.55)', () => {
  const brief = {
    dates_mode:  'flexible' as const,
    flex_month:  '2027-06',
    days:        2,
    anglers:     2,
    non_anglers: 0,
    skill_level: 4,
    priority:    'numbers' as const,
    fitness:     'mid' as const,
    wading_ok:   true,
  }

  it('writes the brief to the column as given, and the angler country', async () => {
    const { svc, getInsertPayload } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'V2 Angler', anglerEmail: 'v2@seed.test', anglerCountry: 'PL',
      partySize: 2, source: 'web_form', actor: { kind: 'system' },
      brief, pageVersion: 2,
    })

    const payload = getInsertPayload()
    expect(payload?.brief).toEqual(brief)
    expect(payload?.angler_country).toBe('PL')
  })

  it('stamps the created event with page_version and brief_completed', async () => {
    const { svc } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'V2 Angler', anglerEmail: 'v2@seed.test', partySize: 2,
      source: 'web_form', actor: { kind: 'system' }, brief, pageVersion: 2,
    })

    const event = mockEmitEvent.mock.calls[0][1] as { type: string; payload: Record<string, unknown> }
    expect(event.type).toBe('inquiry.created')
    expect(event.payload.page_version).toBe(2)
    expect(event.payload.brief_completed).toBe(true)
  })

  it('without a brief: no brief column, no angler_country, and the event payload of main', async () => {
    const { svc, getInsertPayload } = makeSvc()
    vi.mocked(createServiceClient).mockReturnValue(svc)

    await createInquiry({
      anglerName: 'V1 Angler', anglerEmail: 'v1@seed.test', partySize: 2,
      source: 'web_form', actor: { kind: 'system' }, pageVersion: 2,
    })

    const payload = getInsertPayload()
    expect(payload).not.toHaveProperty('brief')
    expect(payload).not.toHaveProperty('angler_country')

    const event = mockEmitEvent.mock.calls[0][1] as { payload: Record<string, unknown> }
    expect(Object.keys(event.payload).sort()).toEqual(
      ['experience_page_id', 'guide_id', 'inquiry_source', 'trip_country'],
    )
  })
})
