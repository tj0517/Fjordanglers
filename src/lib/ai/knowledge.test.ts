/**
 * FA-1.23 — loadKnowledge DB-based loader tests.
 *
 * Uses a mocked createServiceClient (same pattern as draft-reply.test.ts).
 * The mock returns a fixed set of active entries; the DB-side eq('active', true)
 * filter is simulated by only including active rows in the mock data.
 *
 * Verifies that the loader:
 *   - always picks up the instructions and tone entries
 *   - picks the destination entry when country matches (case-insensitive)
 *   - picks the guide entry when guideId matches
 *   - skips destination entries for other countries
 *   - skips guide entries for other guide ids
 *   - returns null instructions when none are active
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/server'
import { loadKnowledge } from './knowledge'

// ─── Test data ────────────────────────────────────────────────────────────────

const ROWS_ALL_ACTIVE = [
  { id: 'k-inst',     kind: 'instructions', country: null,        guide_id: null,  title: 'Instructions (stub)', body: 'You are the FA assistant.' },
  { id: 'k-tone',     kind: 'tone',         country: null,        guide_id: null,  title: 'Tone of voice',       body: 'Warm, direct, no jargon.' },
  { id: 'k-iceland',  kind: 'destination',  country: 'Iceland',   guide_id: null,  title: 'Iceland — basics',    body: 'Iceland season: June–September.' },
  { id: 'k-nz',       kind: 'destination',  country: 'New Zealand', guide_id: null, title: 'NZ — basics',        body: 'NZ brown trout.' },
  { id: 'k-guide-x',  kind: 'guide',        country: null,        guide_id: 'g-x', title: 'Guide X — rates',    body: '400 EUR per day.' },
  { id: 'k-guide-y',  kind: 'guide',        country: null,        guide_id: 'g-y', title: 'Guide Y — rates',    body: '500 EUR per day.' },
]

function mockClient(rows: typeof ROWS_ALL_ACTIVE) {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadKnowledge', () => {
  beforeEach(() => mockClient(ROWS_ALL_ACTIVE))

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

  it('returns null instructions when DB has no instructions rows', async () => {
    mockClient(ROWS_ALL_ACTIVE.filter(r => r.kind !== 'instructions'))
    const result = await loadKnowledge({ country: 'Iceland' })
    expect(result.instructions).toBeNull()
    expect(result.usedIds).not.toContain('k-inst')
  })
})
