import { createServiceClient } from '@/lib/supabase/server'
import { AdsClient } from './AdsClient'
import type { AdCampaignRow, CampaignDefRow } from '@/actions/ads'

export const metadata = {
  title: 'Ads Analytics — FjordAnglers Admin',
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

interface SummaryMetrics {
  totalSpend: number
  cpc: number | null
  ctr: number | null
  totalClicks: number
  totalImpressions: number
  totalConversions: number
}

function computeMetrics(rows: AdCampaignRow[]): SummaryMetrics {
  const totalSpend       = rows.reduce((s, r) => s + r.spend, 0)
  const totalClicks      = rows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
  const totalConversions = rows.reduce((s, r) => s + (r.conversions ?? 0), 0)
  // Use stored avg_cpc if present, otherwise derive from spend/clicks
  const weightedCpc      = rows.reduce((s, r) => {
    const cpc = r.avg_cpc > 0 ? r.avg_cpc : (r.clicks > 0 ? r.spend / r.clicks : 0)
    return s + cpc * r.clicks
  }, 0)

  return {
    totalSpend,
    cpc:              totalClicks > 0 ? weightedCpc / totalClicks : null,
    ctr:              totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
    totalClicks,
    totalImpressions,
    totalConversions,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ date_from?: string; date_to?: string; platforms?: string }>
}) {
  const { date_from, date_to, platforms } = await searchParams
  const supabase = createServiceClient()

  // Current month bounds for summary cards
  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const buildTableQuery = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from as any)('ad_campaigns').select('*')
    if (date_from) q = q.gte('date', date_from)
    if (date_to)   q = q.lte('date', date_to)
    if (platforms) {
      const list = platforms.split(',').filter(Boolean)
      if (list.length > 0) q = q.in('platform', list)
    }
    return q.order('date', { ascending: false })
  }

  const [
    { data: summaryData },
    { data: tableData },
    { data: campaignDefsData },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('ad_campaigns')
      .select('*')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false }),

    buildTableQuery(),

    // Campaign definitions from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('ad_campaign_defs')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ])

  const summaryRows  = (summaryData      ?? []) as AdCampaignRow[]
  const tableRows    = (tableData        ?? []) as AdCampaignRow[]
  const campaignDefs = (campaignDefsData ?? []) as CampaignDefRow[]
  const metrics      = computeMetrics(summaryRows)

  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1400px]">

      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          FjordAnglers Admin
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Ads <span style={{ fontStyle: 'italic' }}>Analytics</span>
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Summary cards · {monthLabel} &nbsp;·&nbsp; Conversions = inquiries received · Table reflects applied filters
        </p>
      </div>

      {/* ─── Summary cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard
          label="Total Spend"
          value={`${metrics.totalSpend.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`}
        />
        <MetricCard
          label="Avg. CPC"
          value={metrics.cpc != null ? `${metrics.cpc.toFixed(2)} zł` : '—'}
        />
        <MetricCard
          label="CTR"
          value={metrics.ctr != null ? `${metrics.ctr.toFixed(2)}%` : '—'}
        />
        <MetricCard
          label="Total Clicks"
          value={metrics.totalClicks.toLocaleString('en')}
        />
        <MetricCard
          label="Impressions"
          value={metrics.totalImpressions.toLocaleString('en')}
        />
        <MetricCard
          label="Conversions"
          value={metrics.totalConversions.toLocaleString('en')}
          sub="inquiries this month"
        />
      </div>

      {/* ─── Filters + Charts + Table + Dialogs ─────────────────── */}
      <AdsClient
        rows={tableRows}
        dateFrom={date_from ?? ''}
        dateTo={date_to ?? ''}
        platforms={platforms ?? ''}
        campaignDefs={campaignDefs}
      />

    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red'
}) {
  const valueColor =
    highlight === 'green' ? '#16A34A' :
    highlight === 'red'   ? '#DC2626' :
    '#0A2E4D'

  return (
    <div
      className="p-5 rounded-[18px]"
      style={{
        background: '#FDFAF7',
        border: highlight === 'red'
          ? '1px solid rgba(220,38,38,0.2)'
          : highlight === 'green'
          ? '1px solid rgba(22,163,74,0.2)'
          : '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold f-display leading-none" style={{ color: valueColor }}>
        {value}
      </p>
      {sub != null && (
        <p className="text-[10px] f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.35)' }}>{sub}</p>
      )}
    </div>
  )
}
