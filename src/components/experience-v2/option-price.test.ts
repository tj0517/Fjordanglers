import { describe, it, expect } from 'vitest'
import { optionPriceText, durationText } from './option-price'

describe('optionPriceText', () => {
  it('says "from" when only the lower end is stored', () => {
    expect(optionPriceText(60000, null, 'NZD')).toBe('from NZ$600')
  })
  it('prints a range when both ends differ, and "from" when they are equal', () => {
    expect(optionPriceText(45050, 320000, 'EUR')).toBe('€450.50–€3,200')
    expect(optionPriceText(60000, 60000, 'NZD')).toBe('from NZ$600')
  })
  it('is null without a price', () => {
    expect(optionPriceText(null, 100, 'EUR')).toBeNull()
  })
})

describe('durationText', () => {
  it.each([
    [1, 1, '1 day'], [7, 7, '7 days'], [3, 5, '3–5 days'], [2, null, '2 days'], [null, 4, '4 days'],
  ])('%s–%s → %s', (min, max, expected) => {
    expect(durationText(min, max)).toBe(expected)
  })
  it('is null when neither end is stored', () => {
    expect(durationText(null, null)).toBeNull()
  })
})
