import type { PipelineDeal } from './PipelineClient'

export function dealTripPrice(d: PipelineDeal): number | null {
  return d.offer_total_eur ?? d.internal_deal_total_eur ?? null
}

export function dealOurCut(d: PipelineDeal): number | null {
  return d.offer_deposit_eur ?? d.deposit_amount ?? d.internal_commission_eur ?? null
}
