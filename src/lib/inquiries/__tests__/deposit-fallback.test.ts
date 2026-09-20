/**
 * deposit-fallback unit tests — FA-1.09
 *
 * The fallback only runs when offer_deposit_eur is empty. It must never produce a
 * number from a price on request or from a non-EUR price (Stripe line item is EUR).
 */

import { describe, it, expect } from 'vitest'
import { computeFallbackDepositCents } from '../deposit-fallback'

const eur = (priceFrom: number, priceType: string) => ({ priceFrom, priceType, currency: 'EUR' })

describe('computeFallbackDepositCents — amounts', () => {
  it('per_person EUR: price × party size × deposit %', () => {
    expect(computeFallbackDepositCents(eur(200, 'per_person'), 3, 30)).toEqual({ ok: true, cents: 18000 })
  })

  it('flat EUR: price × deposit %, party size is NOT multiplied', () => {
    expect(computeFallbackDepositCents(eur(1500, 'flat'), 4, 30)).toEqual({ ok: true, cents: 45000 })
    expect(computeFallbackDepositCents(eur(1500, 'flat'), 1, 30)).toEqual({ ok: true, cents: 45000 })
  })

  it('flat ignores a bad party size', () => {
    expect(computeFallbackDepositCents(eur(1500, 'flat'), 0, 30)).toEqual({ ok: true, cents: 45000 })
  })

  it('rounds to an integer number of cents for a fractional price', () => {
    const r = computeFallbackDepositCents(eur(199.99, 'per_person'), 3, 33)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Number.isInteger(r.cents)).toBe(true)
  })
})

describe('computeFallbackDepositCents — red proof: refuses instead of guessing', () => {
  it('price on request returns an error and no amount', () => {
    const r = computeFallbackDepositCents(eur(200, 'request'), 3, 30)
    expect(r.ok).toBe(false)
    expect(r).not.toHaveProperty('cents')
  })

  it.each(['NZD', 'USD'])('%s price returns an error and no amount (never converted)', currency => {
    for (const priceType of ['flat', 'per_person']) {
      const r = computeFallbackDepositCents({ priceFrom: 500, priceType, currency }, 2, 30)
      expect(r.ok).toBe(false)
      expect(r).not.toHaveProperty('cents')
      if (!r.ok) expect(r.error).toContain(currency)
    }
  })

  it('a request price in a foreign currency is still refused', () => {
    const r = computeFallbackDepositCents({ priceFrom: 500, priceType: 'request', currency: 'NZD' }, 2, 30)
    expect(r.ok).toBe(false)
    expect(r).not.toHaveProperty('cents')
  })
})

describe('computeFallbackDepositCents — other refusals', () => {
  it('null experience returns an error', () => {
    const r = computeFallbackDepositCents(null, 2, 30)
    expect(r).toEqual({ ok: false, error: 'No offer deposit set — save an offer first' })
  })

  it('unknown price type returns an error', () => {
    const r = computeFallbackDepositCents(eur(200, 'per_night'), 2, 30)
    expect(r.ok).toBe(false)
    expect(r).not.toHaveProperty('cents')
  })

  it('price 0 (or negative) returns an error', () => {
    expect(computeFallbackDepositCents(eur(0, 'flat'), 2, 30).ok).toBe(false)
    expect(computeFallbackDepositCents(eur(-10, 'per_person'), 2, 30).ok).toBe(false)
  })

  it('per_person with a party size below 1 or not finite returns an error', () => {
    expect(computeFallbackDepositCents(eur(200, 'per_person'), 0, 30).ok).toBe(false)
    expect(computeFallbackDepositCents(eur(200, 'per_person'), Number.NaN, 30).ok).toBe(false)
  })

  it('a deposit percentage that is not a positive number returns an error', () => {
    expect(computeFallbackDepositCents(eur(200, 'flat'), 2, Number.NaN).ok).toBe(false)
    expect(computeFallbackDepositCents(eur(200, 'flat'), 2, 0).ok).toBe(false)
  })
})
