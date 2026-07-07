import { getCustomer } from './client'

export interface GoogleCampaignMetrics {
  campaignId: string
  campaignName: string
  status: string
  spendEur: number
  impressions: number
  clicks: number
  avgCpcEur: number
}

/**
 * Fetches campaign-level metrics from Google Ads for a given date.
 * @param date ISO date string (YYYY-MM-DD). Defaults to yesterday.
 */
export async function fetchGoogleAdsCampaigns(
  date?: string,
): Promise<GoogleCampaignMetrics[]> {
  const targetDate = date ?? getYesterday()
  const customer = getCustomer()

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks
    FROM campaign
    WHERE segments.date = '${targetDate}'
      AND campaign.status IN ('ENABLED', 'PAUSED')
  `)

  return rows.map((row) => {
    const campaign = row.campaign!
    const metrics = row.metrics!
    const costMicros = Number(metrics.cost_micros ?? 0)
    const clicks = Number(metrics.clicks ?? 0)
    const spendEur = Math.round((costMicros / 1_000_000) * 100) / 100
    const avgCpcEur = clicks > 0 ? Math.round((spendEur / clicks) * 100) / 100 : 0
    return {
      campaignId: String(campaign.id ?? ''),
      campaignName: String(campaign.name ?? ''),
      status: String(campaign.status ?? ''),
      spendEur,
      impressions: Number(metrics.impressions ?? 0),
      clicks,
      avgCpcEur,
    }
  })
}

function getYesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
