import { describe, it, expect } from 'vitest'
import { listingCanonicalUrl } from './listing-canonical'

const TRIPS = 'https://www.fjordanglers.com/trips'

describe('listingCanonicalUrl', () => {
  it('page 1, no page and garbage pages → the bare listing', () => {
    for (const page of [undefined, '1', '0', '-3', 'abc', '2.5', '', ['2', '3']]) {
      expect(listingCanonicalUrl(TRIPS, page, [undefined]), String(page)).toBe(TRIPS)
    }
  })

  it('page N ≥ 2 → itself, normalised', () => {
    expect(listingCanonicalUrl(TRIPS, '2', [undefined])).toBe(`${TRIPS}?page=2`)
    expect(listingCanonicalUrl(TRIPS, '02', [undefined])).toBe(`${TRIPS}?page=2`)
    expect(listingCanonicalUrl(TRIPS, '17', [undefined, ''])).toBe(`${TRIPS}?page=17`)
  })

  it('any filter → the bare listing, with or without a page', () => {
    expect(listingCanonicalUrl(TRIPS, undefined, ['Norway'])).toBe(TRIPS)
    expect(listingCanonicalUrl(TRIPS, '2', ['Norway'])).toBe(TRIPS)
    expect(listingCanonicalUrl(TRIPS, '2', [undefined, 'en'])).toBe(TRIPS)
    expect(listingCanonicalUrl(TRIPS, '2', [['Norway', 'Sweden']])).toBe(TRIPS)
  })

  it('an empty filter value is not a filter (the page ignores it too)', () => {
    expect(listingCanonicalUrl(TRIPS, '2', [''])).toBe(`${TRIPS}?page=2`)
  })
})
