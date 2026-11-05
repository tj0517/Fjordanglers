/**
 * Offer-page v2 → structured data (FA-1.81). Maps `ExperienceV2` to the shared builder's input;
 * the shape itself lives in `offer-jsonld.ts` and is the same one v1 emits.
 *
 * Pure: the page arrives already loaded, nothing here queries anything (CLAUDE.md rule 3).
 *
 * The price published is the price the page shows (tj D1, 2026-11-05):
 *   - `fixed`  — the "from" total of the widget, FA fee included (`fromPrice`, the same call
 *                that feeds the inquiry form's `fromTotalCents`). No usable price rows → no `offers`,
 *                the page says "on request".
 *   - `custom` — the stored range exactly as the page prints it (`customRange`, no fee added —
 *                what the range means is FA-1.50): an `AggregateOffer` when both ends exist, an
 *                `Offer` with the lower bound when only that exists, nothing when there is none.
 * Guide price overrides are already folded into `page.prices` server-side and are never emitted
 * as such — only the resulting "from" number the visitor sees.
 */

import type { ExperienceV2 } from '@/lib/supabase/queries'
import { customRange, fromPrice, type Money } from '@/lib/pricing/experience-price'
import { getHubForSlug, getHubSlugForCountry } from '@/lib/destinations'
import { SITE_URL } from '@/lib/site'
import {
  amountFromCents,
  buildOfferJsonLd,
  type OfferJsonLd,
  type OfferPrice,
} from './offer-jsonld'

type V2Page = Pick<
  ExperienceV2,
  | 'slug' | 'experienceName' | 'metaDescription' | 'country' | 'region' | 'heroImageUrl'
  | 'locationLat' | 'locationLng' | 'offerMode' | 'prices' | 'feePct' | 'maxAnglersPerGuide'
  | 'priceFromCents' | 'priceToCents' | 'currency' | 'guides' | 'faq' | 'responseSlaHours'
>

/** The "from" price of a `fixed` page (FA fee included) — null for `custom` pages and for pages with no usable rows. */
export function v2FromPrice(page: Pick<V2Page, 'offerMode' | 'prices' | 'feePct' | 'maxAnglersPerGuide'>): Money | null {
  if (page.offerMode !== 'fixed') return null
  return fromPrice({ prices: page.prices, feePct: page.feePct, maxAnglersPerGuide: page.maxAnglersPerGuide })
}

/** The price to publish, or null when the page itself shows none. */
function v2OfferPrice(page: V2Page): OfferPrice | null {
  if (page.offerMode === 'fixed') {
    const from = v2FromPrice(page)
    return from == null ? null : { kind: 'single', amount: amountFromCents(from.totalCents), currency: from.currency }
  }

  const range = customRange(page.priceFromCents, page.priceToCents, page.currency)
  if (range == null) return null
  return range.toCents == null
    ? { kind: 'single', amount: amountFromCents(range.fromCents), currency: range.currency }
    : { kind: 'range', low: amountFromCents(range.fromCents), high: amountFromCents(range.toCents), currency: range.currency }
}

/**
 * Home → hub → offer when a hub covers the country (labelled with the hub's own `h1`, tj D2,
 * 2026-11-05); Home → Trips → offer otherwise, as v1 does.
 */
function v2ParentCrumb(country: string): { label: string; url: string } {
  const hubSlug = getHubSlugForCountry(country)
  const hub = hubSlug != null ? getHubForSlug(hubSlug) : undefined

  return hub != null
    ? { label: hub.h1, url: `${SITE_URL}/${hub.slug}` }
    : { label: 'Trips', url: `${SITE_URL}/trips` }
}

/** The description of a v2 page: its own, or the standard line — used by the metadata and the JSON-LD alike. */
export function v2Description(page: Pick<V2Page, 'metaDescription' | 'region' | 'country' | 'responseSlaHours'>): string {
  return page.metaDescription
    ?? `Guided fishing in ${page.region}, ${page.country}. Free inquiry, answer within ${page.responseSlaHours} h, deposit only after you accept the offer.`
}

/** `slug` is the canonical slug the page is rendered under (a retired alias has already been redirected). */
export function v2OfferJsonLd(page: V2Page, slug: string): OfferJsonLd {
  const primary = page.guides.find(g => g.isPrimary) ?? page.guides[0] ?? null

  return buildOfferJsonLd({
    siteUrl:     SITE_URL,
    slug,
    name:        page.experienceName,
    description: v2Description(page),
    imageUrl:    page.heroImageUrl,
    location: page.locationLat != null && page.locationLng != null
      ? {
          name:    `${page.region}, ${page.country}`,
          lat:     page.locationLat,
          lng:     page.locationLng,
          country: page.country,
          region:  page.region,
        }
      : null,
    // v2 stores months, not a date range — nothing to publish without inventing one (docs/deferred-tasks.md, FA-1.81).
    temporalCoverage: null,
    price:       v2OfferPrice(page),
    guide:       primary != null ? { name: primary.fullName, slug: primary.slug, id: primary.id } : null,
    parentCrumb: v2ParentCrumb(page.country),
    faq:         page.faq,
  })
}
