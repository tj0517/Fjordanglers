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
  cpa: number | null
  totalClicks: number
  totalImpressions: number
  totalConversions: number
}

function computeMetrics(rows: AdCampaignRow[], totalConversions = 0): SummaryMetrics {
  const totalSpend       = rows.reduce((s, r) => s + r.spend, 0)
  const totalClicks      = rows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
  // Use stored avg_cpc if present, otherwise derive from spend/clicks
  const weightedCpc      = rows.reduce((s, r) => {
    const cpc = r.avg_cpc > 0 ? r.avg_cpc : (r.clicks > 0 ? r.spend / r.clicks : 0)
    return s + cpc * r.clicks
  }, 0)

  return {
    totalSpend,
    cpc:              totalClicks > 0 ? weightedCpc / totalClicks : null,
    ctr:              totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
    cpa:              totalConversions > 0 ? totalSpend / totalConversions : null,
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
    { data: tableData },
    { data: campaignDefsData },
    { data: inquiryDates },
  ] = await Promise.all([
    buildTableQuery(),

    // Campaign definitions from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('ad_campaign_defs')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),

    // Conversions = inquiries, keyed by date (YYYY-MM-DD)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('inquiries').select('created_at'),
  ])

  // Build date → count map for all inquiries
  const inquiriesByDate: Record<string, number> = {}
  for (const row of (inquiryDates ?? []) as { created_at: string }[]) {
    const d = row.created_at.slice(0, 10)
    inquiriesByDate[d] = (inquiriesByDate[d] ?? 0) + 1
  }

  const tableRows    = (tableData        ?? []) as AdCampaignRow[]
  const campaignDefs = (campaignDefsData ?? []) as CampaignDefRow[]

  // Conversions scoped to the same date range as the table
  const periodConversions = Object.entries(inquiriesByDate)
    .filter(([d]) => (!date_from || d >= date_from) && (!date_to || d <= date_to))
    .reduce((s, [, c]) => s + c, 0)
  const metrics = computeMetrics(tableRows, periodConversions)

  // Period label for subtitle
  const periodLabel = date_from || date_to
    ? [date_from, date_to].filter(Boolean).join(' → ')
    : 'All time'

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
          Summary cards · {periodLabel} &nbsp;·&nbsp; Conversions = inquiries received
        </p>
      </div>

      {/* ─── Summary cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
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
          sub="inquiries in period"
        />
        <MetricCard
          label="Cost / Conv."
          value={metrics.cpa != null ? `${metrics.cpa.toFixed(2)} zł` : '—'}
          sub="spend ÷ inquiries"
        />
      </div>

      {/* ─── Filters + Charts + Table + Dialogs ─────────────────── */}
      <AdsClient
        rows={tableRows}
        dateFrom={date_from ?? ''}
        dateTo={date_to ?? ''}
        platforms={platforms ?? ''}
        inquiriesByDate={inquiriesByDate}
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
