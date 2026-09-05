import { describe, it, expect } from 'vitest'
import { formatPrice } from './format-price'

describe('formatPrice', () => {
  it('USD / per_person', () => {
    expect(formatPrice({ priceFrom: 550, priceType: 'per_person', currency: 'USD' })).toBe('from $550 / person')
  })

  it('USD / flat', () => {
    expect(formatPrice({ priceFrom: 550, priceType: 'flat', currency: 'USD' })).toBe('from $550 per trip')
  })

  it('EUR / request', () => {
    expect(formatPrice({ priceFrom: 800, priceType: 'request', currency: 'EUR' })).toBe('Price on request')
  })

  it('unknown currency never falls back to €', () => {
    const result = formatPrice({ priceFrom: 550, priceType: 'flat', currency: 'XXX' })
    expect(result).toContain('XXX 550')
    expect(result).not.toContain('€')
  })
})
