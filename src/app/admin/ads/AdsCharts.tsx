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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartPoint {
  date: string
  dateLabel: string
  spend: number
  conversions: number
  avgCpc: number
}

// ─── Tooltip formatters ───────────────────────────────────────────────────────

function plnFormatter(value: number) {
  return [`${value.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`]
}

// ─── Daily Spend chart ────────────────────────────────────────────────────────

export function SpendRevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <div
      className="p-5 rounded-[20px]"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Ad Spend
      </p>
      <p className="text-sm font-bold f-display text-[#0A2E4D] mb-4">Daily Spend (zł)</p>
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,46,77,0.07)" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v} zł`}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: '#FDFAF7',
                border: '1px solid rgba(10,46,77,0.1)',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 4px 20px rgba(10,46,77,0.1)',
              }}
              labelStyle={{ color: '#0A2E4D', fontWeight: 600, marginBottom: 4 }}
              formatter={(value) => [
                typeof value === 'number'
                  ? `${value.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                  : '—',
                'Spend',
              ]}
            />
            <Bar dataKey="spend" fill="#0A2E4D" radius={[3, 3, 0, 0]} maxBarSize={36} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Conversions + Spend + CPC chart ─────────────────────────────────────────

export function ConversionsCpcChart({ data }: { data: ChartPoint[] }) {
  return (
    <div
      className="p-5 rounded-[20px]"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Conversions, Spend &amp; CPC
      </p>
      <p className="text-sm font-bold f-display text-[#0A2E4D] mb-4">Daily Inquiries · Spend (zł) · CPC (zł)</p>
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,46,77,0.07)" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            {/* Left axis: CPC bars */}
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v} zł`}
              width={44}
            />
            {/* Right axis: spend line */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'rgba(10,46,77,0.45)', fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v} zł`}
              width={60}
            />
            {/* Hidden axis: inquiries pins — fixed 0-5 domain so dots don't distort scale */}
            <YAxis yAxisId="pins" hide domain={[0, 5]} />
            <Tooltip
              contentStyle={{
                background: '#FDFAF7',
                border: '1px solid rgba(10,46,77,0.1)',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 4px 20px rgba(10,46,77,0.1)',
              }}
              labelStyle={{ color: '#0A2E4D', fontWeight: 600, marginBottom: 4 }}
              formatter={(value, name) => {
                if (name === 'conversions')
                  return [typeof value === 'number' ? value : '—', 'Inquiries']
                const label = name === 'spend' ? 'Spend' : 'Avg. CPC'
                return [
                  typeof value === 'number'
                    ? `${value.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                    : '—',
                  label,
                ]
              }}
            />
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: 'rgba(10,46,77,0.6)' }}
              formatter={(value: string) =>
                value === 'conversions' ? 'Inquiries' : value === 'spend' ? 'Spend' : 'Avg. CPC'
              }
            />
            <Bar   yAxisId="left"  dataKey="avgCpc"       fill="#7C3AED"  radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line  yAxisId="right" dataKey="spend"        stroke="#0A2E4D" strokeWidth={2} dot={{ r: 2, fill: '#0A2E4D' }} activeDot={{ r: 4 }} connectNulls />
            {/* Inquiries: pins — stroke nearly invisible so tooltip still fires */}
            <Line  yAxisId="pins"  dataKey="conversions"  stroke="#E67E50" strokeWidth={1} strokeOpacity={0.15} dot={{ r: 5, fill: '#E67E50', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#E67E50' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
