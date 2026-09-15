/**
 * FA-0.18 — Round 1 of the inquiry agent must not overwrite a country that the
 * inquiry already carries.
 *
 * The website form writes `trip_country` from `experience_pages.country` at insert
 * time; `runAgentRound1` fires a moment later from the same request. Before the
 * fix it pushed its own classification into the row unconditionally, so the AI's
 * guess (which can be `'Other'`) replaced the country the angler actually browsed.
 *
 * Pure unit test: Anthropic, e-mail and Supabase are mocked, so the assertion is
 * about the shape of the update payload the agent builds.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const aiResult = {
  enough: true,
  question: null,
  trip_country: 'Iceland',
  trip_type: 'multi_day',
  priority: 'high',
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

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { runAgentRound1 } from '@/lib/ai/inquiry-agent'

let capturedUpdate: Record<string, unknown> | null = null

function mockDb(existing: { trip_country: string | null; trip_type: string | null; priority: string | null }) {
  capturedUpdate = null
  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: table === 'inquiries' ? existing : null, error: null }) }),
      }),
      update: (payload: Record<string, unknown>) => {
        capturedUpdate = payload
        return { eq: async () => ({ error: null }) }
      },
      insert: async () => ({ error: null }),
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

describe('FA-0.18 — runAgentRound1 / trip_country', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('leaves a country that came from the experience page untouched', async () => {
    mockDb({ trip_country: 'Chile', trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(capturedUpdate).not.toBeNull()
    expect(capturedUpdate).not.toHaveProperty('trip_country')
  })

  it('fills the country when the inquiry has none (e-mail / WhatsApp path)', async () => {
    mockDb({ trip_country: null, trip_type: null, priority: null })

    await runAgentRound1(round1Params)

    expect(capturedUpdate).toMatchObject({ trip_country: 'Iceland' })
  })

  it('still overwrites priority — later rounds have more context', async () => {
    mockDb({ trip_country: 'Chile', trip_type: 'day_trip', priority: 'low' })

    await runAgentRound1(round1Params)

    expect(capturedUpdate).toMatchObject({ priority: 'high' })
    expect(capturedUpdate).not.toHaveProperty('trip_type')
  })
})
