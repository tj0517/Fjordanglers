/**
 * FA-1.14 / FA-1.23 — draftReply unit tests.
 *
 * Verifies that draftReply:
 *   - saves a messages row with status='draft' and drafted_by='agent'
 *   - does NOT emit any inquiry_events row
 *   - throws a readable error when the conversation thread is empty
 *   - throws DraftReplyError when there is no active instructions entry
 *
 * Anthropic, Supabase and @/lib/env are mocked.
 * Knowledge is provided via the agent_knowledge mock rows in mockDb().
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

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
import { composeBriefMessage } from '@/lib/inquiries/brief'

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
  status:             'qualifying',
  source:             'web_form',
}

let currentInquiryData: Record<string, unknown> = INQUIRY_DATA

const DEFAULT_KNOWLEDGE_ROWS = [
  { id: 'k-inst',    kind: 'instructions', country: null,      guide_id: null, title: 'Instructions (stub)', body: 'You are the FA assistant.' },
  { id: 'k-tone',    kind: 'tone',         country: null,      guide_id: null, title: 'Tone',               body: 'Warm, direct.' },
  { id: 'k-iceland', kind: 'destination',  country: 'Iceland', guide_id: null, title: 'Iceland',            body: 'Season: June–September.' },
]

interface MockBuilder {
  eq(k: string, v: unknown): MockBuilder
  neq(k: string, v: unknown): MockBuilder
  order(): Promise<{ data: unknown[]; error: null }>
  single(): Promise<{ data: unknown; error: null }>
  maybeSingle(): Promise<{ data: unknown; error: null }>
}

function mockDb(
  messages: unknown[] = [],
  existingDraft: { id: string } | null = null,
  knowledgeRows: unknown[] = DEFAULT_KNOWLEDGE_ROWS,
  inquiryData: Record<string, unknown> = INQUIRY_DATA,
) {
  insertedMessages  = []
  insertedEvents    = []
  updatedMessages   = []
  currentInquiryData = inquiryData

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      // agent_knowledge: flat select().eq() terminates as a Promise
      if (table === 'agent_knowledge') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: knowledgeRows, error: null }),
          }),
        }
      }

      // All other tables use the fluent builder
      return {
        select: () => {
          const eqs:  [string, unknown][] = []
          const neqs: [string, unknown][] = []

          const builder: MockBuilder = {
            eq(k: string, v: unknown): MockBuilder  { eqs.push([k, v]);  return builder },
            neq(k: string, v: unknown): MockBuilder { neqs.push([k, v]); return builder },
            order(): Promise<{ data: unknown[]; error: null }> {
              const filtered = (messages as Array<Record<string, unknown>>).filter(row =>
                !neqs.some(([k, v]) => row[k] === v),
              )
              return Promise.resolve({ data: filtered, error: null })
            },
            async single() {
              if (table === 'inquiries') return { data: currentInquiryData, error: null }
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
      }
    },
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
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
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
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
    })

    expect(insertedEvents).toHaveLength(0)
  })

  it('returns the ids of used knowledge entries', async () => {
    const result = await draftReply({
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
    })

    // Iceland inquiry → instructions + tone + iceland destination
    expect(result.usedIds).toContain('k-inst')
    expect(result.usedIds).toContain('k-tone')
    expect(result.usedIds).toContain('k-iceland')
  })

  it('returns the used knowledge entries with the same ids as usedIds (FA-1.47) — RED on main: no usedEntries', async () => {
    const result = await draftReply({
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
    })

    expect(result.usedEntries.map(e => e.id)).toEqual(result.usedIds)
    expect(result.usedEntries[0]).toMatchObject({ id: 'k-inst', kind: 'instructions', body: 'You are the FA assistant.' })
    expect(result.usedEntries.map(e => e.id)).toContain('k-iceland')
  })

  it('throws a readable DraftReplyError when thread is empty (default: allowFormOnly not set)', async () => {
    mockDb([]) // no messages; INQUIRY_DATA has a form message, but allowFormOnly defaults to false —
               // this is the path autoSendReply (FA-1.27) relies on staying unchanged.

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email' }),
    ).rejects.toThrow(DraftReplyError)

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email' }),
    ).rejects.toThrow('conversation thread is empty')
  })

  it('throws DraftReplyError when no active instructions entry exists', async () => {
    mockDb(
      [
        { direction: 'inbound', channel: 'email', body: 'Hello', occurred_at: '2026-07-01T10:00:00Z' },
      ],
      null,
      // knowledge rows without any instructions entry
      [
        { id: 'k-tone', kind: 'tone', country: null, guide_id: null, title: 'Tone', body: 'Warm.' },
      ],
    )

    await expect(
      draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email' }),
    ).rejects.toThrow(DraftReplyError)

    await expect(
      draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email' }),
    ).rejects.toThrow('No active instructions entry')
  })
})

// ─── FA-1.34 — empty thread + form message (allowFormOnly) ──────────────────

describe('draftReply — allowFormOnly (FA-1.34)', () => {
  beforeEach(() => {
    anthropicCreate.mockClear()
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Draft reply text from stub.' }],
    })
  })

  it('drafts from the form message when the thread is empty and allowFormOnly is true', async () => {
    mockDb([]) // no messages; INQUIRY_DATA has a form message

    const result = await draftReply({
      inquiryId:     'inquiry-empty',
      counterpart:   'angler',
      channel:       'email',
      allowFormOnly: true,
    })

    expect(result.draftId).toBe('draft-msg-id-1')
    expect(insertedMessages).toHaveLength(1)
    expect(insertedMessages[0].status).toBe('draft')
    expect(insertedMessages[0].drafted_by).toBe('agent')

    expect(anthropicCreate).toHaveBeenCalledOnce()
    const prompt = (anthropicCreate.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content
    expect(prompt).toContain(INQUIRY_DATA.message)
    expect(prompt).toContain('submitted via the website inquiry form')
  })

  it('drafts a guide message from the form data too, with an empty thread and allowFormOnly', async () => {
    mockDb([]) // no messages

    const result = await draftReply({
      inquiryId:     'inquiry-empty',
      counterpart:   'guide',
      channel:       'email',
      allowFormOnly: true,
    })

    expect(result.draftId).toBe('draft-msg-id-1')
    expect(insertedMessages[0].counterpart).toBe('guide')
  })

  it('throws a readable DraftReplyError when there is neither a thread nor a form message', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, message: null })

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email', allowFormOnly: true }),
    ).rejects.toThrow(DraftReplyError)

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email', allowFormOnly: true }),
    ).rejects.toThrow('no message thread and no form message')

    expect(anthropicCreate).not.toHaveBeenCalled()
  })

  // FA-1.46: a form without client text is answerable when it points at a trip.
  it.each([
    ['trip_id',            { trip_id: 'trip-1' }],
    ['experience_page_id', { experience_page_id: 'exp-1' }],
  ])('drafts from the form data when message is empty but %s is set', async (_label, tripRef) => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, message: null, ...tripRef })

    const result = await draftReply({
      inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email', allowFormOnly: true,
    })

    expect(result.draftId).toBe('draft-msg-id-1')
    expect(anthropicCreate).toHaveBeenCalledOnce()
    const prompt = (anthropicCreate.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content
    expect(prompt).toContain('Party size: 2')
    expect(prompt).toContain('Requested dates: 2026-07-15')
  })

  it('still refuses without allowFormOnly, even when the inquiry has a trip', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, message: null, trip_id: 'trip-1' })

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email' }),
    ).rejects.toThrow('the conversation thread is empty')
    expect(anthropicCreate).not.toHaveBeenCalled()
  })

  it('the no-trip error says why: no form message and no trip to write from', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, message: '  ' })

    await expect(
      draftReply({ inquiryId: 'inquiry-empty', counterpart: 'angler', channel: 'email', allowFormOnly: true }),
    ).rejects.toThrow('no trip or experience page to write from')
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
    mockDb(
      [
        { direction: 'inbound', channel: 'email', body: 'Hello', status: 'sent', occurred_at: '2026-07-01T10:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'Follow-up', status: 'sent', occurred_at: '2026-07-01T11:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'More details', status: 'sent', occurred_at: '2026-07-01T12:00:00Z' },
        { direction: 'inbound', channel: 'email', body: 'Last message', status: 'sent', occurred_at: '2026-07-01T13:00:00Z' },
      ],
      { id: 'existing-draft-id' },
    )

    const result = await draftReply({
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
    })

    expect(result.draftId).toBe('existing-draft-id')
    expect(insertedMessages).toHaveLength(0)
    expect(updatedMessages).toHaveLength(1)
    expect(updatedMessages[0]).toMatchObject({ body: 'Draft reply text from stub.', status: 'draft' })
  })

  it('(c) draft messages are excluded from the conversation context sent to AI', async () => {
    mockDb([
      { direction: 'inbound',  channel: 'email', body: 'Real message 1', status: 'sent',  occurred_at: '2026-07-01T10:00:00Z' },
      { direction: 'inbound',  channel: 'email', body: 'Real message 2', status: 'sent',  occurred_at: '2026-07-01T11:00:00Z' },
      { direction: 'inbound',  channel: 'email', body: 'Real message 3', status: 'sent',  occurred_at: '2026-07-01T12:00:00Z' },
      { direction: 'outbound', channel: 'email', body: 'THIS IS A DRAFT — must not leak', status: 'draft', occurred_at: '2026-07-01T13:00:00Z' },
    ])

    await draftReply({
      inquiryId:   'inquiry-1',
      counterpart: 'angler',
      channel:     'email',
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

/**
 * FA-1.55 — the brief in the agent's input block.
 *
 * The three-step form's answers are the qualification: which water the angler can fish, what
 * they are after and how far they will walk. A draft written without them is a draft written
 * without the form. RED on main: `inquiries.brief` was neither selected nor printed, so the
 * prompt contained no "Skill level" and no "Priority" line.
 *
 * The brief is printed inside the ORIGINAL INQUIRY block — it is data the angler supplied,
 * never an instruction to the model.
 */
describe('draftReply — the brief reaches the prompt (FA-1.55)', () => {
  const BRIEF = {
    dates_mode:  'flexible',
    flex_month:  '2027-06',
    days:        3,
    anglers:     2,
    non_anglers: 1,
    skill_level: 4,
    priority:    'trophy',
    fitness:     'high',
    wading_ok:   true,
    budget_ack:  true,
  }

  /** The prompt the model was actually given. */
  function lastPrompt(): string {
    const call = anthropicCreate.mock.calls.at(-1)?.[0] as { messages: { content: string }[] }
    return call.messages[0].content
  }

  it('prints the skill level and the priority from the brief', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, brief: BRIEF })
    await draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email', allowFormOnly: true })

    const prompt = lastPrompt()
    expect(prompt).toContain('Skill level: 4/5')
    expect(prompt).toContain('Experienced')
    expect(prompt).toContain('Priority: One big fish')
    expect(prompt).toContain('Fitness: Walk me in')
    expect(prompt).toContain('Wading: yes')
    expect(prompt).toContain('June 2027')
  })

  it('keeps the brief inside the inquiry block, where the model reads it as data', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, brief: BRIEF })
    await draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email', allowFormOnly: true })

    const prompt = lastPrompt()
    const inquiryBlock = prompt.indexOf('=== ORIGINAL INQUIRY ===')
    expect(inquiryBlock).toBeGreaterThanOrEqual(0)
    expect(prompt.indexOf('Skill level: 4/5')).toBeGreaterThan(inquiryBlock)
  })

  it('does not print the answers twice when the stored message already carries the summary', async () => {
    const message = composeBriefMessage('We fish together every June.', {
      dates_mode: 'flexible', flex_month: '2027-06', days: 3, anglers: 2, non_anglers: 1,
      skill_level: 4, priority: 'trophy', fitness: 'high', wading_ok: true, budget_ack: true,
    })
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, message, brief: BRIEF })
    await draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email', allowFormOnly: true })

    const prompt = lastPrompt()
    expect(prompt).toContain('We fish together every June.')
    expect(prompt.split('Skill level: 4/5').length - 1).toBe(1)
  })

  it('a v1 inquiry (brief null) gets the prompt it got on main — no brief block', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, brief: null })
    await draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email', allowFormOnly: true })

    const prompt = lastPrompt()
    expect(prompt).not.toContain('Skill level')
    expect(prompt).not.toContain('Answers from the inquiry form')
    expect(prompt).toContain('I want to fish for salmon')
  })

  it('a malformed brief is skipped, not shown to the model as fact', async () => {
    mockDb([], null, DEFAULT_KNOWLEDGE_ROWS, { ...INQUIRY_DATA, brief: { skill_level: 99, note: 'junk' } })
    await draftReply({ inquiryId: 'inquiry-1', counterpart: 'angler', channel: 'email', allowFormOnly: true })

    const prompt = lastPrompt()
    expect(prompt).not.toContain('Skill level')
    expect(prompt).not.toContain('junk')
  })
})
