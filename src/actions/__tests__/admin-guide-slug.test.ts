/**
 * FA-1.86 — "active ⇒ slug" in the admin actions. The database enforces the same rule
 * (`guides_active_requires_slug`); these tests pin the readable refusal that comes first, and
 * that a refused activation never reaches the update.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/stripe/client', () => ({ stripe: {} }))
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'admin-1' }),
  UnauthorizedError: class extends Error {},
}))

type GuideRow = { id: string; slug: string | null; status: string; verified_at: string | null }
let rows: GuideRow[] = []
const updates: Record<string, unknown>[] = []
const inserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => {
  const from = (table: string) => {
    let filter: { col: string; val: unknown } | null = null
    let op: 'select' | 'update' | 'insert' = 'select'
    let payload: Record<string, unknown> = {}
    const match = () => rows.filter(r => filter == null || (r as Record<string, unknown>)[filter.col] === filter.val)
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => { filter = { col, val }; return chain },
      update: (p: Record<string, unknown>) => { op = 'update'; payload = p; return chain },
      insert: (p: Record<string, unknown>) => { op = 'insert'; payload = p; return chain },
      single: async () => op === 'insert'
        ? (inserts.push(payload), { data: { id: 'new-guide' }, error: null })
        : { data: match()[0] ?? null, error: null },
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      then: (resolve: (v: { error: null }) => unknown) => {
        if (op === 'update') updates.push(payload)
        return resolve({ error: null })
      },
    }
    if (table !== 'guides') return { ...chain, insert: () => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }) }
    return chain
  }
  return { createServiceClient: () => ({ from }) }
})

import { adminSetGuideStatus, updateGuide, createBetaGuide, type UpdateGuidePayload } from '@/actions/admin'

const base: UpdateGuidePayload = {
  full_name: 'Test Guide', country: 'Iceland', languages: ['English'], fish_expertise: ['Salmon'],
  pricing_model: 'commission', status: 'active',
}

beforeEach(() => {
  rows = []
  updates.length = 0
  inserts.length = 0
})

describe('adminSetGuideStatus', () => {
  it('RED: refuses to activate a guide without a slug, and writes nothing', async () => {
    rows = [{ id: 'g1', slug: null, status: 'pending', verified_at: null }]
    const res = await adminSetGuideStatus('g1', 'active')
    expect(res).toEqual({ error: expect.stringMatching(/without a slug/) })
    expect(updates).toEqual([])
  })

  it('refuses a blank slug too', async () => {
    rows = [{ id: 'g1', slug: '  ', status: 'pending', verified_at: null }]
    expect(await adminSetGuideStatus('g1', 'active')).toHaveProperty('error')
    expect(updates).toEqual([])
  })

  it('activates a guide that has a slug', async () => {
    rows = [{ id: 'g1', slug: 'a-guide', status: 'pending', verified_at: null }]
    expect(await adminSetGuideStatus('g1', 'active')).toEqual({ success: true })
    expect(updates).toHaveLength(1)
  })

  it('suspending or resetting to pending never needs a slug', async () => {
    rows = [{ id: 'g1', slug: null, status: 'active', verified_at: null }]
    expect(await adminSetGuideStatus('g1', 'suspended')).toEqual({ success: true })
    expect(await adminSetGuideStatus('g1', 'pending')).toEqual({ success: true })
  })
})

describe('updateGuide', () => {
  it('RED: refuses status=active without a slug (none stored, none sent)', async () => {
    rows = [{ id: 'g1', slug: null, status: 'pending', verified_at: null }]
    const res = await updateGuide('g1', base)
    expect(res).toEqual({ error: expect.stringMatching(/without a slug/) })
    expect(updates).toEqual([])
  })

  it('activates when the slug is sent in the same save', async () => {
    rows = [{ id: 'g1', slug: null, status: 'pending', verified_at: null }]
    expect(await updateGuide('g1', { ...base, slug: 'test-guide-iceland' })).toEqual({ success: true })
    expect(updates[0]).toMatchObject({ slug: 'test-guide-iceland', status: 'active' })
  })

  it('refuses a malformed slug', async () => {
    rows = [{ id: 'g1', slug: null, status: 'pending', verified_at: null }]
    expect(await updateGuide('g1', { ...base, slug: 'Test Guide' })).toHaveProperty('error')
    expect(updates).toEqual([])
  })

  it('refuses a slug already used by another guide', async () => {
    rows = [
      { id: 'g1', slug: null, status: 'pending', verified_at: null },
      { id: 'g2', slug: 'taken', status: 'active', verified_at: null },
    ]
    expect(await updateGuide('g1', { ...base, slug: 'taken' })).toEqual({ error: expect.stringMatching(/already used/) })
    expect(updates).toEqual([])
  })

  it('lock: an active guide cannot change its slug; the same slug is accepted', async () => {
    rows = [{ id: 'g1', slug: 'old-slug', status: 'active', verified_at: 'x' }]
    expect(await updateGuide('g1', { ...base, slug: 'new-slug' })).toEqual({ error: expect.stringMatching(/cannot be changed/) })
    expect(updates).toEqual([])
    expect(await updateGuide('g1', { ...base, slug: 'old-slug' })).toEqual({ success: true })
  })

  it('a suspended guide can be renamed', async () => {
    rows = [{ id: 'g1', slug: 'old-slug', status: 'suspended', verified_at: 'x' }]
    expect(await updateGuide('g1', { ...base, status: 'suspended', slug: 'new-slug' })).toEqual({ success: true })
    expect(updates[0]).toMatchObject({ slug: 'new-slug' })
  })
})

describe('createBetaGuide (inserts as active)', () => {
  const payload = { ...base, status: undefined, slug: 'new-guide-iceland' } as unknown as Parameters<typeof createBetaGuide>[0]

  it('RED: refuses a missing or blank slug — it must not reach the database rule', async () => {
    expect(await createBetaGuide({ ...payload, slug: '' })).toEqual({ error: expect.stringMatching(/slug is required/i) })
    expect(await createBetaGuide({ ...payload, slug: undefined } as unknown as Parameters<typeof createBetaGuide>[0])).toHaveProperty('error')
    expect(inserts).toEqual([])
  })

  it('refuses a taken slug', async () => {
    rows = [{ id: 'g2', slug: 'new-guide-iceland', status: 'active', verified_at: null }]
    expect(await createBetaGuide(payload)).toEqual({ error: expect.stringMatching(/already used/) })
    expect(inserts).toEqual([])
  })

  it('inserts active with the slug', async () => {
    expect(await createBetaGuide(payload)).toEqual({ success: true, guideId: 'new-guide' })
    expect(inserts[0]).toMatchObject({ slug: 'new-guide-iceland', status: 'active' })
  })
})
