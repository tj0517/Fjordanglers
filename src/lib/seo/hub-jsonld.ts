/**
 * Structured data of a country hub (FA-1.82): the `ItemList` of its offers it always emitted,
 * plus a `BreadcrumbList` (Home → hub) on every hub and a `FAQPage` when the hub has FAQ.
 *
 * Pure, like `offer-jsonld.ts` — plain data in, plain objects out, nothing queried. Serialise
 * with `serializeJsonLd` (FAQ text is editorial copy, but the rule is one rule: never a bare
 * `JSON.stringify` between script tags).
 */

import type { DestinationHub } from '@/lib/destinations'

export type HubJsonLdOffer = {
  page: { slug: string; experience_name: string; hero_image_url: string | null }
}

export interface HubJsonLd {
  itemList:   Record<string, unknown>
  breadcrumb: Record<string, unknown>
  /** Null when the hub has no FAQ — an empty FAQPage is invalid markup. */
  faq:        Record<string, unknown> | null
}

/** The short name of a hub for a breadcrumb: its country, or its region when it spans several. */
export function hubCrumbName(hub: Pick<DestinationHub, 'group' | 'countries'>): string {
  return hub.countries != null && hub.countries.length === 1 ? hub.countries[0] : hub.group
}

export function buildHubJsonLd(
  input: { hub: DestinationHub; offers: readonly HubJsonLdOffer[] },
  siteUrl: string,
): HubJsonLd {
  const { hub, offers } = input

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: hub.h1,
    numberOfItems: offers.length,
    itemListElement: offers.map((offer, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'TouristTrip',
        name: offer.page.experience_name,
        url: `${siteUrl}/experiences/${offer.page.slug}`,
        ...(offer.page.hero_image_url != null ? { image: offer.page.hero_image_url } : {}),
      },
    })),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: hubCrumbName(hub), item: `${siteUrl}/${hub.slug}` },
    ],
  }

  const faq = hub.faq ?? []

  return {
    itemList,
    breadcrumb,
    faq: faq.length === 0 ? null : {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(entry => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
  }
}
