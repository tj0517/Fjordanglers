/**
 * FA-1.23 — loadKnowledge DB-based loader tests.
 *
 * Uses a mocked createServiceClient (same pattern as draft-reply.test.ts).
 * The mock honours the .eq('active', true) call by filtering out rows where
 * active === false before resolving — so the inactive-exclusion test is
 * meaningful, not a tautology.
 *
 * Verifies that the loader:
 *   - always picks up the instructions and tone entries
 *   - picks the destination entry when country matches (case-insensitive)
 *   - picks the guide entry when guideId matches
 *   - skips destination entries for other countries
 *   - skips guide entries for other guide ids
 *   - does NOT return entries with active=false (proven by a red/green proof)
 *   - returns null instructions when none are active
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { loadKnowledge } from './knowledge'

// ─── Test data ────────────────────────────────────────────────────────────────

type TestRow = {
  id: string
  kind: string
  country: string | null
  guide_id: string | null
  title: string
  body: string
  active: boolean
}

const ALL_ROWS: TestRow[] = [
  { id: 'k-inst',         kind: 'instructions', country: null,          guide_id: null,  title: 'Instructions',       body: 'You are the FA assistant.', active: true  },
  { id: 'k-inst-old',     kind: 'instructions', country: null,          guide_id: null,  title: 'Old instructions',   body: 'Outdated.',                 active: false },
  { id: 'k-tone',         kind: 'tone',         country: null,          guide_id: null,  title: 'Tone of voice',      body: 'Warm, direct, no jargon.',  active: true  },
  { id: 'k-tone-inactive',kind: 'tone',         country: null,          guide_id: null,  title: 'Old tone',           body: 'Very formal.',              active: false },
  { id: 'k-iceland',      kind: 'destination',  country: 'Iceland',     guide_id: null,  title: 'Iceland — basics',   body: 'Iceland season: June–Sep.', active: true  },
  { id: 'k-iceland-old',  kind: 'destination',  country: 'Iceland',     guide_id: null,  title: 'Iceland (old)',      body: 'Outdated Iceland.',         active: false },
  { id: 'k-nz',           kind: 'destination',  country: 'New Zealand', guide_id: null,  title: 'NZ — basics',        body: 'NZ brown trout.',           active: true  },
  { id: 'k-guide-x',      kind: 'guide',        country: null,          guide_id: 'g-x', title: 'Guide X — rates',   body: '400 EUR per day.',          active: true  },
  { id: 'k-guide-y',      kind: 'guide',        country: null,          guide_id: 'g-y', title: 'Guide Y — rates',   body: '500 EUR per day.',          active: true  },
]

/**
 * Sets up the mock. When .eq('active', true) is called the mock filters out
 * rows with active=false, mirroring what the real DB query does.
 */
function mockClient(rows: TestRow[]) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: (k: string, v: unknown) => {
          if (k === 'active' && v === true) {
            return Promise.resolve({ data: rows.filter(r => r.active), error: null })
          }
          return Promise.resolve({ data: rows, error: null })
        },
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadKnowledge', () => {
  beforeEach(() => mockClient(ALL_ROWS))

  it('country:Iceland + guideId:g-x → returns instructions + tone + iceland + guide-x', async () => {
    const result = await loadKnowledge({ country: 'Iceland', guideId: 'g-x' })

    expect(result.instructions?.id).toBe('k-inst')
    expect(result.entries.map(e => e.id)).toEqual(['k-tone', 'k-iceland', 'k-guide-x'])
    expect(result.usedIds).toEqual(['k-inst', 'k-tone', 'k-iceland', 'k-guide-x'])
  })

  it('skips destination entry for other country (NZ skipped for Iceland inquiry)', async () => {
    const result = await loadKnowledge({ country: 'Iceland', guideId: 'g-x' })
    expect(result.entries.every(e => e.id !== 'k-nz')).toBe(true)
  })

  it('skips guide entry for other guide id (guide-y skipped when guideId=g-x)', async () => {
    const result = await loadKnowledge({ country: 'Iceland', guideId: 'g-x' })
    expect(result.entries.every(e => e.id !== 'k-guide-y')).toBe(true)
  })

  it('destination match is case-insensitive', async () => {
    const result = await loadKnowledge({ country: 'iceland', guideId: 'g-x' })
    expect(result.entries.some(e => e.id === 'k-iceland')).toBe(true)
  })

  it('no guideId → skips all guide entries', async () => {
    const result = await loadKnowledge({ country: 'Iceland' })
    expect(result.entries.filter(e => e.kind === 'guide')).toHaveLength(0)
  })

  it('no country → skips all destination entries', async () => {
    const result = await loadKnowledge({ guideId: 'g-x' })
    expect(result.entries.filter(e => e.kind === 'destination')).toHaveLength(0)
  })

  it('no params → returns only instructions + tone', async () => {
    const result = await loadKnowledge()
    expect(result.instructions?.id).toBe('k-inst')
    expect(result.entries.map(e => e.id)).toEqual(['k-tone'])
    expect(result.usedIds).toEqual(['k-inst', 'k-tone'])
  })

  it('entries with active=false are excluded — inactive instructions, tone and destination are not returned', async () => {
    const result = await loadKnowledge({ country: 'Iceland', guideId: 'g-x' })
    // k-inst-old, k-tone-inactive, k-iceland-old are all active=false and must be absent
    const ids = [...(result.instructions ? [result.instructions.id] : []), ...result.entries.map(e => e.id)]
    expect(ids).not.toContain('k-inst-old')
    expect(ids).not.toContain('k-tone-inactive')
    expect(ids).not.toContain('k-iceland-old')
  })

  it('returns null instructions when DB has no active instructions rows', async () => {
    mockClient(ALL_ROWS.filter(r => r.kind !== 'instructions' || !r.active))
    const result = await loadKnowledge({ country: 'Iceland' })
    expect(result.instructions).toBeNull()
    expect(result.usedIds).not.toContain('k-inst')
  })
})
