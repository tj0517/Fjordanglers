import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Check, ArrowRight, User, AlignLeft, Image as ImageIcon, Anchor,
  CreditCard, PlusCircle, Calendar, Pencil, Inbox, Clock, TrendingUp,
} from 'lucide-react'

export const revalidate = 0

export const metadata = { title: 'Dashboard — FjordAnglers' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)    return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)     return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)     return `${days}d ago`
  return fmtDate(iso)
}

const STATUS_LABEL: Record<string, string> = {
  pending:    'Awaiting response',
  offer_sent: 'Offer sent',
  confirmed:  'Confirmed',
  declined:   'Declined',
  cancelled:  'Cancelled',
  completed:  'Completed',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#FFF7ED', color: '#C05621'  },
  offer_sent: { bg: '#EFF6FF', color: '#1D4ED8'  },
  confirmed:  { bg: '#F0FDF4', color: '#15803D'  },
  declined:   { bg: '#F9FAFB', color: '#6B7280'  },
  cancelled:  { bg: '#F9FAFB', color: '#6B7280'  },
  completed:  { bg: '#EFF6FF', color: '#1D4ED8'  },
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

  // Fetch experiences + bookings in parallel
  const [{ data: expRows }, { data: bookingRows }] = await Promise.all([
    supabase
      .from('experiences')
      .select('id, published')
      .eq('guide_id', guide.id),
    supabase
      .from('bookings')
      .select(`
        id, status, source, booking_date, date_to, requested_dates,
        guests, total_eur, guide_payout_eur, angler_full_name, created_at,
        experience_id,
        experiences ( title )
      `)
      .eq('guide_id', guide.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const totalTrips     = expRows?.length ?? 0
  const publishedTrips = expRows?.filter(e => e.published).length ?? 0

  const allBookings  = bookingRows ?? []
  const pending      = allBookings.filter(b => b.status === 'pending')
  const offerSent    = allBookings.filter(b => b.status === 'offer_sent')
  const confirmed    = allBookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const recentAll    = allBookings.slice(0, 5)

  // Upcoming confirmed trips (booking_date >= today)
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = confirmed
    .filter(b => (b.booking_date ?? '') >= todayStr)
    .sort((a, b) => (a.booking_date ?? '').localeCompare(b.booking_date ?? ''))
    .slice(0, 3)

  // Items needing action (pending + offer_sent awaiting angler)
  const needsAction = [...pending, ...offerSent]

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
                    <Check size={12} strokeWidth={2} style={{ color: '#16A34A' }} />
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
                    <ArrowRight size={10} strokeWidth={1.6} />
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
              <Check size={13} strokeWidth={2} style={{ color: '#16A34A' }} />
            </div>
            <div>
              <p className="text-sm font-bold f-body" style={{ color: '#16A34A' }}>Profile complete — you&apos;re live!</p>
              <p className="text-xs f-body" style={{ color: 'rgba(22,163,74,0.7)' }}>Anglers across Europe can discover and book your trips.</p>
            </div>
          </div>
          <div className="rounded-b-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-3"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', borderTop: 'none' }}>
            {[
              { label: 'My public profile', sub: 'See how anglers find you',   href: guide.slug ? `/guides/${guide.slug}` : '/dashboard/profile', icon: <User size={16} strokeWidth={1.5} />, primary: true  },
              { label: '+ New trip listing', sub: 'Add a new fishing trip',    href: '/dashboard/trips/new',    icon: <PlusCircle size={16} strokeWidth={1.5} />, primary: false },
              { label: 'Manage calendar',   sub: 'Set availability & blocks', href: '/dashboard/calendar',     icon: <Calendar size={16} strokeWidth={1.5} />, primary: false },
              { label: 'My trips',          sub: `${publishedTrips} published`, href: '/dashboard/trips',      icon: <Anchor size={16} strokeWidth={1.5} />, primary: false },
              { label: 'Edit profile',      sub: 'Update info & photos',       href: '/dashboard/profile/edit', icon: <Pencil size={16} strokeWidth={1.5} />, primary: false },
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: 'Active trips',
            value: String(publishedTrips),
            sub:   totalTrips > 0 ? `${totalTrips} total` : 'No trips yet',
            href:  '/dashboard/trips',
            icon:  <Anchor size={15} strokeWidth={1.5} />,
          },
          {
            label: 'Pending requests',
            value: String(pending.length),
            sub:   pending.length === 1 ? 'needs your response' : pending.length > 0 ? 'need your response' : 'all clear',
            href:  '/dashboard/bookings',
            icon:  <Inbox size={15} strokeWidth={1.5} />,
            urgent: pending.length > 0,
          },
          {
            label: 'Confirmed',
            value: String(confirmed.length),
            sub:   confirmed.length === 1 ? 'booking confirmed' : `bookings confirmed`,
            href:  '/dashboard/bookings',
            icon:  <Check size={15} strokeWidth={2} />,
          },
          {
            label: 'Total bookings',
            value: String(allBookings.length),
            sub:   allBookings.length === 0 ? 'No bookings yet' : 'all time',
            href:  '/dashboard/bookings',
            icon:  <TrendingUp size={15} strokeWidth={1.5} />,
          },
        ].map(stat => (
          <Link key={stat.label} href={stat.href}
            className="rounded-2xl px-4 py-4 flex flex-col gap-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'urgent' in stat && stat.urgent ? 'rgba(230,126,80,0.06)' : '#FDFAF7',
              border: `1px solid ${'urgent' in stat && stat.urgent ? 'rgba(230,126,80,0.25)' : 'rgba(10,46,77,0.07)'}`,
              textDecoration: 'none',
            }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
                 style={{ color: 'urgent' in stat && stat.urgent ? '#C05621' : 'rgba(10,46,77,0.38)' }}>
                {stat.label}
              </p>
              <span style={{ color: 'urgent' in stat && stat.urgent ? '#E67E50' : 'rgba(10,46,77,0.25)' }}>
                {stat.icon}
              </span>
            </div>
            <p className="text-2xl font-bold f-display"
               style={{ color: 'urgent' in stat && stat.urgent ? '#E67E50' : '#0A2E4D' }}>
              {stat.value}
            </p>
            <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Pending requests — needs action ────────────────────────────────── */}
      {needsAction.length > 0 && (
        <div className="rounded-2xl mb-6 overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(230,126,80,0.2)' }}>
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(230,126,80,0.12)', background: 'rgba(230,126,80,0.04)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
              <p className="text-sm font-bold f-body" style={{ color: '#C05621' }}>
                {needsAction.length === 1 ? '1 request needs your attention' : `${needsAction.length} requests need your attention`}
              </p>
            </div>
            <Link href="/dashboard/bookings"
              className="text-xs font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: '#E67E50' }}>
              View all →
            </Link>
          </div>
          <div className="flex flex-col divide-y" style={{ '--divide-color': 'rgba(10,46,77,0.05)' } as React.CSSProperties}>
            {needsAction.map(b => {
              const exp = b.experiences as { title: string } | null
              const dates = b.requested_dates?.length
                ? `${fmtDateShort(b.requested_dates[0])}${b.requested_dates.length > 1 ? ` +${b.requested_dates.length - 1}` : ''}`
                : fmtDateShort(b.booking_date)
              const ss = STATUS_STYLE[b.status] ?? STATUS_STYLE['pending']
              return (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-all hover:bg-white"
                  style={{ textDecoration: 'none' }}
                >
                  {/* Avatar initial */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold f-body"
                    style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}>
                    {(b.angler_full_name ?? 'A')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {b.angler_full_name ?? 'Angler'}
                    </p>
                    <p className="text-xs f-body truncate mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {exp?.title ?? 'Fishing trip'} · {dates} · {b.guests} {b.guests === 1 ? 'angler' : 'anglers'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-semibold f-body px-2.5 py-1 rounded-full"
                      style={{ background: ss.bg, color: ss.color }}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
                      {timeAgo(b.created_at)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Upcoming confirmed trips ────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl mb-6 overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={14} strokeWidth={1.5} style={{ color: '#0A2E4D', opacity: 0.5 }} />
              <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>Upcoming trips</p>
            </div>
            <Link href="/dashboard/bookings"
              className="text-xs font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.45)' }}>
              View all →
            </Link>
          </div>
          <div className="flex flex-col divide-y" style={{ '--divide-color': 'rgba(10,46,77,0.05)' } as React.CSSProperties}>
            {upcoming.map(b => {
              const exp = b.experiences as { title: string } | null
              const dateFrom = b.requested_dates?.[0] ?? b.booking_date
              const dateTo   = b.requested_dates?.at(-1) ?? b.date_to ?? b.booking_date
              const dateStr  = dateFrom === dateTo
                ? fmtDate(dateFrom)
                : `${fmtDateShort(dateFrom)} – ${fmtDateShort(dateTo)}`
              return (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-all hover:bg-white"
                  style={{ textDecoration: 'none' }}
                >
                  {/* Date chip */}
                  <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(10,46,77,0.07)' }}>
                    <span className="text-[10px] font-bold f-body uppercase leading-none"
                      style={{ color: 'rgba(10,46,77,0.5)' }}>
                      {new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="text-base font-bold f-display leading-tight" style={{ color: '#0A2E4D' }}>
                      {new Date(dateFrom + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                      {exp?.title ?? 'Fishing trip'}
                    </p>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {b.angler_full_name ?? 'Angler'} · {dateStr} · {b.guests} {b.guests === 1 ? 'angler' : 'anglers'}
                    </p>
                  </div>
                  {b.guide_payout_eur > 0 && (
                    <p className="text-sm font-bold f-display flex-shrink-0" style={{ color: '#0A2E4D' }}>
                      €{b.guide_payout_eur.toFixed(0)}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Recent bookings ─────────────────────────────────────────────────── */}
      {recentAll.length > 0 ? (
        <div className="rounded-2xl mb-6 overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>Recent bookings</p>
            <Link href="/dashboard/bookings"
              className="text-xs font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.45)' }}>
              All bookings →
            </Link>
          </div>
          <div className="flex flex-col divide-y" style={{ '--divide-color': 'rgba(10,46,77,0.05)' } as React.CSSProperties}>
            {recentAll.map(b => {
              const exp = b.experiences as { title: string } | null
              const dates = b.requested_dates?.length
                ? `${fmtDateShort(b.requested_dates[0])}${b.requested_dates.length > 1 ? ` – ${fmtDateShort(b.requested_dates.at(-1)!)}` : ''}`
                : fmtDateShort(b.booking_date)
              const ss = STATUS_STYLE[b.status] ?? STATUS_STYLE['pending']
              return (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 transition-all hover:bg-white"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                        {b.angler_full_name ?? 'Angler'}
                      </p>
                      <span className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {exp?.title ?? 'Fishing trip'} · {dates}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {b.guide_payout_eur > 0 && (
                      <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>
                        €{b.guide_payout_eur.toFixed(0)}
                      </p>
                    )}
                    <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
                      {timeAgo(b.created_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── Empty state ── */
        <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(10,46,77,0.06)' }}>
            <Clock size={22} strokeWidth={1.3} style={{ color: 'rgba(10,46,77,0.3)' }} />
          </div>
          <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>No bookings yet</p>
          <p className="text-xs f-body mb-5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Once anglers start requesting trips, you&apos;ll see everything here.
          </p>
          <Link href="/dashboard/trips/new"
            className="text-sm font-bold f-body px-5 py-2.5 rounded-xl transition-all"
            style={{ background: '#E67E50', color: '#fff' }}>
            + Create a trip listing
          </Link>
        </div>
      )}

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl px-6 py-5"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-4"
           style={{ color: 'rgba(10,46,77,0.38)' }}>Quick actions</p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: '+ New trip',     href: '/dashboard/trips/new',    primary: true  },
            { label: 'All bookings',   href: '/dashboard/bookings',     primary: false },
            { label: 'My trips',       href: '/dashboard/trips',        primary: false },
            { label: 'Calendar',       href: '/dashboard/calendar',     primary: false },
            { label: 'Edit profile',   href: '/dashboard/profile/edit', primary: false },
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

    </div>
  )
}

// ─── Setup icon helper ────────────────────────────────────────────────────────

function SetupIcon({ name }: { name: string }) {
  const props = { size: 12, strokeWidth: 1.6, style: { color: '#E67E50' } } as const
  switch (name) {
    case 'person': return <User {...props} />
    case 'text':   return <AlignLeft {...props} />
    case 'photo':  return <ImageIcon {...props} />
    case 'trip':   return <Anchor {...props} />
    case 'stripe': return <CreditCard {...props} />
    default:       return <User {...props} />
  }
}
