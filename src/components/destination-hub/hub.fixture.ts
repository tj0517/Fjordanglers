/**
 * Fixture hubs for the country-hub view tests (FA-1.65). Props only — nothing here reads or
 * writes the database, and nothing is added to `DESTINATION_HUBS` (every entry there is a
 * public page on prod).
 */

import type { DestinationHubData, HubOffer } from '@/lib/supabase/queries'

export const offer = (over: Partial<HubOffer> & { id: string }): HubOffer => ({
  page: {
    slug: `slug-${over.id}`, experience_name: `Trip ${over.id}`, country: 'New Zealand', region: 'Otago',
    price_from: 600, price_type: 'per_person', currency: 'NZD',
    hero_image_url: null, gallery_image_urls: [], difficulty: null, non_angler_friendly: null,
  },
  priceText:     'from NZ$1,320 · 1–2 anglers per guide',
  targetSpecies: [],
  locationLat:   null,
  locationLng:   null,
  guides:        [],
  ...over,
})

const OFFERS: HubOffer[] = [
  offer({
    id: 'a', targetSpecies: ['Brown Trout', 'Rainbow Trout'],
    guides: [{ name: 'Josh Fixture', avatarUrl: null }, { name: 'Second Fixture', avatarUrl: null }],
  }),
  offer({
    id: 'b', targetSpecies: ['rainbow trout', 'Kingfish'], priceText: 'from NZ$1,560 · 1–2 anglers per guide',
    guides: [{ name: 'Kristina Fixture', avatarUrl: null }],
  }),
  offer({ id: 'c', targetSpecies: [], priceText: 'Price on request' }),
]

const BASE_HUB: DestinationHubData['hub'] = {
  slug: 'fixture-hub', group: 'New Zealand', h1: 'Fixture Fly Fishing Trips',
  intro: 'Fixture intro text.', metaTitle: 'Fixture', metaDescription: 'Fixture',
}

/** Every editorial field filled, reviews present — all nine sections. */
export const completeHub = (): DestinationHubData => ({
  hub: {
    ...BASE_HUB,
    seasonMonths: [10, 11, 12, 1, 2, 3, 4],
    peakMonths:   [12, 1, 2],
    seasonNote:   'Fixture season note.',
    species:      [],
    faq:          [{ question: 'Fixture question?', answer: 'Fixture answer.' }],
    heroQuote:    { text: 'Fixture quote.', author: 'Fixture Author', country: 'Fixtureland' },
    proofNote:    'gear included',
    contact:      { name: 'Fixture Founder', email: 'fixture@example.com', whatsapp: '+48 000 000 000' },
  },
  offers:     OFFERS,
  guideCount: 3,
  priceFrom:  { cents: 132_000, currency: 'NZD', text: 'from NZ$1,320 · 1–2 anglers per guide' },
  species:    ['Rainbow Trout', 'Brown Trout', 'Kingfish'],
  reviews: [
    { id: 'r1', rating: 5, comment: 'Fixture review.', firstName: 'Ann', country: 'DE', submittedAt: '2026-03-01T00:00:00Z', photoUrl: null },
  ],
  ogImage:   null,
  otherHubs: [{ slug: 'iceland', h1: 'Iceland Fly Fishing Trips' }, { slug: 'patagonia', h1: 'Patagonia Fly Fishing Trips' }],
})

/** No faq, reviews, season, species or contact — what a hub looks like before tj writes it. */
export const emptyHub = (): DestinationHubData => ({
  hub: { ...BASE_HUB, seasonMonths: [], peakMonths: [], species: [], faq: [] },
  offers:     OFFERS,
  guideCount: 2,
  priceFrom:  null,
  species:    [],
  reviews:    [],
  ogImage:    null,
  otherHubs:  [{ slug: 'iceland', h1: 'Iceland Fly Fishing Trips' }],
})

/** FA-1.66 — gives the offers with these ids coordinates (Otago-ish), the rest stay without. */
export const withCoordinates = (data: DestinationHubData, ids: string[]): DestinationHubData => ({
  ...data,
  offers: data.offers.map((o, i) => ids.includes(o.id) ? { ...o, locationLat: -44.7 + i, locationLng: 169.1 + i } : o),
})
