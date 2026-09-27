// FA-1.36 — read-only counters + list for the data-completeness gaps (categories A–F).
// The action reads, src/lib/metrics/gaps.ts computes (CLAUDE.md rule 3). This page has
// no mutation and emits no event — it only links to the inquiry card, where FA-1.37 /
// FA-1.38 let the admin fix the gap.
import Link from 'next/link'
import { getDataGapsData, type GapCategory } from '@/actions/data-gaps'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Data gaps — FjordAnglers Admin',
}

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<GapCategory, string> = {
  A: 'Booking without a payment date',
  B: 'Booking without an amount',
  C: 'Offer without a date',
  D: 'Loss without a reason code',
  E: 'Inquiry dated later than first message',
  F: 'Qualified = unknown',
}

const COMPLETION_CATEGORIES: readonly GapCategory[] = ['A', 'B', 'C', 'D']
const INFO_CATEGORIES: readonly GapCategory[] = ['E', 'F']

function CounterCard({ category, count }: { category: GapCategory; count: number }) {
  const complete = count === 0
  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-5">
        <p className="text-[10px] uppercase tracking-[0.18em] f-body text-muted-foreground mb-1">
          {category}. {CATEGORY_LABELS[category]}
        </p>
        <p className={`text-2xl font-bold f-display leading-none ${complete ? 'text-emerald-600' : 'text-foreground'}`}>
          {count}
        </p>
      </CardContent>
    </Card>
  )
}

function dateStr(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

export default async function DataGapsPage() {
  const { counts, rows } = await getDataGapsData()

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body text-muted-foreground">
          FjordAnglers Admin
        </p>
        <h1 className="text-foreground text-3xl font-bold f-display">Data gaps</h1>
        <p className="text-sm f-body mt-1 text-muted-foreground">
          Read-only. Categories A–D are the completion measure for FA-1.39: when they all show 0,
          history is complete. E and F are informational. Fixing a gap happens on the inquiry card,
          not here.
        </p>
      </div>

      <p className="text-[11px] uppercase tracking-[0.18em] f-body text-muted-foreground mb-2">
        Completion measure (A–D)
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {COMPLETION_CATEGORIES.map(c => <CounterCard key={c} category={c} count={counts[c]} />)}
      </div>

      <p className="text-[11px] uppercase tracking-[0.18em] f-body text-muted-foreground mb-2">
        Informational (E–F)
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {INFO_CATEGORIES.map(c => <CounterCard key={c} category={c} count={counts[c]} />)}
      </div>

      <Card>
        <CardContent className="px-0 pt-0 pb-0">
          {rows.length === 0 ? (
            <p className="text-sm f-body text-muted-foreground px-5 py-6">
              No gaps — every inquiry is complete.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm f-body">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/inquiries/${row.id}`}
                          className="text-accent underline underline-offset-2"
                        >
                          {row.anglerName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{dateStr(row.createdAt)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{row.status}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {row.categories.map(c => (
                            <span
                              key={c}
                              title={CATEGORY_LABELS[c]}
                              className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md text-[11px] font-semibold bg-accent/12 text-accent"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
