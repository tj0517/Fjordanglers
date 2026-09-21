/**
 * FA-1.14 — sendMessage emits message.sent with payload.drafted_by.
 *
 * Verifies that when sendMessage is called with draftedBy='agent', the
 * emitted message.sent event carries payload.drafted_by='agent'.
 * Also covers draftedBy='admin' for completeness.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/channels/email', () => ({
  emailAdapter: {
    send: vi.fn().mockResolvedValue({ externalId: 'ext-1', threadKey: 'thread-1' }),
  },
}))

vi.mock('@/lib/channels/whatsapp', () => ({
  whatsappAdapter: {
    send: vi.fn().mockResolvedValue({ externalId: 'ext-1', threadKey: null }),
    canSendFreeform: vi.fn(() => true),
  },
}))

vi.mock('@/lib/channels/instagram', () => ({
  instagramAdapter: {
    send: vi.fn().mockResolvedValue({ externalId: 'ext-1', threadKey: null }),
  },
}))

import { sendMessage, DraftNotFoundError } from './send'
import { emailAdapter }    from '@/lib/channels/email'
import { whatsappAdapter } from '@/lib/channels/whatsapp'

// ─── Mock Supabase client ─────────────────────────────────────────────────────

type EmittedEvent = Record<string, unknown>

let emittedEvents: EmittedEvent[] = []

/**
 * @param opts.draftUpdateReturns - 'found' (default): UPDATE returns 1 row (happy path).
 *                                  'not_found': UPDATE returns 0 rows (stale/mismatched draft).
 */
function makeMockClient(opts: { draftUpdateReturns?: 'found' | 'not_found' } = {}) {
  emittedEvents = []
  const insertedMessages: Record<string, unknown>[] = []
  const updatedMessages:  Record<string, unknown>[] = []
  // Accumulates every .eq(col, val) called on the UPDATE chain
  const capturedUpdateFilters: { col: string; val: unknown }[] = []

  // Fluent chain for .update().*eq()*.select()
  type UpdChain = { eq(k: string, v: unknown): UpdChain; select(col: string): { data: { id: string }[]; error: null } }
  const makeUpdateChain = (): UpdChain => ({
    eq:     (k, v) => { capturedUpdateFilters.push({ col: k, val: v }); return makeUpdateChain() },
    select: () => ({
      data:  opts.draftUpdateReturns === 'not_found' ? [] : [{ id: 'draft-row-id' }],
      error: null,
    }),
  })

  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === 'messages') {
          insertedMessages.push(row)
          return {
            select: () => ({ single: async () => ({ data: { id: 'msg-1' }, error: null }) }),
          }
        }
        if (table === 'inquiry_events') {
          emittedEvents.push(row)
          return {
            select: () => ({ single: async () => ({ data: { id: 'evt-1' }, error: null }) }),
          }
        }
        return { select: () => ({ single: async () => ({ data: null, error: null }) }) }
      },
      update: (payload: Record<string, unknown>) => {
        if (table === 'messages') updatedMessages.push(payload)
        return makeUpdateChain()
      },
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          neq: () => ({ count: 0, error: null }),
        }),
      }),
    }),
  }
  return { client, insertedMessages, updatedMessages, capturedUpdateFilters }
}

describe('sendMessage — payload.drafted_by in message.sent event', () => {
  beforeEach(() => { emittedEvents = [] })

  it('emits message.sent with payload.drafted_by=agent when draftedBy=agent', async () => {
    const { client } = makeMockClient()

    await sendMessage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      {
        inquiryId:   'inq-1',
        channel:     'email',
        counterpart: 'angler',
        to:          'angler@example.invalid',
        body:        'Here is your reply.',
        draftedBy:   'agent',
        actor:       { kind: 'agent' },
      },
    )

    const sent = emittedEvents.find(e => e.type === 'message.sent')
    expect(sent).toBeDefined()
    expect((sent!.payload as Record<string, unknown>).drafted_by).toBe('agent')
  })

  it('emits message.sent with payload.drafted_by=admin when draftedBy=admin', async () => {
    const { client } = makeMockClient()

    await sendMessage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      {
        inquiryId:   'inq-1',
        channel:     'email',
        counterpart: 'angler',
        to:          'angler@example.invalid',
        body:        'Admin message.',
        draftedBy:   'admin',
        actor:       { kind: 'admin', id: 'admin-uid' },
      },
    )

    const sent = emittedEvents.find(e => e.type === 'message.sent')
    expect(sent).toBeDefined()
    expect((sent!.payload as Record<string, unknown>).drafted_by).toBe('admin')
  })
})

describe('sendMessage — draftId lifecycle (FA-1.14 round 2)', () => {
  beforeEach(() => { emittedEvents = [] })

  it('when draftId is given: updates the row (no insert), emits message.sent with drafted_by=agent', async () => {
    const { client, insertedMessages, updatedMessages } = makeMockClient()

    await sendMessage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      {
        inquiryId:   'inq-1',
        channel:     'email',
        counterpart: 'angler',
        to:          'angler@example.invalid',
        body:        'Final reply text.',
        draftedBy:   'agent',
        draftId:     'draft-row-id',
        actor:       { kind: 'admin', id: 'admin-uid' },
      },
    )

    // No new row inserted
    expect(insertedMessages).toHaveLength(0)
    // Existing row updated (status=queued then sent)
    expect(updatedMessages.some(u => u.status === 'queued')).toBe(true)
    // Event carries drafted_by=agent
    const sent = emittedEvents.find(e => e.type === 'message.sent')
    expect(sent).toBeDefined()
    expect((sent!.payload as Record<string, unknown>).drafted_by).toBe('agent')
    // messageId in event should be the draftId
    expect(sent!.message_id).toBe('draft-row-id')
  })
})

describe('sendMessage — promotion guard (FA-1.14 round 3)', () => {
  beforeEach(() => {
    emittedEvents = []
    vi.clearAllMocks()
  })

  // r3-1: stale draftId (row already 'sent') → guard rejects; verifies all WHERE conditions
  it('(r3-1) stale draftId → throws DraftNotFoundError, all 5 WHERE conditions applied, email adapter not called', async () => {
    const { client, capturedUpdateFilters } = makeMockClient({ draftUpdateReturns: 'not_found' })

    await expect(
      sendMessage(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
        {
          inquiryId:   'inq-1',
          channel:     'email',
          counterpart: 'angler',
          to:          'angler@example.invalid',
          body:        'Re-send attempt.',
          draftedBy:   'agent',
          draftId:     'already-sent-draft-id',
          actor:       { kind: 'admin', id: 'admin-uid' },
        },
      ),
    ).rejects.toThrow(DraftNotFoundError)

    // All 5 WHERE conditions must be applied — if any is missing, removing it from send.ts fails here
    expect(capturedUpdateFilters).toEqual(expect.arrayContaining([
      { col: 'id',          val: 'already-sent-draft-id' },
      { col: 'inquiry_id',  val: 'inq-1' },
      { col: 'channel',     val: 'email' },
      { col: 'counterpart', val: 'angler' },
      { col: 'status',      val: 'draft' },
    ]))

    // Guard throws before provider — email adapter not called
    expect(vi.mocked(emailAdapter.send)).not.toHaveBeenCalled()

    // No message.sent event emitted
    expect(emittedEvents.find(e => e.type === 'message.sent')).toBeUndefined()
  })

  // r3-2: channel/counterpart mismatch — same guard, verifies channel/counterpart/status in WHERE
  it('(r3-2) channel/counterpart mismatch → throws DraftNotFoundError, channel+status in WHERE, wa adapter not called', async () => {
    const { client, capturedUpdateFilters } = makeMockClient({ draftUpdateReturns: 'not_found' })

    // Draft was email/angler; sending as whatsapp/guide — guard must catch the mismatch
    await expect(
      sendMessage(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
        {
          inquiryId:   'inq-1',
          channel:     'whatsapp',
          counterpart: 'guide',
          to:          '+48123456789',
          body:        'Wrong channel send.',
          draftedBy:   'agent',
          draftId:     'email-angler-draft-id',
          actor:       { kind: 'admin', id: 'admin-uid' },
        },
      ),
    ).rejects.toThrow(DraftNotFoundError)

    // channel, counterpart, status must all be in the WHERE — removing any one must break this
    expect(capturedUpdateFilters).toEqual(expect.arrayContaining([
      { col: 'channel',     val: 'whatsapp' },
      { col: 'counterpart', val: 'guide' },
      { col: 'status',      val: 'draft' },
    ]))

    // Guard throws before provider
    expect(vi.mocked(whatsappAdapter.send)).not.toHaveBeenCalled()

    expect(emittedEvents.find(e => e.type === 'message.sent')).toBeUndefined()
  })
})
