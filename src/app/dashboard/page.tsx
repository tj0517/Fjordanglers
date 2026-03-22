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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  // Full guide row — all fields needed for completion checks
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, bio, avatar_url, fish_expertise, stripe_account_id, stripe_payouts_enabled, status')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/login')

  const firstName = guide.full_name?.split(' ')[0] ?? 'there'

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const service = createServiceClient()

  const [
    { data: expRows },
    { data: bookingsMonth },
    { data: pendingBks },
    { data: pendingInqs },
  ] = await Promise.all([
    supabase
      .from('experiences')
      .select('id, published')
      .eq('guide_id', guide.id),
    supabase
      .from('bookings')
      .select('guide_payout_eur')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', monthStart),
    supabase
      .from('bookings')
      .select('id')
      .eq('guide_id', guide.id)
      .eq('status', 'pending'),
    service
      .from('trip_inquiries')
      .select('id')
      .eq('assigned_guide_id', guide.id)
      .in('status', ['inquiry', 'reviewing', 'offer_sent']),
  ])

  const totalTrips     = expRows?.length ?? 0
  const publishedTrips = expRows?.filter(e => e.published).length ?? 0
  const monthEarnings  = bookingsMonth?.reduce((acc, b) => acc + (b.guide_payout_eur ?? 0), 0) ?? 0
  const pendingCount   = pendingBks?.length ?? 0
  const requestCount   = pendingInqs?.length ?? 0

  // ── Completion checklist ───────────────────────────────────────────────────
  const profileDone = (guide.country ?? '').length > 0 && (guide.fish_expertise ?? []).length > 0
  const bioDone     = (guide.bio ?? '').trim().length > 0
  const photoDone   = guide.avatar_url != null
  const tripDone    = totalTrips > 0
  // stripeDone = account connected (guide filled in their bank details).
  // We mark done as soon as the account row exists, not waiting for Stripe verification.
  const stripeDone  = guide.stripe_account_id != null

  const setupItems = [
    {
      key:   'profile',
      done:  profileDone,
      icon:  'person',
      label: 'Complete your guide profile',
      sub:   profileDone
        ? `${guide.country} · ${(guide.fish_expertise ?? []).length} target species`
        : 'Add your country and target species so anglers can find you',
      href:  '/dashboard/profile/edit',
      cta:   'Edit profile',
    },
    {
      key:   'bio',
      done:  bioDone,
      icon:  'text',
      label: 'Write your guide bio',
      sub:   bioDone
        ? 'Bio added — great introduction for anglers'
        : 'Tell anglers about your experience and what makes your trips unique',
      href:  '/dashboard/profile/edit',
      cta:   'Add bio',
    },
    {
      key:   'photo',
      done:  photoDone,
      icon:  'photo',
      label: 'Add a profile photo',
      sub:   photoDone
        ? 'Profile photo uploaded'
        : 'Profiles with a photo get significantly more bookings',
      href:  '/dashboard/profile/edit',
      cta:   'Upload photo',
    },
    {
      key:   'trip',
      done:  tripDone,
      icon:  'trip',
      label: 'Create your first trip listing',
      sub:   tripDone
        ? `${publishedTrips} published · ${totalTrips} total`
        : 'Add a fishing trip so anglers can discover and book you',
      href:  '/dashboard/trips/new',
      cta:   'Create trip',
    },
    {
      key:   'stripe',
      done:  stripeDone,
      icon:  'stripe',
      label: 'Add your bank account for payouts',
      sub:   stripeDone
        ? guide.stripe_payouts_enabled
          ? 'Stripe verified — payouts enabled'
          : 'Bank account connected — Stripe verifying (1–2 days)'
        : 'Required to receive earnings from bookings',
      href:  '/dashboard/account',
      cta:   'Add bank account',
    },
  ] as const

  const doneCount  = setupItems.filter(i => i.done).length
  const totalSteps = setupItems.length
  const allDone    = doneCount === totalSteps
  const pct        = Math.round((doneCount / totalSteps) * 100)

  // Status badge
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
        <span
          className="text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full f-body mt-1"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* ── Setup checklist ────────────────────────────────────────────────── */}
      {!allDone && (
        <div
          className="rounded-2xl mb-8 overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          {/* Checklist header */}
          <div
            className="px-6 py-4 flex items-center justify-between gap-4"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
          >
            <div>
              <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>
                Set up your guide profile
              </p>
              <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {doneCount} of {totalSteps} complete — finish these steps to start accepting bookings
              </p>
            </div>
            {/* Progress bar */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>{pct}%</span>
              <div
                className="w-32 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(10,46,77,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? '#16A34A' : '#E67E50' }}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="flex flex-col divide-y" style={{ '--divide-color': 'rgba(10,46,77,0.05)' } as React.CSSProperties}>
            {setupItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-4 px-6 py-4"
                style={{ opacity: item.done ? 0.55 : 1 }}
              >
                {/* Status dot */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: item.done ? 'rgba(74,222,128,0.12)' : 'rgba(230,126,80,0.1)',
                  }}
                >
                  {item.done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  ) : (
                    <SetupIcon name={item.icon} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold f-body leading-snug" style={{ color: '#0A2E4D' }}>
                    {item.label}
                  </p>
                  <p className="text-xs f-body mt-0.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {item.sub}
                  </p>
                </div>

                {/* CTA */}
                {!item.done && (
                  <Link
                    href={item.href}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-bold f-body px-3.5 py-2 rounded-xl transition-all"
                    style={{
                      background: 'rgba(230,126,80,0.1)',
                      color:      '#C96030',
                      border:     '1px solid rgba(230,126,80,0.2)',
                    }}
                  >
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

      {/* All done — celebration banner */}
      {allDone && (
        <div
          className="rounded-2xl px-6 py-5 mb-8 flex items-center gap-4"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(74,222,128,0.15)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
              <polyline points="3,9 7,13 15,5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold f-body" style={{ color: '#16A34A' }}>
              Your profile is complete!
            </p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
              All set — you&apos;re ready to accept bookings from anglers across Europe.
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Active trips',
            value: String(publishedTrips),
            sub:   totalTrips > 0 ? `${totalTrips} total` : 'No trips yet',
            href:  '/dashboard/trips',
          },
          {
            label: 'Earnings this month',
            value: fmtEur(monthEarnings),
            sub:   'confirmed bookings',
            href:  '/dashboard/earnings',
          },
          {
            label: 'Pending bookings',
            value: String(pendingCount),
            sub:   'awaiting confirmation',
            href:  '/dashboard/bookings',
          },
          {
            label: 'Open requests',
            value: String(requestCount),
            sub:   'trip inquiries',
            href:  '/dashboard/inquiries',
          },
        ].map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl px-4 py-4 transition-all hover:scale-[1.01]"
            style={{
              background:  '#FDFAF7',
              border:      '1px solid rgba(10,46,77,0.07)',
              display:     'block',
              textDecoration: 'none',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
               style={{ color: 'rgba(10,46,77,0.38)' }}>
              {stat.label}
            </p>
            <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
              {stat.value}
            </p>
            <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {stat.sub}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-4"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Quick actions
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: '+ New trip',     href: '/dashboard/trips/new',     primary: true  },
            { label: 'My trips',       href: '/dashboard/trips',         primary: false },
            { label: 'Calendar',       href: '/dashboard/calendar',      primary: false },
            { label: 'Bookings',       href: '/dashboard/bookings',      primary: false },
            { label: 'Inquiries',      href: '/dashboard/inquiries',     primary: false },
            { label: 'Edit profile',   href: '/dashboard/profile/edit',  primary: false },
          ].map(action => (
            <Link
              key={action.label}
              href={action.href}
              className="text-sm font-semibold f-body px-4 py-2.5 rounded-xl transition-all"
              style={
                action.primary
                  ? { background: '#E67E50', color: '#fff' }
                  : {
                      background: 'rgba(10,46,77,0.05)',
                      color:      '#0A2E4D',
                      border:     '1px solid rgba(10,46,77,0.1)',
                    }
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Setup icon helper ────────────────────────────────────────────────────────

function SetupIcon({ name }: { name: string }) {
  const s = { width: 12, height: 12, fill: 'none', stroke: '#E67E50', strokeWidth: 1.6, strokeLinecap: 'round' as const }
  switch (name) {
    case 'person':
      return (
        <svg {...s} viewBox="0 0 12 12">
          <circle cx="6" cy="4" r="2.2" />
          <path d="M1.5 11c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" />
        </svg>
      )
    case 'text':
      return (
        <svg {...s} viewBox="0 0 12 12">
          <line x1="2" y1="3.5" x2="10" y2="3.5" />
          <line x1="2" y1="6" x2="10" y2="6" />
          <line x1="2" y1="8.5" x2="7" y2="8.5" />
        </svg>
      )
    case 'photo':
      return (
        <svg {...s} viewBox="0 0 12 12">
          <rect x="1" y="2.5" width="10" height="7" rx="1.5" />
          <circle cx="6" cy="6" r="1.8" />
        </svg>
      )
    case 'trip':
      return (
        <svg {...s} viewBox="0 0 12 12">
          <path d="M2 10 L6 2 L10 10" />
          <line x1="3.5" y1="7" x2="8.5" y2="7" />
        </svg>
      )
    case 'stripe':
      return (
        <svg {...s} viewBox="0 0 12 12">
          <rect x="1" y="3" width="10" height="6.5" rx="1.2" />
          <line x1="1" y1="5.5" x2="11" y2="5.5" />
          <line x1="3.5" y1="7.8" x2="5.5" y2="7.8" strokeWidth="2" />
        </svg>
      )
    default:
      return (
        <svg {...s} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="4" />
        </svg>
      )
  }
}
