/**
 * Email-inbound webhook — a client message after a human reply. FA-1.48
 *
 * Real route, real autoSendReply, real takeover query and real emitEvent over an in-memory
 * database. Only the model calls (draftReply / judgeReply), the e-mail send and the
 * matcher are mocked.
 *
 * A client message in a thread a human has taken over: the message and `message.received`
 * are stored, autoSendReply runs and answers "human has taken over the thread" (event
 * `agent.auto_send_decided`, sent=false) without a draft, a judge call or a send. The D2
 * transition (new → qualifying) keeps its own rule.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockEnv = vi.hoisted(() => ({
  RESEND_INBOUND_SECRET:  undefined as string | undefined,
  RESEND_API_KEY:         'test-resend' as string,
  AI_AUTO_REPLY_ENABLED:  true,
  AI_AUTO_SEND_DAILY_CAP: undefined as number | undefined,
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: mockEnv }))
vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail:     vi.fn().mockResolvedValue('inq-1'),
  matchInquiryByRecipient: vi.fn(),
}))
vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: vi.fn() }))
vi.mock('@/lib/ai/draft-reply', () => ({
  draftReply: vi.fn(),
  DraftReplyError: class DraftReplyError extends Error {},
}))
vi.mock('@/lib/ai/judge-reply', () => ({ judgeReply: vi.fn(), JUDGE_THRESHOLD: 0.9 }))
vi.mock('@/lib/messages/send', () => ({
  sendMessage: vi.fn(),
  DraftNotFoundError: class DraftNotFoundError extends Error {},
}))
// Gate 4 needs a destination entry; the knowledge loader itself is not under test here.
vi.mock('@/lib/ai/knowledge', () => ({
  loadKnowledge: vi.fn().mockResolvedValue({ entries: [{ kind: 'destination' }] }),
}))
vi.mock('@/lib/inquiries/state', () => ({
  transition:      vi.fn().mockResolvedValue({ from: 'new', to: 'qualifying' }),
  TransitionError: class TransitionError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/ai/draft-reply'
import { judgeReply } from '@/lib/ai/judge-reply'
import { sendMessage } from '@/lib/messages/send'
import { transition } from '@/lib/inquiries/state'

// ─── In-memory database ───────────────────────────────────────────────────────

type Row = Record<string, unknown>

let tables: Record<'messages' | 'inquiry_events', Row[]>

function query(rows: Row[], opts?: { count?: string; head?: boolean }) {
  const filters: ((r: Row) => boolean)[] = []
  const run = () => rows.filter(r => filters.every(f => f(r)))
  const builder = {
    eq:    (col: string, val: unknown)    => { filters.push(r => r[col] === val); return builder },
    neq:   (col: string, val: unknown)    => { filters.push(r => r[col] !== val); return builder },
    in:    (col: string, vals: unknown[]) => { filters.push(r => vals.includes(r[col])); return builder },
    gte:   () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(
        opts?.head === true
          ? { count: run().length, data: null, error: null }
          : { data: run(), error: null },
      ).then(resolve, reject),
  }
  return builder
}

function setupDb(seed: { status: string; messages: Row[] }) {
  tables = { messages: seed.messages, inquiry_events: [] }
  const inquiry = { id: 'inq-1', status: seed.status, angler_email: 'angler@example.com' }

  vi.mocked(createServiceClient).mockReturnValue({
    from: (name: string) => {
      if (name === 'messages' || name === 'inquiry_events') {
        const rows = tables[name]
        return {
          select: (_f?: string, o?: { count?: string; head?: boolean }) => query(rows, o),
          insert: (row: Row) => {
            const stored = { id: `${name}-${rows.length + 1}`, ...row }
            rows.push(stored)
            return { select: () => ({ single: async () => ({ data: { id: stored.id }, error: null }) }) }
          },
        }
      }
      if (name === 'inquiries') {
        return {
          select: () => query([inquiry]),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      return {}
    },
  } as unknown as ReturnType<typeof createServiceClient>)
}

const T = (n: number) => `2026-10-0${n}T10:00:00Z`

const FIRST_CLIENT_MSG = {
  id: 'm-1', inquiry_id: 'inq-1', direction: 'inbound', counterpart: 'angler',
  status: 'received', drafted_by: null, body: 'Hello, planning NZ.', occurred_at: T(1),
}
const MANUAL_REPLY = {
  id: 'm-2', inquiry_id: 'inq-1', direction: 'outbound', counterpart: 'angler',
  status: 'sent', drafted_by: 'admin', body: 'Hi, here is the price.', occurred_at: T(2),
}
const AUTO_REPLY = {
  id: 'm-0', inquiry_id: 'inq-1', direction: 'outbound', counterpart: 'angler',
  status: 'sent', drafted_by: 'agent', body: 'Thanks for your inquiry.', occurred_at: T(1),
}

const GUIDE_MESSAGE = {
  id: 'm-g', inquiry_id: 'inq-1', direction: 'outbound', counterpart: 'guide',
  status: 'sent', drafted_by: 'admin', body: 'Are you free on 20 June?', occurred_at: T(2),
}

function makeRequest() {
  return new NextRequest('http://localhost/api/webhooks/email-inbound', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({
      type: 'email.received',
      data: {
        email_id: 'email-inbound-1',
        from:     'angler@example.com',
        to:       ['leads@fjordanglers.com'],
        subject:  'Re: trip',
        text:     'And what about 20 June?',
      },
    }),
  })
}

function eventsOfType(type: string) {
  return tables.inquiry_events.filter(e => e.type === type)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = true
  process.env.RESEND_DEV_FAKE = '1'
  vi.mocked(draftReply).mockResolvedValue({ draftId: 'draft-1', text: 'Hello!', subject: 'Re: trip', usedIds: [], usedEntries: [] })
  vi.mocked(judgeReply).mockResolvedValue({ score: 0.95, send: true, reasons: ['looks good'] })
})

afterEach(() => {
  delete process.env.RESEND_DEV_FAKE
})

describe('email-inbound webhook — client message after a human reply (FA-1.48)', () => {
  it('stores the message and message.received, then autoSendReply answers "human has taken over" — no draft, no judge, no send, no D2', async () => {
    setupDb({ status: 'new', messages: [FIRST_CLIENT_MSG, MANUAL_REPLY] })

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const stored = tables.messages.filter(m => m.direction === 'inbound' && m.external_id === 'email-inbound-1')
    expect(stored).toHaveLength(1)
    expect(eventsOfType('message.received')).toHaveLength(1)

    const decisions = eventsOfType('agent.auto_send_decided')
    expect(decisions).toHaveLength(1)
    expect(decisions[0].payload).toEqual({
      sent: false, score: null, reasons: ['human has taken over the thread'], draft_message_id: null,
    })

    expect(vi.mocked(draftReply)).not.toHaveBeenCalled()
    expect(vi.mocked(judgeReply)).not.toHaveBeenCalled()
    expect(vi.mocked(sendMessage)).not.toHaveBeenCalled()
    expect(vi.mocked(transition)).not.toHaveBeenCalled()
  })

  it('leaves D2 untouched: an earlier agent auto-reply still moves new → qualifying, while the human takeover keeps the agent silent', async () => {
    setupDb({ status: 'new', messages: [FIRST_CLIENT_MSG, AUTO_REPLY, MANUAL_REPLY] })

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(transition).mock.calls[0][2]).toBe('qualifying')
    expect(eventsOfType('agent.auto_send_decided')[0].payload).toMatchObject({
      sent: false, reasons: ['human has taken over the thread'],
    })
    expect(vi.mocked(draftReply)).not.toHaveBeenCalled()
  })

  it('keeps the agent leading when no human has written yet — the model is called and the reply goes out', async () => {
    setupDb({ status: 'new', messages: [FIRST_CLIENT_MSG, AUTO_REPLY] })
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(draftReply)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)
    expect(eventsOfType('agent.auto_send_decided')[0].payload).toMatchObject({ sent: true, score: 0.95 })
  })

  it('a human message to a guide is not a takeover — the agent keeps leading', async () => {
    setupDb({ status: 'new', messages: [FIRST_CLIENT_MSG, AUTO_REPLY, GUIDE_MESSAGE] })

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(draftReply)).toHaveBeenCalledTimes(1)
    expect(eventsOfType('agent.auto_send_decided')[0].payload).toMatchObject({ sent: true })
  })
})
