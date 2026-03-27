import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HelpWidget } from '@/components/ui/help-widget'

export const revalidate = 0

export const metadata = { title: 'Earnings — FjordAnglers Dashboard' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getLastNMonths(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const offset = n - 1 - i
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[d.getMonth()]!, isCurrent: offset === 0 }
  })
}

// ─── Payout status chip ───────────────────────────────────────────────────────

function PayoutChip({ payoutStatus, bookingStatus }: { payoutStatus: string; bookingStatus: string }) {
  if (payoutStatus === 'sent') {
    return <Chip label="Paid out" bg="rgba(74,222,128,0.1)" color="#16A34A" dot />
  }
  if (payoutStatus === 'returned') {
    return <Chip label="Refunded" bg="rgba(239,68,68,0.08)" color="#DC2626" />
  }
  if (['confirmed', 'completed'].includes(bookingStatus)) {
    return <Chip label="Awaiting payout" bg="rgba(230,126,80,0.1)" color="#C96030" />
  }
  if (bookingStatus === 'accepted') {
    return <Chip label="Deposit pending" bg="rgba(59,130,246,0.1)" color="#2563EB" />
  }
  if (['declined', 'refunded', 'cancelled'].includes(bookingStatus)) {
    return <Chip label="Cancelled" bg="rgba(239,68,68,0.07)" color="#DC2626" />
  }
  return <Chip label="Pending" bg="rgba(10,46,77,0.07)" color="rgba(10,46,77,0.5)" />
}

function Chip({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full f-body flex-shrink-0"
      style={{ background: bg, color }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
      {label}
    </span>
  )
}

// ─── SVG bar chart ────────────────────────────────────────────────────────────

function EarningsChart({ bars }: { bars: { key: string; label: string; value: number; isCurrent: boolean }[] }) {
  const max   = Math.max(...bars.map(b => b.value), 100)
  const BAR_W = 40
  const GAP   = 12
  const CH    = 100
  const LH    = 18
  const W     = bars.length * BAR_W + (bars.length - 1) * GAP

  return (
    <svg viewBox={`0 0 ${W} ${CH + LH}`} className="w-full" style={{ overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={0} y1={CH - pct * CH} x2={W} y2={CH - pct * CH}
          stroke="rgba(10,46,77,0.06)" strokeWidth="1" />
      ))}
      {bars.map((bar, i) => {
        const barH = Math.max((bar.value / max) * CH, 3)
        const x    = i * (BAR_W + GAP)
        return (
          <g key={bar.key}>
            <rect x={x} y={CH - barH} width={BAR_W} height={barH} rx={5}
              fill={bar.isCurrent ? '#E67E50' : bar.value > 0 ? 'rgba(230,126,80,0.28)' : 'rgba(10,46,77,0.06)'} />
            {bar.value > 0 && (
              <text x={x + BAR_W / 2} y={CH - barH - 5} textAnchor="middle" fontSize={7.5}
                fontFamily="DM Sans, sans-serif" fontWeight="600"
                fill={bar.isCurrent ? '#E67E50' : 'rgba(10,46,77,0.4)'}>
                {bar.value >= 1000 ? `€${(bar.value / 1000).toFixed(1)}k` : `€${Math.round(bar.value)}`}
              </text>
            )}
            <text x={x + BAR_W / 2} y={CH + LH - 2} textAnchor="middle" fontSize={9}
              fontFamily="DM Sans, sans-serif" fontWeight={bar.isCurrent ? '700' : '400'}
              fill={bar.isCurrent ? '#E67E50' : 'rgba(10,46,77,0.38)'}>
              {bar.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login?next=/dashboard/earnings')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // ── Dates ──────────────────────────────────────────────────────────────────
  const now          = new Date()
  const today        = now.toISOString().split('T')[0]!
  const monthStart   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const sixMonthsAgo = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  // ── Queries ────────────────────────────────────────────────────────────────
  const [
    { data: allBks },
    { data: chartBks },
    { data: transactions },
  ] = await Promise.all([
    // All bookings for summary stats
    supabase
      .from('bookings')
      .select('status, payout_status, guide_payout_eur, booking_date')
      .eq('guide_id', guide.id),
    // Last 6 months for chart
    supabase
      .from('bookings')
      .select('booking_date, guide_payout_eur')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', sixMonthsAgo),
    // Transaction list — all bookings, rich data
    supabase
      .from('bookings')
      .select('id, status, payout_status, payout_sent_at, guide_payout_eur, total_eur, deposit_eur, booking_date, angler_full_name, guests, experience:experiences(title)')
      .eq('guide_id', guide.id)
      .order('booking_date', { ascending: false })
      .limit(50),
  ])

  const rows = allBks ?? []

  // ── Summary stats ──────────────────────────────────────────────────────────
  // Already in guide's bank (admin sent payout)
  const paidOut = rows
    .filter(b => b.payout_status === 'sent')
    .reduce((s, b) => s + b.guide_payout_eur, 0)

  // Trip confirmed/completed, admin hasn't sent payout yet
  const awaitingPayout = rows
    .filter(b => b.payout_status === 'pending' && ['confirmed', 'completed'].includes(b.status))
    .reduce((s, b) => s + b.guide_payout_eur, 0)

  // Upcoming confirmed trips (trip date in the future, not yet earned)
  const upcoming = rows
    .filter(b => b.payout_status === 'pending' && b.status === 'confirmed' && (b.booking_date ?? '') >= today)
    .reduce((s, b) => s + b.guide_payout_eur, 0)

  // This month earned (confirmed/completed)
  const thisMonth = rows
    .filter(b => ['confirmed', 'completed'].includes(b.status) && (b.booking_date ?? '') >= monthStart)
    .reduce((s, b) => s + b.guide_payout_eur, 0)

  // ── Chart data ─────────────────────────────────────────────────────────────
  const months  = getLastNMonths(6)
  const monthMap: Record<string, number> = {}
  for (const b of chartBks ?? []) {
    const k = b.booking_date.slice(0, 7)
    monthMap[k] = (monthMap[k] ?? 0) + b.guide_payout_eur
  }
  const chartBars = months.map(m => ({ ...m, value: monthMap[m.key] ?? 0 }))

  // ── Revenue by trip ────────────────────────────────────────────────────────
  type TxRow = typeof transactions extends (infer T)[] | null ? T : never
  const byExp: Record<string, { title: string; revenue: number; count: number }> = {}
  for (const tx of (transactions ?? []) as TxRow[]) {
    if (!['confirmed', 'completed'].includes(tx.status)) continue
    const expId = (tx as { experience?: { title?: string } | null }).experience != null
      ? JSON.stringify((tx as { experience: unknown }).experience)
      : 'unknown'
    const title = ((tx as { experience?: { title?: string } | null }).experience?.title) ?? 'Unknown trip'
    if (!byExp[expId]) byExp[expId] = { title, revenue: 0, count: 0 }
    byExp[expId].revenue += tx.guide_payout_eur
    byExp[expId].count   += 1
  }
  const tripBreakdown = Object.values(byExp).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const totalEarned   = paidOut + awaitingPayout

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[900px]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>Guide Dashboard</p>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            Earnings
          </h1>
          <HelpWidget
            title="Earnings"
            description="Your payout history and upcoming earnings from confirmed bookings."
            items={[
              { icon: '✅', title: 'Paid out', text: 'Earnings already transferred to your bank account by FjordAnglers.' },
              { icon: '⏳', title: 'Awaiting payout', text: 'Trip is confirmed or completed but the admin has not yet sent the transfer. Usually processed within a few business days.' },
              { icon: '📅', title: 'Upcoming trips', text: 'Earnings from confirmed future trips — the money will be in your account after the trip is completed.' },
              { icon: '💶', title: 'Your cut', text: 'Your guide payout = total paid by angler minus the platform commission and 5% service fee. The balance payment has no platform fee.' },
            ]}
          />
        </div>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Your payout history and upcoming earnings.
        </p>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Paid out',        value: fmtEur(paidOut),         sub: 'in your bank',           accent: '#16A34A', bg: 'rgba(74,222,128,0.07)'  },
          { label: 'Awaiting payout', value: fmtEur(awaitingPayout),  sub: 'trip done, pending send', accent: '#E67E50', bg: 'rgba(230,126,80,0.07)' },
          { label: 'Upcoming trips',  value: fmtEur(upcoming),        sub: 'confirmed, not yet',      accent: '#2563EB', bg: 'rgba(59,130,246,0.07)'  },
          { label: 'This month',      value: fmtEur(thisMonth),       sub: 'earned in current month', accent: '#0A2E4D', bg: 'rgba(10,46,77,0.04)'   },
        ].map(s => (
          <div key={s.label} className="rounded-2xl px-5 py-4"
            style={{ background: s.bg, border: '1px solid rgba(10,46,77,0.07)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1.5"
               style={{ color: 'rgba(10,46,77,0.38)' }}>{s.label}</p>
            <p className="text-2xl font-bold f-display" style={{ color: s.accent }}>{s.value}</p>
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart + Trip breakdown ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Bar chart */}
        <div className="sm:col-span-2 rounded-2xl px-6 py-5"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                 style={{ color: 'rgba(10,46,77,0.38)' }}>Monthly earnings — last 6 months</p>
              <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                {fmtEur(chartBars.reduce((s, b) => s + b.value, 0))}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                 style={{ color: 'rgba(10,46,77,0.38)' }}>All-time earned</p>
              <p className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>{fmtEur(totalEarned)}</p>
            </div>
          </div>
          <EarningsChart bars={chartBars} />
        </div>

        {/* Top trips */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>Top trips by earnings</p>
          </div>
          {tripBreakdown.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No confirmed bookings yet</p>
            </div>
          ) : (
            <div className="flex flex-col px-5 py-4 gap-3.5">
              {tripBreakdown.map((t, i) => (
                <div key={t.title + i}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold f-body truncate pr-2" style={{ color: '#0A2E4D' }}>{t.title}</p>
                    <p className="text-xs font-bold f-body flex-shrink-0" style={{ color: '#0A2E4D' }}>{fmtEur(t.revenue)}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,46,77,0.07)' }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${totalEarned > 0 ? Math.max((t.revenue / totalEarned) * 100, 6) : 0}%`,
                        background: i === 0 ? '#E67E50' : '#1B4F72',
                      }} />
                  </div>
                  <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    {t.count} {t.count === 1 ? 'booking' : 'bookings'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
             style={{ color: 'rgba(10,46,77,0.38)' }}>Transactions</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {(transactions ?? []).length} total
            </span>
          </div>
        </div>

        {(transactions ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No transactions yet.</p>
          </div>
        ) : (
          <>
            {/* Table head — desktop */}
            <div className="hidden sm:grid px-6 py-2.5"
              style={{
                gridTemplateColumns: '1fr 1.2fr 90px 90px 130px',
                borderBottom: '1px solid rgba(10,46,77,0.05)',
                background: 'rgba(10,46,77,0.02)',
              }}>
              {['Trip date', 'Angler', 'Total', 'Your cut', 'Status'].map(col => (
                <p key={col} className="text-[10px] uppercase tracking-[0.14em] font-semibold f-body"
                   style={{ color: 'rgba(10,46,77,0.35)' }}>{col}</p>
              ))}
            </div>

            <div className="flex flex-col">
              {(transactions ?? []).map((tx, idx) => {
                const exp = (tx as { experience?: { title?: string } | null }).experience
                const tripTitle = exp?.title ?? '—'
                const isSent    = tx.payout_status === 'sent'

                return (
                  <Link
                    key={tx.id}
                    href={`/dashboard/bookings/${tx.id}`}
                    className="transition-colors hover:bg-black/[0.015]"
                    style={idx > 0 ? { borderTop: '1px solid rgba(10,46,77,0.05)' } : {}}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid items-center px-6 py-4"
                      style={{ gridTemplateColumns: '1fr 1.2fr 90px 90px 130px' }}>

                      {/* Trip + date */}
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>{tripTitle}</p>
                        <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
                          {fmtDate(tx.booking_date)} · {tx.guests} {tx.guests === 1 ? 'guest' : 'guests'}
                        </p>
                      </div>

                      {/* Angler */}
                      <div className="min-w-0 pr-2">
                        <p className="text-sm f-body truncate" style={{ color: '#0A2E4D' }}>
                          {tx.angler_full_name ?? '—'}
                        </p>
                      </div>

                      {/* Total */}
                      <p className="text-sm font-semibold f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {fmtEur(tx.total_eur)}
                      </p>

                      {/* Guide payout */}
                      <p className="text-sm font-bold f-body" style={{ color: isSent ? '#16A34A' : '#0A2E4D' }}>
                        {fmtEur(tx.guide_payout_eur)}
                      </p>

                      {/* Status */}
                      <div className="flex flex-col gap-1 items-start">
                        <PayoutChip payoutStatus={tx.payout_status} bookingStatus={tx.status} />
                        {isSent && tx.payout_sent_at && (
                          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            {fmtDate(tx.payout_sent_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="sm:hidden flex items-center gap-3 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>{tripTitle}</p>
                        <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.42)' }}>
                          {fmtDate(tx.booking_date)} · {tx.angler_full_name ?? '—'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold f-body" style={{ color: isSent ? '#16A34A' : '#0A2E4D' }}>
                          {fmtEur(tx.guide_payout_eur)}
                        </p>
                        <div className="mt-1">
                          <PayoutChip payoutStatus={tx.payout_status} bookingStatus={tx.status} />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
