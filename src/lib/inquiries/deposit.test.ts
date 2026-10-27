/**
 * FA-1.74 — depositSetFromOldPrice: the accepted option's price moved after the
 * deposit amount was saved.
 */
import { describe, it, expect } from 'vitest'
import { depositSetFromOldPrice } from './deposit'

const accepted = { id: 'opt-1', price_cents: 320000, currency: 'eur' }
const deposit = { type: 'deposit.amount_set', payload: { amount_cents: 60000, currency: 'EUR' } }
const edit = (fromCents: number, toCents: number) => ({
  type:    'offer.updated',
  payload: {
    offer_id: 'off-1',
    before:   [{ id: 'opt-1', label: '3 days', price_cents: fromCents, currency: 'eur' }],
    after:    [{ id: 'opt-1', label: '3 days', price_cents: toCents, currency: 'eur' }],
  },
})

describe('depositSetFromOldPrice', () => {
  it('no deposit saved → false', () => {
    expect(depositSetFromOldPrice([edit(300000, 320000)], accepted)).toBe(false)
  })

  it('price edited before the deposit was saved → false', () => {
    expect(depositSetFromOldPrice([edit(300000, 320000), deposit], accepted)).toBe(false)
  })

  it('price edited after the deposit was saved → true', () => {
    expect(depositSetFromOldPrice([deposit, edit(300000, 320000)], accepted)).toBe(true)
  })

  it('edited and set back to the deposit-time price → false', () => {
    expect(depositSetFromOldPrice([deposit, edit(320000, 350000), edit(350000, 320000)], accepted)).toBe(false)
  })

  it('deposit saved again after the edit → false', () => {
    expect(depositSetFromOldPrice([deposit, edit(300000, 320000), deposit], accepted)).toBe(false)
  })

  it('currency changed after the deposit → true', () => {
    expect(depositSetFromOldPrice([deposit, edit(320000, 320000)], { ...accepted, currency: 'usd' })).toBe(true)
  })

  it('an edit that only touched another option → false', () => {
    const other = {
      type:    'offer.updated',
      payload: {
        before: [{ id: 'opt-1', price_cents: 320000, currency: 'eur' }, { id: 'opt-2', price_cents: 1, currency: 'eur' }],
        after:  [{ id: 'opt-1', price_cents: 320000, currency: 'eur' }, { id: 'opt-2', price_cents: 2, currency: 'eur' }],
      },
    }
    expect(depositSetFromOldPrice([deposit, other], accepted)).toBe(false)
  })
})
