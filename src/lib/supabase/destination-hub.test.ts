/**
 * Integration test for getDestinationHub() against the local Supabase stack (FA-1.65).
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * The test brings every row it reads: a hub that exists only inside this file (country
 * Denmark — no seed row, no hub on the site), five pages, three guides, two price rows,
 * three inquiries and three reviews, all under ids starting `f1650000-`. They are deleted
 * afterwards. Nothing is added to DESTINATION_HUBS: every entry there is a public page.
 *
 * What it pins down:
 *   guideCount — distinct guides that are active and `show_on_page`, on active pages only
 *   priceFrom  — lowest priced offer in the dominant currency; on-request offers and other
 *                currencies do not count (tj D3, decisions 1 and 3b, 2026-10-23)
 *   card price — a v2 page prices off experience_prices + fee, exactly as its page does
 *   species    — union of the offers' target_species, deduplicated case-insensitively
 *   reviews    — consented AND submitted only (red case: the unconsented one is absent)
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { DestinationHub } from '@/lib/destinations'

const h = vi.hoisted(() => ({
  env: { EXPERIENCE_V2_ENABLED: true as boolean },
  hub: {
    slug: 'fa165-test-hub', group: 'Nordic', countries: ['Denmark'],
    h1: 'FA-1.65 test hub', intro: 'Test.', metaTitle: 'Test', metaDescription: 'Test',
  } as DestinationHub,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/env', () => ({ env: h.env }))
vi.mock('@/lib/destinations', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/destinations')>()
  return {
    ...original,
    getHubForSlug: (slug: string) => (slug === h.hub.slug ? h.hub : original.getHubForSlug(slug)),
  }
})

import { createServiceClient } from '@/lib/supabase/server'
import { getDestinationHub } from './queries'

const id = (n: number) => `f1650000-0000-4000-8000-${String(n).padStart(12, '0')}`

const G1 = id(1), G2 = id(2), G3 = id(3)
const P1 = id(11), P2 = id(12), P3 = id(13), P4 = id(14), P5 = id(15)
const I1 = id(21), I2 = id(22), I3 = id(23)
const R1 = id(31), R2 = id(32), R3 = id(33)

const svc = createServiceClient()

async function cleanup() {
  await svc.from('reviews').delete().in('id', [R1, R2, R3])
  await svc.from('inquiries').delete().in('id', [I1, I2, I3])
  await svc.from('experience_guides').delete().in('experience_id', [P1, P2, P3, P4, P5])
  await svc.from('experience_prices').delete().in('experience_id', [P1, P2, P3, P4, P5])
  await svc.from('experience_pages').delete().in('id', [P1, P2, P3, P4, P5])
  await svc.from('guides').delete().in('id', [G1, G2, G3])
}

async function must(label: string, run: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run
  if (error != null) throw new Error(`${label}: ${error.message}`)
}

beforeAll(async () => {
  await cleanup()

  await must('guides', svc.from('guides').insert([
    { id: G1, full_name: 'Gunnar Testguide', country: 'Denmark', status: 'active' },
    { id: G2, full_name: 'Freja Testguide',  country: 'Denmark', status: 'active' },
    { id: G3, full_name: 'Paused Testguide', country: 'Denmark', status: 'active' },
  ]))

  // One insert per page: a bulk insert sends NULL for a key one row leaves out, skipping its default.
  const base = { country: 'Denmark', region: 'Jutland', status: 'active', max_anglers_per_guide: 2, fee_pct: 0.2 }
  const pages = [
    // v2 fixed — priced from its rows below: cheapest 50 000 guide + 20% = 60 000 (€600).
    { ...base, id: P1, slug: 'fa165-p1-v2', experience_name: 'FA165 P1 v2', currency: 'EUR', price_from: 100, price_type: 'per_person',
      page_version: 2, offer_mode: 'fixed', price_from_cents: 10_000, target_species: ['Brown Trout', 'Sea Trout'],
      created_at: '2026-10-05T00:00:00Z' },
    // v1 per person — €450, the hub minimum.
    { ...base, id: P2, slug: 'fa165-p2-v1', experience_name: 'FA165 P2 v1', currency: 'EUR', price_from: 450, price_type: 'per_person',
      page_version: 1, target_species: ['sea trout', ' Arctic  Char'], created_at: '2026-10-04T00:00:00Z' },
    // v1 on request, placeholder price 1 — must not become the minimum (decision 1).
    { ...base, id: P3, slug: 'fa165-p3-request', experience_name: 'FA165 P3 request', currency: 'EUR', price_from: 1, price_type: 'request',
      page_version: 1, created_at: '2026-10-03T00:00:00Z' },
    // The only NOK offer — cheaper, but NOK is not the hub's dominant currency.
    { ...base, id: P4, slug: 'fa165-p4-nok', experience_name: 'FA165 P4 NOK', currency: 'NOK', price_from: 100, price_type: 'per_person',
      page_version: 1, created_at: '2026-10-02T00:00:00Z' },
    // Draft — not on the hub at all, nor its guide.
    { ...base, id: P5, slug: 'fa165-p5-draft', experience_name: 'FA165 P5 draft', currency: 'EUR', price_from: 10, price_type: 'per_person',
      page_version: 1, status: 'draft', target_species: ['Pike'], created_at: '2026-10-01T00:00:00Z' },
  ]
  for (const page of pages) await must(`page ${page.slug}`, svc.from('experience_pages').insert(page))

  await must('prices', svc.from('experience_prices').insert([
    { experience_id: P1, days: 1, anglers: 1, guide_price_cents: 50_000, currency: 'EUR' },
    { experience_id: P1, days: 1, anglers: 2, guide_price_cents: 60_000, currency: 'EUR' },
  ]))

  await must('experience_guides', svc.from('experience_guides').insert([
    { experience_id: P1, guide_id: G1, role: 'primary', status: 'active', show_on_page: true,  sort_order: 0 },
    { experience_id: P1, guide_id: G2, role: 'backup',  status: 'active', show_on_page: true,  sort_order: 1 },
    { experience_id: P2, guide_id: G1, role: 'primary', status: 'active', show_on_page: true,  sort_order: 0 },
    { experience_id: P3, guide_id: G3, role: 'primary', status: 'paused', show_on_page: true,  sort_order: 0 },
    { experience_id: P4, guide_id: G3, role: 'primary', status: 'active', show_on_page: false, sort_order: 0 },
    { experience_id: P5, guide_id: G3, role: 'primary', status: 'active', show_on_page: true,  sort_order: 0 },
  ]))

  await must('inquiries', svc.from('inquiries').insert([
    { id: I1, angler_name: 'Anna Testowa Kowalska', angler_email: 'fa165-r1@example.test', angler_country: 'DE' },
    { id: I2, angler_name: 'Bob Noconsent',         angler_email: 'fa165-r2@example.test', angler_country: 'GB' },
    { id: I3, angler_name: 'Cleo Unsubmitted',      angler_email: 'fa165-r3@example.test', angler_country: 'FR' },
  ]))

  await must('reviews', svc.from('reviews').insert([
    { id: R1, inquiry_id: I1, experience_id: P1, token: 'fa165-tok-1', publish_consent: true,
      submitted_at: '2026-10-10T00:00:00Z', overall_rating: 5, comment: 'Consented and submitted.' },
    { id: R2, inquiry_id: I2, experience_id: P1, token: 'fa165-tok-2', publish_consent: false,
      submitted_at: '2026-10-11T00:00:00Z', overall_rating: 4, comment: 'NOT consented.' },
    { id: R3, inquiry_id: I3, experience_id: P2, token: 'fa165-tok-3', publish_consent: true,
      submitted_at: null, overall_rating: null, comment: null },
  ]))
})

afterAll(cleanup)

describe('getDestinationHub (local stack)', () => {
  it('FA-1.65: unknown slug → null', async () => {
    expect(await getDestinationHub('nope')).toBeNull()
  })

  it('FA-1.65: active offers only, newest first, with the guides their page shows', async () => {
    const hub = (await getDestinationHub(h.hub.slug))!
    expect(hub.offers.map(o => o.id)).toEqual([P1, P2, P3, P4])
    expect(hub.offers.map(o => o.guides.map(g => g.name))).toEqual([
      ['Gunnar Testguide', 'Freja Testguide'], ['Gunnar Testguide'], [], [],
    ])
  })

  it('FA-1.65: guideCount — distinct active + show_on_page guides of active offers', async () => {
    expect((await getDestinationHub(h.hub.slug))!.guideCount).toBe(2)
  })

  it('FA-1.65: card prices — v2 from experience_prices + fee, v1 via formatPrice', async () => {
    const hub = (await getDestinationHub(h.hub.slug))!
    expect(hub.offers.map(o => o.priceText)).toEqual([
      'from €600 · 1–2 anglers per guide', 'from €450 / person', 'Price on request', 'from NOK 100 / person',
    ])
  })

  it('FA-1.65: priceFrom — dominant currency, on-request and minority-currency offers left out', async () => {
    expect((await getDestinationHub(h.hub.slug))!.priceFrom).toEqual({
      cents: 45_000, currency: 'EUR', text: 'from €450 / person',
    })
  })

  it('FA-1.65: with the v2 flag off the v2 page is priced as v1, as the router would render it', async () => {
    h.env.EXPERIENCE_V2_ENABLED = false
    try {
      const hub = (await getDestinationHub(h.hub.slug))!
      expect(hub.offers[0]!.priceText).toBe('from €100 / person')
    } finally {
      h.env.EXPERIENCE_V2_ENABLED = true
    }
  })

  it('FA-1.65: species — union of active offers, case-insensitive, most offers first', async () => {
    expect((await getDestinationHub(h.hub.slug))!.species).toEqual(['Sea Trout', 'Arctic Char', 'Brown Trout'])
  })

  it('FA-1.65 red case: only the consented AND submitted review appears — the unconsented one is absent', async () => {
    const { reviews } = (await getDestinationHub(h.hub.slug))!
    expect(reviews.map(r => r.id)).toEqual([R1])
    expect(reviews.map(r => r.id)).not.toContain(R2)   // publish_consent = false
    expect(reviews.map(r => r.id)).not.toContain(R3)   // submitted_at is null
    // The card fields only: first name, never the full name, the e-mail or the inquiry id.
    expect(reviews[0]).toEqual({
      id: R1, rating: 5, comment: 'Consented and submitted.', firstName: 'Anna', country: 'DE',
      submittedAt: expect.stringMatching(/^2026-10-10/), photoUrl: null,
    })
    expect(JSON.stringify(reviews)).not.toMatch(/Kowalska|example\.test|f1650000-0000-4000-8000-0000000000(21|22|23)/)
  })

  it('FA-1.65: ogImage and the other hubs', async () => {
    const hub = (await getDestinationHub(h.hub.slug))!
    expect(hub.ogImage).toBeNull()
    expect(hub.otherHubs.map(o => o.slug)).toEqual(['patagonia', 'iceland', 'new-zealand'])
  })
})
