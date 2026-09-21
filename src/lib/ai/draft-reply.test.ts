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

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => ({
        content: [{ type: 'text', text: 'Draft reply text from stub.' }],
      }),
    }
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
let insertedEvents: InsertedRow[] = []

function mockDb(messages: unknown[] = []) {
  insertedMessages = []
  insertedEvents   = []

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => ({
      select: (cols?: string) => {
        if (table === 'inquiries') {
          return {
            eq: () => ({
              single: async () => ({
                data: {
                  angler_name:        'Jan Kowalski',
                  message:            'I want to fish for salmon',
                  requested_dates:    ['2026-07-15'],
                  party_size:         2,
                  trip_country:       'Iceland',
                  assigned_guide_id:  null,
                  trip_id:            null,
                  experience_page_id: null,
                },
                error: null,
              }),
            }),
          }
        }
        if (table === 'messages') {
          return {
            eq: () => ({
              order: () => Promise.resolve({ data: messages, error: null }),
            }),
          }
        }
        // Unused but satisfies type
        void cols
        return { eq: () => ({ single: async () => ({ data: null, error: null }) }) }
      },
      insert: (row: Record<string, unknown>) => {
        if (table === 'messages')   insertedMessages.push(row)
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
