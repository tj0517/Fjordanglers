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
    send: async () => ({ externalId: 'ext-1', threadKey: 'thread-1' }),
  },
}))

vi.mock('@/lib/channels/whatsapp', () => ({
  whatsappAdapter: {
    send: async () => ({ externalId: 'ext-1', threadKey: null }),
    canSendFreeform: () => true,
  },
}))

vi.mock('@/lib/channels/instagram', () => ({
  instagramAdapter: {
    send: async () => ({ externalId: 'ext-1', threadKey: null }),
  },
}))

import { sendMessage } from './send'

// ─── Mock Supabase client ─────────────────────────────────────────────────────

type EmittedEvent = Record<string, unknown>

let emittedEvents: EmittedEvent[] = []

function makeMockClient() {
  emittedEvents = []
  const insertedMessages: Record<string, unknown>[] = []
  const updatedMessages:  Record<string, unknown>[] = []

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
        return { eq: () => ({ error: null }) }
      },
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          neq: () => ({ count: 0, error: null }),
        }),
      }),
    }),
  }
  return { client, insertedMessages, updatedMessages }
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
