/**
 * FA-1.27 — autoSendReply / hasAgentAutoReply tests.
 *
 * Gate tests (red→green):
 *   ‣ counterpart=guide, channel=whatsapp, status=waiting_guide → null, 0 sends, 0 events
 *   ‣ no destination entry → draft saved, event sent=false (RED: remove dest gate → test fails)
 *   ‣ judge score=0.89 → draft saved, event sent=false
 *   ‣ judge send=false (complaint) → draft saved, event sent=false
 *
 * Happy path:
 *   ‣ new inquiry, active entries, judge 0.93/true → sendMessage called, event sent=true
 *
 * hasAgentAutoReply:
 *   ‣ prior agent-sent message → true; none → false
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Module mocks (vi.fn() inline so hoisting works) ─────────────────────────

vi.mock('@/lib/ai/draft-reply', () => ({
  draftReply: vi.fn(),
  DraftReplyError: class DraftReplyError extends Error {
    name = 'DraftReplyError'
    constructor(m: string) { super(m) }
  },
}))

vi.mock('@/lib/ai/judge-reply', () => ({
  judgeReply:      vi.fn(),
  JUDGE_THRESHOLD: 0.9,
}))

vi.mock('@/lib/messages/send', () => ({
  sendMessage: vi.fn(),
  DraftNotFoundError: class DraftNotFoundError extends Error { constructor(id: string) { super(id) } },
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { ANTHROPIC_API_KEY: 'test-key' } }))

import { createServiceClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/ai/draft-reply'
import { judgeReply } from '@/lib/ai/judge-reply'
import { sendMessage } from '@/lib/messages/send'
import { autoSendReply, hasAgentAutoReply } from './auto-send'

// ─── Mock DB ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

let emittedEvents: Row[] = []

interface MockOptions {
  status?:          string
  trip_country?:    string
  angler_email?:    string
  knowledgeRows?:   Row[]
  priorAgentMsgs?:  Row[]
  conversationMsgs?: Row[]
}

const DEFAULT_KNOWLEDGE = [
  { id: 'k-inst', kind: 'instructions', country: null,          guide_id: null, title: 'Instructions', body: 'Be helpful.' },
  { id: 'k-tone', kind: 'tone',         country: null,          guide_id: null, title: 'Tone',         body: 'Warm.'        },
  { id: 'k-dest', kind: 'destination',  country: 'New Zealand', guide_id: null, title: 'NZ',           body: 'Great rivers.' },
]

const DEFAULT_CONVERSATION = [
  { direction: 'inbound',  body: 'I want to fish NZ rivers.',   status: 'received', occurred_at: '2026-09-01T10:00:00Z' },
  { direction: 'outbound', body: 'Great, we can arrange that.',  status: 'sent',     occurred_at: '2026-09-01T11:00:00Z' },
]

function setupMockDb(opts: MockOptions = {}) {
  emittedEvents = []

  const {
    status          = 'new',
    trip_country    = 'New Zealand',
    angler_email    = 'angler@example.com',
    knowledgeRows   = DEFAULT_KNOWLEDGE,
    priorAgentMsgs  = [],
    conversationMsgs = DEFAULT_CONVERSATION,
  } = opts

  const inquiry = { id: 'inq-1', status, trip_country, angler_email }

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'agent_knowledge') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: knowledgeRows, error: null }),
          }),
        }
      }

      if (table === 'inquiry_events') {
        return {
          insert: (row: Row) => {
            emittedEvents.push(row)
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'evt-id' }, error: null }),
              }),
            }
          },
        }
      }

      if (table === 'messages') {
        return {
          select: (_fields?: string, opts2?: Record<string, unknown>) => {
            const isCountQuery = opts2?.count === 'exact' && opts2?.head === true
            if (isCountQuery) {
              const count  = priorAgentMsgs.length
              const builder = {
                eq: () => builder,
                in: () => Promise.resolve({ count, error: null }),
              }
              return builder
            }
            // Conversation query: .select(...).eq(...).neq(...).order(...)
            const builder = {
              eq:    () => builder,
              neq:   () => builder,
              order: () => Promise.resolve({ data: conversationMsgs, error: null }),
            }
            return builder
          },
        }
      }

      if (table === 'inquiries') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: inquiry, error: null }),
            }),
          }),
        }
      }

      return {}
    },
  } as unknown as ReturnType<typeof createServiceClient>)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('autoSendReply — pre-draft gate failures (null, no events)', () => {
  beforeEach(() => {
    setupMockDb()
    vi.mocked(sendMessage).mockReset()
    vi.mocked(draftReply).mockReset()
    vi.mocked(judgeReply).mockReset()
  })

  it('returns null for counterpart=guide without drafting', async () => {
    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'guide', channel: 'email' })
    expect(result).toBeNull()
    expect(vi.mocked(draftReply)).not.toHaveBeenCalled()
    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(0)
  })

  it('returns null for channel=whatsapp without drafting', async () => {
    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'whatsapp' })
    expect(result).toBeNull()
    expect(vi.mocked(draftReply)).not.toHaveBeenCalled()
    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(0)
  })

  it('returns null for status=waiting_guide without drafting', async () => {
    setupMockDb({ status: 'waiting_guide' })
    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'email' })
    expect(result).toBeNull()
    expect(vi.mocked(draftReply)).not.toHaveBeenCalled()
    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(0)
  })
})

describe('autoSendReply — destination gate (post-draft, RED guard)', () => {
  beforeEach(() => {
    vi.mocked(sendMessage).mockReset()
    vi.mocked(draftReply).mockResolvedValue({ draftId: 'draft-1', text: 'Hello!', subject: 'Re: trip', usedIds: ['k-inst'] })
    vi.mocked(judgeReply).mockResolvedValue({ score: 0.95, send: true, reasons: ['looks good'] })
  })

  it('does NOT send and emits sent=false when no destination entry exists — RED: remove destination gate and this test fails', async () => {
    setupMockDb({ knowledgeRows: [
      { id: 'k-inst', kind: 'instructions', country: null, guide_id: null, title: 'Instructions', body: 'Be helpful.' },
      { id: 'k-tone', kind: 'tone',         country: null, guide_id: null, title: 'Tone',         body: 'Warm.'        },
    ] })

    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'email' })

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.sent).toBe(false)
    expect(result!.score).toBeNull()
    expect(result!.reasons[0]).toMatch(/destination/)

    expect(emittedEvents).toHaveLength(1)
    const payload = emittedEvents[0].payload as Record<string, unknown>
    expect(payload.sent).toBe(false)
    expect(payload.score).toBeNull()
    expect(String((payload.reasons as string[])[0])).toMatch(/destination/)
    expect(payload.draft_message_id).toBe('draft-1')
  })
})

describe('autoSendReply — judge gate failures', () => {
  beforeEach(() => {
    setupMockDb()
    vi.mocked(sendMessage).mockReset()
    vi.mocked(draftReply).mockResolvedValue({ draftId: 'draft-2', text: 'Hello angler!', subject: 'Re: trip', usedIds: [] })
  })

  it('does NOT send when judge score=0.89 and emits sent=false with score', async () => {
    vi.mocked(judgeReply).mockResolvedValue({ score: 0.89, send: true, reasons: ['slightly uncertain about dates'] })

    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'email' })

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(result!.sent).toBe(false)
    expect(result!.score).toBe(0.89)

    const payload = emittedEvents[0].payload as Record<string, unknown>
    expect(payload.sent).toBe(false)
    expect(payload.score).toBe(0.89)
  })

  it('does NOT send when judge send=false (complaint) even if score=0.97', async () => {
    vi.mocked(judgeReply).mockResolvedValue({ score: 0.97, send: false, reasons: ['angler expressed a complaint'] })

    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'email' })

    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(result!.sent).toBe(false)
    expect(result!.score).toBe(0.97)

    const payload = emittedEvents[0].payload as Record<string, unknown>
    expect(payload.sent).toBe(false)
    expect((payload.reasons as string[])[0]).toMatch(/complaint/)
  })
})

describe('autoSendReply — happy path', () => {
  beforeEach(() => {
    setupMockDb({ status: 'new', trip_country: 'New Zealand' })
    vi.mocked(sendMessage).mockReset()
    vi.mocked(draftReply).mockResolvedValue({
      draftId: 'draft-3',
      text:    'Looking forward to your NZ trip!',
      subject: 'Re: New Zealand inquiry',
      usedIds: ['k-inst', 'k-dest'],
    })
    vi.mocked(judgeReply).mockResolvedValue({ score: 0.93, send: true, reasons: ['clear, accurate, safe to send'] })
    vi.mocked(sendMessage).mockResolvedValue({ messageId: 'sent-msg-id', threadKey: null })
  })

  it('calls sendMessage with agent actor and emits agent.auto_send_decided sent=true; status stays new', async () => {
    const result = await autoSendReply({ inquiryId: 'inq-1', counterpart: 'angler', channel: 'email' })

    expect(result).not.toBeNull()
    expect(result!.sent).toBe(true)
    expect(result!.score).toBe(0.93)
    expect(result!.draftMessageId).toBe('draft-3')

    expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)
    const sendCall = vi.mocked(sendMessage).mock.calls[0][1] as unknown as Record<string, unknown>
    expect(sendCall.inquiryId).toBe('inq-1')
    expect(sendCall.counterpart).toBe('angler')
    expect(sendCall.channel).toBe('email')
    expect(sendCall.draftId).toBe('draft-3')
    expect(sendCall.draftedBy).toBe('agent')
    expect(sendCall.actor).toEqual({ kind: 'agent' })

    expect(emittedEvents).toHaveLength(1)
    const payload = emittedEvents[0].payload as Record<string, unknown>
    expect(payload.sent).toBe(true)
    expect(payload.score).toBe(0.93)
    expect(payload.draft_message_id).toBe('draft-3')
  })
})

describe('hasAgentAutoReply', () => {
  it('returns true when a prior agent-sent message exists', async () => {
    setupMockDb({ priorAgentMsgs: [{ id: 'msg-agent-1', drafted_by: 'agent', status: 'sent' }] })
    expect(await hasAgentAutoReply('inq-1')).toBe(true)
  })

  it('returns false when no prior agent-sent message exists', async () => {
    setupMockDb({ priorAgentMsgs: [] })
    expect(await hasAgentAutoReply('inq-1')).toBe(false)
  })
})
