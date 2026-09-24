import type { PipelineDeal } from './PipelineClient'

export function dealTripPrice(d: PipelineDeal): number | null {
  return d.offer_total_eur ?? d.internal_deal_total_eur ?? null
}

export function dealOurCut(d: PipelineDeal): number | null {
  return d.offer_deposit_eur ?? d.deposit_amount ?? d.internal_commission_eur ?? null
}

/** Our cut in EUR, using the frozen rate for FA-1.28 rows; legacy path for older rows. */
export function dealOurCutEur(d: PipelineDeal, usdEurRate: number): number | null {
  if (d.deposit_amount_cents != null && d.deposit_eur_rate != null) {
    return d.deposit_amount_cents / d.deposit_eur_rate / 100
  }
  const raw = dealOurCut(d)
  if (raw == null) return null
  return d.deal_currency === 'USD' ? raw * usdEurRate : raw
}
