import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CountryFlag } from '@/components/ui/country-flag'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────


const STATUS_STYLES = {
  confirmed:  { bg: 'rgba(74,222,128,0.1)',    color: '#16A34A', label: 'Confirmed' },
  pending:    { bg: 'rgba(230,126,80,0.12)',   color: '#E67E50', label: 'Pending' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',     color: '#DC2626', label: 'Cancelled' },
  completed:  { bg: 'rgba(74,222,128,0.1)',    color: '#16A34A', label: 'Completed' },
  refunded:   { bg: 'rgba(239,68,68,0.1)',     color: '#DC2626', label: 'Refunded' },
} as const

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ── Auth & Guide ──────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    return (
      <div className="px-10 py-10 max-w-[1100px]">
        <p className="text-[#0A2E4D]/45 text-sm f-body">
          Please <Link href="/login" className="underline">sign in</Link> to access your dashboard.
        </p>
      </div>
    )
  }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, average_rating, total_reviews, bio, avatar_url, fish_expertise')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    // Layout should have shown onboarding — this is a safety fallback
    return (
      <div className="px-10 py-10 max-w-[1100px]">
        <p className="text-[#0A2E4D]/45 text-sm f-body">Setting up your guide profile…</p>
      </div>
    )
  }

  // ── Data fetching (parallel) ───────────────────────────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: monthBookings },
    { count: activeExpCount },
    { data: upcomingBookings },
    { data: guideExperiences },
  ] = await Promise.all([
    // This month's bookings for revenue + count stats
    supabase
      .from('bookings')
      .select('guide_payout_eur, status')
      .eq('guide_id', guide.id)
      .gte('created_at', startOfMonth.toISOString()),

    // Active experience count
    supabase
      .from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('guide_id', guide.id)
      .eq('published', true),

    // Upcoming bookings (next 60 days) for the bookings table
    supabase
      .from('bookings')
      .select('id, angler_full_name, angler_country, experience:experiences(title), booking_date, guests, total_eur, status')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'pending'])
      .gte('booking_date', new Date().toISOString().split('T')[0])
      .order('booking_date', { ascending: true })
      .limit(10),

    // Guide's experiences for the quick list panel
    supabase
      .from('experiences')
      .select('id, title, price_per_person_eur, duration_hours, duration_days, max_guests, published, images:experience_images(url, is_cover, sort_order)')
      .eq('guide_id', guide.id)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  // ── Profile completeness ──────────────────────────────────────────────────
  const hasProfileInfo  = (guide.bio != null && guide.bio.length > 10) && (guide.fish_expertise ?? []).length > 0
  const hasAvatar       = guide.avatar_url != null
  const hasExperience   = (activeExpCount ?? 0) > 0
  const completeness    = 25 + (hasProfileInfo ? 25 : 0) + (hasAvatar ? 25 : 0) + (hasExperience ? 25 : 0)

  const nextStep =
    !hasProfileInfo ? { label: 'Complete your bio and fish expertise', href: '/dashboard/profile/edit' }
    : !hasAvatar    ? { label: 'Add a profile photo', href: '/dashboard/profile/edit' }
    : !hasExperience ? { label: 'Add your first fishing trip', href: '/dashboard/trips/new' }
    : null

  // ── Derived stats ─────────────────────────────────────────────────────────
  const revenueThisMonth = (monthBookings ?? [])
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.guide_payout_eur ?? 0), 0)

  const bookingsThisMonth  = (monthBookings ?? []).length
  const pendingThisMonth   = (monthBookings ?? []).filter(b => b.status === 'pending').length

  const STATS = [
    {
      label:  'Revenue this month',
      value:  `€${revenueThisMonth.toLocaleString('en-EU', { minimumFractionDigits: 0 })}`,
      sub:    'confirmed bookings',
      trend:  'up' as const,
      accent: '#E67E50',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="1,13 5,9 8.5,11 16,4" />
          <polyline points="12,4 16,4 16,8" />
        </svg>
      ),
    },
    {
      label:  'Bookings this month',
      value:  bookingsThisMonth.toString(),
      sub:    `${pendingThisMonth} pending confirmation`,
      trend:  'neutral' as const,
      accent: '#1B4F72',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="14" height="12" rx="2" />
          <line x1="2" y1="7.5" x2="16" y2="7.5" />
          <line x1="6" y1="1.5" x2="6" y2="5" />
          <line x1="12" y1="1.5" x2="12" y2="5" />
        </svg>
      ),
    },
    {
      label:  'Active trips',
      value:  (activeExpCount ?? 0).toString(),
      sub:    'published trips',
      trend:  'neutral' as const,
      accent: '#0A2E4D',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="9" r="7" />
          <path d="M11.5 6.5L9 12 6.5 9 12 6.5z" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      label:  'Guide rating',
      value:  guide.average_rating != null ? `★ ${guide.average_rating.toFixed(1)}` : '—',
      sub:    `${guide.total_reviews ?? 0} reviews`,
      trend:  'up' as const,
      accent: '#E67E50',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <path d="M9 1.5l2.2 4.4 4.8.7-3.5 3.4.8 4.8L9 12.5l-4.3 2.3.8-4.8L2 6.6l4.8-.7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {today}
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Good morning,{' '}
            <span style={{ fontStyle: 'italic' }}>{guide.full_name.split(' ')[0]}.</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">Here&apos;s what&apos;s happening with your trips.</p>
        </div>

        <Link
          href="/dashboard/trips/new"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
            <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
          </svg>
          New Trip
        </Link>
      </div>

      {/* ─── Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="p-6 flex flex-col gap-3"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
                {stat.label}
              </p>
              <span style={{ color: stat.accent, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p className="text-[#0A2E4D] text-2xl font-bold leading-none f-display">{stat.value}</p>
            <p
              className="text-xs f-body"
              style={{ color: stat.trend === 'up' ? '#16A34A' : 'rgba(10,46,77,0.38)' }}
            >
              {stat.trend === 'up' && '↑ '}{stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Main grid: bookings left, experiences right ─────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

        {/* Upcoming bookings */}
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
            className="px-7 py-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
          >
            <div>
              <h2 className="text-[#0A2E4D] text-base font-bold f-display">Upcoming Bookings</h2>
              <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">Next 60 days</p>
            </div>
            <Link
              href="/dashboard/bookings"
              className="text-xs font-medium f-body transition-colors hover:text-[#E67E50]"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              View all →
            </Link>
          </div>

          {(upcomingBookings == null || upcomingBookings.length === 0) ? (
            <div className="px-7 py-12 flex flex-col items-center text-center">
              <p className="text-[#0A2E4D]/30 text-sm f-body">No upcoming bookings.</p>
              <p className="text-[#0A2E4D]/22 text-xs mt-1 f-body">When anglers book your trips they&apos;ll appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {upcomingBookings.map((booking) => {
                const status = booking.status as keyof typeof STATUS_STYLES
                const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
                const expTitle = (booking.experience as { title: string } | null)?.title ?? '—'
                const dateFormatted = new Date(booking.booking_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })

                return (
                  <div key={booking.id} className="px-7 py-4 flex items-center gap-4">
                    {/* Angler */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CountryFlag country={booking.angler_country} />
                        <p className="text-[#0A2E4D] text-sm font-semibold f-body">
                          {booking.angler_full_name ?? 'Guest'}
                        </p>
                      </div>
                      <p className="text-[#0A2E4D]/42 text-xs f-body truncate">{expTitle}</p>
                    </div>

                    {/* Date */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-[#0A2E4D] text-xs font-medium f-body">{dateFormatted}</p>
                      <p className="text-[#0A2E4D]/38 text-xs f-body">
                        {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0 w-16">
                      <p className="text-[#0A2E4D] text-sm font-bold f-display">€{booking.total_eur}</p>
                    </div>

                    {/* Status */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full flex-shrink-0 f-body"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick experience list */}
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
            className="px-6 py-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
          >
            <div>
              <h2 className="text-[#0A2E4D] text-base font-bold f-display">My Trips</h2>
              <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">
                {activeExpCount ?? 0} active
              </p>
            </div>
            <Link
              href="/dashboard/trips"
              className="text-xs font-medium f-body transition-colors hover:text-[#E67E50]"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Manage →
            </Link>
          </div>

          {(guideExperiences == null || guideExperiences.length === 0) ? (
            <div className="p-6 text-center">
              <p className="text-[#0A2E4D]/30 text-sm f-body">No trips yet.</p>
              <Link
                href="/dashboard/trips/new"
                className="text-xs font-semibold mt-3 inline-block f-body"
                style={{ color: '#E67E50' }}
              >
                Create your first trip →
              </Link>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-2">
              {guideExperiences.map((exp) => {
                type ImgRow = { url: string; is_cover: boolean; sort_order: number }
                const images = (exp.images as ImgRow[] | null) ?? []
                const cover = images.find(i => i.is_cover)?.url
                  ?? images.sort((a, b) => a.sort_order - b.sort_order)[0]?.url
                  ?? null
                const duration = exp.duration_hours != null
                  ? `${exp.duration_hours}h`
                  : `${exp.duration_days ?? '?'} days`

                return (
                  <div
                    key={exp.id}
                    className="flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-[#F3EDE4]"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                      {cover != null ? (
                        <Image src={cover} alt={exp.title} width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0A2E4D] text-xs font-semibold leading-snug line-clamp-1 f-body">{exp.title}</p>
                      <p className="text-[#0A2E4D]/40 text-[11px] mt-0.5 f-body">
                        €{exp.price_per_person_eur}/pp · {duration}
                      </p>
                    </div>

                    {/* Live badge */}
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full flex-shrink-0 f-body"
                      style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}
                    >
                      Live
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ─── Profile completion prompt ───────────────────────────── */}
      {completeness < 100 && nextStep != null && (
        <div
          className="mt-6 px-7 py-5 flex items-center justify-between"
          style={{
            background: 'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <p className="text-white text-sm font-semibold f-body">Complete your profile</p>
            <p className="text-white/45 text-xs mt-0.5 f-body">{nextStep.label}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${completeness}%`, background: '#E67E50' }}
                />
              </div>
              <span className="text-white/55 text-xs f-body">{completeness}%</span>
            </div>
            <Link
              href={nextStep.href}
              className="text-white text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body"
              style={{ background: 'rgba(230,126,80,0.25)', border: '1px solid rgba(230,126,80,0.35)' }}
            >
              {completeness <= 25 ? 'Complete profile →' : 'Continue →'}
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
