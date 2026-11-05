/**
 * Two v1 offer pages as the database returns them (FA-1.81, tj D3) — the input of the golden
 * test that proves v1's JSON-LD is byte-identical before and after the shared builder.
 *
 * Rows are the shape `ExperienceV1` reads (`experience_pages.*` and the guide columns it selects);
 * only the columns the JSON-LD touches are filled. Fictional content throughout.
 *
 *   full    — FAQ, location, season, price, guide; one FAQ answer carries `<`, `&` and `"` on purpose,
 *             so the golden records how the current serialization treats them (it does not escape).
 *   request — `price_type: 'request'`, no FAQ, no location, no season, no guide.
 */

export const V1_FULL = {
  slug: 'v1-golden-full',
  page: {
    id: 'a1000000-0000-4000-8000-000000000001',
    slug: 'v1-golden-full',
    status: 'active',
    experience_name: 'Golden Salmon Weekend',
    meta_description: 'Two days on the Laxá with a local guide — salmon and sea-run char.',
    country: 'Iceland',
    region: 'Northeast',
    hero_image_url: 'https://images.example.test/golden-hero.jpg',
    gallery_image_urls: [],
    location_lat: 65.6,
    location_lng: -17.1,
    location_area: 'Laxá valley',
    season_start: '2026-06-01',
    season_end: '2026-09-15',
    price_from: 450,
    currency: 'EUR',
    price_type: 'per_person',
    guide_id: 'b2000000-0000-4000-8000-000000000002',
    trip_id: null,
    faq: [
      { question: 'Do I need a fishing licence?', answer: 'Yes — we arrange the day licence for you.' },
      { question: 'What is included?', answer: 'Tackle <b>included</b> & waders on request: "just ask".' },
    ],
  },
  guide: {
    id: 'b2000000-0000-4000-8000-000000000002',
    full_name: 'Jón Golden',
    slug: 'jon-golden',
    languages: ['English', 'Icelandic'],
  },
}

export const V1_REQUEST = {
  slug: 'v1-golden-request',
  page: {
    id: 'a1000000-0000-4000-8000-000000000003',
    slug: 'v1-golden-request',
    status: 'active',
    experience_name: 'Request-only Char Trip',
    meta_description: null,
    country: 'Norway',
    region: 'Finnmark',
    hero_image_url: null,
    gallery_image_urls: [],
    location_lat: null,
    location_lng: null,
    location_area: null,
    season_start: null,
    season_end: null,
    price_from: 0,
    currency: 'NOK',
    price_type: 'request',
    guide_id: null,
    trip_id: null,
    faq: null,
  },
  guide: null,
}

export type V1Fixture = typeof V1_FULL | typeof V1_REQUEST
