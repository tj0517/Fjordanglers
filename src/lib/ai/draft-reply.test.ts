/**
 * FA-1.14 — draftReply unit tests.
 *
 * Verifies that draftReply:
 *   - saves a messages row with status='draft' and drafted_by='agent'
 *   - does NOT emit any inquiry_events row
 *   - throws a readable error when the conversation thread is empty
 *
 * Anthropic, Supabase and @/lib/env are mocked.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import path from 'path'

const FIXTURE_DIR = path.resolve(__dirname, '__fixtures__/knowledge')

const anthropicCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Draft reply text from stub.' }],
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    NEXT_PUBLIC_APP_URL: 'https://test.example.com',
  },
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/inquiries/experience-lookup', () => ({
  getInquiryExperience: async () => null,
  tripTitleOf: () => null,
}))

import { createServiceClient } from '@/lib/supabase/server'
import { draftReply, DraftReplyError } from './draft-reply'

// ─── Mock DB helpers ─────────────────────────────────────────────────────────

type InsertedRow = Record<string, unknown>

let insertedMessages: InsertedRow[] = []
let insertedEvents:   InsertedRow[] = []
let updatedMessages:  InsertedRow[] = []

const INQUIRY_DATA = {
  angler_name:        'Jan Kowalski',
  message:            'I want to fish for salmon',
  requested_dates:    ['2026-07-15'],
  party_size:         2,
  trip_country:       'Iceland',
  assigned_guide_id:  null,
  trip_id:            null,
  experience_page_id: null,
}

/**
 * @param messages - thread messages returned by the DB
 * @param existingDraft - if non-null, the messages table returns this as an existing draft
 *                        (simulates a second "zaproponuj" call)
 */
interface MockBuilder {
  eq(k: string, v: unknown): MockBuilder
  neq(k: string, v: unknown): MockBuilder
  order(): Promise<{ data: unknown[]; error: null }>
  single(): Promise<{ data: unknown; error: null }>
  maybeSingle(): Promise<{ data: unknown; error: null }>
}

function mockDb(messages: unknown[] = [], existingDraft: { id: string } | null = null) {
  insertedMessages = []
  insertedEvents   = []
  updatedMessages  = []

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => ({
      select: () => {
        // Fluent builder — accumulates eq/neq filters, resolves on terminal call
        const eqs:  [string, unknown][] = []
        const neqs: [string, unknown][] = []

        const builder: MockBuilder = {
          eq(k: string, v: unknown): MockBuilder  { eqs.push([k, v]);  return builder },
          neq(k: string, v: unknown): MockBuilder { neqs.push([k, v]); return builder },
          order(): Promise<{ data: unknown[]; error: null }> {
            // Thread query: apply neq filters (e.g. status != 'draft')
            const filtered = (messages as Array<Record<string, unknown>>).filter(row =>
              !neqs.some(([k, v]) => row[k] === v),
            )
            return Promise.resolve({ data: filtered, error: null })
          },
          async single() {
            if (table === 'inquiries') return { data: INQUIRY_DATA, error: null }
            return { data: null, error: null }
          },
          async maybeSingle() {
            if (table === 'messages') {
              const isDraftQuery = eqs.some(([k, v]) => k === 'status' && v === 'draft')
              if (isDraftQuery && existingDraft != null) return { data: existingDraft, error: null }
            }
            return { data: null, error: null }
          },
        }
        return builder
      },
      update: (payload: Record<string, unknown>) => {
        if (table === 'messages') updatedMessages.push(payload)
        return { eq: () => ({ error: null }) }
      },
      insert: (row: Record<string, unknown>) => {
        if (table === 'messages')       insertedMessages.push(row)
        if (table === 'inquiry_events') insertedEvents.push(row)
        return {
          select: () => ({
            single: async () => ({ data: { id: 'draft-msg-id-1' }, error: null }),
          }),
        }
      },
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('draftReply', () => {
  beforeEach(() => {
    mockDb([
      { direction: 'inbound', channel: 'email', body: 'Hello, I want to book', occurred_at: '2026-07-01T10:00:00Z' },
      { direction: 'outbound', channel: 'email', body: 'What species?', occurred_at: '2026-07-01T11:00:00Z' },
      { direction: 'inbound', channel: 'email', body: 'Salmon please', occurred_at: '2026-07-01T12:00:00Z' },
      { direction: 'inbound', channel: 'email', body: 'Flexible on dates', occurred_at: '2026-07-01T13:00:00Z' },
    ])
  })

  it('saves a draft row with status=draft and drafted_by=agent', async () => {
    const result = await draftReply({
      inquiryId:    'inquiry-1',
      counterpart:  'angler',
      channel:      'email',
      knowledgeDir: FIXTURE_DIR,
    })

    expect(result.draftId).toBe('draft-msg-id-1')
    expect(result.text).toBe('Draft reply text from stub.')

    expect(insertedMessages).toHaveLength(1)
    expect(insertedMessages[0].status).toBe('draft')
    expect(insertedMessages[0].drafted_by).toBe('agent')
    expect(insertedMessages[0].inquiry_id).toBe('inquiry-1')
    expect(insertedMessages[0].counterpart).toBe('angler')
    expect(insertedMessages[0].channel).toBe('email')
  })

  it('does NOT insert an inquiry_events row', async () => {
    await draftReply({
      inquiryId:    'inquiry-1',
      counterpart:  'angler',
      channel:      'email',
      knowledgeDir: FIXTURE_DIR,
    })

    expect(insertedEvents).toHaveLength(0)
  })

  it('returns the paths of used knowledge files', async () => {
    const result = await draftReply({
      inquiryId:    'inquiry-1',
      counterpart:  'angler',
      channel:      'email',
      knowledgeDir: FIXTURE_DIR,
    })

    // Iceland inquiry → tone + iceland destination
    expect(result.usedFiles.some(f => f.includes('tone'))).toBe(true)
    expect(result.usedFiles.some(f => f.includes('iceland'))).toBe(true)
  })

  it('throws a readable DraftReplyError when thread is empty', async () => {
    mockDb([]) // no messages

    await expect(
      draftReply({
        inquiryId:    'inquiry-empty',
        counterpart:  'angler',
        channel:      'email',
        knowledgeDir: FIXTURE_DIR,
      }),
    ).rejects.toThrow(DraftReplyError)

    await expect(
      draftReply({
        inquiryId:    'inquiry-empty',
        counterpart:  'angler',
        channel:      'email',
        knowledgeDir: FIXTURE_DIR,
      }),
    ).rejects.toThrow('conversation thread is empty')
  })
})

// ─── FA-1.14 round 2 — draft lifecycle ───────────────────────────────────────

describe('draftReply — draft lifecycle (FA-1.14 round 2)', () => {
  beforeEach(() => {
    anthropicCreate.mockClear()
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Draft reply text from stub.' }],
    })
  })

  it('(b) second call with existing draft updates the row — no duplicate insert', async () => {
    // Simulate existing draft row already saved for this inquiry/counterpart/channel
    mockDb(
      [
        { direction: 'inbound', channel: 'email', body: 'Hello', status: 'sent', occurred_at: '2026-07-01T10:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'Follow-up', status: 'sent', occurred_at: '2026-07-01T11:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'More details', status: 'sent', occurred_at: '2026-07-01T12:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'Last message', status: 'sent', occurred_at: '2026-07-01T13:00:00Z' },
      ],
      { id: 'existing-draft-id' }, // ← existing draft already in DB
    )

    const result = await draftReply({
      inquiryId:    'inquiry-1',
      counterpart:  'angler',
      channel:      'email',
      knowledgeDir: FIXTURE_DIR,
    })

    // Must reuse the existing row, not insert a new one
    expect(result.draftId).toBe('existing-draft-id')
    expect(insertedMessages).toHaveLength(0)
    expect(updatedMessages).toHaveLength(1)
    expect(updatedMessages[0]).toMatchObject({ body: 'Draft reply text from stub.', status: 'draft' })
  })

  it('(c) draft messages are excluded from the conversation context sent to AI', async () => {
    // Mix of sent + draft messages — only sent ones must reach the AI
    mockDb([
      { direction: 'inbound',  channel: 'email', body: 'Real message 1', status: 'sent',  occurred_at: '2026-07-01T10:00:00Z' },
      { direction: 'inbound',  channel: 'email', body: 'Real message 2', status: 'sent',  occurred_at: '2026-07-01T11:00:00Z' },
      { direction: 'inbound',  channel: 'email', body: 'Real message 3', status: 'sent',  occurred_at: '2026-07-01T12:00:00Z' },
      { direction: 'outbound', channel: 'email', body: 'THIS IS A DRAFT — must not leak', status: 'draft', occurred_at: '2026-07-01T13:00:00Z' },
    ])

    await draftReply({
      inquiryId:    'inquiry-1',
      counterpart:  'angler',
      channel:      'email',
      knowledgeDir: FIXTURE_DIR,
    })

    expect(anthropicCreate).toHaveBeenCalledOnce()
    const prompt = (anthropicCreate.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content
    expect(prompt).not.toContain('THIS IS A DRAFT')
  })
})

// ─── buildDraftSubject ────────────────────────────────────────────────────────

import { buildDraftSubject } from './draft-reply-prompt'

describe('buildDraftSubject', () => {
  const inquiry = { angler_name: 'Jan Kowalski', trip_country: 'Iceland' }

  it('email → non-empty subject containing country and name', () => {
    const subject = buildDraftSubject(inquiry, 'email')
    expect(subject).not.toBeNull()
    expect(subject!.length).toBeGreaterThan(0)
    expect(subject).toContain('Iceland')
    expect(subject).toContain('Jan Kowalski')
  })

  it('whatsapp → null', () => {
    expect(buildDraftSubject(inquiry, 'whatsapp')).toBeNull()
  })

  it('instagram → null', () => {
    expect(buildDraftSubject(inquiry, 'instagram')).toBeNull()
  })

  it('email with null country → uses fallback', () => {
    const subject = buildDraftSubject({ angler_name: 'Jan', trip_country: null }, 'email')
    expect(subject).not.toBeNull()
    expect(subject!.length).toBeGreaterThan(0)
  })
})
