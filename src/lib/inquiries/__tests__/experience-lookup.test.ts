/**
 * experience-lookup unit tests — FA-1.09
 *
 * Resolution order: experience_page_id first, then experience_pages.trip_id.
 * The helper never throws and does not touch the database when both refs are null.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import {
  getInquiryExperience,
  getInquiryExperiences,
  tripTitleOf,
  TRIP_TITLE_FALLBACK,
} from '../experience-lookup'

const PAGE_A = '11111111-1111-4111-8111-111111111111'
const PAGE_B = '22222222-2222-4222-8222-222222222222'
const TRIP_X = '33333333-3333-4333-8333-333333333333'
const TRIP_Y = '44444444-4444-4444-8444-444444444444'

interface PageRow {
  id: string
  experience_name: string
  slug: string
  country: string
  guide_id: string | null
  price_from: number
  price_type: string
  currency: string
  trip_id: string | null
  created_at: string
}

function page(over: Partial<PageRow> & { id: string }): PageRow {
  return {
    experience_name: `Page ${over.id.slice(0, 2)}`,
    slug:            `slug-${over.id.slice(0, 2)}`,
    country:         'Iceland',
    guide_id:        null,
    price_from:      200,
    price_type:      'per_person',
    currency:        'EUR',
    trip_id:         null,
    created_at:      '2026-01-01T00:00:00Z',
    ...over,
  }
}

interface Call {
  method: string
  args:   unknown[]
}

type Outcome = { data: PageRow | PageRow[] | null; error: { message: string } | null }

/**
 * Chainable query mock. Each `from('experience_pages')` chain records its calls and
 * resolves (on await or on maybeSingle) with the next queued outcome.
 */
function mockDb(outcomes: Outcome[]) {
  const chains: Call[][] = []
  let i = 0

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      const calls: Call[] = [{ method: 'from', args: [table] }]
      chains.push(calls)
      const outcome = outcomes[i++] ?? { data: null, error: null }
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'or', 'order', 'limit']) {
        chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain }
      }
      chain.maybeSingle = async () => { calls.push({ method: 'maybeSingle', args: [] }); return outcome }
      chain.then = (resolve: (v: Outcome) => unknown) => resolve(outcome)
      return chain
    },
  } as unknown as ReturnType<typeof createServiceClient>)

  return { chains }
}

const usedColumn = (calls: Call[], column: string) =>
  calls.some(c => c.method === 'eq' && c.args[0] === column)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('getInquiryExperience — resolution order', () => {
  it('uses experience_page_id and does not query trip_id when the page is found', async () => {
    const { chains } = mockDb([
      { data: page({ id: PAGE_A, experience_name: 'Salmon on the Laxá' }), error: null },
    ])

    const exp = await getInquiryExperience({ experience_page_id: PAGE_A, trip_id: TRIP_X })

    expect(exp?.id).toBe(PAGE_A)
    expect(exp?.name).toBe('Salmon on the Laxá')
    expect(chains).toHaveLength(1)
    expect(usedColumn(chains[0], 'id')).toBe(true)
    expect(usedColumn(chains[0], 'trip_id')).toBe(false)
  })

  it('falls back to trip_id when the page id matches nothing', async () => {
    const { chains } = mockDb([
      { data: null, error: null },
      { data: page({ id: PAGE_B, trip_id: TRIP_X, experience_name: 'Via trip' }), error: null },
    ])

    const exp = await getInquiryExperience({ experience_page_id: PAGE_A, trip_id: TRIP_X })

    expect(exp?.id).toBe(PAGE_B)
    expect(chains).toHaveLength(2)
    expect(usedColumn(chains[1], 'trip_id')).toBe(true)
    // duplicates of trip_id must never make this throw: earliest row wins, limit 1
    expect(chains[1].some(c => c.method === 'order' && c.args[0] === 'created_at')).toBe(true)
    expect(chains[1].some(c => c.method === 'limit' && c.args[0] === 1)).toBe(true)
  })

  it('resolves via trip_id when there is no experience_page_id', async () => {
    const { chains } = mockDb([
      { data: page({ id: PAGE_B, trip_id: TRIP_X }), error: null },
    ])

    const exp = await getInquiryExperience({ experience_page_id: null, trip_id: TRIP_X })

    expect(exp?.id).toBe(PAGE_B)
    expect(chains).toHaveLength(1)
    expect(usedColumn(chains[0], 'id')).toBe(false)
    expect(usedColumn(chains[0], 'trip_id')).toBe(true)
  })

  it('maps the row to camelCase', async () => {
    mockDb([
      {
        data: page({
          id: PAGE_A, experience_name: 'Trip', slug: 'trip', country: 'Norway',
          guide_id: 'g-1', price_from: 350, price_type: 'flat', currency: 'EUR',
        }),
        error: null,
      },
    ])

    expect(await getInquiryExperience({ experience_page_id: PAGE_A, trip_id: null })).toEqual({
      id: PAGE_A, name: 'Trip', slug: 'trip', country: 'Norway',
      guideId: 'g-1', priceFrom: 350, priceType: 'flat', currency: 'EUR',
    })
  })
})

describe('getInquiryExperience — red proof: nothing to resolve', () => {
  it('returns null, does not throw and does not hit the database when both refs are null', async () => {
    mockDb([])

    await expect(
      getInquiryExperience({ experience_page_id: null, trip_id: null }),
    ).resolves.toBeNull()

    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('returns null when neither reference matches a page', async () => {
    mockDb([{ data: null, error: null }, { data: null, error: null }])
    expect(await getInquiryExperience({ experience_page_id: PAGE_A, trip_id: TRIP_X })).toBeNull()
  })

  it('returns null and does not throw on a supabase error', async () => {
    mockDb([{ data: null, error: { message: 'boom' } }])

    await expect(
      getInquiryExperience({ experience_page_id: PAGE_A, trip_id: TRIP_X }),
    ).resolves.toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('getInquiryExperiences — batch', () => {
  it('runs ONE query for a mixed set and keys the Map by inquiry id', async () => {
    const { chains } = mockDb([
      {
        data: [
          page({ id: PAGE_A, experience_name: 'By page id' }),
          page({ id: PAGE_B, trip_id: TRIP_X, experience_name: 'By trip id' }),
        ],
        error: null,
      },
    ])

    const map = await getInquiryExperiences([
      { id: 'inq-1', experience_page_id: PAGE_A, trip_id: null },
      { id: 'inq-2', experience_page_id: null,   trip_id: TRIP_X },
      { id: 'inq-3', experience_page_id: null,   trip_id: TRIP_Y },
      { id: 'inq-4', experience_page_id: null,   trip_id: null },
    ])

    expect(chains).toHaveLength(1)
    const orCall = chains[0].find(c => c.method === 'or')
    expect(orCall?.args[0]).toBe(`id.in.(${PAGE_A}),trip_id.in.(${TRIP_X},${TRIP_Y})`)

    expect([...map.keys()].sort()).toEqual(['inq-1', 'inq-2'])
    expect(map.get('inq-1')?.name).toBe('By page id')
    expect(map.get('inq-2')?.name).toBe('By trip id')
  })

  it('lets the page id win over the trip_id row for the same inquiry', async () => {
    mockDb([
      {
        data: [
          page({ id: PAGE_B, trip_id: TRIP_X, experience_name: 'Trip row', created_at: '2026-01-01T00:00:00Z' }),
          page({ id: PAGE_A, experience_name: 'Page row', created_at: '2026-02-01T00:00:00Z' }),
        ],
        error: null,
      },
    ])

    const map = await getInquiryExperiences([
      { id: 'inq-1', experience_page_id: PAGE_A, trip_id: TRIP_X },
    ])

    expect(map.get('inq-1')?.name).toBe('Page row')
  })

  it('uses the earliest created_at when a trip_id has duplicates', async () => {
    mockDb([
      {
        data: [
          page({ id: PAGE_A, trip_id: TRIP_X, experience_name: 'Earlier', created_at: '2026-01-01T00:00:00Z' }),
          page({ id: PAGE_B, trip_id: TRIP_X, experience_name: 'Later',   created_at: '2026-03-01T00:00:00Z' }),
        ],
        error: null,
      },
    ])

    const map = await getInquiryExperiences([{ id: 'inq-1', experience_page_id: null, trip_id: TRIP_X }])

    expect(map.get('inq-1')?.name).toBe('Earlier')
  })

  it('returns an empty Map without querying for empty input or all-null refs', async () => {
    mockDb([])

    expect((await getInquiryExperiences([])).size).toBe(0)
    expect((await getInquiryExperiences([{ id: 'inq-1', experience_page_id: null, trip_id: null }])).size).toBe(0)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('drops values that are not uuids instead of putting them in the filter', async () => {
    const { chains } = mockDb([{ data: [page({ id: PAGE_A })], error: null }])

    await getInquiryExperiences([
      { id: 'inq-1', experience_page_id: PAGE_A,              trip_id: null },
      { id: 'inq-2', experience_page_id: 'x),id.eq.(y',       trip_id: null },
    ])

    expect(chains[0].find(c => c.method === 'or')?.args[0]).toBe(`id.in.(${PAGE_A})`)
  })

  it('returns an empty Map and does not throw on a supabase error', async () => {
    mockDb([{ data: null, error: { message: 'boom' } }])

    const map = await getInquiryExperiences([{ id: 'inq-1', experience_page_id: PAGE_A, trip_id: null }])

    expect(map.size).toBe(0)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('tripTitleOf', () => {
  it('returns the name, or the fallback when unresolved', () => {
    expect(tripTitleOf(null)).toBe(TRIP_TITLE_FALLBACK)
    expect(
      tripTitleOf({
        id: PAGE_A, name: 'Real name', slug: 's', country: 'Iceland',
        guideId: null, priceFrom: 1, priceType: 'flat', currency: 'EUR',
      }),
    ).toBe('Real name')
  })
})
