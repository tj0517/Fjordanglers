import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * FA-1.54 — what `getExperienceV2` hands the S3–S9 sections.
 *
 * The Supabase client is faked at the `supabase-js` boundary, so nothing here touches a
 * database: each table answers with the rows below, and the test checks what the data layer
 * does with them. The S7 rule (O-34) lives here, not in the component — the public read
 * policy returns every `experience_guides` row of an active page, `paused` ones included, and
 * the function is what narrows them to the guides the page may show.
 */

const h = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      // One chainable, awaitable stand-in for every query shape the function uses.
      const result = { data: h.tables[table] ?? null, error: null }
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        not: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (v: typeof result) => unknown) => resolve(result),
      }
      return builder
    },
  }),
}))

import { getExperienceV2 } from '../supabase/queries'

const guideRow = (
  id: string,
  over: { role?: string; status?: string; show_on_page?: boolean; sort_order?: number; override?: number | null } = {},
) => ({
  role: over.role ?? 'backup',
  status: over.status ?? 'active',
  show_on_page: over.show_on_page ?? true,
  sort_order: over.sort_order ?? 0,
  guide_price_override_cents: over.override ?? null,
  guide: {
    id, slug: id, full_name: `Guide ${id}`, avatar_url: null, years_experience: 5, association: null,
    response_time_hours: 24, google_rating: null, google_review_count: null, google_profile_url: null,
    languages: ['English', 'Polish'], bio: `Bio of ${id}`, default_balance_payment_method: 'stripe',
  },
})

beforeEach(() => {
  h.tables = {
    experience_pages: {
      id: 'p1', slug: 'seed-nz', experience_name: 'Seed NZ', intro_text: null, country: 'New Zealand',
      region: 'Otago', hero_image_url: null, gallery_image_urls: [], includes: ['Guide'], excludes: ['Flights'],
      season_months: [10], skill_level: 3, species_details: [{ name: 'Brown trout' }], technique: ['Sight'],
      meeting_point_name: 'Lodge', meeting_point_description: null, walking_km_min: 6, walking_km_max: 12,
      license_info: { required: true, buy_url: 'javascript:alert(1)' }, tip_guidance_text: null,
      suited_for: ['a'], not_suited_for: [], expectations_text: null,
      day_schedule: [{ time: '9:00', title: 'Fishing' }], weather_policy_text: null, offer_eta_text: '48 h',
      min_days: 1, max_days: 3, max_anglers_per_guide: 2, response_sla_hours: 24, offer_mode: 'fixed',
      fee_pct: 0.2, currency: 'NZD', price_from_cents: null, price_to_cents: null,
      meta_title: null, meta_description: null,
      // FA-1.55 — S10–S13.
      peak_months: [11, 12], location_lat: -44.7, location_lng: 169.1,
      nearest_airport: 'Queenstown (ZQN)',
      suggested_lodging: [
        { name: 'Wanaka Lakeside', url: 'https://lodging.example/wanaka', note: '20 min away' },
        { name: 'Bad link', url: 'javascript:alert(1)', note: null },
        { url: 'https://lodging.example/nameless' },
      ],
      what_to_bring: ['Polarised sunglasses'],
      faq: [
        { question: 'Licence?', answer: 'Online.' },
        { question: 'Half an entry', answer: '' },
      ],
    },
    experience_guides: [
      guideRow('a', { role: 'primary', sort_order: 0, override: 130000 }),
      guideRow('b', { sort_order: 1 }),
      guideRow('paused', { status: 'paused', sort_order: 2 }),
      guideRow('hidden', { show_on_page: false, sort_order: 3 }),
    ],
    experience_prices: [
      { days: 1, anglers: 2, guide_price_cents: 125000, currency: 'NZD', valid_from: null, valid_to: null },
    ],
    reviews: [
      {
        id: 'rev-1', overall_rating: 5, comment: 'Spotted every fish first.',
        submitted_at: '2026-03-18T09:00:00Z',
        media_urls: ['javascript:alert(1)', 'https://pics.example/trout.jpg'],
        inquiry: { angler_name: 'Tomasz Kowalski', angler_country: 'PL' },
      },
      {
        id: 'rev-2', overall_rating: null, comment: '   ', submitted_at: '2026-02-01T09:00:00Z',
        media_urls: [], inquiry: { angler_name: 'Empty Review', angler_country: 'DE' },
      },
    ],
    experience_page_options: [
      { id: 'o1', kind: 'archetype', label: 'Day', price_from_cents: 1, price_to_cents: null, currency: 'NZD',
        duration_days_min: 1, duration_days_max: 1, description: 'd', sample_itinerary: [{ title: 'River' }], sort_order: 0 },
      { id: 'o2', kind: 'addon', label: 'Extra', price_from_cents: 2, price_to_cents: null, currency: 'NZD',
        duration_days_min: null, duration_days_max: null, description: null, sample_itinerary: [{ title: 'ignored' }], sort_order: 1 },
    ],
  }
})

describe('getExperienceV2 — S7 guides (O-34)', () => {
  it('returns only active rows with show_on_page, in sort order: 2 shown of 4 stored', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page?.guides.map(g => g.id)).toEqual(['a', 'b'])
    expect(page?.guides.map(g => g.id)).not.toContain('paused')
    expect(page?.guides.map(g => g.id)).not.toContain('hidden')
  })

  it('carries what the guide cards print', async () => {
    const g = (await getExperienceV2('seed-nz'))?.guides[0]
    expect(g).toMatchObject({
      fullName: 'Guide a', languages: ['English', 'Polish'], bio: 'Bio of a',
      balancePaymentMethod: 'stripe', isPrimary: true, yearsExperience: 5,
    })
  })

  it('folds the override into the price rows and never returns the column', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page?.prices).toEqual([{ days: 1, anglers: 2, guidePriceCents: 130000, currency: 'NZD' }])
    expect(JSON.stringify(page)).not.toMatch(/override/i)
  })
})

describe('getExperienceV2 — content for S3–S9', () => {
  it('maps the FA-1.50 columns', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page).toMatchObject({
      excludes: ['Flights'], speciesNames: ['Brown trout'], technique: ['Sight'],
      meetingPointName: 'Lodge', walkingKmMin: 6, walkingKmMax: 12, suitedFor: ['a'], notSuitedFor: [],
      offerEtaText: '48 h',
      daySchedule: [{ time: '9:00', title: 'Fishing', metaLines: [] }],
    })
  })

  it('a licence link that is not http(s) comes back as text, not as a URL', async () => {
    const license = (await getExperienceV2('seed-nz'))?.license
    expect(license?.buyUrl).toBeNull()
    expect(license?.buyText).toBe('javascript:alert(1)')
  })

  it('reads the itinerary of an archetype and ignores one on any other kind', async () => {
    const options = (await getExperienceV2('seed-nz'))?.options
    expect(options?.find(o => o.kind === 'archetype')?.sampleItinerary).toEqual([{ day: 1, title: 'River', details: [] }])
    expect(options?.find(o => o.kind === 'addon')?.sampleItinerary).toEqual([])
  })
})

describe('getExperienceV2 — S10–S13 (FA-1.55)', () => {
  it('maps the map, the logistics and the season columns', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page?.locationLat).toBe(-44.7)
    expect(page?.locationLng).toBe(169.1)
    expect(page?.nearestAirport).toBe('Queenstown (ZQN)')
    expect(page?.peakMonths).toEqual([11, 12])
    expect(page?.whatToBring).toEqual(['Polarised sunglasses'])
  })

  it('keeps a lodging link only when it is http(s), and drops a row with no name', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page?.suggestedLodging).toEqual([
      { name: 'Wanaka Lakeside', url: 'https://lodging.example/wanaka', note: '20 min away' },
      { name: 'Bad link', url: null, note: null },
    ])
  })

  it('drops a FAQ entry that is missing its answer', async () => {
    const page = await getExperienceV2('seed-nz')
    expect(page?.faq).toEqual([{ question: 'Licence?', answer: 'Online.' }])
  })

  it('a Google profile that is not an http(s) URL never leaves the data layer', async () => {
    const page = await getExperienceV2('seed-nz')
    expect(page?.guides.every(g => g.googleProfileUrl == null)).toBe(true)
  })
})

describe('getExperienceV2 — S10 reviews (FA-1.55)', () => {
  it('sends the first name only, never the stored full name', async () => {
    const page = await getExperienceV2('seed-nz')

    expect(page?.reviews).toHaveLength(1)
    expect(page?.reviews[0]).toMatchObject({
      id: 'rev-1', rating: 5, firstName: 'Tomasz', country: 'PL',
      comment: 'Spotted every fish first.',
    })
    expect(JSON.stringify(page?.reviews)).not.toContain('Kowalski')
  })

  it('takes the first http(s) photo and ignores anything else in media_urls', async () => {
    const page = await getExperienceV2('seed-nz')
    expect(page?.reviews[0].photoUrl).toBe('https://pics.example/trout.jpg')
  })

  it('drops a submitted review that carries neither a rating nor text', async () => {
    const page = await getExperienceV2('seed-nz')
    expect(page?.reviews.map(r => r.id)).not.toContain('rev-2')
  })

  it('no reviews stored → an empty list, and the section renders nothing', async () => {
    h.tables.reviews = []
    const page = await getExperienceV2('seed-nz')
    expect(page?.reviews).toEqual([])
  })
})
