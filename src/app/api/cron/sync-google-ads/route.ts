import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isGoogleAdsConfigured, } from '@/lib/google-ads/client'
import { fetchGoogleAdsCampaigns } from '@/lib/google-ads/fetch-campaigns'
import { getCampaignDefs, upsertAdCampaignRows } from '@/actions/ads'
import type { AdCampaignInsert } from '@/actions/ads'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isGoogleAdsConfigured()) {
    console.log('[sync-google-ads] Google Ads not configured — skipping.')
    return NextResponse.json({ synced: 0, skipped: true })
  }

  const dateParam = req.nextUrl.searchParams.get('date') ?? undefined

  // Fetch campaign defs for key lookup
  const defs = await getCampaignDefs()
  const defsByGoogleId = new Map(
    defs
      .filter((d) => d.google_campaign_id)
      .map((d) => [d.google_campaign_id!, d.key]),
  )

  // Fetch metrics from Google Ads
  let campaigns: Awaited<ReturnType<typeof fetchGoogleAdsCampaigns>>
  try {
    campaigns = await fetchGoogleAdsCampaigns(dateParam)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync-google-ads] Google Ads API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (campaigns.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // Build upsert rows
  const date = dateParam ?? getYesterday()
  const rows: AdCampaignInsert[] = campaigns.map((c) => ({
    date,
    platform: 'google_ads',
    campaign_name: defsByGoogleId.get(c.campaignId) ?? c.campaignName,
    spend: c.spendEur,
    impressions: c.impressions,
    clicks: c.clicks,
    avg_cpc: c.avgCpcEur,
  }))

  const result = await upsertAdCampaignRows(rows)
  if (!result.success) {
    console.error('[sync-google-ads] Upsert failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  console.log(`[sync-google-ads] Synced ${rows.length} campaigns for ${date}`)
  return NextResponse.json({ synced: rows.length, date })
}

function getYesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
