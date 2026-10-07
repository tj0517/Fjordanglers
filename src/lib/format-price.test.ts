import { describe, it, expect } from 'vitest'
import { formatPrice, formatCents } from './format-price'

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

describe('formatCents', () => {
  it('prints a round amount without cents', () => {
    expect(formatCents(150_000, 'NZD')).toBe('NZ$1,500')
  })

  it('keeps the cents when there are any', () => {
    expect(formatCents(45_050, 'EUR')).toBe('€450.50')
  })

  it('uses the shared currency symbols, and leaves an unknown code as-is', () => {
    expect(formatCents(100_000, 'USD')).toBe('$1,000')
    expect(formatCents(100_000, 'ISK')).toBe('ISK 1,000')
    expect(formatCents(100_000, 'XYZ')).toBe('XYZ 1,000')
  })

  it('zero is a number, not an empty string', () => {
    expect(formatCents(0, 'EUR')).toBe('€0')
  })
})
