import { createServiceClient } from '@/lib/supabase/server'
import { PipelineClient } from './PipelineClient'

export const metadata = { title: 'Pipeline — FjordAnglers Admin' }

export default async function PipelinePage() {
  const supabase = createServiceClient()

  const [{ data: rawInquiries }, { data: rawAdDays }, { data: rawSettings }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('inquiries')
      .select('id, created_at, status, stage_reached, offer_sent_at, deposit_paid_at, internal_commission_eur, offer_total_eur, deal_currency')
      .order('created_at', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('ad_campaigns')
      .select('date, clicks, spend')
      .order('date', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('finance_settings')
      .select('key, value'),
  ])

  const settings   = (rawSettings ?? []) as { key: string; value: string }[]
  const eurRate    = parseFloat(settings.find(s => s.key === 'eur_pln_rate')?.value  ?? '4.25')
  const usdEurRate = parseFloat(settings.find(s => s.key === 'usd_eur_rate')?.value  ?? '0.92')

  return (
    <PipelineClient
      inquiries={rawInquiries ?? []}
      adDays={rawAdDays ?? []}
      eurRate={eurRate}
      usdEurRate={usdEurRate}
    />
  )
}
