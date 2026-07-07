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
      metrics.clicks,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date = '${targetDate}'
      AND campaign.status IN ('ENABLED', 'PAUSED')
  `)

  return rows.map((row) => {
    const campaign = row.campaign!
    const metrics = row.metrics!
    return {
      campaignId: String(campaign.id ?? ''),
      campaignName: String(campaign.name ?? ''),
      status: String(campaign.status ?? ''),
      spendEur: Math.round((Number(metrics.cost_micros ?? 0) / 1_000_000) * 100) / 100,
      impressions: Number(metrics.impressions ?? 0),
      clicks: Number(metrics.clicks ?? 0),
      avgCpcEur: Math.round((Number(metrics.average_cpc ?? 0) / 1_000_000) * 100) / 100,
    }
  })
}

function getYesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
