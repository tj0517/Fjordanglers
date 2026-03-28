import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const revalidate = 0

export const metadata = { title: 'Dashboard — FjordAnglers' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Earnings SVG bar chart ───────────────────────────────────────────────────

function EarningsChart({ bars }: {
  bars: { key: string; label: string; value: number; isCurrent: boolean }[]
}) {
  const max   = Math.max(...bars.map(b => b.value), 100)
  const BAR_W = 36
  const GAP   = 10
  const CH    = 110 // chart height
  const LH    = 18  // label height
  const W     = bars.length * BAR_W + (bars.length - 1) * GAP

  return (
    <svg viewBox={`0 0 ${W} ${CH + LH}`} className="w-full" style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={0} y1={CH - pct * CH} x2={W} y2={CH - pct * CH}
          stroke="rgba(10,46,77,0.06)" strokeWidth="1" />
      ))}
      {/* Bars */}
      {bars.map((bar, i) => {
        const barH = Math.max((bar.value / max) * CH, 3)
        const x    = i * (BAR_W + GAP)
        return (
          <g key={bar.key}>
            <rect
              x={x} y={CH - barH} width={BAR_W} height={barH} rx={5}
              fill={bar.isCurrent ? '#E67E50' : bar.value > 0 ? 'rgba(230,126,80,0.28)' : 'rgba(10,46,77,0.06)'}
            />
            {bar.value > 0 && (
              <text
                x={x + BAR_W / 2} y={CH - barH - 5}
                textAnchor="middle" fontSize={7} fontFamily="DM Sans, sans-serif" fontWeight="600"
                fill={bar.isCurrent ? '#E67E50' : 'rgba(10,46,77,0.4)'}
              >
                {bar.value >= 1000 ? `€${(bar.value / 1000).toFixed(1)}k` : `€${Math.round(bar.value)}`}
              </text>
            )}
            <text
              x={x + BAR_W / 2} y={CH + LH - 2}
              textAnchor="middle" fontSize={8} fontFamily="DM Sans, sans-serif"
              fontWeight={bar.isCurrent ? '700' : '400'}
              fill={bar.isCurrent ? '#E67E50' : 'rgba(10,46,77,0.38)'}
            >
              {bar.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending',   bg: 'rgba(217,119,6,0.1)',  color: '#B45309' },
    accepted:  { label: 'Accepted',  bg: 'rgba(59,130,246,0.1)', color: '#2563EB' },
    confirmed: { label: 'Confirmed', bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    completed: { label: 'Completed', bg: 'rgba(10,46,77,0.08)',  color: '#0A2E4D' },
    declined:  { label: 'Declined',  bg: 'rgba(239,68,68,0.1)',  color: '#DC2626' },
    refunded:  { label: 'Refunded',  bg: 'rgba(239,68,68,0.07)', color: '#EF4444' },
  }
  const s = map[status] ?? map['pending']!
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, bio, avatar_url, fish_expertise, stripe_account_id, stripe_payouts_enabled, status, slug')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/login')

  const firstName = guide.full_name?.split(' ')[0] ?? 'there'

  // ── Date helpers ───────────────────────────────────────────────────────────
  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today      = now.toISOString().split('T')[0]

  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(now.getMonth() - 5)
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

  const service = createServiceClient()

  // ── All queries in parallel ────────────────────────────────────────────────
  const [
    { data: expRows },
    { data: bookingsMonth },
    { data: pendingBks },
    { data: pendingInqs },
    { data: earningsData },
    { data: upcomingBks },
    { data: recentBks },
    { data: allTimeBks },
  ] = await Promise.all([
    supabase.from('experiences').select('id, published').eq('guide_id', guide.id),
    supabase.from('bookings').select('guide_payout_eur').eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']).gte('booking_date', monthStart),
    supabase.from('bookings').select('id').eq('guide_id', guide.id).eq('status', 'pending'),
    service.from('trip_inquiries').select('id').eq('assigned_guide_id', guide.id)
      .in('status', ['inquiry', 'reviewing', 'offer_sent']),
    // 6-month chart data
    supabase.from('bookings').select('booking_date, guide_payout_eur').eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']).gte('booking_date', sixMonthsAgoStr),
    // Upcoming confirmed trips
    supabase.from('bookings')
      .select('id, angler_full_name, guests, total_eur, booking_date')
      .eq('guide_id', guide.id).eq('status', 'confirmed')
      .gte('booking_date', today).order('booking_date', { ascending: true }).limit(4),
    // Recent activity
    supabase.from('bookings')
      .select('id, angler_full_name, total_eur, status, created_at')
      .eq('guide_id', guide.id).order('created_at', { ascending: false }).limit(6),
    // All-time totals
    supabase.from('bookings').select('guide_payout_eur').eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']),
  ])

  const totalTrips      = expRows?.length ?? 0
  const publishedTrips  = expRows?.filter(e => e.published).length ?? 0
  const monthEarnings   = bookingsMonth?.reduce((acc, b) => acc + (b.guide_payout_eur ?? 0), 0) ?? 0
  const pendingCount    = pendingBks?.length ?? 0
  const requestCount    = pendingInqs?.length ?? 0
  const allTimeEarnings = allTimeBks?.reduce((acc, b) => acc + (b.guide_payout_eur ?? 0), 0) ?? 0
  const confirmedCount  = allTimeBks?.length ?? 0
  const monthlyCount    = bookingsMonth?.length ?? 0

  // Build 6-month earnings chart bars
  const chartBars = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return {
      key:       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label:     MONTHS[d.getMonth()]!,
      value:     0,
      isCurrent: offset === 0,
    }
  })
  earningsData?.forEach(b => {
    const key = b.booking_date.slice(0, 7)
    const bar = chartBars.find(cb => cb.key === key)
    if (bar) bar.value += b.guide_payout_eur
  })
  const sixMonthTotal = chartBars.reduce((s, b) => s + b.value, 0)

  // ── Completion checklist ───────────────────────────────────────────────────
  const profileDone = (guide.country ?? '').length > 0 && (guide.fish_expertise ?? []).length > 0
  const bioDone     = (guide.bio ?? '').trim().length > 0
  const photoDone   = guide.avatar_url != null
  const tripDone    = totalTrips > 0
  const stripeDone  = guide.stripe_account_id != null

  const setupItems = [
    { key: 'profile', done: profileDone, icon: 'person', label: 'Complete your guide profile', sub: profileDone ? `${guide.country} · ${(guide.fish_expertise ?? []).length} target species` : 'Add your country and target species so anglers can find you', href: '/dashboard/profile/edit', cta: 'Edit profile' },
    { key: 'bio',     done: bioDone,     icon: 'text',   label: 'Write your guide bio',         sub: bioDone     ? 'Bio added — great introduction for anglers' : 'Tell anglers about your experience and what makes your trips unique', href: '/dashboard/profile/edit', cta: 'Add bio' },
    { key: 'photo',   done: photoDone,   icon: 'photo',  label: 'Add a profile photo',          sub: photoDone   ? 'Profile photo uploaded' : 'Profiles with a photo get significantly more bookings', href: '/dashboard/profile/edit', cta: 'Upload photo' },
    { key: 'trip',    done: tripDone,    icon: 'trip',   label: 'Create your first trip listing', sub: tripDone  ? `${publishedTrips} published · ${totalTrips} total` : 'Add a fishing trip so anglers can discover and book you', href: '/dashboard/trips/new', cta: 'Create trip' },
    { key: 'stripe',  done: stripeDone,  icon: 'stripe', label: 'Add your bank account for payouts', sub: stripeDone ? (guide.stripe_payouts_enabled ? 'Stripe verified — payouts enabled' : 'Bank account connected — Stripe verifying (1–2 days)') : 'Required to receive earnings from bookings', href: '/dashboard/account', cta: 'Add bank account' },
  ] as const

  const doneCount  = setupItems.filter(i => i.done).length
  const totalSteps = setupItems.length
  const allDone    = doneCount === totalSteps
  const pct        = Math.round((doneCount / totalSteps) * 100)

  const statusLabel: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending review', bg: 'rgba(217,119,6,0.1)',  color: '#B45309' },
    active:    { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    verified:  { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    suspended: { label: 'Suspended',      bg: 'rgba(239,68,68,0.1)',  color: '#DC2626' },
  }
  const statusStyle = statusLabel[guide.status] ?? statusLabel['pending']!

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Guide Dashboard
          </p>
          <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
            {greet()}, <span style={{ fontStyle: 'italic' }}>{firstName}.</span>
          </h1>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full f-body mt-1"
          style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </div>

      {/* ── Setup checklist ────────────────────────────────────────────────── */}
      {!allDone && (
        <div className="rounded-2xl mb-8 overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-6 py-4 flex items-center justify-between gap-4"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <div>
              <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>Set up your guide profile</p>
              <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {doneCount} of {totalSteps} complete — finish these steps to start accepting bookings
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>{pct}%</span>
              <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,46,77,0.08)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? '#16A34A' : '#E67E50' }} />
              </div>
            </div>
          </div>
          <div className="flex flex-col divide-y"
            style={{ '--divide-color': 'rgba(10,46,77,0.05)' } as React.CSSProperties}>
            {setupItems.map((item) => (
              <div key={item.key} className="flex items-center gap-4 px-6 py-4"
                style={{ opacity: item.done ? 0.55 : 1 }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: item.done ? 'rgba(74,222,128,0.12)' : 'rgba(230,126,80,0.1)' }}>
                  {item.done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  ) : (
                    <SetupIcon name={item.icon} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold f-body leading-snug" style={{ color: '#0A2E4D' }}>{item.label}</p>
                  <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>{item.sub}</p>
                </div>
                {!item.done && (
                  <Link href={item.href}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-bold f-body px-3.5 py-2 rounded-xl transition-all"
                    style={{ background: 'rgba(230,126,80,0.1)', color: '#C96030', border: '1px solid rgba(230,126,80,0.2)' }}>
                    {item.cta}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" />
                    </svg>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All done — shortcuts panel */}
      {allDone && (
        <div className="mb-8">
          <div className="rounded-t-2xl px-6 py-4 flex items-center gap-3"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderBottom: 'none' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(74,222,128,0.15)' }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
                <polyline points="2,6.5 5.5,10 11,3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold f-body" style={{ color: '#16A34A' }}>Profile complete — you&apos;re live!</p>
              <p className="text-xs f-body" style={{ color: 'rgba(22,163,74,0.7)' }}>Anglers across Europe can discover and book your trips.</p>
            </div>
          </div>
          <div className="rounded-b-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-3"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', borderTop: 'none' }}>
            {[
              { label: 'My public profile', sub: 'See how anglers find you',   href: guide.slug ? `/guides/${guide.slug}` : '/dashboard/profile', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="5.5" r="2.5" /><path d="M2.5 13.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /></svg>, primary: true  },
              { label: '+ New trip listing', sub: 'Add a new fishing trip',    href: '/dashboard/trips/new',    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6.5" /><line x1="8" y1="5" x2="8" y2="11" /><line x1="5" y1="8" x2="11" y2="8" /></svg>, primary: false },
              { label: 'Manage calendar',   sub: 'Set availability & blocks', href: '/dashboard/calendar',     icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1.5" y="3" width="13" height="10.5" rx="1.5" /><line x1="1.5" y1="6.5" x2="14.5" y2="6.5" /><line x1="5" y1="1.5" x2="5" y2="4.5" /><line x1="11" y1="1.5" x2="11" y2="4.5" /></svg>, primary: false },
              { label: 'Bookings',          sub: `${pendingCount} pending`,   href: '/dashboard/bookings',     icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1.5" y="2" width="13" height="12" rx="1.5" /><line x1="5" y1="6" x2="11" y2="6" /><line x1="5" y1="8.5" x2="11" y2="8.5" /><line x1="5" y1="11" x2="8.5" y2="11" /></svg>, primary: false },
              { label: 'Requests',          sub: `${requestCount} open`,       href: '/dashboard/inquiries',   icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 2.5h13a1 1 0 011 1v8a1 1 0 01-1 1H4.5l-3.5 3V3.5a1 1 0 011-1z" /></svg>, primary: false },
              { label: 'Edit profile',      sub: 'Update info & photos',       href: '/dashboard/profile/edit', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z" /></svg>, primary: false },
            ].map(sc => (
              <Link key={sc.label} href={sc.href}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all hover:scale-[1.01]"
                style={sc.primary
                  ? { background: '#0A2E4D', color: '#fff' }
                  : { background: 'rgba(10,46,77,0.04)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.08)' }}>
                <span className="mt-0.5 flex-shrink-0" style={{ opacity: sc.primary ? 0.75 : 0.55 }}>{sc.icon}</span>
                <div>
                  <p className="text-sm font-semibold f-body leading-tight">{sc.label}</p>
                  <p className="text-[11px] f-body mt-0.5" style={{ opacity: sc.primary ? 0.55 : 0.45 }}>{sc.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active trips',        value: String(publishedTrips),  sub: totalTrips > 0 ? `${totalTrips} total` : 'No trips yet',    href: '/dashboard/trips'    },
          { label: 'Earnings this month', value: fmtEur(monthEarnings),   sub: 'confirmed bookings',                                        href: '/dashboard/earnings' },
          { label: 'Pending bookings',    value: String(pendingCount),    sub: 'awaiting confirmation',                                     href: '/dashboard/bookings' },
          { label: 'Open requests',       value: String(requestCount),    sub: 'trip inquiries',                                            href: '/dashboard/inquiries'},
        ].map(stat => (
          <Link key={stat.label} href={stat.href}
            className="rounded-2xl px-4 py-4 transition-all hover:scale-[1.01]"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', display: 'block', textDecoration: 'none' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
               style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.label}</p>
            <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>{stat.value}</p>
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Earnings trend bar chart */}
        <div className="sm:col-span-2 rounded-2xl px-6 py-5"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                 style={{ color: 'rgba(10,46,77,0.38)' }}>
                Earnings — last 6 months
              </p>
              <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                {fmtEur(sixMonthTotal)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
                 style={{ color: 'rgba(10,46,77,0.38)' }}>All time</p>
              <p className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>{fmtEur(allTimeEarnings)}</p>
              <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{confirmedCount} bookings</p>
            </div>
          </div>
          <EarningsChart bars={chartBars} />
        </div>

        {/* Booking overview — progress bars */}
        <div className="rounded-2xl px-6 py-5 flex flex-col"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-5"
             style={{ color: 'rgba(10,46,77,0.38)' }}>
            Booking overview
          </p>
          <div className="flex-1 flex flex-col gap-4">
            {[
              { label: 'Published trips',      value: publishedTrips,             max: Math.max(totalTrips, 1),                          color: '#E67E50' },
              { label: 'Pending action',        value: pendingCount + requestCount, max: Math.max(pendingCount + requestCount, 5),         color: '#B45309' },
              { label: 'Confirmed this month',  value: monthlyCount,               max: Math.max(monthlyCount, 5),                        color: '#16A34A' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{item.label}</span>
                  <span className="text-xs font-bold f-body" style={{ color: '#0A2E4D' }}>{item.value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,46,77,0.07)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width:    `${Math.min(item.value > 0 ? Math.max((item.value / item.max) * 100, 8) : 0, 100)}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
               style={{ color: 'rgba(10,46,77,0.38)' }}>All-time confirmed</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>{confirmedCount}</span>
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>bookings</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Upcoming + Recent ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

        {/* Upcoming confirmed trips */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>Upcoming trips</p>
            <Link href="/dashboard/bookings" className="text-[11px] font-semibold f-body"
              style={{ color: '#E67E50' }}>View all →</Link>
          </div>
          {(upcomingBks?.length ?? 0) === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No upcoming confirmed trips</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {upcomingBks!.map((bk, idx) => {
                const tripDate = new Date(bk.booking_date)
                const daysAway = Math.ceil((tripDate.getTime() - Date.now()) / 86400000)
                return (
                  <Link key={bk.id} href={`/dashboard/bookings/${bk.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.015]"
                    style={idx > 0 ? { borderTop: '1px solid rgba(10,46,77,0.05)' } : {}}>
                    {/* Date chip */}
                    <div className="flex-shrink-0 w-10 text-center rounded-xl py-1"
                      style={{ background: daysAway <= 7 ? 'rgba(230,126,80,0.1)' : 'rgba(10,46,77,0.05)' }}>
                      <p className="text-sm font-bold f-display leading-tight"
                        style={{ color: daysAway <= 7 ? '#E67E50' : '#0A2E4D' }}>
                        {tripDate.getDate()}
                      </p>
                      <p className="text-[9px] font-semibold f-body uppercase"
                        style={{ color: daysAway <= 7 ? '#E67E50' : 'rgba(10,46,77,0.4)' }}>
                        {MONTHS[tripDate.getMonth()]}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                        {bk.angler_full_name ?? 'Angler'}
                      </p>
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {bk.guests} {bk.guests === 1 ? 'guest' : 'guests'} · {fmtEur(bk.total_eur)}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold f-body flex-shrink-0"
                      style={{ color: daysAway <= 3 ? '#DC2626' : daysAway <= 7 ? '#E67E50' : 'rgba(10,46,77,0.35)' }}>
                      {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomrw' : `${daysAway}d`}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent bookings activity */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
               style={{ color: 'rgba(10,46,77,0.38)' }}>Recent activity</p>
            <Link href="/dashboard/bookings" className="text-[11px] font-semibold f-body"
              style={{ color: '#E67E50' }}>View all →</Link>
          </div>
          {(recentBks?.length ?? 0) === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No bookings yet</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {recentBks!.map((bk, idx) => {
                const createdDate = new Date(bk.created_at)
                const dateStr = createdDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
                return (
                  <Link key={bk.id} href={`/dashboard/bookings/${bk.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.015]"
                    style={idx > 0 ? { borderTop: '1px solid rgba(10,46,77,0.05)' } : {}}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                        {bk.angler_full_name ?? 'Angler'}
                      </p>
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {fmtEur(bk.total_eur)} · {dateStr}
                      </p>
                    </div>
                    <StatusChip status={bk.status} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions — only shown when setup incomplete (allDone has shortcuts grid) */}
      {!allDone && (
        <div className="rounded-2xl px-6 py-5"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-4"
             style={{ color: 'rgba(10,46,77,0.38)' }}>Quick actions</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: '+ New trip',   href: '/dashboard/trips/new',    primary: true  },
              { label: 'My trips',     href: '/dashboard/trips',        primary: false },
              { label: 'Calendar',     href: '/dashboard/calendar',     primary: false },
              { label: 'Bookings',     href: '/dashboard/bookings',     primary: false },
              { label: 'Inquiries',    href: '/dashboard/inquiries',    primary: false },
              { label: 'Edit profile', href: '/dashboard/profile/edit', primary: false },
            ].map(action => (
              <Link key={action.label} href={action.href}
                className="text-sm font-semibold f-body px-4 py-2.5 rounded-xl transition-all"
                style={action.primary
                  ? { background: '#E67E50', color: '#fff' }
                  : { background: 'rgba(10,46,77,0.05)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.1)' }}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Setup icon helper ────────────────────────────────────────────────────────

function SetupIcon({ name }: { name: string }) {
  const s = { width: 12, height: 12, fill: 'none', stroke: '#E67E50', strokeWidth: 1.6, strokeLinecap: 'round' as const }
  switch (name) {
    case 'person': return (<svg {...s} viewBox="0 0 12 12"><circle cx="6" cy="4" r="2.2" /><path d="M1.5 11c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" /></svg>)
    case 'text':   return (<svg {...s} viewBox="0 0 12 12"><line x1="2" y1="3.5" x2="10" y2="3.5" /><line x1="2" y1="6" x2="10" y2="6" /><line x1="2" y1="8.5" x2="7" y2="8.5" /></svg>)
    case 'photo':  return (<svg {...s} viewBox="0 0 12 12"><rect x="1" y="2.5" width="10" height="7" rx="1.5" /><circle cx="6" cy="6" r="1.8" /></svg>)
    case 'trip':   return (<svg {...s} viewBox="0 0 12 12"><path d="M2 10 L6 2 L10 10" /><line x1="3.5" y1="7" x2="8.5" y2="7" /></svg>)
    case 'stripe': return (<svg {...s} viewBox="0 0 12 12"><rect x="1" y="3" width="10" height="6.5" rx="1.2" /><line x1="1" y1="5.5" x2="11" y2="5.5" /><line x1="3.5" y1="7.8" x2="5.5" y2="7.8" strokeWidth="2" /></svg>)
    default:       return (<svg {...s} viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" /></svg>)
  }
}
