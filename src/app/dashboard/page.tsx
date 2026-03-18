import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

type RecentBooking = {
  id: string
  status: BookingStatus
  booking_date: string
  angler_full_name: string | null
  guests: number
  total_eur: number
  guide_payout_eur: number
  experience: { title: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Partial<Record<BookingStatus, { bg: string; color: string; label: string }>> = {
  confirmed: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Confirmed' },
  pending:   { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'Pending'   },
  cancelled: { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Cancelled' },
  completed: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Completed' },
  accepted:  { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Accepted'  },
  declined:  { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C', label: 'Declined'  },
  refunded:  { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Refunded'  },
}

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    return (
      <div className="px-6 lg:px-10 py-10">
        <p className="text-[#0A2E4D]/55 text-sm f-body">Please sign in to access your dashboard.</p>
      </div>
    )
  }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, status, stripe_charges_enabled')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-6 lg:px-10 py-10">
        <p className="text-[#0A2E4D]/55 text-sm f-body">
          No guide profile found.{' '}
          <Link href="/guides/apply" className="text-[#E67E50] underline underline-offset-2">Apply →</Link>
        </p>
      </div>
    )
  }

  // ── Parallel data fetch ──────────────────────────────────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: expRows },
    { data: recentBookings },
    { data: pendingRows },
    { data: monthRows },
    { data: upcomingRows },
  ] = await Promise.all([
    // All experiences (for stats)
    supabase
      .from('experiences')
      .select('id, published')
      .eq('guide_id', guide.id),

    // Recent 6 bookings
    supabase
      .from('bookings')
      .select('id, status, booking_date, angler_full_name, guests, total_eur, guide_payout_eur, experience:experiences(title)')
      .eq('guide_id', guide.id)
      .order('created_at', { ascending: false })
      .limit(6),

    // Pending count
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('guide_id', guide.id)
      .eq('status', 'pending'),

    // This month earnings
    supabase
      .from('bookings')
      .select('guide_payout_eur')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', startOfMonth.toISOString().split('T')[0]),

    // Upcoming bookings (next 14 days, confirmed)
    supabase
      .from('bookings')
      .select('id, booking_date, angler_full_name, guests, experience:experiences(title)')
      .eq('guide_id', guide.id)
      .eq('status', 'confirmed')
      .gte('booking_date', new Date().toISOString().split('T')[0])
      .order('booking_date', { ascending: true })
      .limit(3),
  ])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const allExps     = expRows ?? []
  const liveTrips   = allExps.filter(e => e.published).length
  const totalTrips  = allExps.length
  const pendingCount = pendingRows?.length ?? 0
  const monthEarned  = (monthRows ?? []).reduce((s, b) => s + b.guide_payout_eur, 0)
  const bookings     = (recentBookings ?? []) as unknown as RecentBooking[]
  const upcoming     = (upcomingRows   ?? []) as unknown as RecentBooking[]

  const stripeReady = guide.stripe_charges_enabled === true

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1000px]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-2xl lg:text-3xl font-bold f-display">
          {greet()}, <span style={{ fontStyle: 'italic' }}>{guide.full_name.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">Here's what's happening with your trips.</p>
      </div>

      {/* ── Stripe setup banner (if not ready) ─────────────────────────────── */}
      {!stripeReady && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-5 rounded-2xl mb-6"
          style={{
            background: 'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex-1">
            <p className="text-white text-sm font-semibold f-body">Set up Stripe to accept payments</p>
            <p className="text-white/45 text-xs mt-0.5 f-body">Connect your bank account to receive payouts from bookings.</p>
          </div>
          <Link
            href="/dashboard/profile/edit"
            className="flex-shrink-0 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            Connect Stripe →
          </Link>
        </div>
      )}

      {/* ── Stats grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
        {[
          {
            label: 'Live trips',
            value: liveTrips,
            sub:   `${totalTrips} total`,
            color: '#0A2E4D',
            href:  '/dashboard/trips',
            icon: (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.4">
                <circle cx="7.5" cy="7.5" r="6" />
                <path d="M9.5 5.5L7.5 10 5.5 7.5 10 5.5z" fill="#E67E50" stroke="none" />
              </svg>
            ),
          },
          {
            label: 'Pending bookings',
            value: pendingCount,
            sub:   'awaiting response',
            color: pendingCount > 0 ? '#E67E50' : '#0A2E4D',
            href:  '/dashboard/bookings',
            icon: (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.4">
                <rect x="1.5" y="2" width="12" height="11" rx="1.5" />
                <line x1="4.5" y1="5.5" x2="10.5" y2="5.5" />
                <line x1="4.5" y1="8"   x2="8"    y2="8"   />
              </svg>
            ),
          },
          {
            label: 'Upcoming trips',
            value: upcoming.length,
            sub:   'confirmed bookings',
            color: '#0A2E4D',
            href:  '/dashboard/calendar',
            icon: (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.4">
                <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
                <line x1="1.5" y1="6" x2="13.5" y2="6" />
                <line x1="4.5" y1="1" x2="4.5" y2="4" />
                <line x1="10.5" y1="1" x2="10.5" y2="4" />
              </svg>
            ),
          },
          {
            label: 'Earned this month',
            value: `€${Math.round(monthEarned).toLocaleString()}`,
            sub:   'guide payout',
            color: monthEarned > 0 ? '#16A34A' : '#0A2E4D',
            href:  '/dashboard/earnings',
            icon: (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.4">
                <polyline points="1,11 4.5,7 7.5,9 13,3.5" />
                <polyline points="9.5,3.5 13,3.5 13,7" />
              </svg>
            ),
          },
        ].map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group px-5 py-5 rounded-2xl transition-all hover:shadow-md"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
                {stat.label}
              </p>
              <span className="opacity-60 group-hover:opacity-100 transition-opacity">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold f-display" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{stat.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Two-column row ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">

        {/* Recent bookings */}
        <div
          style={{
            background:   '#FDFAF7',
            borderRadius: '24px',
            border:       '1px solid rgba(10,46,77,0.07)',
            boxShadow:    '0 2px 16px rgba(10,46,77,0.05)',
            overflow:     'hidden',
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
          >
            <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Recent Bookings</h2>
            <Link href="/dashboard/bookings" className="text-xs f-body font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
              View all →
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[#0A2E4D]/30 text-sm f-body">No bookings yet. Share your trip link to get started.</p>
              <Link
                href="/dashboard/trips"
                className="inline-block mt-4 text-xs font-semibold px-4 py-2 rounded-full f-body transition-all hover:brightness-105"
                style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
              >
                Manage Trips →
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
              {bookings.map(b => {
                const s = STATUS_STYLES[b.status] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D', label: b.status }
                const date = new Date(b.booking_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                return (
                  <div key={b.id} className="flex items-center gap-4 px-6 py-3.5">
                    {/* Status dot */}
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">
                        {b.angler_full_name ?? 'Guest'}
                        <span className="font-normal text-[#0A2E4D]/40 ml-1.5">· {b.experience?.title ?? '—'}</span>
                      </p>
                      <p className="text-[#0A2E4D]/40 text-xs f-body">{date} · {b.guests} {b.guests === 1 ? 'angler' : 'anglers'}</p>
                    </div>

                    {/* Payout + badge */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-sm font-bold f-display" style={{ color: '#16A34A' }}>€{b.guide_payout_eur}</p>
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-full f-body"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column — upcoming + quick actions */}
        <div className="flex flex-col gap-4">

          {/* Upcoming trips */}
          <div
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              overflow:     'hidden',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Upcoming</h2>
              <Link href="/dashboard/calendar" className="text-xs f-body font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                Calendar →
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.3)' }}>
                No upcoming confirmed trips.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
                {upcoming.map(b => {
                  const d = new Date(b.booking_date)
                  const day   = d.toLocaleDateString('en-GB', { weekday: 'short' })
                  const date  = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                      {/* Date badge */}
                      <div
                        className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(230,126,80,0.1)' }}
                      >
                        <p className="text-[9px] font-bold uppercase f-body leading-none" style={{ color: '#E67E50' }}>{day}</p>
                        <p className="text-sm font-bold f-display leading-none mt-0.5" style={{ color: '#0A2E4D' }}>
                          {d.getDate()}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#0A2E4D] text-xs font-semibold f-body truncate">{b.experience?.title ?? '—'}</p>
                        <p className="text-[#0A2E4D]/40 text-[11px] f-body">{date} · {b.guests} {b.guests === 1 ? 'angler' : 'anglers'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div
            className="px-5 py-4"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Quick actions
            </h2>
            <div className="flex flex-col gap-1.5">
              {[
                { label: '+ New Trip',           href: '/dashboard/trips/new',  accent: true  },
                { label: 'Edit Profile',          href: '/dashboard/profile/edit' },
                { label: 'View Public Profile',   href: `/guides/${guide.id}`, external: true },
              ].map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  target={a.external ? '_blank' : undefined}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold f-body transition-all hover:brightness-95"
                  style={{
                    background: a.accent ? '#E67E50' : 'rgba(10,46,77,0.06)',
                    color:      a.accent ? '#fff'    : '#0A2E4D',
                  }}
                >
                  {a.label}
                  <span style={{ opacity: 0.5 }}>{a.external ? '↗' : '→'}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
