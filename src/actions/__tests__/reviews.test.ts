/**
 * Review actions — FA-1.59.
 *
 * generateReviewLink pins the new review to the inquiry's experience page and emits
 * review.requested. submitReview stores the publication consent it is given (never a default),
 * emits review.submitted with it, and rejects input that does not pass zod.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  tables:  {} as Record<string, Record<string, unknown>[]>,
  inserts: [] as { table: string; values: Record<string, unknown> }[],
  updates: [] as { table: string; values: Record<string, unknown>; id: unknown }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const filters: [string, unknown][] = []
      const find = () => (db.tables[table] ?? []).filter(r => filters.every(([c, v]) => r[c] === v))
      const api = {
        select:      () => api,
        eq:          (col: string, val: unknown) => { filters.push([col, val]); return api },
        maybeSingle: async () => ({ data: find()[0] ?? null, error: null }),
        single:      async () => ({ data: find()[0] ?? null, error: null }),
        insert:      async (values: Record<string, unknown>) => {
          db.inserts.push({ table, values })
          return { error: null }
        },
        update: (values: Record<string, unknown>) => ({
          eq: async (_col: string, id: unknown) => {
            db.updates.push({ table, values, id })
            return { error: null }
          },
        }),
      }
      return api
    },
  }),
}))

vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'admin-1' }),
  requireToken: vi.fn().mockResolvedValue({ id: 'rev-1' }),
}))

vi.mock('@/lib/app-url', () => ({
  getAppUrl: async () => 'https://fa.test',
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue('evt-1'),
}))

import { emitEvent } from '@/lib/events/emit'
import { generateReviewLink, submitReview, type ReviewSubmitInput } from '../reviews'

const mockEmitEvent = vi.mocked(emitEvent)

const validInput = (over: Partial<ReviewSubmitInput> = {}): ReviewSubmitInput => ({
  overallRating: 5,
  comment: 'Spotted every fish first.',
  publishConsent: false,
  ...over,
})

beforeEach(() => {
  db.tables = {
    inquiries: [
      { id: 'inq-with-page', experience_page_id: 'exp-1' },
      { id: 'inq-no-page', experience_page_id: null },
    ],
    reviews: [{ id: 'rev-1', inquiry_id: 'inq-with-page', token: 'tok-1', submitted_at: null }],
  }
  db.inserts = []
  db.updates = []
  mockEmitEvent.mockClear()
})

describe('generateReviewLink — FA-1.59', () => {
  it('pins the new review to the inquiry\'s experience page and emits review.requested', async () => {
    db.tables.reviews = []

    await generateReviewLink('inq-with-page')

    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0].values).toMatchObject({ inquiry_id: 'inq-with-page', experience_id: 'exp-1' })
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inquiryId: 'inq-with-page',
        type:      'review.requested',
        actor:     { kind: 'admin', id: 'admin-1' },
        payload:   { experience_id: 'exp-1' },
      }),
    )
  })

  it('an inquiry without an experience page → experience_id NULL, event still emitted', async () => {
    db.tables.reviews = []

    await generateReviewLink('inq-no-page')

    expect(db.inserts[0].values.experience_id).toBeNull()
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ inquiryId: 'inq-no-page', type: 'review.requested' }),
    )
  })

  it('an existing link is returned without a second insert or event', async () => {
    const { token } = await generateReviewLink('inq-with-page')

    expect(db.inserts).toHaveLength(0)
    expect(mockEmitEvent).not.toHaveBeenCalled()
    expect(token).toBe('tok-1')
  })
})

describe('submitReview — FA-1.59', () => {
  it('consent ticked → publish_consent true, publish_consent_at set, event carries it', async () => {
    const result = await submitReview('token', validInput({ publishConsent: true }))

    expect(result).toEqual({ ok: true })
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].values).toMatchObject({ publish_consent: true })
    expect(db.updates[0].values.publish_consent_at).toBeTypeOf('string')
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inquiryId: 'inq-with-page',
        type:      'review.submitted',
        payload:   { publish_consent: true },
      }),
    )
  })

  it('consent unticked → publish_consent false, publish_consent_at NULL, event carries false', async () => {
    const result = await submitReview('token', validInput({ publishConsent: false }))

    expect(result).toEqual({ ok: true })
    expect(db.updates[0].values).toMatchObject({ publish_consent: false, publish_consent_at: null })
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'review.submitted', payload: { publish_consent: false } }),
    )
  })

  it('a missing consent field is rejected by zod — nothing is written', async () => {
    const withoutConsent: Partial<ReviewSubmitInput> = validInput()
    delete withoutConsent.publishConsent
    const result = await submitReview('token', withoutConsent as ReviewSubmitInput)

    expect(result.ok).toBe(false)
    expect(db.updates).toHaveLength(0)
    expect(mockEmitEvent).not.toHaveBeenCalled()
  })

  it('a rating out of range is rejected by zod — nothing is written', async () => {
    const result = await submitReview('token', validInput({ overallRating: 9, publishConsent: true }))

    expect(result.ok).toBe(false)
    expect(db.updates).toHaveLength(0)
  })

  it('a photo that is not a URL is rejected by zod — nothing is written', async () => {
    const result = await submitReview('token', validInput({ mediaUrls: ['javascript:alert(1)'], publishConsent: true }))

    expect(result.ok).toBe(false)
    expect(db.updates).toHaveLength(0)
  })
})
