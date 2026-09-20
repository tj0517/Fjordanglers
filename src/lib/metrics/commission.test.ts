// PERMANENT shared helper — see commission.ts header.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FX_RATES,
  commissionEur,
  commissionPln,
  parseFxRates,
  rowCommissionEur,
  type CommissionRow,
} from './commission'

const row = (over: Partial<CommissionRow>): CommissionRow => ({
  offer_deposit_eur: null,
  deposit_amount: null,
  internal_commission_eur: null,
  deal_currency: 'EUR',
  ...over,
})

describe('parseFxRates', () => {
  it('reads eur_pln_rate and usd_eur_rate', () => {
    expect(
      parseFxRates([
        { key: 'eur_pln_rate', value: '4.31' },
        { key: 'usd_eur_rate', value: '0.9' },
        { key: 'other', value: '1' },
      ]),
    ).toEqual({ eurPln: 4.31, usdEur: 0.9 })
  })

  it('falls back to 4.25 / 0.92 when keys are missing', () => {
    expect(parseFxRates([])).toEqual({ eurPln: 4.25, usdEur: 0.92 })
    expect(DEFAULT_FX_RATES).toEqual({ eurPln: 4.25, usdEur: 0.92 })
  })

  it('falls back to the default when a value is not numeric', () => {
    expect(
      parseFxRates([
        { key: 'eur_pln_rate', value: 'abc' },
        { key: 'usd_eur_rate', value: '' },
      ]),
    ).toEqual({ eurPln: 4.25, usdEur: 0.92 })
  })
})

describe('rowCommissionEur', () => {
  it('prefers offer_deposit_eur, then deposit_amount, then internal_commission_eur', () => {
    expect(rowCommissionEur(row({ offer_deposit_eur: 100, deposit_amount: 50, internal_commission_eur: 30 }), 0.5)).toBe(100)
    expect(rowCommissionEur(row({ deposit_amount: 50, internal_commission_eur: 30 }), 0.5)).toBe(50)
    expect(rowCommissionEur(row({ internal_commission_eur: 30 }), 0.5)).toBe(30)
  })

  it('keeps ?? semantics: an explicit 0 in offer_deposit_eur wins over later fields', () => {
    expect(rowCommissionEur(row({ offer_deposit_eur: 0, deposit_amount: 70 }), 0.5)).toBe(0)
  })

  it('is 0 when every field is null', () => {
    expect(rowCommissionEur(row({}), 0.5)).toBe(0)
  })

  it('converts USD rows with usdEur and leaves other currencies alone', () => {
    expect(rowCommissionEur(row({ offer_deposit_eur: 200, deal_currency: 'USD' }), 0.5)).toBe(100)
    expect(rowCommissionEur(row({ offer_deposit_eur: 200, deal_currency: 'EUR' }), 0.5)).toBe(200)
    expect(rowCommissionEur(row({ offer_deposit_eur: 200, deal_currency: null }), 0.5)).toBe(200)
  })
})

describe('commissionPln', () => {
  // Rates chosen to be exact in binary floating point: 1 USD = 0.5 EUR, 1 EUR = 4 PLN.
  const rates = { eurPln: 4, usdEur: 0.5 }

  it('sums rows with different filled fields plus one USD row', () => {
    const rows = [
      row({ offer_deposit_eur: 100 }),                     // 100 EUR (offer_deposit_eur)
      row({ deposit_amount: 50 }),                         //  50 EUR (deposit_amount fallback)
      row({ internal_commission_eur: 30 }),                //  30 EUR (internal_commission_eur fallback)
      row({ offer_deposit_eur: 0, deposit_amount: 70 }),   //   0 EUR (explicit 0 wins over 70)
      row({ offer_deposit_eur: 200, deal_currency: 'USD' }), // 200 USD * 0.5 = 100 EUR
    ]
    // EUR: 100 + 50 + 30 + 0 + 100 = 280  →  PLN: 280 * 4 = 1120
    expect(commissionEur(rows, rates.usdEur)).toBe(280)
    expect(commissionPln(rows, rates)).toBe(1120)
  })

  it('returns 0 (not NaN) for no rows', () => {
    expect(commissionEur([], 0.92)).toBe(0)
    expect(commissionPln([], DEFAULT_FX_RATES)).toBe(0)
  })

  it('reproduces the /admin/finances inline formula to the last bit', () => {
    const rows = [
      row({ offer_deposit_eur: 123.45 }),
      row({ deposit_amount: 67.89, deal_currency: 'USD' }),
      row({ internal_commission_eur: 0.1 }),
      row({ offer_deposit_eur: 33.33, deal_currency: 'USD' }),
      row({}),
    ]
    // Reference: the original finances/page.tsx loop, copied verbatim.
    let eur = 0
    for (const r of rows) {
      const amt = Number(r.offer_deposit_eur ?? r.deposit_amount ?? r.internal_commission_eur ?? 0)
      const amtEur = r.deal_currency === 'USD' ? amt * 0.92 : amt
      eur = (eur ?? 0) + amtEur
    }
    expect(commissionPln(rows, DEFAULT_FX_RATES)).toBe(eur * 4.25)
  })
})
