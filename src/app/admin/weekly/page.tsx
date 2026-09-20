// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
//
// Weekly review: eight numbers from today's tables (FA-1.10, REBUILD_PLAN §9).
// Deliberately plain: no charts, no date filters. Every number has its definition
// underneath and a link to where the rows can be inspected.
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
  type CostBlock,
} from '@/lib/metrics/weekly'

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
  n === null ? '—' : `${n.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`)

function Section({
  n,
  title,
  metric,
  definition,
  href,
  hrefLabel,
  children,
}: {
  n: number
  title: string
  metric: string
  definition: string
  href: string
  hrefLabel: string
  children: React.ReactNode
}) {
  return (
    <section
      className="p-5 rounded-[18px] mb-4"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
        {n}. {title} · {metric}
      </p>
      {children}
      <p className="text-xs f-body mt-3" style={{ color: 'rgba(10,46,77,0.5)' }}>
        {definition}{' '}
        <Link href={href} className="underline">
          {hrefLabel}
        </Link>
      </p>
    </section>
  )
}

function Big({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xl font-bold f-display leading-none mb-2" style={{ color: '#0A2E4D' }}>
      {children}
    </p>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="text-xs f-body tabular-nums" style={{ color: '#0A2E4D' }}>
      <thead>
        <tr>
          {head.map(h => (
            <th key={h} className="text-left pr-6 pb-1 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={String(r[0])}>
            {r.map((cell, i) => (
              <td key={i} className="pr-6 py-0.5">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const costCells = (b: CostBlock) => [b.inquiries, b.qualified, pln2(b.perInquiry), pln2(b.perQualified)]

export default async function WeeklyPage() {
  const now = new Date()
  const weeks = lastWeeks(now, WEEKS_SHOWN)
  const oldestStart = weeks[weeks.length - 1]?.start ?? YEAR_START

  const { inquiries, adRows, lastAdDate, rates } = await getWeeklyReviewData(YEAR_START, oldestStart)

  const commission = commissionToDate(inquiries, rates, YEAR_START)
  const bookings = bookingsInMonth(inquiries, now)
  const perWeek = inquiriesPerWeek(inquiries, weeks)
  const qualified = qualifiedPerWeek(inquiries, weeks)
  const spend = adSpendPerWeek(adRows, weeks)
  const cost = costPerWeek(inquiries, adRows, weeks)
  const conversion = cumulativeConversion(inquiries, YEAR_START)
  const lost = lostReasons(inquiries, now)

  const currentSpend = spend[0]?.spendPln ?? 0

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1000px]">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          FjordAnglers Admin · temporary screen
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">Weekly review</h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Weeks are Monday–Sunday, Europe/Warsaw. Current week: {weeks[0]?.key} ({weeks[0]?.start} → {weeks[0]?.end}).
          Rates: 1 EUR = {rates.eurPln} PLN, 1 USD = {rates.usdEur} EUR (finance_settings).
        </p>
      </div>

      <Section
        n={1}
        title="Commission to date"
        metric="M1"
        definition="Sum of the deposit (offer_deposit_eur ?? deposit_amount ?? internal_commission_eur, USD converted) of inquiries with deposit_paid_at set, since 1 Jan 2026. Same formula as /admin/finances, but that page selects rows by status and can differ."
        href="/admin/finances"
        hrefLabel="Finances →"
      >
        <Big>
          {pln0(commission.pln)} <span className="text-sm font-normal">of {pln0(commission.targetPln)} · {commission.deals} paid deposit{commission.deals === 1 ? '' : 's'}</span>
        </Big>
      </Section>

      <Section
        n={2}
        title="Bookings in the month"
        metric="M2"
        definition="Inquiries whose deposit was paid (deposit_paid_at) in the calendar month."
        href="/admin/finances"
        hrefLabel="Finances →"
      >
        <Big>
          {bookings.current} <span className="text-sm font-normal">in {bookings.currentKey} · {bookings.previous} in {bookings.previousKey}</span>
        </Big>
      </Section>

      <Section
        n={3}
        title="Inquiries per week"
        metric="M5 numerator"
        definition="Inquiries created in the ISO week (created_at)."
        href="/admin/inquiries"
        hrefLabel="Inquiries →"
      >
        <Big>{perWeek[0]?.count ?? 0} <span className="text-sm font-normal">this week</span></Big>
        <Table head={['Week', 'From', 'Inquiries']} rows={perWeek.map(w => [w.key, w.start, w.count])} />
      </Section>

      <Section
        n={4}
        title="Qualified per week"
        metric="M5"
        definition="Inquiries with qualified = 'yes' (column, not events); 'unknown' shows how many are not yet assessed."
        href="/admin/inquiries"
        hrefLabel="Inquiries →"
      >
        <Big>
          {qualified[0]?.yes ?? 0} <span className="text-sm font-normal">qualified this week · {qualified[0]?.unknown ?? 0} unknown</span>
        </Big>
        <Table
          head={['Week', 'Yes', 'No', 'Unknown', 'Total']}
          rows={qualified.map(w => [w.key, w.yes, w.no, w.unknown, w.total])}
        />
      </Section>

      <Section
        n={5}
        title="Ad spend"
        metric="M6 numerator"
        definition="Sum of ad_campaigns.spend per week. The column is already PLN (Google Ads account currency) — no conversion."
        href="/admin/ads"
        hrefLabel="Ads →"
      >
        <Big>{pln2(currentSpend)} <span className="text-sm font-normal">this week</span></Big>
        <p className="text-xs f-body mb-2" style={{ color: 'rgba(10,46,77,0.5)' }}>
          last sync (newest ad_campaigns row): {lastAdDate ?? 'no data'}
        </p>
        <Table head={['Week', 'From', 'Spend']} rows={spend.map(w => [w.key, w.start, pln2(w.spendPln)])} />
      </Section>

      <Section
        n={6}
        title="Cost per inquiry / per qualified"
        metric="M6"
        definition="Ad spend of the week ÷ inquiries (÷ qualified) of the week. 'Paid' counts only inquiries with a gclid or utm_medium cpc/paid; 'all' counts every inquiry. Never taken from the Google Ads conversions column."
        href="/admin/ads"
        hrefLabel="Ads →"
      >
        <Table
          head={[
            'Week', 'Spend',
            'Paid inq.', 'Paid qual.', 'Paid zł/inq.', 'Paid zł/qual.',
            'All inq.', 'All qual.', 'All zł/inq.', 'All zł/qual.',
          ]}
          rows={cost.map(w => [w.key, pln2(w.spendPln), ...costCells(w.attributed), ...costCells(w.all)])}
        />
      </Section>

      <Section
        n={7}
        title="Cumulative conversion"
        metric="M7 approximation"
        definition="Inquiries created since 1 Jan 2026 with a paid deposit ÷ all such inquiries. WARNING: this is a period ratio and understates conversion — winning inquiries have 60+ days of lead time. The correct cohort view arrives in stage 5 (M7)."
        href="/admin/inquiries"
        hrefLabel="Inquiries →"
      >
        <Big>
          {pct(conversion.rate)} <span className="text-sm font-normal">{conversion.booked} of {conversion.inquiries}</span>
        </Big>
      </Section>

      <Section
        n={8}
        title="Lost reasons"
        metric="last 90 days"
        definition="Inquiries with status 'lost' by lost_reason_code, last 90 days. There is no lost_at column, so updated_at stands in for the date it was lost."
        href="/admin/inquiries"
        hrefLabel="Inquiries →"
      >
        {lost.length === 0 ? (
          <Big>0</Big>
        ) : (
          <Table head={['Reason', 'Count']} rows={lost.map(l => [l.code ?? 'no code', l.count])} />
        )}
      </Section>
    </div>
  )
}
