// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
//
// Weekly review: eight numbers from today's tables (FA-1.10, REBUILD_PLAN §9).
import Link from 'next/link'
import { getWeeklyReviewData } from '@/actions/weekly'
import { lastWeeks } from '@/lib/metrics/weeks'
import {
  adSpendPerWeek,
  bookingsInMonth,
  commissionToDate,
  costPerWeek,
  cumulativeConversion,
  inquiriesPerWeek,
  lostReasons,
  qualifiedPerWeek,
} from '@/lib/metrics/weekly'
import { Card, CardContent } from '@/components/ui/card'
import { WeeklyCharts } from './WeeklyCharts'

export const metadata = {
  title: 'Weekly review — FjordAnglers Admin',
}

// The page reads the session and the clock on every request.
export const dynamic = 'force-dynamic'

const YEAR_START = '2026-01-01'
const WEEKS_SHOWN = 5

const pln0 = (n: number) =>
  `${n.toLocaleString('pl', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`
const pln2 = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('pl', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`)

function delta(curr: number | null, prev: number | null, lowerIsBetter = false): {
  sign: string; color: string; diff: string
} | null {
  if (curr == null || prev == null || prev === 0) return null
  const d = curr - prev
  if (d === 0) return null
  const isGood = lowerIsBetter ? d < 0 : d > 0
  return {
    sign:  d > 0 ? '↑' : '↓',
    color: isGood ? 'text-emerald-600' : 'text-red-500',
    diff:  Math.abs(d).toString(),
  }
}

function Tile({
  label,
  value,
  sub,
  deltaEl,
  href,
}: {
  label:    string
  value:    string
  sub?:     string
  deltaEl?: React.ReactNode
  href?:    string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-5">
        <p className="text-[10px] uppercase tracking-[0.18em] f-body text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold f-display leading-none text-foreground">{value}</p>
        {sub != null && (
          <p className="text-xs f-body mt-1 text-muted-foreground">{sub}</p>
        )}
        {deltaEl != null && <div className="mt-1">{deltaEl}</div>}
        {href != null && (
          <Link href={href} className="text-[10px] f-body mt-2 block text-muted-foreground/60 hover:text-foreground underline underline-offset-2">
            See details →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function Delta({ d }: { d: ReturnType<typeof delta> }) {
  if (d == null) return null
  return (
    <span className={`text-xs font-semibold f-body ${d.color}`}>
      {d.sign}{d.diff} vs prev
    </span>
  )
}

export default async function WeeklyPage() {
  const now = new Date()
  const weeks = lastWeeks(now, WEEKS_SHOWN)
  const oldestStart = weeks[weeks.length - 1]?.start ?? YEAR_START

  const { inquiries, adRows, lastAdDate, rates } = await getWeeklyReviewData(YEAR_START, oldestStart)

  const commission = commissionToDate(inquiries, rates, YEAR_START)
  const bookings   = bookingsInMonth(inquiries, now)
  const perWeek    = inquiriesPerWeek(inquiries, weeks)
  const qualified  = qualifiedPerWeek(inquiries, weeks)
  const spend      = adSpendPerWeek(adRows, weeks)
  const cost       = costPerWeek(inquiries, adRows, weeks)
  const conversion = cumulativeConversion(inquiries, YEAR_START)
  const lost       = lostReasons(inquiries, now)

  const currentSpend   = spend[0]?.spendPln ?? 0
  const prevSpend      = spend[1]?.spendPln ?? null
  const currentCostInq = cost[0]?.all.perInquiry ?? null
  const prevCostInq    = cost[1]?.all.perInquiry ?? null

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1000px]">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body text-muted-foreground">
          FjordAnglers Admin · temporary screen
        </p>
        <h1 className="text-foreground text-3xl font-bold f-display">Weekly review</h1>
        <p className="text-sm f-body mt-1 text-muted-foreground">
          Weeks are Monday–Sunday, Europe/Warsaw. Current week: {weeks[0]?.key} ({weeks[0]?.start} → {weeks[0]?.end}).
          Rates: 1 EUR = {rates.eurPln} PLN, 1 USD = {rates.usdEur} EUR (finance_settings).
          {lastAdDate != null && <> · last ad sync: {lastAdDate}</>}
        </p>
      </div>

      {/* KPI tiles — 4 cols on md+, 2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Tile
          label="Commission to date"
          value={pln0(commission.pln)}
          sub={`of ${pln0(commission.targetPln)} · ${commission.deals} paid`}
          href="/admin/finances"
        />
        <Tile
          label="Bookings this month"
          value={String(bookings.current)}
          sub={`${bookings.previous} in ${bookings.previousKey}`}
          deltaEl={<Delta d={delta(bookings.current, bookings.previous)} />}
          href="/admin/inquiries"
        />
        <Tile
          label="Inquiries / week"
          value={String(perWeek[0]?.count ?? 0)}
          sub={`${perWeek[1]?.count ?? '—'} last week`}
          deltaEl={<Delta d={delta(perWeek[0]?.count ?? null, perWeek[1]?.count ?? null)} />}
          href="/admin/inquiries"
        />
        <Tile
          label="Qualified / week"
          value={String(qualified[0]?.yes ?? 0)}
          sub={`${qualified[1]?.yes ?? '—'} last week`}
          deltaEl={<Delta d={delta(qualified[0]?.yes ?? null, qualified[1]?.yes ?? null)} />}
          href="/admin/inquiries"
        />
        <Tile
          label="Ad spend this week"
          value={pln2(currentSpend)}
          sub={`${pln2(prevSpend)} last week`}
          deltaEl={<Delta d={delta(currentSpend, prevSpend, true)} />}
          href="/admin/ads"
        />
        <Tile
          label="Cost / inquiry"
          value={pln2(currentCostInq)}
          sub={`${pln2(prevCostInq)} last week`}
          deltaEl={<Delta d={delta(currentCostInq, prevCostInq, true)} />}
          href="/admin/ads"
        />
        <Tile
          label="Conversion (YTD)"
          value={pct(conversion.rate)}
          sub={`${conversion.booked} of ${conversion.inquiries}`}
          href="/admin/inquiries"
        />
        <Tile
          label="Lost (90d)"
          value={String(lost.reduce((s, l) => s + l.count, 0))}
          sub={`${lost.length} reason${lost.length === 1 ? '' : 's'}`}
          href="/admin/inquiries"
        />
      </div>

      {/* Charts + collapsible detail tables */}
      <WeeklyCharts
        perWeek={perWeek}
        qualified={qualified}
        spend={spend}
        cost={cost}
        lost={lost}
      />
    </div>
  )
}
