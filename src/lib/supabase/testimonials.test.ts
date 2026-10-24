/**
 * Integration test for testimonials (FA-1.68) against the local Supabase stack.
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * One file for the reader (`getTestimonial`) and the admin actions, because both need the
 * whole table: "null on an empty table" empties it and `moveTestimonial` renumbers every row.
 * Vitest runs files in parallel, so two files on this table would race. The seed rows are
 * read first and put back afterwards; if a run dies half-way, `supabase db reset` restores them.
 *
 * What it pins down:
 *   getTestimonial — country match first (any of several, for a hub), general fallback, null
 *                    when nothing fits, never an inactive row, and no consent field in what
 *                    it returns (value and type)
 *   actions        — the database rules reach the caller as plain messages (no throw), the
 *                    photo URL must be our bucket's testimonials/ folder (tj D2 a), consent
 *                    time is kept on re-save, and move up/down reorders
 */
import { vi, describe, it, expect, expectTypeOf, beforeAll, afterAll } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn(async () => ({ userId: 'admin-test' })),
}))
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL },
}))

import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { getTestimonial, listTestimonialsForAdmin, type Testimonial } from './testimonials'
import {
  createTestimonial,
  updateTestimonial,
  setTestimonialActive,
  moveTestimonial,
  type TestimonialPayload,
} from '@/actions/testimonials'

type Row = Database['public']['Tables']['testimonials']['Row']

const id = (n: number) => `f1680000-0000-4000-8000-${String(n).padStart(12, '0')}`
const svc = createServiceClient()

let seedRows: Row[] = []

async function emptyTable() {
  const { error } = await svc.from('testimonials').delete().not('id', 'is', null)
  if (error != null) throw new Error(error.message)
}

beforeAll(async () => {
  const { data, error } = await svc.from('testimonials').select('*')
  if (error != null) throw new Error(error.message)
  seedRows = data ?? []
  await emptyTable()
})

afterAll(async () => {
  await emptyTable()
  if (seedRows.length > 0) await svc.from('testimonials').insert(seedRows)
})

const consented = new Date('2026-10-01T10:00:00Z').toISOString()

function row(n: number, extra: Partial<Row>): Database['public']['Tables']['testimonials']['Insert'] {
  return {
    id:          id(n),
    quote:       `quote ${n}`,
    author_name: `Author ${n}`,
    source:      'direct',
    consent_note: `internal note ${n}`,
    ...extra,
  }
}

// ─── getTestimonial ──────────────────────────────────────────────────────────

describe('getTestimonial', () => {
  it('returns null on an empty table, for a country and for none', async () => {
    expect(await getTestimonial(['New Zealand'])).toBeNull()
    expect(await getTestimonial([])).toBeNull()
  })

  describe('with rows', () => {
    const NEVER = [id(3), id(4), id(7)]

    beforeAll(async () => {
      const { error } = await svc.from('testimonials').insert([
        row(1, { trip_country: null,          is_active: true,  consent_confirmed_at: consented, sort_order: 3 }),
        row(2, { trip_country: null,          is_active: true,  consent_confirmed_at: consented, sort_order: 1 }),
        row(3, { trip_country: null,          is_active: false, consent_confirmed_at: consented, sort_order: 0 }),
        row(4, { trip_country: 'New Zealand', is_active: false, consent_confirmed_at: null,      sort_order: 0 }),
        row(5, { trip_country: 'New Zealand', is_active: true,  consent_confirmed_at: consented, sort_order: 2,
                 source: 'trustpilot', source_url: 'https://www.trustpilot.com/reviews/abc' }),
        row(6, { trip_country: 'New Zealand', is_active: true,  consent_confirmed_at: consented, sort_order: 4 }),
        row(7, { trip_country: 'Iceland',     is_active: false, consent_confirmed_at: consented, sort_order: 0 }),
      ])
      if (error != null) throw new Error(error.message)
    })
    afterAll(emptyTable)

    it('country match: the first active row of that country by sort_order', async () => {
      const t = await getTestimonial(['New Zealand'])
      expect(t?.id).toBe(id(5))
      expect(t?.source).toBe('trustpilot')
      expect(t?.sourceUrl).toBe('https://www.trustpilot.com/reviews/abc')
    })

    it('several countries (a hub): the first active row of any of them by sort_order', async () => {
      expect((await getTestimonial(['Argentina', 'New Zealand']))?.id).toBe(id(5))
      await svc.from('testimonials').insert(
        row(8, { trip_country: 'Chile', is_active: true, consent_confirmed_at: consented, sort_order: 1 }),
      )
      expect((await getTestimonial(['Argentina', 'Chile', 'New Zealand']))?.id).toBe(id(8))
      expect((await getTestimonial(['Argentina']))?.id).toBe(id(2))   // none of them has a row
      await svc.from('testimonials').delete().eq('id', id(8))
    })

    it('falls back to the first active general row when the country has none active', async () => {
      expect((await getTestimonial(['Iceland']))?.id).toBe(id(2))   // Iceland's only row is inactive
      expect((await getTestimonial(['Norway']))?.id).toBe(id(2))    // no row at all
      expect((await getTestimonial([]))?.id).toBe(id(2))
    })

    it('never returns an inactive row, consented or not', async () => {
      for (const countries of [['New Zealand'], ['Iceland'], ['Norway'], []]) {
        const t = await getTestimonial(countries)
        expect(NEVER).not.toContain(t?.id)
      }
    })

    it('returns null when nothing matches and no general row is active', async () => {
      await svc.from('testimonials').update({ is_active: false }).in('id', [id(1), id(2)])
      expect(await getTestimonial(['Norway'])).toBeNull()
      expect((await getTestimonial(['New Zealand']))?.id).toBe(id(5))
      await svc.from('testimonials').update({ is_active: true }).in('id', [id(1), id(2)])
    })

    it('carries public fields only — no consent field in the value or the type', async () => {
      const t = await getTestimonial(['New Zealand'])
      expect(Object.keys(t ?? {}).sort()).toEqual([
        'authorCountry', 'authorName', 'id', 'photoUrl', 'quote', 'rating', 'source', 'sourceUrl', 'tripCountry',
      ])
      expect(JSON.stringify(t)).not.toContain('internal note')

      expectTypeOf<Testimonial>().not.toHaveProperty('consent_note')
      expectTypeOf<Testimonial>().not.toHaveProperty('consentNote')
      expectTypeOf<Testimonial>().not.toHaveProperty('consentConfirmedAt')
    })
  })
})

// ─── Admin actions ───────────────────────────────────────────────────────────

describe('admin actions', () => {
  const photoPrefix = new URL(
    '/storage/v1/object/public/guide-photos/testimonials/',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ).href

  const base: TestimonialPayload = {
    quote:             'A good week.',
    author_name:       'Action Test',
    author_country:    'PL',
    trip_country:      null,
    rating:            5,
    photo_url:         null,
    source:            'direct',
    source_url:        null,
    consent_confirmed: true,
    consent_note:      'by e-mail',
    is_active:         true,
  }

  async function rowsByName(name: string) {
    const { data } = await svc.from('testimonials').select('*').eq('author_name', name)
    return data ?? []
  }

  afterAll(emptyTable)

  it('Trustpilot without a link: the database refuses, the form gets a sentence', async () => {
    const result = await createTestimonial({ ...base, author_name: 'TP no link', source: 'trustpilot', source_url: null })
    expect(result).toEqual({
      success: false,
      error: 'A Trustpilot testimonial needs the link to its review on trustpilot.com (https://…trustpilot.com/…).',
    })
    expect(await rowsByName('TP no link')).toHaveLength(0)
  })

  it('Trustpilot link on another host is refused by the database rule', async () => {
    const result = await createTestimonial({
      ...base, author_name: 'TP evil', source: 'trustpilot', source_url: 'https://trustpilot.com.evil.example/x',
    })
    expect(result.success).toBe(false)
    expect(await rowsByName('TP evil')).toHaveLength(0)
  })

  it('active without consent: the database refuses, the form gets a sentence', async () => {
    const result = await createTestimonial({ ...base, author_name: 'No consent', consent_confirmed: false, is_active: true })
    expect(result).toEqual({
      success: false,
      error: 'A testimonial cannot be active without the client’s consent. Tick the consent box first.',
    })
    expect(await rowsByName('No consent')).toHaveLength(0)
  })

  it.each([
    ['javascript: scheme',        'javascript:alert(1)'],
    ['another host',              'https://evil.example/storage/v1/object/public/guide-photos/testimonials/x.jpg'],
    ['our bucket, other folder',  `${photoPrefix.replace('testimonials/', '')}abc/x.jpg`],
    ['path escaping the folder',  `${photoPrefix}../x.jpg`],
    ['the folder itself',         photoPrefix],
  ])('photo_url refused: %s', async (_label, photoUrl) => {
    const result = await createTestimonial({ ...base, author_name: 'Bad photo', photo_url: photoUrl })
    expect(result).toEqual({ success: false, error: 'The photo must be uploaded with the photo field above' })
  })

  it('source_url with a javascript: scheme is refused before the database', async () => {
    const result = await createTestimonial({ ...base, author_name: 'Bad link', source: 'trustpilot', source_url: 'javascript:alert(1)' })
    expect(result).toEqual({ success: false, error: 'The link must be a full https:// address' })
  })

  it('creates a valid one with a photo from our folder, appended at the end', async () => {
    const photoUrl = `${photoPrefix}0b1c2d3e.jpg`
    expect((await createTestimonial({ ...base, author_name: 'Good one', photo_url: photoUrl })).success).toBe(true)
    expect((await createTestimonial({ ...base, author_name: 'Second one', trip_country: 'Iceland' })).success).toBe(true)

    const [good] = await rowsByName('Good one')
    const [second] = await rowsByName('Second one')
    expect(good?.photo_url).toBe(photoUrl)
    expect(good?.consent_confirmed_at).not.toBeNull()
    expect(second?.sort_order).toBeGreaterThan(good?.sort_order ?? Infinity)
  })

  it('keeps the original consent time on re-save; unticking it on an active row is refused', async () => {
    const [good] = await rowsByName('Good one')
    if (good == null) throw new Error('row missing')

    expect((await updateTestimonial(good.id, { ...base, author_name: 'Good one', quote: 'Edited.' })).success).toBe(true)
    const [after] = await rowsByName('Good one')
    expect(after?.quote).toBe('Edited.')
    expect(after?.consent_confirmed_at).toBe(good.consent_confirmed_at)

    const result = await updateTestimonial(good.id, { ...base, author_name: 'Good one', consent_confirmed: false })
    expect(result).toEqual({
      success: false,
      error: 'A testimonial cannot be active without the client’s consent. Tick the consent box first.',
    })
  })

  it('toggle: activating a row without consent returns the message, not a throw', async () => {
    expect((await createTestimonial({ ...base, author_name: 'Draft', consent_confirmed: false, is_active: false })).success).toBe(true)
    const [draft] = await rowsByName('Draft')
    if (draft == null) throw new Error('row missing')

    await expect(setTestimonialActive(draft.id, true)).resolves.toEqual({
      success: false,
      error: 'A testimonial cannot be active without the client’s consent. Tick the consent box first.',
    })
    expect((await setTestimonialActive(id(999), true))).toEqual({ success: false, error: 'Testimonial not found' })
  })

  it('move up / down reorders and renumbers 0…n-1', async () => {
    const names = async () => (await listTestimonialsForAdmin()).map(r => r.authorName)
    expect(await names()).toEqual(['Good one', 'Second one', 'Draft'])

    const [draft] = await rowsByName('Draft')
    if (draft == null) throw new Error('row missing')

    expect((await moveTestimonial(draft.id, 'up')).success).toBe(true)
    expect(await names()).toEqual(['Good one', 'Draft', 'Second one'])
    expect((await listTestimonialsForAdmin()).map(r => r.sortOrder)).toEqual([0, 1, 2])

    expect((await moveTestimonial(draft.id, 'down')).success).toBe(true)
    expect(await names()).toEqual(['Good one', 'Second one', 'Draft'])

    // Already last: nothing to do, still a success.
    expect((await moveTestimonial(draft.id, 'down')).success).toBe(true)
    expect(await names()).toEqual(['Good one', 'Second one', 'Draft'])
  })
})
