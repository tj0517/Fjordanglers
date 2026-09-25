import { describe, it, expect } from 'vitest'
import { DEPOSIT_PERCENT, depositHintCents, isDepositCurrency } from '../deposit'

describe('depositHintCents', () => {
  it('returns 20% of the option price, rounded to nearest minor unit', () => {
    expect(depositHintCents(100_000)).toBe(20_000) // 1000.00 EUR → 200.00 EUR
    expect(depositHintCents(150_000_000)).toBe(30_000_000) // 1 500 000 ISK ×100 → 300 000 ISK ×100
  })

  it('rounds correctly for non-round values', () => {
    expect(depositHintCents(333)).toBe(67)  // 20% of 333 = 66.6 → rounds to 67
    expect(depositHintCents(100)).toBe(20)  // 20% of 100 = 20
  })

  it('DEPOSIT_PERCENT is 20', () => {
    expect(DEPOSIT_PERCENT).toBe(20)
  })
})

describe('isDepositCurrency', () => {
  it('accepts EUR, USD, ISK, NZD', () => {
    expect(isDepositCurrency('EUR')).toBe(true)
    expect(isDepositCurrency('USD')).toBe(true)
    expect(isDepositCurrency('ISK')).toBe(true)
    expect(isDepositCurrency('NZD')).toBe(true)
  })

  it('rejects lowercase and other currencies', () => {
    expect(isDepositCurrency('eur')).toBe(false)
    expect(isDepositCurrency('NOK')).toBe(false)
    expect(isDepositCurrency('SEK')).toBe(false)
    expect(isDepositCurrency('')).toBe(false)
  })
})
