/**
 * FA-1.04 — admin lock in Round 2 of the inquiry agent.
 *
 * Covers the "ready" path (line 591) and "waiting" path (line 632) —
 * removing the `qualified_set_by !== 'admin'` guard from either path
 * red-lines the matching test.
 *
 * Uses a separate file from round1.test.ts because the mock for runAgentRound2
 * needs to handle messages.select().eq().order() in addition to the
 * inquiries select, and keeping the two setups apart avoids cross-contamination.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const aiResult2 = {
  enough:      true,
  question:    null as string | null,
  trip_country: 'Iceland',
  trip_type:   'multi_day',
  priority:    'high',
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => ({ content: [{ type: 'text', text: JSON.stringify(aiResult2) }] }),
    }
  },
}))

vi.mock('@/lib/env', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key', NEXT_PUBLIC_APP_URL: 'https://test.example.com' },
}))

vi.mock('@/lib/email', () => ({ sendInquiryAgentEmail: vi.fn() }))

import { sendInquiryAgentEmail } from '@/lib/email'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { runAgentRound2 } from '@/lib/ai/inquiry-agent'

const baseInquiry = {
  angler_name:              'Test Angler',
  angler_email:             'angler@example.invalid',
  message:                  'Looking for a week of dry fly fishing.',
  requested_dates:          ['2027-01-10'],
  party_size:               2,
  agent_round:              1,
  trip_id:                  null,
  experience_page_id:       null,
  trip_country:             'Iceland',
  trip_type:                null as string | null,
  priority:                 null as string | null,
  qualified_set_by:         null as string | null,
  email_thread_message_id:  null as string | null,
}

let capturedUpdates: Record<string, unknown>[] = []
let inquiryEventsInserted = 0

function mockRound2Db(inquiry: typeof baseInquiry) {
  capturedUpdates = []
  inquiryEventsInserted = 0
  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: table === 'inquiries' ? inquiry : null,
            error: null,
          }),
          order: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        capturedUpdates.push(payload)
        return { eq: () => ({ error: null, data: null }) }
      },
      insert: () => {
        if (table === 'inquiry_events') inquiryEventsInserted++
        return {
          select: () => ({
            single: async () => ({ data: { id: 'evt-1' }, error: null }),
          }),
        }
      },
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

const DEFAULT_AI2 = { enough: true, question: null, trip_country: 'Iceland', trip_type: 'multi_day', priority: 'high' } as const

// ─── FA-1.14 — old agent must not call sendInquiryAgentEmail ─────────────────

describe('FA-1.14 — sendInquiryAgentEmail not called (Round 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult2, DEFAULT_AI2)
  })

  it('does not call sendInquiryAgentEmail on the ready path (Round 2)', async () => {
    mockRound2Db({ ...baseInquiry, qualified_set_by: null })

    await runAgentRound2('inq-2')

    expect(vi.mocked(sendInquiryAgentEmail)).not.toHaveBeenCalled()
  })

  it('does not call sendInquiryAgentEmail on the waiting path (Round 2)', async () => {
    Object.assign(aiResult2, { ...DEFAULT_AI2, enough: false, question: 'What dates?' })
    mockRound2Db({ ...baseInquiry, qualified_set_by: null })

    await runAgentRound2('inq-2')

    expect(vi.mocked(sendInquiryAgentEmail)).not.toHaveBeenCalled()
  })
})

// ─── Round 2 ready path (line 591) ───────────────────────────────────────────

describe('FA-1.04 — admin lock / Round 2 ready path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult2, { ...DEFAULT_AI2, enough: true, question: null })
  })

  it('does not call setQualified when qualified_set_by is admin (Round 2 ready)', async () => {
    mockRound2Db({ ...baseInquiry, qualified_set_by: 'admin' })

    await runAgentRound2('inq-2')

    expect(capturedUpdates.filter(u => 'qualified' in u)).toHaveLength(0)
    expect(inquiryEventsInserted).toBe(0)
  })

  it('calls setQualified when qualified_set_by is null (Round 2 ready)', async () => {
    mockRound2Db({ ...baseInquiry, qualified_set_by: null })

    await runAgentRound2('inq-2')

    const qUpdates = capturedUpdates.filter(u => 'qualified' in u)
    expect(qUpdates).toHaveLength(1)
    expect(qUpdates[0]).toMatchObject({ qualified: 'yes', qualified_set_by: 'agent' })
    expect(inquiryEventsInserted).toBe(1)
  })
})

// ─── Round 2 waiting path (line 632) ─────────────────────────────────────────

describe('FA-1.04 — admin lock / Round 2 waiting path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult2, { ...DEFAULT_AI2, enough: false, question: 'What type of fishing?' })
  })

  it('does not call setQualified when qualified_set_by is admin (Round 2 waiting)', async () => {
    mockRound2Db({ ...baseInquiry, qualified_set_by: 'admin' })

    await runAgentRound2('inq-2')

    expect(capturedUpdates.filter(u => 'qualified' in u)).toHaveLength(0)
    expect(inquiryEventsInserted).toBe(0)
  })

  it('calls setQualified when qualified_set_by is null (Round 2 waiting)', async () => {
    mockRound2Db({ ...baseInquiry, qualified_set_by: null })

    await runAgentRound2('inq-2')

    const qUpdates = capturedUpdates.filter(u => 'qualified' in u)
    expect(qUpdates).toHaveLength(1)
    expect(qUpdates[0]).toMatchObject({ qualified: 'yes', qualified_set_by: 'agent' })
    expect(inquiryEventsInserted).toBe(1)
  })
})
