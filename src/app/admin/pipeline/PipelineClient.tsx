'use client'

import { useState, useMemo } from 'react'
import { PipelineBarChart, CloseRateLineChart, type ChartPeriod } from './PipelineCharts'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineRow {
  id: string
  created_at: string
  status: string
  stage_reached: string  // 'inquiry' | 'offer_sent' | 'deposit_paid' | 'completed'
  offer_sent_at: string | null
  deposit_paid_at: string | null
  internal_commission_eur: number | null
  offer_total_eur: number | null
  deal_currency: string | null
}

interface AdDay {
  date: string
  clicks: number | null
  spend: number | null
}

interface PeriodMetrics {
  key: string
  label: string
  inquiries: number
  offersSent: number       // offer_sent_at != null (regardless of current status)
  depositsPaid: number
  completed: number
  lostBeforeOffer: number  // lost/cancelled AND offer_sent_at == null
  lostAfterOffer: number   // lost/cancelled AND offer_sent_at != null
  active: number
  clicks: number
  spend: number
  commissionPln: number
  closeRate: number
  offerRate: number
  depositFromOffer: number
}

type Mode = 'monthly' | 'weekly'

// ─── Status / stage helpers ────────────────────────────────────────────────────

const LOST_STATUSES   = new Set(['lost', 'cancelled'])
const ACTIVE_STATUSES = new Set([
  'pending', 'in_negotiation', 'waiting_for_guide_offer',
  'offer_sent', 'waiting_for_deposit', 'deposit_sent',
])
const DEPOSIT_STATUSES = new Set(['deposit_paid', 'completed'])

// stage_reached ordering — used to express "reached at least this stage"
const STAGE_ORDER = ['inquiry', 'offer_sent', 'deposit_paid', 'completed'] as const
type Stage = typeof STAGE_ORDER[number]

function stageGte(reached: string, min: Stage): boolean {
  return STAGE_ORDER.indexOf(reached as Stage) >= STAGE_ORDER.indexOf(min)
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getMonthKey(d: string)  { return d.slice(0, 7) }

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z')
  const day = d.getUTCDay() || 7
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + 4 - day)
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const wk = Math.ceil(((thu.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}

function getKey(dateStr: string, mode: Mode) {
  return mode === 'monthly' ? getMonthKey(dateStr) : getWeekKey(dateStr)
}

function getMonthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

function getWeekLabel(key: string): string {
  const match = key.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return key
  const year = parseInt(match[1]), week = parseInt(match[2])
  const jan4    = new Date(Date.UTC(year, 0, 4))
  const jan4day = jan4.getUTCDay() || 7
  const monday  = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4day + 1 + (week - 1) * 7)
  const sunday  = new Date(monday.getTime() + 6 * 86_400_000)
  const fmt = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  return `W${week} · ${fmt(monday)}–${sunday.getUTCDate()}`
}

function getLabel(key: string, mode: Mode) {
  return mode === 'monthly' ? getMonthLabel(key) : getWeekLabel(key)
}

function generatePeriods(mode: Mode, earliest: string, today: Date): string[] {
  const periods: string[] = []

  if (mode === 'monthly') {
    let [y, m] = earliest.slice(0, 7).split('-').map(Number)
    const ey = today.getFullYear(), em = today.getMonth() + 1
    while (y < ey || (y === ey && m <= em)) {
      periods.push(`${y}-${String(m).padStart(2, '0')}`)
      if (++m > 12) { m = 1; y++ }
    }
  } else {
    const start = new Date(earliest.slice(0, 10) + 'T00:00:00Z')
    const day   = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() - day + 1)   // Monday of first week
    const seen = new Set<string>()
    const d = new Date(start)
    while (d <= today) {
      const k = getWeekKey(d.toISOString().slice(0, 10))
      if (!seen.has(k)) { seen.add(k); periods.push(k) }
      d.setUTCDate(d.getUTCDate() + 7)
    }
  }

  return periods
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregate(
  inquiries: PipelineRow[],
  adDays: AdDay[],
  key: string,
  mode: Mode,
  eurRate: number,
  usdEurRate: number,
): PeriodMetrics {
  const inqs = inquiries.filter(i => getKey(i.created_at, mode) === key)
  const ads  = adDays.filter(d => getKey(d.date, mode) === key)

  const total    = inqs.length

  // ── Funnel stages — based solely on stage_reached ───────────────────────────
  // stage_reached is the definitive record of the furthest stage reached,
  // set by DB at each transition. No inference from status needed.
  const offersSent = inqs.filter(i => stageGte(i.stage_reached, 'offer_sent')).length
  const deposits   = inqs.filter(i => stageGte(i.stage_reached, 'deposit_paid')).length
  const completed  = inqs.filter(i => i.stage_reached === 'completed').length

  // ── Lost — split by stage reached when they left ────────────────────────────
  const isLost = (i: PipelineRow) => LOST_STATUSES.has(i.status)
  const lostBeforeOffer = inqs.filter(i => isLost(i) && i.stage_reached === 'inquiry').length
  const lostAfterOffer  = inqs.filter(i => isLost(i) && stageGte(i.stage_reached, 'offer_sent')).length

  // ── Still active ─────────────────────────────────────────────────────────────
  const active = inqs.filter(i => ACTIVE_STATUSES.has(i.status)).length

  // ── Ad data ──────────────────────────────────────────────────────────────────
  const clicks = ads.reduce((s, d) => s + (d.clicks ?? 0), 0)
  const spend  = ads.reduce((s, d) => s + Number(d.spend ?? 0), 0)

  // ── Commission — convert to PLN (handle USD deals) ───────────────────────────
  const commission = inqs
    .filter(i => DEPOSIT_STATUSES.has(i.status))
    .reduce((s, i) => {
      const raw = Number(i.internal_commission_eur ?? 0)
      const eur = i.deal_currency === 'USD' ? raw * usdEurRate : raw
      return s + eur * eurRate
    }, 0)

  return {
    key,
    label:            getLabel(key, mode),
    inquiries:        total,
    offersSent,
    depositsPaid:     deposits,
    completed,
    lostBeforeOffer,
    lostAfterOffer,
    active,
    clicks,
    spend,
    commissionPln:    commission,
    closeRate:        total > 0 ? (deposits / total) * 100 : 0,
    offerRate:        total > 0 ? (offersSent / total) * 100 : 0,
    depositFromOffer: offersSent > 0 ? (deposits / offersSent) * 100 : 0,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="p-4 rounded-[18px]"
      style={{
        background: '#FDFAF7',
        border: accent ? '1px solid rgba(230,126,80,0.25)' : '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold f-display leading-none" style={{ color: accent ? '#E67E50' : '#0A2E4D' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.35)' }}>{sub}</p>
      )}
    </div>
  )
}

function FunnelStage({
  label, count, pct, isFirst,
}: { label: string; count: number; pct?: number; isFirst?: boolean }) {
  return (
    <div className="flex items-stretch min-w-0" style={{ flex: 1 }}>
      {!isFirst && (
        <div className="flex flex-col items-center justify-center px-1.5 flex-shrink-0">
          <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 18, lineHeight: 1 }}>›</span>
          {pct != null && (
            <span style={{ fontSize: 9, color: '#E67E50', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className="flex-1 text-center rounded-2xl py-4 px-2"
        style={{
          background: '#fff',
          border: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 1px 6px rgba(10,46,77,0.04)',
        }}
      >
        <p style={{ fontSize: 9, color: 'rgba(10,46,77,0.4)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: 6 }}>
          {label}
        </p>
        <p className="f-display font-bold" style={{ fontSize: 28, color: '#0A2E4D', lineHeight: 1 }}>
          {count.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PipelineClient({
  inquiries,
  adDays,
  eurRate,
  usdEurRate,
}: {
  inquiries: PipelineRow[]
  adDays: AdDay[]
  eurRate: number
  usdEurRate: number
}) {
  const [mode, setMode]               = useState<Mode>('monthly')
  const [periodIdx, setPeriodIdx]     = useState<number | null>(null)
  const [targetRate, setTargetRate]   = useState<number | null>(null)

  const today = new Date()

  const earliest = useMemo(() => {
    const all = [
      ...inquiries.map(i => i.created_at.slice(0, 10)),
      ...adDays.map(d => d.date.slice(0, 10)),
    ]
    return all.length > 0 ? all.sort()[0] : today.toISOString().slice(0, 10)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiries, adDays])

  const periods = useMemo(
    () => generatePeriods(mode, earliest, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, earliest],
  )

  const currentIdx = periodIdx != null && periodIdx < periods.length
    ? periodIdx
    : periods.length - 1

  const allPeriodData = useMemo(
    () => periods.map(k => aggregate(inquiries, adDays, k, mode, eurRate, usdEurRate)),
    [periods, inquiries, adDays, mode, eurRate, usdEurRate],
  )

  const current: PeriodMetrics = allPeriodData[currentIdx] ?? {
    key: '', label: '', inquiries: 0, offersSent: 0, depositsPaid: 0,
    completed: 0, lostBeforeOffer: 0, lostAfterOffer: 0, active: 0,
    clicks: 0, spend: 0, commissionPln: 0, closeRate: 0, offerRate: 0, depositFromOffer: 0,
  }

  const chartData: ChartPeriod[] = allPeriodData.map(p => ({
    label:     p.label,
    inquiries: p.inquiries,
    offers:    p.offersSent,
    deposits:  p.depositsPaid,
    clicks:    p.clicks,
    closeRate: Math.round(p.closeRate * 10) / 10,
  }))

  // ── Forecast calculations (all-time averages, in PLN) ────────────────────────

  const totalClosed = inquiries.filter(i => DEPOSIT_STATUSES.has(i.status))
  const totalCommissionPln = totalClosed.reduce((s, i) => {
    const raw = Number(i.internal_commission_eur ?? 0)
    const eur = i.deal_currency === 'USD' ? raw * usdEurRate : raw
    return s + eur * eurRate
  }, 0)
  const avgCommission = totalClosed.length > 0 ? totalCommissionPln / totalClosed.length : 0
  const overallClose  = inquiries.length > 0
    ? Math.round((totalClosed.length / inquiries.length) * 100)
    : 0

  // avg inquiries over last 3 completed periods (excluding current)
  const last3 = allPeriodData.slice(-4, -1)   // 3 periods before current
  const avgInq = last3.length > 0
    ? last3.reduce((s, p) => s + p.inquiries, 0) / last3.length
    : current.inquiries

  const sliderRate   = targetRate ?? overallClose
  const projCurrent  = avgInq * (overallClose / 100) * avgCommission
  const projTarget   = avgInq * (sliderRate   / 100) * avgCommission
  const periodSuffix = mode === 'monthly' ? 'mo' : 'wk'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1200px]">

      {/* Header + mode toggle */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            FjordAnglers Admin
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">Pipeline</h1>
          <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Leads → Inquiries → Offers → Deposits · funnel health at a glance
          </p>
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl self-start"
          style={{ background: 'rgba(10,46,77,0.06)' }}
        >
          {(['monthly', 'weekly'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setPeriodIdx(null) }}
              className="px-4 py-1.5 rounded-lg text-sm f-body font-medium transition-all"
              style={{
                background: mode === m ? '#0A2E4D' : 'transparent',
                color:      mode === m ? '#fff'    : 'rgba(10,46,77,0.45)',
                cursor:     'pointer',
              }}
            >
              {m === 'monthly' ? 'Monthly' : 'Weekly'}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setPeriodIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
          style={{
            background: 'rgba(10,46,77,0.06)',
            color:  currentIdx === 0 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
            cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          ←
        </button>

        <span
          className="text-sm font-semibold f-body"
          style={{ color: '#0A2E4D', minWidth: 150, textAlign: 'center' }}
        >
          {current.label}
        </span>

        <button
          onClick={() => setPeriodIdx(Math.min(periods.length - 1, currentIdx + 1))}
          disabled={currentIdx === periods.length - 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
          style={{
            background: 'rgba(10,46,77,0.06)',
            color:  currentIdx === periods.length - 1 ? 'rgba(10,46,77,0.2)' : '#0A2E4D',
            cursor: currentIdx === periods.length - 1 ? 'not-allowed' : 'pointer',
          }}
        >
          →
        </button>

        {currentIdx !== periods.length - 1 && (
          <button
            onClick={() => setPeriodIdx(null)}
            className="text-xs f-body px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)', cursor: 'pointer' }}
          >
            Current
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="Ad Clicks"
          value={current.clicks.toLocaleString()}
          sub={current.spend > 0 ? `${current.spend.toFixed(0)} zł spend` : 'no ad data'}
        />
        <KpiCard
          label="Inquiries"
          value={String(current.inquiries)}
          sub={current.clicks > 0
            ? `${((current.inquiries / current.clicks) * 100).toFixed(1)}% of clicks`
            : undefined}
        />
        <KpiCard
          label="Offers Sent"
          value={String(current.offersSent)}
          sub={current.inquiries > 0 ? `${current.offerRate.toFixed(0)}% of inquiries` : undefined}
        />
        <KpiCard
          label="Close Rate"
          value={`${current.closeRate.toFixed(1)}%`}
          sub={`${current.depositsPaid} deposit${current.depositsPaid !== 1 ? 's' : ''} paid`}
          accent
        />
        <KpiCard
          label="FA Commission"
          value={`${current.commissionPln.toLocaleString('pl', { maximumFractionDigits: 0 })} zł`}
          sub={current.depositsPaid > 0
            ? `${(current.commissionPln / current.depositsPaid).toLocaleString('pl', { maximumFractionDigits: 0 })} zł avg/deal`
            : undefined}
        />
      </div>

      {/* Horizontal funnel */}
      <div
        className="p-5 rounded-[20px] mb-8"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Funnel · {current.label}
        </p>
        <p className="text-sm font-bold f-display text-[#0A2E4D] mb-5">
          Conversion by stage
        </p>

        <div className="flex items-stretch gap-0">
          <FunnelStage
            label="Leads (clicks)"
            count={current.clicks}
            isFirst
          />
          <FunnelStage
            label="Inquiries"
            count={current.inquiries}
            pct={current.clicks > 0 ? (current.inquiries / current.clicks) * 100 : undefined}
          />
          <FunnelStage
            label="Offer Sent"
            count={current.offersSent}
            pct={current.inquiries > 0 ? current.offerRate : undefined}
          />
          <FunnelStage
            label="Deposit Paid"
            count={current.depositsPaid}
            pct={current.offersSent > 0 ? current.depositFromOffer : undefined}
          />
          <FunnelStage
            label="Completed"
            count={current.completed}
            pct={current.depositsPaid > 0 ? (current.completed / current.depositsPaid) * 100 : undefined}
          />
        </div>

        {/* Status breakdown row */}
        <div
          className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 pt-4"
          style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
        >
          {[
            {
              label: 'Still active',
              count: current.active,
              color: '#E67E50',
            },
            {
              label: 'Lost before offer',
              count: current.lostBeforeOffer,
              color: '#DC2626',
            },
            {
              label: 'Lost after offer',
              count: current.lostAfterOffer,
              color: '#B91C1C',
            },
            ...(current.spend > 0 && current.depositsPaid > 0 ? [{
              label: 'Cost per closed deal',
              count: null,
              extra: `${(current.spend / current.depositsPaid).toFixed(0)} zł`,
              color: '#0A2E4D',
            }] : []),
            ...(current.clicks > 0 && current.depositsPaid > 0 ? [{
              label: 'Cost per deposit (CPA)',
              count: null,
              extra: `${(current.spend / current.depositsPaid).toFixed(0)} zł`,
              color: '#0A2E4D',
            }] : []),
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                {item.label}:{' '}
                <strong style={{ color: item.color }}>
                  {'extra' in item && item.extra
                    ? item.extra
                    : item.count != null
                    ? item.count
                    : '—'}
                </strong>
                {item.count != null && current.inquiries > 0 && (
                  <span style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {' '}({((item.count / current.inquiries) * 100).toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <PipelineBarChart data={chartData} />
        <CloseRateLineChart data={chartData} />
      </div>

      {/* Revenue forecast */}
      <div
        className="p-6 rounded-[20px]"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Forecast
        </p>
        <p className="text-sm font-bold f-display text-[#0A2E4D] mb-1">Revenue Forecast</p>
        <p className="text-xs f-body mb-6" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Based on avg {avgInq.toFixed(1)} inquiries/{periodSuffix} (prev 3 periods)
          {avgCommission > 0 && ` · avg ${avgCommission.toLocaleString('pl', { maximumFractionDigits: 0 })} zł commission/deal`}
        </p>

        {avgCommission === 0 ? (
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            No closed deals with commission data yet — forecast will appear once deals are marked with internal commission.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Current baseline */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  Current close rate
                </span>
                <span className="text-sm font-bold f-body ml-2" style={{ color: '#0A2E4D' }}>
                  {overallClose}%
                </span>
              </div>
              <span className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                {projCurrent.toLocaleString('pl', { maximumFractionDigits: 0 })} zł/{periodSuffix}
              </span>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-4">
              <span className="text-xs f-body w-6 text-right" style={{ color: 'rgba(10,46,77,0.35)' }}>5%</span>
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={sliderRate}
                onChange={e => setTargetRate(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#E67E50' }}
              />
              <span className="text-xs f-body w-7" style={{ color: 'rgba(10,46,77,0.35)' }}>80%</span>
            </div>

            {/* Target result */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ background: 'rgba(230,126,80,0.08)', border: '1px solid rgba(230,126,80,0.18)' }}
            >
              <div>
                <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  Target close rate
                </span>
                <span className="text-sm font-bold f-body ml-2" style={{ color: '#E67E50' }}>
                  {sliderRate}%
                </span>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold f-display" style={{ color: '#E67E50' }}>
                  {projTarget.toLocaleString('pl', { maximumFractionDigits: 0 })} zł/{periodSuffix}
                </p>
                {projTarget > projCurrent && (
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    +{(projTarget - projCurrent).toLocaleString('pl', { maximumFractionDigits: 0 })} zł vs current
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
