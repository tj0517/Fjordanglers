/**
 * FA-1.81 — the v2 offer page emits structured data like v1: the trip with its price, the breadcrumb,
 * and the FAQ when there is one; plus `og:url` / `og:type`.
 *
 * The component's own body runs against fixtures that mirror the seed's two v2 pages (NZ `fixed`,
 * Iceland `custom`) and the `<script type="application/ld+json">` payloads are read out of the element
 * tree it returns (the same way v1-offer-jsonld-golden.test.tsx reads v1's). Nothing is rendered, so no
 * client component, map or image loader is involved.
 *
 * The price assertions pin tj D1 (2026-11-05): the number published is the number the page shows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const h = vi.hoisted(() => ({
  mockEnv: { EXPERIENCE_V2_ENABLED: true as boolean, NEXT_PUBLIC_WHATSAPP_NUMBER: '48600100200' },
  getExperienceV2: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ env: h.mockEnv }))
// A hub's label in the breadcrumb is its `h1` from the `destination_hubs` table (FA-1.85), read by
// `getHubCrumbForCountry`; this file mocks the data layer, so it supplies the labels itself. The real
// read is covered against the local database in hub-rows.test.ts.
const HUB_LABELS: Record<string, string> = {
  iceland: 'Iceland Fly Fishing Trips',
  norway: 'Guided Fishing Trips in Norway',
  'new-zealand': 'New Zealand Fly Fishing Trips',
}
vi.mock('@/lib/supabase/queries', async importOriginal => {
  const { getHubSlugForCountry } = await import('@/lib/destinations')
  return {
    ...(await importOriginal<typeof import('@/lib/supabase/queries')>()),
    getExperienceV2:           h.getExperienceV2,
    getRelatedExperiencePages: async () => [],
    getHubCrumbForCountry:     async (country: string) => {
      const slug = getHubSlugForCountry(country)
      return slug != null && HUB_LABELS[slug] != null ? { slug, label: HUB_LABELS[slug] } : null
    },
  }
})
vi.mock('@/lib/fx', () => ({ fetchIndicativeRates: async () => ({}) }))
vi.mock('@/lib/supabase/testimonials', () => ({ getTestimonial: async () => null }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('../_v1/ExperienceV1', () => ({ default: () => null, generateMetadata: vi.fn() }))
vi.mock('@/components/layout/nav', () => ({ SiteNav: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))

import ExperienceV2, { generateMetadata } from '../_v2/ExperienceV2'
import { fixedPage, customPage } from '@/components/experience-v2/v2-page.fixture'
import type { ExperienceV2 as ExperienceV2Page } from '@/lib/supabase/queries'

type Block = Record<string, unknown> & { '@type': string }

/** Every `<script type="application/ld+json">` payload in the element tree, in document order. */
function payloads(node: ReactNode): string[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(payloads)
  const el = node as ReactElement<{ type?: string; children?: ReactNode; dangerouslySetInnerHTML?: { __html: string } }>
  if (el.type === 'script' && el.props.type === 'application/ld+json') return [el.props.dangerouslySetInnerHTML?.__html ?? '']
  return payloads(el.props?.children)
}

/** The props of the first `InquiryWizardProvider` — to compare the JSON-LD price with the number the form uses. */
function wizardPage(node: unknown): { fromTotalCents: number | null } | null {
  if (Array.isArray(node)) { for (const c of node) { const hit = wizardPage(c); if (hit != null) return hit } return null }
  if (typeof node !== 'object' || node === null) return null
  const el = node as { type?: unknown; props?: Record<string, unknown> }
  if (typeof el.type === 'function' && el.type.name === 'InquiryWizardProvider') return el.props?.page as { fromTotalCents: number | null }
  return el.props == null ? null : wizardPage(el.props.children)
}

async function render(page: ExperienceV2Page): Promise<{ raw: string[]; blocks: Block[]; tree: ReactElement }> {
  h.getExperienceV2.mockResolvedValue(page)
  const tree = await ExperienceV2({ slug: page.slug })
  const raw = payloads(tree)
  return { raw, blocks: raw.map(s => JSON.parse(s) as Block), tree }
}

const ofType = (blocks: Block[], type: string) => blocks.find(b => b['@type'] === type)

beforeEach(() => { vi.clearAllMocks() })

describe('v2 emits the offer structured data', () => {
  it('fixture with FAQ → TouristTrip (with offers), BreadcrumbList and FAQPage', async () => {
    const { blocks } = await render(fixedPage())

    expect(blocks.map(b => b['@type'])).toEqual(['TouristTrip', 'BreadcrumbList', 'FAQPage'])
    expect(ofType(blocks, 'TouristTrip')).toHaveProperty('offers')
    expect(ofType(blocks, 'FAQPage')).toMatchObject({
      mainEntity: [
        { '@type': 'Question', name: 'How do I buy the fishing licence?', acceptedAnswer: { text: 'Online, the evening before.' } },
        { '@type': 'Question', name: 'What if the river is muddy?' },
      ],
    })
  })

  it('no FAQ on the page → no FAQPage', async () => {
    const { blocks } = await render(fixedPage({ faq: [] }))

    expect(blocks.map(b => b['@type'])).toEqual(['TouristTrip', 'BreadcrumbList'])
  })

  it('the trip carries what the page shows: name, canonical url, image, location, primary guide', async () => {
    const { blocks } = await render(fixedPage({ heroImageUrl: 'https://img.example.test/h.jpg' }))

    expect(ofType(blocks, 'TouristTrip')).toMatchObject({
      '@context': 'https://schema.org',
      name: 'Seed Backcountry Day',
      url: 'https://www.fjordanglers.com/experiences/seed-nz',
      image: 'https://img.example.test/h.jpg',
      location: { '@type': 'Place', name: 'Otago, New Zealand', geo: { latitude: -44.7, longitude: 169.1 } },
      subjectOf: { '@type': 'Person', name: 'Alex Rivers', url: 'https://www.fjordanglers.com/guides/g1' },
      provider: { name: 'FjordAnglers' },
    })
  })

  it('every emitted block parses and contains no raw < > &', async () => {
    const { raw } = await render(fixedPage({ faq: [{ question: 'Q <b>?', answer: 'A </script> & B' }] }))

    expect(raw).toHaveLength(3)
    for (const s of raw) {
      expect(() => JSON.parse(s)).not.toThrow()
      expect(s).not.toMatch(/[<>&]/)
    }
  })
})

describe('price = the price the page shows (tj D1)', () => {
  it('fixed → an Offer with the widget\'s "from" total, FA fee included, in the page currency', async () => {
    const { blocks, tree } = await render(fixedPage())

    // cheapest row 90000 + 20% fee = 108000 cents → 1080
    expect(ofType(blocks, 'TouristTrip')?.offers).toMatchObject({
      '@type': 'Offer', price: 1080, priceCurrency: 'NZD', availability: 'https://schema.org/InStock',
      url: 'https://www.fjordanglers.com/experiences/seed-nz', seller: { name: 'FjordAnglers' },
    })
    // …and it is the very number the inquiry form is handed.
    expect(wizardPage(tree)?.fromTotalCents).toBe(108000)
  })

  it('fixed with no usable price rows → no offers (the page says "on request")', async () => {
    const { blocks, tree } = await render(fixedPage({ prices: [] }))

    expect(ofType(blocks, 'TouristTrip')).not.toHaveProperty('offers')
    expect(wizardPage(tree)?.fromTotalCents).toBeNull()
  })

  it('custom with both ends → an AggregateOffer with the stored range, no fee added', async () => {
    const { blocks } = await render(customPage())

    expect(ofType(blocks, 'TouristTrip')?.offers).toMatchObject({
      '@type': 'AggregateOffer', lowPrice: 450.5, highPrice: 3200, priceCurrency: 'EUR',
    })
  })

  it('custom with only a lower bound → an Offer with that bound', async () => {
    const { blocks } = await render(customPage({ priceToCents: null }))

    expect(ofType(blocks, 'TouristTrip')?.offers).toMatchObject({ '@type': 'Offer', price: 450.5, priceCurrency: 'EUR' })
  })

  it('custom with no lower bound → no offers', async () => {
    const { blocks } = await render(customPage({ priceFromCents: null, priceToCents: null }))

    expect(ofType(blocks, 'TouristTrip')).not.toHaveProperty('offers')
  })

  it('custom with an upper bound that is not above the lower → an Offer, not a degenerate range', async () => {
    const { blocks } = await render(customPage({ priceFromCents: 50000, priceToCents: 50000 }))

    expect(ofType(blocks, 'TouristTrip')?.offers).toMatchObject({ '@type': 'Offer', price: 500 })
  })

  it('a guide price override that reaches the rows only shows as the resulting "from" — no override field is emitted', async () => {
    const { raw } = await render(fixedPage())

    expect(raw.length).toBeGreaterThan(0)
    expect(raw.join('')).not.toMatch(/override|guidePrice|feePct|feeCents/i)
  })
})

describe('breadcrumb (tj D2)', () => {
  const crumbs = (blocks: Block[]) =>
    (ofType(blocks, 'BreadcrumbList')?.itemListElement as { position: number; name: string; item: string }[])
      .map(c => [c.position, c.name, c.item])

  it('country with a hub → Home → the hub (its own h1) → the offer', async () => {
    const { blocks } = await render(fixedPage())

    expect(crumbs(blocks)).toEqual([
      [1, 'Home', 'https://www.fjordanglers.com'],
      [2, 'New Zealand Fly Fishing Trips', 'https://www.fjordanglers.com/new-zealand'],
      [3, 'Seed Backcountry Day', 'https://www.fjordanglers.com/experiences/seed-nz'],
    ])
  })

  it('Iceland (custom page) → the Iceland hub', async () => {
    const { blocks } = await render(customPage({ country: 'Iceland', slug: 'seed-iceland' }))

    expect(crumbs(blocks)[1]).toEqual([2, 'Iceland Fly Fishing Trips', 'https://www.fjordanglers.com/iceland'])
  })

  it('country without a hub → Home → Trips → the offer, as in v1', async () => {
    // Denmark has no hub (Norway had none until FA-1.82).
    const { blocks } = await render(fixedPage({ country: 'Denmark', slug: 'seed-denmark' }))

    expect(crumbs(blocks)).toEqual([
      [1, 'Home', 'https://www.fjordanglers.com'],
      [2, 'Trips', 'https://www.fjordanglers.com/trips'],
      [3, 'Seed Backcountry Day', 'https://www.fjordanglers.com/experiences/seed-denmark'],
    ])
  })

  it('FA-1.82: Norway now has a hub → Home → hub → the offer', async () => {
    const { blocks } = await render(fixedPage({ country: 'Norway', slug: 'seed-norway' }))

    expect(crumbs(blocks)[1]).toEqual([2, 'Guided Fishing Trips in Norway', 'https://www.fjordanglers.com/norway'])
  })
})

describe('metadata', () => {
  it('openGraph.url is the canonical offer URL and openGraph.type is website', async () => {
    h.getExperienceV2.mockResolvedValue(fixedPage())

    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'seed-nz' }) })

    expect(meta.openGraph).toMatchObject({ url: 'https://www.fjordanglers.com/experiences/seed-nz', type: 'website' })
    expect(meta.alternates).toEqual({ canonical: 'https://www.fjordanglers.com/experiences/seed-nz' })
  })

  it('the description is unchanged: the page\'s own, or the standard line', async () => {
    h.getExperienceV2.mockResolvedValue(fixedPage({ metaDescription: null }))
    const standard = await generateMetadata({ params: Promise.resolve({ slug: 'seed-nz' }) })
    h.getExperienceV2.mockResolvedValue(fixedPage({ metaDescription: 'Own text.' }))
    const own = await generateMetadata({ params: Promise.resolve({ slug: 'seed-nz' }) })

    expect(standard.description).toBe('Guided fishing in Otago, New Zealand. Free inquiry, answer within 24 h, deposit only after you accept the offer.')
    expect(own.description).toBe('Own text.')
  })
})
