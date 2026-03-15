import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Returns the last N month labels + keys in YYYY-MM format, oldest first. */
function getLastNMonths(n: number): Array<{ key: string; label: string }> {
  const months: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    months.push({ key, label })
  }
  return months
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (user == null) {
    return (
      <div className="px-10 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">Earnings</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          Please{' '}
          <Link href="/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to view your earnings.
        </p>
      </div>
    )
  }

  // ── Guide lookup ────────────────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, pricing_model')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-10 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">Earnings</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          No guide profile found.{' '}
          <Link href="/guides/apply" className="text-[#E67E50] underline underline-offset-2">Apply to become a guide →</Link>
        </p>
      </div>
    )
  }

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const [
    { data: allTimeRows },
    { data: thisMonthRows },
    { data: recentRows },
    { data: pendingRows },
    { data: expRevenueRows },
  ] = await Promise.all([
    // All confirmed/completed bookings — for all-time totals
    supabase
      .from('bookings')
      .select('guide_payout_eur, platform_fee_eur, total_eur, status')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']),

    // This month's confirmed/completed bookings
    supabase
      .from('bookings')
      .select('guide_payout_eur, total_eur')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', startOfMonth.toISOString().split('T')[0]),

    // Last 6 months — for monthly chart
    supabase
      .from('bookings')
      .select('guide_payout_eur, booking_date')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('booking_date', { ascending: true }),

    // Pending bookings — money that could come in
    supabase
      .from('bookings')
      .select('guide_payout_eur')
      .eq('guide_id', guide.id)
      .eq('status', 'pending'),

    // Revenue per experience — join with experiences for title
    supabase
      .from('bookings')
      .select('experience_id, guide_payout_eur, experience:experiences(title)')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']),
  ])

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totalEarned      = (allTimeRows ?? []).reduce((s, b) => s + b.guide_payout_eur, 0)
  const totalFees        = (allTimeRows ?? []).reduce((s, b) => s + b.platform_fee_eur, 0)
  const thisMonthEarned  = (thisMonthRows ?? []).reduce((s, b) => s + b.guide_payout_eur, 0)
  const pendingAmount    = (pendingRows ?? []).reduce((s, b) => s + b.guide_payout_eur, 0)

  // ── Monthly breakdown (last 6 months) ──────────────────────────────────────
  const months = getLastNMonths(6)
  const monthlyMap: Record<string, number> = {}
  for (const row of recentRows ?? []) {
    const monthKey = row.booking_date.slice(0, 7) // 'YYYY-MM'
    monthlyMap[monthKey] = (monthlyMap[monthKey] ?? 0) + row.guide_payout_eur
  }
  const monthlyData = months.map(m => ({
    ...m,
    earned: monthlyMap[m.key] ?? 0,
  }))
  const maxMonthly = Math.max(...monthlyData.map(m => m.earned), 1)

  // ── Per-experience revenue ──────────────────────────────────────────────────
  type ExpRevRow = { experience_id: string; guide_payout_eur: number; experience: { title: string } | null }
  const byExp: Record<string, { title: string; revenue: number; bookings: number }> = {}
  for (const row of (expRevenueRows ?? []) as unknown as ExpRevRow[]) {
    const title = row.experience?.title ?? 'Unknown'
    if (byExp[row.experience_id] == null) {
      byExp[row.experience_id] = { title, revenue: 0, bookings: 0 }
    }
    byExp[row.experience_id].revenue   += row.guide_payout_eur
    byExp[row.experience_id].bookings  += 1
  }
  const expBreakdown = Object.entries(byExp)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── Commission rate label ───────────────────────────────────────────────────
  const commissionLabel = guide.pricing_model === 'commission' ? '8% (Founding)' : '10%'

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="px-10 py-10 max-w-[900px]">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">Earnings</h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Your guide payout history. Commission rate: <strong>{commissionLabel}</strong>
        </p>
      </div>

      {/* ─── Top stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total earned',
            value: `€${Math.round(totalEarned).toLocaleString()}`,
            sub: 'all-time payout',
            color: '#16A34A',
          },
          {
            label: 'This month',
            value: `€${Math.round(thisMonthEarned).toLocaleString()}`,
            sub: 'current month',
            color: '#E67E50',
          },
          {
            label: 'Pending',
            value: `€${Math.round(pendingAmount).toLocaleString()}`,
            sub: 'if all confirmed',
            color: '#1B4F72',
          },
          {
            label: 'Platform fees',
            value: `€${Math.round(totalFees).toLocaleString()}`,
            sub: `${commissionLabel} commission`,
            color: 'rgba(10,46,77,0.35)',
          },
        ].map(stat => (
          <div
            key={stat.label}
            className="px-6 py-5"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
              {stat.label}
            </p>
            <p className="text-2xl font-bold f-display" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Monthly chart ──────────────────────────────────────────── */}
      <div
        className="p-7 mb-6"
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[#0A2E4D] text-base font-bold f-display">Monthly Earnings</h2>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">Last 6 months — guide payout</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-3" style={{ height: '120px' }}>
          {monthlyData.map(m => {
            const heightPct = maxMonthly > 0 ? (m.earned / maxMonthly) * 100 : 0
            const isCurrentMonth = m.key === new Date().toISOString().slice(0, 7)

            return (
              <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-2">
                {/* Bar */}
                <div className="w-full relative flex items-end justify-center" style={{ height: '96px' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(heightPct, m.earned > 0 ? 4 : 1)}%`,
                      background: isCurrentMonth
                        ? '#E67E50'
                        : 'rgba(10,46,77,0.12)',
                      borderRadius: '6px 6px 3px 3px',
                      transition: 'height 0.3s ease',
                      minHeight: '3px',
                    }}
                  />
                  {/* Value label (only if earned > 0) */}
                  {m.earned > 0 && (
                    <span
                      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold f-display whitespace-nowrap"
                      style={{ color: isCurrentMonth ? '#E67E50' : '#0A2E4D' }}
                    >
                      €{Math.round(m.earned)}
                    </span>
                  )}
                </div>
                {/* Month label */}
                <p
                  className="text-[10px] f-body text-center"
                  style={{ color: isCurrentMonth ? '#E67E50' : 'rgba(10,46,77,0.38)' }}
                >
                  {m.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Per-experience breakdown ────────────────────────────────── */}
      <div
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-7 py-5"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
        >
          <h2 className="text-[#0A2E4D] text-base font-bold f-display">Revenue by Trip</h2>
          <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">Confirmed + completed bookings only</p>
        </div>

        {expBreakdown.length === 0 ? (
          <div className="px-7 py-12 text-center">
            <p className="text-[#0A2E4D]/30 text-sm f-body">
              No revenue data yet — earnings will appear here once you have confirmed bookings.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {expBreakdown.map((exp, i) => {
              const sharePct = totalEarned > 0 ? (exp.revenue / totalEarned) * 100 : 0

              return (
                <div key={exp.id} className="px-7 py-4 flex items-center gap-5">
                  {/* Rank */}
                  <p
                    className="text-2xl font-bold f-display flex-shrink-0 w-7 text-center"
                    style={{ color: i === 0 ? '#E67E50' : 'rgba(10,46,77,0.2)' }}
                  >
                    {i + 1}
                  </p>

                  {/* Info + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{exp.title}</p>
                      <p className="text-[#0A2E4D] text-sm font-bold f-display flex-shrink-0 ml-4">
                        €{Math.round(exp.revenue).toLocaleString()}
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(10,46,77,0.07)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${sharePct}%`, background: i === 0 ? '#E67E50' : '#1B4F72' }}
                      />
                    </div>
                    <p className="text-[#0A2E4D]/38 text-xs mt-1 f-body">
                      {exp.bookings} {exp.bookings === 1 ? 'booking' : 'bookings'} · {sharePct.toFixed(0)}% of total
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stripe Connect notice */}
      <div
        className="mt-6 px-7 py-5 flex items-center gap-5"
        style={{
          background: 'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4">
            <rect x="1.5" y="4" width="15" height="10" rx="2" />
            <line x1="1.5" y1="8" x2="16.5" y2="8" />
            <line x1="4.5" y1="11.5" x2="7" y2="11.5" />
          </svg>
        </div>
        <div>
          <p className="text-white text-sm font-semibold f-body">Payouts via Stripe Connect</p>
          <p className="text-white/42 text-xs mt-0.5 f-body">
            Funds are transferred to your connected bank account within 2–7 business days after trip completion.
          </p>
        </div>
      </div>

    </div>
  )
}
