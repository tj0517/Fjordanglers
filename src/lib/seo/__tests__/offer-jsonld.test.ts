/**
 * FA-1.81 — the shared JSON-LD builder and serializer.
 *
 * Text in a JSON-LD block comes from the database (offer names, FAQ answers) and is inlined in
 * `<script type="application/ld+json">`. A `</script>` in it must not be able to close that tag,
 * so the serializer writes `<`, `>` and `&` as \u003c, \u003e, \u0026 — which JSON.parse reads back as
 * the very same characters (tj decision C, 2026-11-05).
 */

import { describe, it, expect } from 'vitest'
import { buildOfferJsonLd, serializeJsonLd, type OfferJsonLdInput } from '../offer-jsonld'

const HOSTILE = 'Bring a rod.</script><script>alert(1)</script> Tom & Jerry <b>bold</b>'

const input = (over: Partial<OfferJsonLdInput> = {}): OfferJsonLdInput => ({
  siteUrl: 'https://www.fjordanglers.com',
  slug: 'escape-fixture',
  name: 'Escape fixture',
  description: 'Fixture.',
  imageUrl: null,
  location: null,
  temporalCoverage: null,
  price: null,
  guide: null,
  parentCrumb: { label: 'Trips', url: 'https://www.fjordanglers.com/trips' },
  faq: [{ question: 'Is it safe?', answer: HOSTILE }],
  ...over,
})

describe('serializeJsonLd — a </script> in the content cannot close the tag', () => {
  it('FAQ answer containing </script> → no raw < > & in the output', () => {
    const { faq } = buildOfferJsonLd(input())

    const out = serializeJsonLd(faq!)

    expect(out).not.toMatch(/[<>&]/)
    expect(out).not.toContain('</script')
    expect(out).toContain('\\u003c/script\\u003e')
  })

  it('inlined in a script tag, the block ends exactly where the page ends it', () => {
    const { faq } = buildOfferJsonLd(input())

    const html = `<script type="application/ld+json">${serializeJsonLd(faq!)}</script>`

    expect(html.split('</script>')).toHaveLength(2) // one closing tag: the page's own
  })

  it('what a parser reads back is the original content, character for character', () => {
    const { faq } = buildOfferJsonLd(input())

    expect(JSON.parse(serializeJsonLd(faq!))).toEqual(faq)
    expect(JSON.stringify(JSON.parse(serializeJsonLd(faq!)))).toContain('</script><script>alert(1)</script>')
  })

  it('the offer name and the trip description are escaped as well', () => {
    const { trip, breadcrumb } = buildOfferJsonLd(input({ name: 'A <i>& B</i>', description: HOSTILE }))

    for (const block of [trip, breadcrumb]) expect(serializeJsonLd(block)).not.toMatch(/[<>&]/)
    expect(JSON.parse(serializeJsonLd(trip))).toEqual(trip)
  })

  it('plain content is untouched (no escape where there is nothing to escape)', () => {
    const { breadcrumb } = buildOfferJsonLd(input({ name: 'Plain Salmon Day' }))

    expect(serializeJsonLd(breadcrumb)).toBe(JSON.stringify(breadcrumb))
  })
})
