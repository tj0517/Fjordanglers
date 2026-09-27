import { describe, expect, it } from 'vitest'
import { aggregate, type PipelineRow } from './PipelineClient'

const row = (over: Partial<PipelineRow>): PipelineRow => ({
  id: 'x',
  created_at: '2026-05-10T10:00:00Z',
  status: 'new',
  stage_reached: 'inquiry',
  offer_sent_at: null,
  deposit_paid_at: null,
  offer_total_eur: null,
  offer_deposit_eur: null,
  deposit_amount: null,
  internal_commission_eur: null,
  deal_currency: 'EUR',
  deposit_amount_cents: null,
  deposit_currency: null,
  deposit_eur_rate: null,
  ...over,
})

describe('aggregate — deposits (booking)', () => {
  it('counts a deposit only when deposit_paid_at is set, regardless of status', () => {
    const inquiries = [
      row({ status: 'paid', deposit_paid_at: null }),                      // not booked
      row({ status: 'awaiting_payment', deposit_paid_at: '2026-05-12T10:00:00Z' }), // booked
    ]
    const result = aggregate(inquiries, [], '2026-05', 'monthly', 4.25, 0.92)
    expect(result.depositsPaid).toBe(1)
  })
})

describe('aggregate — commission (FA-1.35 acceptance criterion 3)', () => {
  it('uses rowCommissionEur for a row carrying only the FA-1.28 columns, not 0', () => {
    const inquiries = [
      row({
        deposit_paid_at: '2026-05-12T10:00:00Z',
        deposit_amount_cents: 20000,
        deposit_eur_rate: 1,
        deposit_currency: 'EUR',
      }),
    ]
    // rowCommissionEur: 20000 / 1 / 100 = 200 EUR → 200 * 4.25 = 850 PLN
    const result = aggregate(inquiries, [], '2026-05', 'monthly', 4.25, 0.92)
    expect(result.commissionPln).toBe(850)
  })

  it('is 0 when no row in the period is booked', () => {
    const inquiries = [row({ deposit_paid_at: null, internal_commission_eur: 100 })]
    const result = aggregate(inquiries, [], '2026-05', 'monthly', 4.25, 0.92)
    expect(result.commissionPln).toBe(0)
  })
})
