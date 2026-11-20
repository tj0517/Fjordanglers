/**
 * /trips keeps its Leaflet map and list (tj, 2026-11-18) and draws the trips on the site's one trip
 * card: region tag, species, the v1 price line, the first gallery photo. `?country=` filters and
 * the page links keep it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

type Row = Record<string, unknown>
const listCalls: { ilike?: [string, string]; range?: [number, number] }[] = []
let rows: Row[] = []
let count = 0

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => {
      const call: (typeof listCalls)[number] = {}
      listCalls.push(call)
      const q = {
        select: () => q,
        eq:     () => q,
        order:  () => q,
        range:  (a: number, b: number) => { call.range = [a, b]; return q },
        ilike:  (col: string, v: string) => { call.ilike = [col, v]; return q },
        then:   (res: (v: { data: Row[]; count: number }) => unknown) => Promise.resolve(res({ data: rows, count })),
      }
      return q
    },
  }),
}))
vi.mock('@/lib/supabase/queries', () => ({ getActiveDestinationCountries: async () => ['Iceland'] }))
vi.mock('@/components/layout/nav', () => ({ SiteNav: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/analytics/WebEventTracker', () => ({ WebEventTracker: () => null }))
vi.mock('../exp-page-map-wrapper', () => ({ default: () => <div data-testid="trips-map" /> }))
vi.mock('../exp-page-geo-action', () => ({ fetchGeoExpPages: async () => [] }))

import TripsPage from '../page'

const trip = (over: Row = {}): Row => ({
  id: 'e-1', slug: 'salmon-week', experience_name: 'Salmon week', country: 'Iceland', region: 'South-West',
  price_from: 450.5, price_type: 'per_person', currency: 'EUR', hero_image_url: '/hero.jpg',
  gallery_image_urls: ['/iceland.jpg'], difficulty: null, technique: null, target_species: ['Salmon'],
  non_angler_friendly: null, location_lat: 64, location_lng: -20, location_area: null, location_spots: null,
  ...over,
})

const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await TripsPage({ searchParams: Promise.resolve(searchParams) }))
const decode = (s: string) => s.replace(/&amp;/g, '&')

beforeEach(() => { listCalls.length = 0; rows = [trip()]; count = 1 })

describe('/trips', () => {
  it('trips on the site trip card: region tag, species, price, link; the gallery photo first', async () => {
    const html = await render()
    expect(html).toContain('href="/experiences/salmon-week"')
    expect(html).toContain('South-West')
    expect(html).toContain('Salmon')
    expect(html).toMatch(/data-testid="hub-card-price"[^>]*>from €450\.50 \/ person</)
    expect(html).toContain('iceland.jpg')
    expect(html).toContain('View trip')
  })

  it('a page without photos or species still draws its card', async () => {
    rows = [trip({ gallery_image_urls: null, hero_image_url: null, target_species: null })]
    const html = await render()
    expect(html).toContain('Salmon week')
    expect(html).toContain('View trip')
  })

  it('every card is the same height: name cut at two lines, species line kept even when empty (tj)', async () => {
    rows = [trip(), trip({ id: 'e-2', slug: 'no-species', target_species: null })]
    const html = await render()
    const cards = html.split('<article').slice(1)
    for (const card of cards) {
      expect(card).toMatch(/<h3 class="[^"]*line-clamp-2[^"]*"[^>]*height:49px/)
      expect(card).toMatch(/<p class="[^"]*h-\[22px\] truncate/)
    }
  })

  it('?country= filters the list', async () => {
    await render({ country: 'iceland' })
    expect(listCalls[0]!.ilike).toEqual(['country', 'iceland'])
  })

  it('pages of 12 with the shared pagination; page links keep the country', async () => {
    count = 30
    const html = decode(await render({ country: 'Iceland', page: '2' }))
    expect(listCalls[0]!.range).toEqual([12, 23])
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>2<\/span>/)
    expect(html).toContain('href="/trips?country=Iceland&page=3"')
    expect(html).toContain('href="/trips?country=Iceland&page=1"')
  })
})
