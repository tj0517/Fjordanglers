import { createServiceClient } from '@/lib/supabase/server'
import { FinancesPageTabs } from './FinancesPageTabs'
import type { FixedCostRow, ManualCostEntryRow } from '@/actions/finances'
import type { MonthRaw } from './MonthlyPLClient'
import type { PipelineDeal } from './PipelineClient'
import { dealOurCut } from './pipeline-utils'

export const metadata = {
  title: 'Finances — FjordAnglers Admin',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthlyPln(row: FixedCostRow): number {
  if (row.billing_cycle === 'yearly') return row.amount_pln / 12
  if (row.billing_cycle === 'one_time') return 0
  return row.amount_pln
}

function generateMonths(start: string, end: string): string[] {
  const months: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthLabel(ym: string): string {
  const [y, mo] = ym.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en', { month: 'short', year: 'numeric' })
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FinancesPage() {
  const supabase = createServiceClient()

  // Fetch all data in parallel
  const [
    { data: inquiryData },
    { data: adData },
    { data: fixedData },
    { data: manualData },
    { data: settingsData },
    { data: pipelineData },
  ] = await Promise.all([
    // Inquiries where deposit is paid — revenue source
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('inquiries')
      .select('deposit_paid_at, updated_at, offer_deposit_eur, deposit_amount, internal_commission_eur, deal_currency')
      .in('status', ['deposit_paid', 'completed']),

    // Ad spend by date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('ad_campaigns')
      .select('date, spend'),

    // Active fixed recurring costs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('fixed_costs')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true }),

    // Manual one-off cost entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('manual_cost_entries')
      .select('*')
      .order('created_at', { ascending: true }),

    // Finance settings (EUR rate)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('finance_settings')
      .select('key, value'),

    // Open deals — all active (non-terminal) statuses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('inquiries')
      .select('id, angler_name, angler_email, offer_sent_at, updated_at, offer_total_eur, internal_deal_total_eur, offer_deposit_eur, deposit_amount, internal_commission_eur, deal_currency, created_at, status')
      .in('status', ['pending_fa_review', 'in_negotiation', 'deposit_sent'])
      .order('updated_at', { ascending: false }),
  ])

  // ── Parse ────────────────────────────────────────────────────────────────────

  const fixedCosts    = (fixedData    ?? []) as FixedCostRow[]
  const manualEntries = (manualData   ?? []) as ManualCostEntryRow[]
  const settings      = (settingsData ?? []) as { key: string; value: string }[]
  const pipeline      = (pipelineData ?? []) as PipelineDeal[]
  const eurRate       = parseFloat(settings.find(s => s.key === 'eur_pln_rate')?.value ?? '4.25')
  const usdEurRate    = parseFloat(settings.find(s => s.key === 'usd_eur_rate')?.value ?? '0.92')

  // Fixed costs → single monthly total (same for every month)
  const fixedMonthly = fixedCosts.reduce((s, r) => s + toMonthlyPln(r), 0)

  // ── Aggregate revenue by month ────────────────────────────────────────────────

  const revenueByMonth: Record<string, { eur: number; deals: number }> = {}
  for (const row of (inquiryData ?? []) as {
    deposit_paid_at: string | null
    updated_at: string
    offer_deposit_eur: number | null
    deposit_amount: number | null
    internal_commission_eur: number | null
    deal_currency: string | null
  }[]) {
    const month = (row.deposit_paid_at ?? row.updated_at)?.slice(0, 7)
    if (!month) continue
    const amt    = Number(row.offer_deposit_eur ?? row.deposit_amount ?? row.internal_commission_eur ?? 0)
    const amtEur = row.deal_currency === 'USD' ? amt * usdEurRate : amt
    revenueByMonth[month] = {
      eur:   (revenueByMonth[month]?.eur   ?? 0) + amtEur,
      deals: (revenueByMonth[month]?.deals ?? 0) + 1,
    }
  }

  // ── Aggregate ad spend by month ───────────────────────────────────────────────

  const adByMonth: Record<string, number> = {}
  for (const row of (adData ?? []) as { date: string; spend: number }[]) {
    const month = row.date?.slice(0, 7)
    if (!month) continue
    adByMonth[month] = (adByMonth[month] ?? 0) + Number(row.spend)
  }

  // ── Group manual entries by month ─────────────────────────────────────────────

  const manualByMonth: Record<string, ManualCostEntryRow[]> = {}
  for (const e of manualEntries) {
    if (!manualByMonth[e.month]) manualByMonth[e.month] = []
    manualByMonth[e.month].push(e)
  }

  // ── Aggregate potential revenue by month (open deals with price) ─────────────

  const potentialByMonth: Record<string, number> = {}
  for (const d of pipeline) {
    const cut = dealOurCut(d)
    if (cut == null || cut <= 0) continue
    const month  = (d.offer_sent_at ?? d.updated_at)?.slice(0, 7)
    if (!month) continue
    const cutEur = d.deal_currency === 'USD' ? cut * usdEurRate : cut
    potentialByMonth[month] = (potentialByMonth[month] ?? 0) + cutEur
  }

  // ── Generate month range (Apr 2026 → now, plus any earlier data) ──────────────

  const now          = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const allKeys      = [
    ...Object.keys(revenueByMonth),
    ...Object.keys(adByMonth),
    ...Object.keys(manualByMonth),
    '2026-04',   // company founding month
    currentMonth,
  ]
  const minMonth  = allKeys.sort()[0]
  const monthList = generateMonths(minMonth, currentMonth)

  // ── Build MonthRaw[] (newest first) ──────────────────────────────────────────

  const months: MonthRaw[] = [...monthList].reverse().map(month => {
    const entries = manualByMonth[month] ?? []
    return {
      month,
      label:            monthLabel(month),
      deals:            revenueByMonth[month]?.deals ?? 0,
      revenue_eur:      revenueByMonth[month]?.eur   ?? 0,
      potential_eur:    potentialByMonth[month] ?? 0,
      ad_spend_pln:     adByMonth[month] ?? 0,
      fixed_costs_pln:  fixedMonthly,
      manual_entries:   entries,
      manual_costs_pln: entries.reduce((s, e) => s + Number(e.amount_pln), 0),
    }
  })

  // ── Summary metrics for header cards ─────────────────────────────────────────

  const totalRevEur  = months.reduce((s, m) => s + m.revenue_eur, 0)
  const totalRevPln  = totalRevEur * eurRate
  const totalAdSpend = months.reduce((s, m) => s + m.ad_spend_pln, 0)
  const totalFixed   = fixedMonthly * months.length
  const totalManual  = months.reduce((s, m) => s + m.manual_costs_pln, 0)
  const totalCosts   = totalAdSpend + totalFixed + totalManual
  const totalNet     = totalRevPln - totalCosts
  const pipelineEur  = pipeline.reduce((s, d) => {
    const cut    = dealOurCut(d) ?? 0
    const cutEur = d.deal_currency === 'USD' ? cut * usdEurRate : cut
    return s + cutEur
  }, 0)
  const pipelinePln  = pipelineEur * eurRate
  const usdPlnRate   = usdEurRate * eurRate

  const fmt0 = (n: number) =>
    n.toLocaleString('pl', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtRate = (n: number) =>
    n.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1200px]">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          FjordAnglers Admin
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Finances
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Monthly P&amp;L · Ad spend from DB · Revenue from closed deals · Fixed costs
        </p>
      </div>

      {/* Exchange rates */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-5">
        {[
          { label: 'EUR/PLN', value: fmtRate(eurRate) },
          { label: 'USD/EUR', value: fmtRate(usdEurRate) },
          { label: 'USD/PLN', value: fmtRate(usdPlnRate) },
        ].map(r => (
          <span key={r.label} className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            <span className="font-semibold" style={{ color: 'rgba(10,46,77,0.55)' }}>{r.label}</span>
            {' '}{r.value}
          </span>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <MetricCard
          label="Total Revenue"
          value={`${fmt0(totalRevPln)} zł`}
          sub={`€${totalRevEur.toFixed(2)}`}
          highlight="green"
        />
        <MetricCard
          label="Total Costs"
          value={`${fmt0(totalCosts)} zł`}
          sub="ads + fixed + manual"
        />
        <MetricCard
          label="Net P&L"
          value={`${totalNet >= 0 ? '+' : ''}${fmt0(totalNet)} zł`}
          highlight={totalNet >= 0 ? 'green' : 'red'}
          sub="revenue − all costs"
        />
        <MetricCard
          label="Pipeline"
          value={`${fmt0(pipelinePln)} zł`}
          sub={`€${pipelineEur.toFixed(2)} · ${pipeline.length} open deal${pipeline.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          label="Fixed / month"
          value={`${fixedMonthly.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`}
          sub={`${fixedCosts.length} active line${fixedCosts.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Tabs: Monthly P&L ↔ Fixed Costs */}
      <FinancesPageTabs
        months={months}
        defaultEurRate={eurRate}
        usdEurRate={usdEurRate}
        fixedCosts={fixedCosts}
        pipeline={pipeline}
      />

    </div>
  )
}
