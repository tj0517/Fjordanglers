'use client'

import { dealTripPrice, dealOurCut } from './pipeline-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineDeal {
  id: string
  angler_name: string
  angler_email: string
  offer_sent_at: string | null
  updated_at: string
  offer_total_eur: number | null         // full trip price (from rich offer)
  internal_deal_total_eur: number | null // full trip price (internal tracking)
  offer_deposit_eur: number | null       // deposit we'd collect (from rich offer)
  deposit_amount: number | null          // legacy deposit field
  internal_commission_eur: number | null // our cut (internal tracking)
  created_at: string
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function urgencyColor(days: number): string {
  if (days <= 3) return '#16A34A'
  if (days <= 7) return '#E67E50'
  return '#DC2626'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PipelineClient({
  deals,
  eurRate,
}: {
  deals: PipelineDeal[]
  eurRate: number
}) {
  const totalEur     = deals.reduce((s, d) => s + (dealTripPrice(d) ?? 0), 0)
  const totalDepEur  = deals.reduce((s, d) => s + (dealOurCut(d) ?? 0), 0)

  const fmtEur = (n: number) =>
    '€' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtPln = (n: number) =>
    n.toLocaleString('pl', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł'

  if (deals.length === 0) {
    return (
      <div
        className="rounded-[18px] px-6 py-12 text-center"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          No open deals right now. Offers in <code>deposit_sent</code> status will appear here.
        </p>
      </div>
    )
  }

  return (
    <div>

      {/* ── Summary bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[
          { label: 'Open deals',         value: String(deals.length) },
          { label: 'Our potential cut',  value: fmtEur(totalDepEur), sub: `≈ ${fmtPln(totalDepEur * eurRate)}` },
          { label: 'Total trip value',   value: fmtEur(totalEur),    sub: 'guide + our cut combined' },
        ].map(c => (
          <div
            key={c.label}
            className="flex-1 min-w-[160px] p-4 rounded-[14px]"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {c.label}
            </p>
            <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>{c.value}</p>
            {c.sub && <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.35)' }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] overflow-hidden"
        style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
      >
        <table className="w-full text-sm f-body">
          <thead>
            <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              {[
                ['Angler',           'text-left'],
                ['Trip price (full)', 'text-right'],
                ['Our cut',          'text-right'],
                ['→ PLN',            'text-right'],
                ['Offer sent',       'text-right'],
                ['Waiting',          'text-right'],
              ].map(([h, a]) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-semibold ${a}`}
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody style={{ background: '#FDFAF7' }}>
            {deals.map(d => {
              const tripPrice   = dealTripPrice(d)
              const deposit     = dealOurCut(d)
              const offerDate   = d.offer_sent_at ?? d.updated_at ?? d.created_at
              const days        = daysAgo(offerDate)
              const waitColor   = urgencyColor(days)

              return (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>

                  {/* Angler */}
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: '#0A2E4D' }}>{d.angler_name}</p>
                    <p className="text-xs" style={{ color: 'rgba(10,46,77,0.45)' }}>{d.angler_email}</p>
                  </td>

                  {/* Trip price */}
                  <td className="px-4 py-3 text-right font-mono" style={{ color: tripPrice ? '#0A2E4D' : 'rgba(10,46,77,0.3)' }}>
                    {tripPrice != null ? fmtEur(tripPrice) : '—'}
                  </td>

                  {/* Deposit */}
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: deposit != null ? '#16A34A' : 'rgba(10,46,77,0.3)' }}>
                    {deposit != null ? fmtEur(deposit) : '—'}
                  </td>

                  {/* Deposit in PLN */}
                  <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {deposit != null ? fmtPln(deposit * eurRate) : '—'}
                  </td>

                  {/* Offer sent date */}
                  <td className="px-4 py-3 text-right text-xs" style={{ color: 'rgba(10,46,77,0.5)' }}>
                    {new Date(offerDate).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                  </td>

                  {/* Days waiting */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className="text-xs font-semibold f-body px-2 py-0.5 rounded-full"
                      style={{ background: `${waitColor}18`, color: waitColor }}
                    >
                      {days}d
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totals */}
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(10,46,77,0.1)', background: 'rgba(10,46,77,0.03)' }}>
              <td className="px-4 py-3 font-bold f-body" style={{ color: '#0A2E4D' }}>
                {deals.length} open deal{deals.length !== 1 ? 's' : ''}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#0A2E4D' }}>
                {fmtEur(totalEur)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#16A34A' }}>
                {fmtEur(totalDepEur)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: 'rgba(10,46,77,0.55)' }}>
                {fmtPln(totalDepEur * eurRate)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
