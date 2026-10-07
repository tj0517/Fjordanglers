/**
 * Shared fixtures for the v2 offer page (FA-1.54, extended for S10–S14 in FA-1.55).
 *
 * They mirror the seed's two v2 pages (supabase/seed.sql): NZ `fixed` with its
 * (1d×1, 1d×2, 2d×2) price rows at a 20% fee, Iceland `custom` with a stored range. The seed
 * carries no content for S5/S6, no archetypes and nothing for S10–S14, so those fields are
 * filled here as props — nothing here reads or writes the database.
 */

import type { ExperienceV2 } from '@/lib/supabase/queries'

export const guide = (over: Partial<ExperienceV2['guides'][number]> = {}): ExperienceV2['guides'][number] => ({
  id: 'g1', slug: 'g1', fullName: 'Alex Rivers', avatarUrl: null, yearsExperience: 11,
  association: 'NZPFGA', responseTimeHours: 24, googleRating: 4.9, googleReviewCount: 31,
  googleProfileUrl: null, languages: ['English'], bio: 'Grew up on the Mataura.',
  balancePaymentMethod: 'cash', isPrimary: true, ...over,
})

export const fixedPage = (over: Partial<ExperienceV2> = {}): ExperienceV2 => ({
  id: 'p1', slug: 'seed-nz', experienceName: 'Seed Backcountry Day', introText: null,
  country: 'New Zealand', region: 'Otago', heroImageUrl: null, galleryImageUrls: [],
  includes: ['Guide service', 'Lunch on the river'], excludes: ['Flights and lodging'],
  speciesNames: ['Brown trout'], technique: ['Sight-fishing'],
  meetingPointName: 'Your lodge', meetingPointDescription: 'Pick-up 7:30',
  walkingKmMin: 6, walkingKmMax: 12,
  license: { required: true, buyUrl: 'https://fishandgame.example/licence', buyText: null, priceText: 'NZ$30', steps: [] },
  tipGuidanceText: 'Customary 10%',
  suitedFor: ['you cast 12–15 m in wind'], notSuitedFor: ['you are a complete beginner'],
  expectationsText: 'No promise of a big fish.',
  daySchedule: [
    { time: '7:30', title: 'Pick-up', metaLines: [] },
    { time: '9:00', title: 'Fishing', metaLines: ['45 min drive', '3 km on foot'] },
  ],
  weatherPolicyText: 'Unsafe conditions: free reschedule.', offerEtaText: 'within 48–72 h',
  seasonMonths: [10, 11, 12, 1, 2, 3, 4], peakMonths: [12, 1, 2],
  skillLevel: 3, minDays: 1, maxDays: 3, maxAnglersPerGuide: 2,
  responseSlaHours: 24, offerMode: 'fixed', feePct: 0.2, currency: 'NZD',
  priceFromCents: 65000, priceToCents: null,
  locationLat: -44.7, locationLng: 169.1, nearestAirport: 'Queenstown (ZQN), 1 h from Wanaka',
  suggestedLodging: [
    { name: 'Wanaka Lakeside', url: 'https://lodging.example/wanaka', note: '20 min from the meeting point' },
    { name: 'Queenstown town centre', url: null, note: null },
  ],
  whatToBring: ['Polarised sunglasses', 'Layers — wind and sun the same day'],
  faq: [
    { question: 'How do I buy the fishing licence?', answer: 'Online, the evening before.' },
    { question: 'What if the river is muddy?', answer: 'Your guide moves you to a plan-B water.' },
  ],
  metaTitle: null, metaDescription: null,
  reviews: [],
  guides: [guide()],
  prices: [
    { days: 1, anglers: 1, guidePriceCents: 90000,  currency: 'NZD' },
    { days: 1, anglers: 2, guidePriceCents: 125000, currency: 'NZD' },
    { days: 2, anglers: 2, guidePriceCents: 240000, currency: 'NZD' },
  ],
  options: [
    { id: 'o1', kind: 'addon', label: 'Extra day', priceFromCents: 60000, priceToCents: null,
      currency: 'NZD', durationDaysMin: null, durationDaysMax: null, description: null, sampleItinerary: [] },
  ],
  ...over,
})

export const customPage = (over: Partial<ExperienceV2> = {}): ExperienceV2 => fixedPage({
  offerMode: 'custom', currency: 'EUR', prices: [], daySchedule: [],
  priceFromCents: 45050, priceToCents: 320000, minDays: 3, maxDays: 7,
  options: [
    { id: 'a1', kind: 'archetype', label: 'Day trip from Reykjavik', priceFromCents: 45050, priceToCents: null,
      currency: 'EUR', durationDaysMin: 1, durationDaysMax: 1, description: 'One day on the river.',
      sampleItinerary: [{ day: 1, title: 'River Ytri', details: [{ label: 'Meals', value: 'Lunch' }] }] },
    { id: 'a2', kind: 'archetype', label: 'Lodge week', priceFromCents: 320000, priceToCents: null,
      currency: 'EUR', durationDaysMin: 7, durationDaysMax: 7, description: null,
      sampleItinerary: [{ day: 1, title: 'Arrival', details: [] }, { day: 2, title: 'Beat 3', details: [] }] },
  ],
  ...over,
})
