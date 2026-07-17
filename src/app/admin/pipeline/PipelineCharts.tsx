'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChartPeriod {
  label: string
  inquiries: number
  offers: number
  deposits: number
  clicks: number
  closeRate: number  // 0–100
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: '#FDFAF7',
  border: '1px solid rgba(10,46,77,0.07)',
  borderRadius: 20,
  boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
  padding: 20,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TICK: any = { fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }

const TOOLTIP_CONTENT = {
  background: '#FDFAF7',
  border: '1px solid rgba(10,46,77,0.1)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 4px 20px rgba(10,46,77,0.1)',
}

const TOOLTIP_LABEL = { color: '#0A2E4D', fontWeight: 600, marginBottom: 4 }

function EmptyState() {
  return (
    <div className="h-[220px] flex items-center justify-center">
      <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No data</p>
    </div>
  )
}

// ─── Bar chart: Inquiries / Offers / Deposits per period ──────────────────────

export function PipelineBarChart({ data }: { data: ChartPeriod[] }) {
  return (
    <div style={CARD_STYLE}>
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Funnel Volume
      </p>
      <p className="text-sm font-bold f-display text-[#0A2E4D] mb-4">Inquiries · Offers · Deposits</p>
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,46,77,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ ...TICK, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ ...TICK, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
            />
            <Tooltip contentStyle={TOOLTIP_CONTENT} labelStyle={TOOLTIP_LABEL} />
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'rgba(10,46,77,0.6)' }}
            />
            <Bar dataKey="inquiries" name="Inquiries" fill="#0A2E4D"             radius={[3,3,0,0]} maxBarSize={22} />
            <Bar dataKey="offers"    name="Offers"    fill="rgba(10,46,77,0.35)" radius={[3,3,0,0]} maxBarSize={22} />
            <Bar dataKey="deposits"  name="Deposits"  fill="#E67E50"             radius={[3,3,0,0]} maxBarSize={22} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Line chart: Close rate trend ─────────────────────────────────────────────

export function CloseRateLineChart({ data }: { data: ChartPeriod[] }) {
  return (
    <div style={CARD_STYLE}>
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Conversion
      </p>
      <p className="text-sm font-bold f-display text-[#0A2E4D] mb-4">Close Rate (deposits ÷ inquiries)</p>
      {data.length === 0 ? <EmptyState /> : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,46,77,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ ...TICK, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ ...TICK, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              width={36}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT}
              labelStyle={TOOLTIP_LABEL}
              formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)}%` : '—', 'Close Rate']}
            />
            <Line
              dataKey="closeRate"
              name="Close Rate"
              stroke="#E67E50"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#E67E50', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
