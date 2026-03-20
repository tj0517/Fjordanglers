import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

type AnglerBooking = {
  id: string
  booking_date: string
  guests: number
  total_eur: number
  status: BookingStatus
  experience_id: string | null
  inquiry_id: string | null
  experience: { id: string; title: string } | null
  guide: { full_name: string } | null
  experience_image: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'  },
  pending:    { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'    },
  cancelled:  { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'  },
  completed:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'  },
  refunded:   { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'   },
  accepted:   { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'   },
  declined:   { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'   },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/bookings')

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Fetch all bookings (regular + inquiry-derived with experience_id=null) ──
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select(
      'id, booking_date, guests, total_eur, status, experience_id, inquiry_id, experiences(id, title, experience_images(url, is_cover, sort_order)), guides(full_name)',
    )
    .eq('angler_id', user.id)
    .order('booking_date', { ascending: false })

  const bookings: AnglerBooking[] = (rawBookings ?? []).map(b => {
    const exp = b.experiences as unknown as {
      id: string
      title: string
      experience_images: { url: string; is_cover: boolean; sort_order: number }[]
    } | null

    const images = exp?.experience_images ?? []
    const cover  =
      images.find(img => img.is_cover) ??
      images.sort((a, x) => a.sort_order - x.sort_order)[0]

    return {
      id:             b.id,
      booking_date:   b.booking_date,
      guests:         b.guests ?? 1,
      total_eur:      b.total_eur,
      status:         b.status,
      experience_id:  b.experience_id,
      inquiry_id:     b.inquiry_id,
      experience:     exp ? { id: exp.id, title: exp.title } : null,
      guide:          b.guides as unknown as { full_name: string } | null,
      experience_image: cover?.url ?? null,
    }
  })

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10)

  const upcoming = bookings.filter(
    b =>
      (b.status === 'confirmed' || b.status === 'pending' || b.status === 'accepted') &&
      b.booking_date >= todayStr,
  )
  const totalSpent = bookings
    .filter(b => b.status !== 'cancelled' && b.status !== 'refunded' && b.status !== 'declined')
    .reduce((sum, b) => sum + b.total_eur, 0)

  const STATS = [
    {
      label: 'Total bookings',
      value: bookings.length.toString(),
      sub: 'all time',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="14" height="12" rx="2" />
          <line x1="2" y1="7.5" x2="16" y2="7.5" />
          <line x1="6" y1="1.5" x2="6" y2="5" />
          <line x1="12" y1="1.5" x2="12" y2="5" />
        </svg>
      ),
      accent: '#1B4F72',
    },
    {
      label: 'Upcoming trips',
      value: upcoming.length.toString(),
      sub: upcoming.length > 0 ? 'confirmed or pending' : 'none scheduled',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="9" r="7" />
          <path d="M9 5v4l2.5 2.5" strokeLinecap="round" />
        </svg>
      ),
      accent: '#E67E50',
    },
    {
      label: 'Total spent',
      value: `€${totalSpent.toLocaleString()}`,
      sub: 'confirmed bookings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="9" r="7" />
          <path d="M9 5v1m0 6v1m2.5-5.5a2.5 2.5 0 10-5 0c0 1.5 1 2 2.5 2.5S12 11 12 12.5a2.5 2.5 0 01-5 0" strokeLinecap="round" />
        </svg>
      ),
      accent: '#0A2E4D',
    },
  ]

  // ── Next trip banner ──────────────────────────────────────────────────────
  const nextTrip = upcoming[0] ?? null

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {today}
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            My <span style={{ fontStyle: 'italic' }}>Bookings</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Track your fishing adventures.
          </p>
        </div>
        <Link
          href="/trips"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="5.5" />
            <path d="M8.5 4.5L6.5 9 4.5 6.5 9 4.5z" fill="currentColor" stroke="none" />
          </svg>
          Browse Trips
        </Link>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Next trip banner ─────────────────────────────────────────────────── */}
      {nextTrip != null && (() => {
        const isCustomTrip = nextTrip.experience_id == null
        const title = nextTrip.experience?.title ?? (isCustomTrip ? 'Custom Fishing Trip' : 'Fishing trip')
        const date  = new Date(`${nextTrip.booking_date}T12:00:00`)
        const daysAway = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
        return (
          <Link href={`/account/bookings/${nextTrip.id}`}>
            <div
              className="flex items-center justify-between gap-4 px-7 py-5 mb-6"
              style={{
                background: 'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] mb-0.5 f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Next adventure
                </p>
                <p className="text-white font-bold text-lg f-display">{title}</p>
                <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {daysAway <= 60 && (
                    <span className="ml-2 font-semibold" style={{ color: '#E67E50' }}>
                      in {daysAway} day{daysAway !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-4xl flex-shrink-0">🎣</div>
            </div>
          </Link>
        )
      })()}

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

        {/* Bookings panel */}
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
              <h2 className="text-[#0A2E4D] text-base font-bold f-display">All Bookings</h2>
              <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{bookings.length} total</p>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div className="px-7 py-16 flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(230,126,80,0.08)' }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#E67E50" strokeWidth="1.5">
                  <rect x="3" y="4" width="16" height="14" rx="2" />
                  <line x1="3" y1="9" x2="19" y2="9" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="14" y1="2" x2="14" y2="6" />
                </svg>
              </div>
              <p className="text-[#0A2E4D]/30 text-sm f-body">No bookings yet.</p>
              <p className="text-[#0A2E4D]/22 text-xs mt-1 f-body">Your fishing adventures will appear here.</p>
              <Link
                href="/trips"
                className="mt-5 text-sm font-semibold f-body transition-colors hover:opacity-70"
                style={{ color: '#E67E50' }}
              >
                Browse experiences →
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {bookings.map(booking => {
                const s            = STATUS_STYLES[booking.status]
                const isCustomTrip = booking.experience_id == null
                const title        = booking.experience?.title ?? (isCustomTrip ? 'Custom Trip' : 'Fishing trip')
                const dateFormatted = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString(
                  'en-GB',
                  { day: 'numeric', month: 'short', year: 'numeric' },
                )

                return (
                  <Link
                    key={booking.id}
                    href={`/account/bookings/${booking.id}`}
                    className="block hover:bg-[#F8F4EF] transition-colors"
                  >
                    <div className="px-7 py-4 flex items-center gap-4">
                      {/* Thumbnail */}
                      <div
                        className="flex-shrink-0 rounded-xl overflow-hidden"
                        style={{ width: 48, height: 48, background: 'rgba(10,46,77,0.06)' }}
                      >
                        {booking.experience_image != null ? (
                          <Image
                            src={booking.experience_image}
                            alt={title}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">🎣</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[#0A2E4D] text-sm font-semibold f-body leading-snug truncate">
                            {title}
                          </p>
                          {isCustomTrip && (
                            <span
                              className="text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full flex-shrink-0 f-body"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#2563EB' }}
                            >
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-[#0A2E4D]/42 text-xs f-body truncate">
                          {booking.guide?.full_name ?? 'Guide'}
                        </p>
                      </div>

                      {/* Date */}
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <p className="text-[#0A2E4D] text-xs font-medium f-body">{dateFormatted}</p>
                        <p className="text-[#0A2E4D]/38 text-xs f-body">
                          {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0 w-14">
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
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Discover CTA */}
          <div
            className="relative overflow-hidden px-6 py-7 flex flex-col"
            style={{
              background: 'linear-gradient(135deg, #E67E50 0%, #c95e30 100%)',
              borderRadius: '24px',
            }}
          >
            <span className="text-3xl mb-3">🎣</span>
            <h3 className="text-white text-base font-bold f-display mb-1">
              Find your next trip
            </h3>
            <p className="f-body text-sm mb-5" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Browse experiences led by Scandinavia&apos;s best guides.
            </p>
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 self-start text-sm font-bold px-5 py-2.5 rounded-full f-body transition-all hover:brightness-105"
              style={{ background: '#fff', color: '#E67E50' }}
            >
              Browse →
            </Link>
          </div>

          {/* Custom trip CTA */}
          <div
            className="px-6 py-6 flex flex-col"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
              Custom trips
            </p>
            <h3 className="text-[#0A2E4D] text-sm font-bold f-display mb-1">
              Need something tailored?
            </h3>
            <p className="f-body text-xs mb-4" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Request a custom itinerary from our expert guides.
            </p>
            <Link
              href="/account/trips"
              className="inline-flex items-center gap-1 self-start text-xs font-semibold f-body transition-opacity hover:opacity-70"
              style={{ color: '#2563EB' }}
            >
              View trip requests →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
