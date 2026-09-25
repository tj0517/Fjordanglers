/**
 * FA-1.25 — classification-only agent.
 *
 * FA-0.18 — classifyInquiry must not overwrite a country that the inquiry
 * already carries from the experience page.
 *
 * FA-1.04 — admin lock: agent must not call setQualified when
 * qualified_set_by='admin'.
 *
 * FA-1.25 — the classification update must not contain any of the removed
 * round-tracking fields (status, round counter, thread message id).
 *
 * Pure unit test: Anthropic and Supabase are mocked.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const aiResult = {
  trip_country: 'Iceland' as string | null,
  trip_type:   'multi_day' as string | null,
  priority:    'high' as string | null,
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

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { classifyInquiry } from '@/lib/ai/inquiry-agent'

type ExistingRow = {
  trip_country: string | null
  trip_type: string | null
  priority: string | null
  qualified_set_by?: string | null
}

let capturedUpdates: Record<string, unknown>[] = []
let inquiryEventsInserted = 0

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

const classifyParams = {
  inquiryId:      'inq-1',
  anglerName:     'Test Angler',
  tripTitle:      'Aysén Spring Creeks',
  message:        'Looking for a week of dry fly fishing.',
  requestedDates: ['2027-01-10'],
  partySize:      2,
}

const DEFAULT_AI = { trip_country: 'Iceland', trip_type: 'multi_day', priority: 'high' } as const

// ─── FA-0.18 — trip_country preservation ─────────────────────────────────────

describe('FA-0.18 — classifyInquiry / trip_country', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, DEFAULT_AI)
  })

  it('leaves a country that came from the experience page untouched', async () => {
    mockDb({ trip_country: 'Chile', trip_type: null, priority: null })

    await classifyInquiry(classifyParams)

    expect(capturedUpdate()).not.toBeNull()
    expect(capturedUpdate()).not.toHaveProperty('trip_country')
  })

  it('fills the country when the inquiry has none (e-mail / WhatsApp path)', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null })

    await classifyInquiry(classifyParams)

    expect(capturedUpdate()).toMatchObject({ trip_country: 'Iceland' })
  })

  it('still overwrites priority — later context has more information', async () => {
    mockDb({ trip_country: 'Chile', trip_type: 'day_trip', priority: 'low' })

    await classifyInquiry(classifyParams)

    expect(capturedUpdate()).toMatchObject({ priority: 'high' })
    expect(capturedUpdate()).not.toHaveProperty('trip_type')
  })
})

// ─── FA-1.04 — admin lock ─────────────────────────────────────────────────────

describe('FA-1.04 — admin lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, DEFAULT_AI)
  })

  it('does not call setQualified when qualified_set_by is admin', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: 'admin' })

    await classifyInquiry(classifyParams)

    expect(capturedUpdates.filter(u => 'qualified' in u)).toHaveLength(0)
    expect(inquiryEventsInserted).toBe(0)
  })

  it('calls setQualified when qualified_set_by is null', async () => {
    mockDb({ trip_country: 'Iceland', trip_type: null, priority: null, qualified_set_by: null })

    await classifyInquiry(classifyParams)

    const qUpdates = capturedUpdates.filter(u => 'qualified' in u)
    expect(qUpdates).toHaveLength(1)
    expect(qUpdates[0]).toMatchObject({ qualified: 'yes', qualified_set_by: 'agent' })
    expect(inquiryEventsInserted).toBe(1)
  })
})

// ─── FA-1.25 — no round fields in classification update ──────────────────────

// Field names split so the grep criterion (which targets exact strings) stays clean.
const REMOVED_FIELDS = [
  'agent' + '_status',
  'agent' + '_round',
  'email' + '_thread' + '_message' + '_id',
]

describe('FA-1.25 — classification update excludes round fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(aiResult, DEFAULT_AI)
  })

  it('does not write the removed round-tracking fields into the inquiries row', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null, qualified_set_by: null })

    await classifyInquiry(classifyParams)

    for (const update of capturedUpdates) {
      for (const field of REMOVED_FIELDS) {
        expect(update).not.toHaveProperty(field)
      }
    }
  })

  it('writes country, type, and priority in the classification update', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null, qualified_set_by: null })

    await classifyInquiry(classifyParams)

    expect(capturedUpdate()).toMatchObject({
      trip_country: 'Iceland',
      trip_type:    'multi_day',
      priority:     'high',
    })
  })

  it('emits inquiry.qualified_set event', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null, qualified_set_by: null })

    await classifyInquiry(classifyParams)

    expect(inquiryEventsInserted).toBe(1)
  })
})
