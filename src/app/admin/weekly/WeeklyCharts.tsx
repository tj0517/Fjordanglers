'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  InquiriesPerWeek,
  QualifiedPerWeek,
  AdSpendPerWeek,
  CostPerWeek,
  LostReason,
} from '@/lib/metrics/weekly'

interface Props {
  perWeek:   InquiriesPerWeek[]
  qualified: QualifiedPerWeek[]
  spend:     AdSpendPerWeek[]
  cost:      CostPerWeek[]
  lost:      LostReason[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pln0 = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('pl', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`


// ─── Section wrapper with collapsible table ───────────────────────────────────

function ChartSection({
  title,
  metric,
  children,
  tableContent,
}: {
  title:        string
  metric:       string
  children:     React.ReactNode
  tableContent: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.18em] f-body text-muted-foreground">
            {title} · {metric}
          </p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setOpen(v => !v)}
            className="text-muted-foreground flex-shrink-0"
          >
            {open ? 'Hide table' : 'Show table'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {children}
        {open && (
          <div className="mt-4 overflow-x-auto">
            {tableContent}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyCharts({ perWeek, qualified, spend, cost, lost }: Props) {
  const inqData  = perWeek.map(w => ({ week: w.key, Inquiries: w.count }))
  const qualData = qualified.map(w => ({ week: w.key, Yes: w.yes, No: w.no, Unknown: w.unknown }))
  const spendData = spend.map(w => ({ week: w.key, 'Spend (PLN)': Math.round(w.spendPln) }))
  const costData = cost.map(w => ({
    week:             w.key,
    'Paid zł/inq':    Math.round(w.attributed.perInquiry ?? 0),
    'All zł/inq':     Math.round(w.all.perInquiry ?? 0),
  }))
  const lostData = lost.map(l => ({ reason: l.code ?? 'no code', Count: l.count }))

  return (
    <>
      {/* 1. Inquiries per week */}
      <ChartSection
        title="Inquiries per week"
        metric="M5 numerator"
        tableContent={
          <Table className="text-xs f-body tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Inquiries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perWeek.map(w => (
                <TableRow key={w.key}>
                  <TableCell>{w.key}</TableCell>
                  <TableCell>{w.start}</TableCell>
                  <TableCell>{w.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={inqData} barSize={24}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={24} />
            <Tooltip />
            <Bar dataKey="Inquiries" fill="var(--color-primary)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 2. Qualified per week */}
      <ChartSection
        title="Qualified per week"
        metric="M5"
        tableContent={
          <Table className="text-xs f-body tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Yes</TableHead>
                <TableHead>No</TableHead>
                <TableHead>Unknown</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qualified.map(w => (
                <TableRow key={w.key}>
                  <TableCell>{w.key}</TableCell>
                  <TableCell>{w.yes}</TableCell>
                  <TableCell>{w.no}</TableCell>
                  <TableCell>{w.unknown}</TableCell>
                  <TableCell>{w.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={qualData} barSize={20}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={24} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Yes"     stackId="a" fill="#10b981" radius={[0,0,0,0]} />
            <Bar dataKey="No"      stackId="a" fill="#ef4444" radius={[0,0,0,0]} />
            <Bar dataKey="Unknown" stackId="a" fill="#94a3b8" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 3. Ad spend */}
      <ChartSection
        title="Ad spend"
        metric="M6 numerator"
        tableContent={
          <Table className="text-xs f-body tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spend.map(w => (
                <TableRow key={w.key}>
                  <TableCell>{w.key}</TableCell>
                  <TableCell>{w.start}</TableCell>
                  <TableCell>{pln0(w.spendPln)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={spendData} barSize={24}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v) => (v == null ? '—' : pln0(Number(v)))} />
            <Bar dataKey="Spend (PLN)" fill="var(--color-accent)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 4. Cost per inquiry */}
      <ChartSection
        title="Cost per inquiry / qualified"
        metric="M6"
        tableContent={
          <Table className="text-xs f-body tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Paid inq.</TableHead>
                <TableHead>Paid qual.</TableHead>
                <TableHead>Paid zł/inq.</TableHead>
                <TableHead>Paid zł/qual.</TableHead>
                <TableHead>All inq.</TableHead>
                <TableHead>All qual.</TableHead>
                <TableHead>All zł/inq.</TableHead>
                <TableHead>All zł/qual.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cost.map(w => (
                <TableRow key={w.key}>
                  <TableCell>{w.key}</TableCell>
                  <TableCell>{pln0(w.spendPln)}</TableCell>
                  <TableCell>{w.attributed.inquiries}</TableCell>
                  <TableCell>{w.attributed.qualified}</TableCell>
                  <TableCell>{pln0(w.attributed.perInquiry)}</TableCell>
                  <TableCell>{pln0(w.attributed.perQualified)}</TableCell>
                  <TableCell>{w.all.inquiries}</TableCell>
                  <TableCell>{w.all.qualified}</TableCell>
                  <TableCell>{pln0(w.all.perInquiry)}</TableCell>
                  <TableCell>{pln0(w.all.perQualified)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={costData}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v) => (v == null ? '—' : pln0(Number(v)))} />
            <Legend />
            <Line type="monotone" dataKey="Paid zł/inq" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="All zł/inq"  stroke="var(--color-accent)"  strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* 5. Lost reasons */}
      {lost.length > 0 && (
        <ChartSection
          title="Lost reasons"
          metric="last 90 days"
          tableContent={
            <Table className="text-xs f-body tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lost.map(l => (
                  <TableRow key={l.code ?? 'none'}>
                    <TableCell>{l.code ?? 'no code'}</TableCell>
                    <TableCell>{l.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        >
          <ResponsiveContainer width="100%" height={Math.max(120, lost.length * 32 + 40)}>
            <BarChart data={lostData} layout="vertical" barSize={18}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="Count" fill="#ef4444" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}
    </>
  )
}
