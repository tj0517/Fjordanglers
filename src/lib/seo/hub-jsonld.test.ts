import { describe, it, expect } from 'vitest'
import { buildHubJsonLd, hubCrumbName } from './hub-jsonld'
import { serializeJsonLd } from './offer-jsonld'
import type { DestinationHub } from '@/lib/destinations'

const SITE = 'https://example.test'

const hub = (over: Partial<DestinationHub> = {}): DestinationHub => ({
  slug: 'norway', group: 'Nordic', countries: ['Norway'],
  h1: 'Guided Fishing Trips in Norway', intro: 'i', metaTitle: 't', metaDescription: 'd',
  ...over,
})

const offers = [
  { page: { slug: 'a', experience_name: 'Offer A', hero_image_url: 'https://img.test/a.jpg' } },
  { page: { slug: 'b', experience_name: 'Offer B', hero_image_url: null } },
]

describe('buildHubJsonLd (FA-1.82)', () => {
  it('always emits ItemList and BreadcrumbList (Home → hub)', () => {
    const ld = buildHubJsonLd({ hub: hub(), offers }, SITE)
    expect(ld.itemList['@type']).toBe('ItemList')
    expect(ld.itemList.numberOfItems).toBe(2)
    expect(ld.breadcrumb['@type']).toBe('BreadcrumbList')
    expect(ld.breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Norway', item: `${SITE}/norway` },
    ])
  })

  it('FAQPage only when the hub has FAQ', () => {
    expect(buildHubJsonLd({ hub: hub(), offers }, SITE).faq).toBeNull()
    expect(buildHubJsonLd({ hub: hub({ faq: [] }), offers }, SITE).faq).toBeNull()
    const ld = buildHubJsonLd({ hub: hub({ faq: [{ question: 'Q1?', answer: 'A1.' }] }), offers }, SITE)
    expect(ld.faq).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1.' } }],
    })
  })

  it('a hub with no offers still emits an (empty) ItemList and the breadcrumb', () => {
    const ld = buildHubJsonLd({ hub: hub(), offers: [] }, SITE)
    expect(ld.itemList.numberOfItems).toBe(0)
    expect(ld.breadcrumb).toBeDefined()
  })

  it('FAQ text cannot close the script tag', () => {
    const ld = buildHubJsonLd({ hub: hub({ faq: [{ question: 'Q?', answer: '</script><b>x</b> & y' }] }), offers }, SITE)
    const text = serializeJsonLd(ld.faq!)
    expect(text).not.toContain('</script>')
    expect(JSON.parse(text).mainEntity[0].acceptedAnswer.text).toBe('</script><b>x</b> & y')
  })
})

describe('hubCrumbName', () => {
  it('is the country for a single-country hub and the region otherwise', () => {
    expect(hubCrumbName({ group: 'Nordic', countries: ['Iceland'] })).toBe('Iceland')
    expect(hubCrumbName({ group: 'Patagonia' })).toBe('Patagonia')
    expect(hubCrumbName({ group: 'New Zealand' })).toBe('New Zealand')
  })
})
