/**
 * FA-0.18 — Round 1 of the inquiry agent must not overwrite a country that the
 * inquiry already carries.
 *
 * The website form writes `trip_country` from `experience_pages.country` at insert
 * time; `runAgentRound1` fires a moment later from the same request. Before the
 * fix it pushed its own classification into the row unconditionally, so the AI's
 * guess (which can be `'Other'`) replaced the country the angler actually browsed.
 *
 * FA-1.04 — admin lock: agent must not call setQualified when qualified_set_by='admin'.
 * Tests cover both the Round 1 "ready" path (line 455) and the Round 1 "waiting"
 * path (line 490) — removing the guard from either path red-lines the matching test.
 *
 * Pure unit test: Anthropic, e-mail and Supabase are mocked.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const aiResult = {
  enough:      true,
  question:    null as string | null,
  trip_country: 'Iceland',
  trip_type:   'multi_day',
  priority:    'high',
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => ({ content: [{ type: 'text', text: JSON.stringify(aiResult) }] }),
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
import { runAgentRound1 } from '@/lib/ai/inquiry-agent'

type ExistingRow = {
  trip_country: string | null
  trip_type: string | null
  priority: string | null
  qualified_set_by?: string | null
}

let capturedUpdates: Record<string, unknown>[] = []
let inquiryEventsInserted = 0

/** First update is the classification update on inquiries; subsequent ones are from setQualified. */
function capturedUpdate() { return capturedUpdates[0] ?? null }

function mockDb(existing: ExistingRow) {
  capturedUpdates = []
  inquiryEventsInserted = 0
  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: table === 'inquiries' ? existing : null, error: null }) }),
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

const round1Params = {
  inquiryId:      'inq-1',
  anglerName:     'Test Angler',
  anglerEmail:    'angler@example.invalid',
  tripTitle:      'Aysén Spring Creeks',
  message:        'Looking for a week of dry fly fishing.',
  requestedDates: ['2027-01-10'],
  partySize:      2,
}

const DEFAULT_AI = { enough: true, question: null, trip_country: 'Iceland', trip_type: 'multi_day', priority: 'high' } as const

// ─── FA-0.18 — trip_country preservation ─────────────────────────────────────

describe('FA-0.18 — runAgentRound1 / trip_country', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, DEFAULT_AI)
  })

  it('leaves a country that came from the experience page untouched', async () => {
    mockDb({ trip_country: 'Chile', trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(capturedUpdate()).not.toBeNull()
    expect(capturedUpdate()).not.toHaveProperty('trip_country')
  })

  it('fills the country when the inquiry has none (e-mail / WhatsApp path)', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(capturedUpdate()).toMatchObject({ trip_country: 'Iceland' })
  })

  it('still overwrites priority — later rounds have more context', async () => {
    mockDb({ trip_country: 'Chile', trip_type: 'day_trip', priority: 'low' })

    await runAgentRound1(round1Params)

    expect(capturedUpdate()).toMatchObject({ priority: 'high' })
    expect(capturedUpdate()).not.toHaveProperty('trip_type')
  })
})

// ─── FA-1.04 — admin lock / Round 1 ready path (line 455) ────────────────────

describe('FA-1.04 — admin lock / Round 1 ready path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, { ...DEFAULT_AI, enough: true, question: null })
  })

  it('does not call setQualified when qualified_set_by is admin (Round 1 ready)', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: 'admin' })

    await runAgentRound1(round1Params)

    expect(capturedUpdates.filter(u => 'qualified' in u)).toHaveLength(0)
    expect(inquiryEventsInserted).toBe(0)
  })

  it('calls setQualified when qualified_set_by is null (Round 1 ready)', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: null })

    await runAgentRound1(round1Params)

    const qUpdates = capturedUpdates.filter(u => 'qualified' in u)
    expect(qUpdates).toHaveLength(1)
    expect(qUpdates[0]).toMatchObject({ qualified: 'yes', qualified_set_by: 'agent' })
    expect(inquiryEventsInserted).toBe(1)
  })
})

// ─── FA-1.14 — old agent must not call sendInquiryAgentEmail ─────────────────

describe('FA-1.14 — sendInquiryAgentEmail not called', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, DEFAULT_AI)
  })

  it('does not call sendInquiryAgentEmail on the ready path (Round 1)', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(vi.mocked(sendInquiryAgentEmail)).not.toHaveBeenCalled()
  })

  it('does not call sendInquiryAgentEmail on the waiting path (Round 1)', async () => {
    Object.assign(aiResult, { ...DEFAULT_AI, enough: false, question: 'What dates?' })
    mockDb({ trip_country: null, trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(vi.mocked(sendInquiryAgentEmail)).not.toHaveBeenCalled()
  })
})

// ─── FA-1.04 — admin lock / Round 1 waiting path (line 490) ──────────────────

describe('FA-1.04 — admin lock / Round 1 waiting path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, { ...DEFAULT_AI, enough: false, question: 'What dates work?' })
  })

  it('does not call setQualified when qualified_set_by is admin (Round 1 waiting)', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: 'admin' })

    await runAgentRound1(round1Params)

    expect(capturedUpdates.filter(u => 'qualified' in u)).toHaveLength(0)
    expect(inquiryEventsInserted).toBe(0)
  })

  it('calls setQualified when qualified_set_by is null (Round 1 waiting)', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: null })

    await runAgentRound1(round1Params)

    const qUpdates = capturedUpdates.filter(u => 'qualified' in u)
    expect(qUpdates).toHaveLength(1)
    expect(qUpdates[0]).toMatchObject({ qualified: 'yes', qualified_set_by: 'agent' })
    expect(inquiryEventsInserted).toBe(1)
  })
})
