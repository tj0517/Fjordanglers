import { describe, expect, it } from 'vitest'
import { revenueByMonth, type RevenueRow } from './revenue'

const row = (over: Partial<RevenueRow>): RevenueRow => ({
  deposit_paid_at: null,
  offer_deposit_eur: null,
  deposit_amount: null,
  internal_commission_eur: null,
  deal_currency: 'EUR',
  deposit_amount_cents: null,
  deposit_currency: null,
  deposit_eur_rate: null,
  ...over,
})

describe('revenueByMonth (FA-1.35 acceptance criterion 2)', () => {
  it('a row with deposit_paid_at in May and updated_at in September lands in May', () => {
    const withUpdatedAt = { ...row({ deposit_paid_at: '2026-05-15T10:00:00Z', offer_deposit_eur: 100 }), updated_at: '2026-09-01T00:00:00Z' }
    const result = revenueByMonth([withUpdatedAt], 0.92)
    expect(Object.keys(result)).toEqual(['2026-05'])
    expect(result['2026-05']).toEqual({ eur: 100, deals: 1 })
  })

  it('a row without deposit_paid_at lands nowhere', () => {
    const result = revenueByMonth([row({ deposit_paid_at: null, offer_deposit_eur: 500 })], 0.92)
    expect(result).toEqual({})
  })

  it('sums multiple rows in the same month with rowCommissionEur', () => {
    const rows = [
      row({ deposit_paid_at: '2026-06-01T10:00:00Z', offer_deposit_eur: 100 }),
      row({ deposit_paid_at: '2026-06-20T10:00:00Z', offer_deposit_eur: 200, deal_currency: 'USD' }),
    ]
    // 100 EUR + (200 USD * 0.5) = 200 EUR
    const result = revenueByMonth(rows, 0.5)
    expect(result['2026-06']).toEqual({ eur: 200, deals: 2 })
  })
})
