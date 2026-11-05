/**
 * Structured data (schema.org JSON-LD) of an offer page — one builder for template v1 and v2 (FA-1.81).
 *
 * Pure: plain data in, plain objects out. It never queries anything (CLAUDE.md rule 3) and never
 * sees a price in anything but a number the caller already decided to publish. Each template maps
 * its own rows to `OfferJsonLdInput`; what differs between them (which price to show, which parent
 * breadcrumb) is the caller's decision, what is shared is the shape, the key order and the `@type`s.
 *
 * Key order matters here: v1's output is pinned byte-for-byte by a golden fixture
 * (`experiences/[slug]/__tests__/__golden__/`), so the object literals below list keys in the order
 * the v1 page always emitted them.
 *
 * Money: prices are integer minor units in code (CLAUDE.md rule 6). `amountFromCents` is the one
 * place a decimal number is made, because schema.org wants "450.50", not 45050 — it divides, it
 * does not do arithmetic on a price.
 */

import type { Json } from '@/lib/supabase/database.types'

/** A price already decided for publication, as the decimal amount schema.org wants. */
export type OfferPrice =
  | { kind: 'single'; amount: number; currency: string }
  | { kind: 'range';  low: number; high: number; currency: string }

export interface OfferJsonLdInput {
  siteUrl: string
  slug:    string
  name:        string
  description: string
  imageUrl:    string | null
  /** `name` is `Json` because v1 reads it from a jsonb column and has always emitted it as stored. */
  location:    { name: Json; lat: number; lng: number; country: string; region: string } | null
  /** `start/end` in the form the page stores it, e.g. "2026-06-01/2026-09-15". */
  temporalCoverage: string | null
  /** Null → the page says "on request" and no `offers` is emitted. */
  price: OfferPrice | null
  guide: { name: string; slug: string | null; id: string } | null
  /** The crumb between Home and the offer: the destination hub, or "Trips". */
  parentCrumb: { label: string; url: string }
  /** Empty → no FAQPage. */
  faq: readonly { question: string; answer: string }[]
}

export interface OfferJsonLd {
  trip:       Record<string, unknown>
  breadcrumb: Record<string, unknown>
  faq:        Record<string, unknown> | null
}

/** Integer minor units → the decimal amount of a schema.org price (45050 → 450.5). */
export function amountFromCents(cents: number): number {
  return cents / 100
}

/** The text that goes between `<script type="application/ld+json">` tags. One place to change how it is serialised. */
export function serializeJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema)
}

function offersOf(price: OfferPrice, siteUrl: string, url: string): Record<string, unknown> {
  const seller = { '@type': 'Organization', name: 'FjordAnglers', url: siteUrl }
  const tail = { priceCurrency: price.currency, availability: 'https://schema.org/InStock', url, seller }

  return price.kind === 'single'
    ? { '@type': 'Offer', price: price.amount, ...tail }
    : { '@type': 'AggregateOffer', lowPrice: price.low, highPrice: price.high, ...tail }
}

export function buildOfferJsonLd(input: OfferJsonLdInput): OfferJsonLd {
  const { siteUrl, name } = input
  const url = `${siteUrl}/experiences/${input.slug}`
  const faOrg = { '@type': 'Organization', name: 'FjordAnglers', url: siteUrl }

  const trip = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    description: input.description,
    ...(input.imageUrl != null ? { image: input.imageUrl } : {}),
    url,
    touristType: ['Fishing', 'Outdoor Activity'],
    ...(input.location != null ? {
      location: {
        '@type': 'Place',
        name: input.location.name,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: input.location.lat,
          longitude: input.location.lng,
        },
        address: {
          '@type': 'PostalAddress',
          addressCountry: input.location.country,
          addressRegion: input.location.region,
        },
      },
    } : {}),
    ...(input.temporalCoverage != null ? { temporalCoverage: input.temporalCoverage } : {}),
    ...(input.price != null ? { offers: offersOf(input.price, siteUrl, url) } : {}),
    provider: faOrg,
    ...(input.guide != null ? {
      subjectOf: {
        '@type': 'Person',
        name: input.guide.name,
        url: `${siteUrl}/guides/${input.guide.slug ?? input.guide.id}`,
      },
    } : {}),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: input.parentCrumb.label, item: input.parentCrumb.url },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  }

  // FAQPage retained for AI/LLM citation benefit only.
  // Google ended FAQ rich results for all sites on May 7, 2026 — no SERP feature is rendered.
  const faq = input.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: input.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null

  return { trip, breadcrumb, faq }
}
