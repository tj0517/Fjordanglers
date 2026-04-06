import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { Calendar, Clock, Euro } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

type AnglerBooking = {
  id: string
  booking_date: string
  guests: number
  total_eur: number | null
  status: BookingStatus
  experience_id: string | null
  source: string | null
  target_species: string[] | null
  experience: { id: string; title: string } | null
  guide: { full_name: string } | null
  experience_image: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  pending:        { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Pending'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED', label: 'Under review'   },
  offer_sent:     { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50', label: 'Offer ready'    },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Offer accepted' },
  accepted:       { bg: 'rgba(59,130,246,0.1)',   color: '#2563EB', label: 'Accepted'       },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Confirmed'      },
  completed:      { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Completed'      },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Cancelled'      },
  refunded:       { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Refunded'       },
  declined:       { bg: 'rgba(239,68,68,0.08)',   color: '#B91C1C', label: 'Declined'       },
}

const UPCOMING_STATUSES: BookingStatus[] = [
  'pending', 'reviewing', 'offer_sent', 'offer_accepted', 'accepted', 'confirmed',
]

const GRID_CLASS = 'grid-cols-[64px_2fr_1.4fr_1.2fr_55px_100px_110px_50px]'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/bookings')

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Fetch all bookings (direct + inquiry) ────────────────────────────
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select(
      'id, booking_date, guests, total_eur, status, experience_id, source, target_species, experiences(id, title, experience_images(url, is_cover, sort_order)), guides(full_name)',
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
      [...images].sort((a, x) => a.sort_order - x.sort_order)[0]

    return {
      id:              b.id,
      booking_date:    b.booking_date,
      guests:          b.guests ?? 1,
      total_eur:       b.total_eur,
      status:          b.status,
      experience_id:   b.experience_id,
      source:          b.source,
      target_species:  b.target_species,
      experience:      exp ? { id: exp.id, title: exp.title } : null,
      guide:           b.guides as unknown as { full_name: string } | null,
      experience_image: cover?.url ?? null,
    }
  })

  // ── Stats ──────────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10)

  const upcoming = bookings.filter(
    b => UPCOMING_STATUSES.includes(b.status) && b.booking_date >= todayStr,
  )
  const totalSpent = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_eur ?? 0), 0)

  const STATS = [
    {
      label:  'Total bookings',
      value:  bookings.length.toString(),
      sub:    'all time',
      icon:   <Calendar width={18} height={18} strokeWidth={1.5} />,
      accent: '#1B4F72',
    },
    {
      label:  'Upcoming trips',
      value:  upcoming.length.toString(),
      sub:    upcoming.length > 0 ? 'confirmed or pending' : 'none scheduled',
      icon:   <Clock width={18} height={18} strokeWidth={1.5} />,
      accent: '#E67E50',
    },
    {
      label:  'Total spent',
      value:  `€${totalSpent.toLocaleString()}`,
      sub:    'confirmed bookings',
      icon:   <Euro width={18} height={18} strokeWidth={1.5} />,
      accent: '#0A2E4D',
    },
  ]

  // ── Next trip banner ────────────────────────────────────────────────────────
  const nextTrip = upcoming.find(
    b => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'offer_accepted',
  ) ?? null

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 w-full max-w-[1120px]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {today}
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            My <span style={{ fontStyle: 'italic' }}>Bookings</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Direct bookings and trip requests in one place.
          </p>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="p-6 flex flex-col gap-3"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
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

      {/* ── Next trip banner ──────────────────────────────────────────────── */}
      {nextTrip != null && (() => {
        const isInquiry = nextTrip.source === 'inquiry'
        const title = nextTrip.experience?.title
          ?? (isInquiry && nextTrip.target_species?.length
            ? `Custom trip · ${nextTrip.target_species.join(', ')}`
            : 'Custom Fishing Trip')
        const date     = new Date(`${nextTrip.booking_date}T12:00:00`)
        const daysAway = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
        const href     = isInquiry ? `/account/trips/${nextTrip.id}` : `/account/bookings/${nextTrip.id}`
        return (
          <Link href={href}>
            <div
              className="flex items-center justify-between gap-4 px-7 py-5 mb-6"
              style={{
                background:   'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
                borderRadius: '20px',
                border:       '1px solid rgba(255,255,255,0.08)',
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
              <div className="flex-shrink-0">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.55 }}>
                  <path d="M6 28C10 20 20 16 30 20" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M28 18L32 22L28 26" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="10" cy="10" r="3" stroke="white" strokeWidth="1.8"/>
                  <path d="M10 7V4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M10 13C10 13 14 17 18 16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </Link>
        )
      })()}

      {/* ── Bookings table ────────────────────────────────────────────────── */}
      {bookings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center"
          style={{
            background:   '#FDFAF7',
            borderRadius: '24px',
            border:       '2px dashed rgba(10,46,77,0.12)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(230,126,80,0.08)' }}
          >
            <Calendar width={22} height={22} stroke="#E67E50" strokeWidth={1.5} />
          </div>
          <p className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">No bookings yet</p>
          <p className="text-[#0A2E4D]/45 text-sm f-body">Your fishing adventures will appear here.</p>
          <Link
            href="/trips"
            className="mt-5 text-sm font-semibold f-body transition-colors hover:opacity-70"
            style={{ color: '#E67E50' }}
          >
            Browse experiences →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Mobile cards ──────────────────────────────────────────── */}
          <div className="sm:hidden flex flex-col gap-3">
            {bookings.map(booking => {
              const s          = STATUS_STYLES[booking.status]
              const isInquiry  = booking.source === 'inquiry'
              const title      = booking.experience?.title
                ?? (isInquiry && booking.target_species?.length
                  ? `Custom trip · ${booking.target_species.join(', ')}`
                  : 'Fishing trip')
              const href           = isInquiry ? `/account/trips/${booking.id}` : `/account/bookings/${booking.id}`
              const dateFormatted  = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString(
                'en-GB', { day: 'numeric', month: 'short', year: 'numeric' },
              )
              const isActionable   = booking.status === 'offer_sent' || booking.status === 'accepted' || booking.status === 'offer_accepted'

              return (
                <Link
                  key={booking.id}
                  href={href}
                  className="block rounded-2xl overflow-hidden"
                  style={{
                    background:  '#FDFAF7',
                    border:      isActionable ? '1px solid rgba(230,126,80,0.2)' : '1px solid rgba(10,46,77,0.07)',
                    boxShadow:   '0 2px 8px rgba(10,46,77,0.04)',
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    {/* Thumbnail */}
                    <div
                      className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ background: 'rgba(10,46,77,0.06)' }}
                    >
                      {booking.experience_image != null ? (
                        <Image
                          src={booking.experience_image}
                          alt={title}
                          width={56}
                          height={56}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(10,46,77,0.22)' }}>
                          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                            <path d="M4 20C8 13 16 10 24 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M22 12L26 16L22 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{title}</p>
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-[#0A2E4D]/55 text-xs f-body truncate">{booking.guide?.full_name ?? '—'}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs f-body">
                        <span style={{ color: 'rgba(10,46,77,0.5)' }}>{dateFormatted}</span>
                        <span style={{ color: 'rgba(10,46,77,0.28)' }}>·</span>
                        <span style={{ color: 'rgba(10,46,77,0.5)' }}>{booking.guests} guest{booking.guests !== 1 ? 's' : ''}</span>
                        {booking.total_eur != null && (
                          <>
                            <span style={{ color: 'rgba(10,46,77,0.28)' }}>·</span>
                            <span className="font-bold f-display" style={{ color: '#0A2E4D' }}>€{booking.total_eur}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 text-right">
                    <span
                      className="text-xs font-bold f-body"
                      style={{ color: isActionable ? '#E67E50' : 'rgba(10,46,77,0.38)' }}
                    >
                      {isActionable ? 'Action →' : 'View →'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
          {/* ── Desktop table ─────────────────────────────────────────── */}
          <div className="hidden sm:block">
          <TableCard>
          <TableHeader
            columns={['', 'Trip', 'Guide', 'Date', 'Guests', 'Amount', 'Status', '']}
            gridClass={GRID_CLASS}
          />
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {bookings.map(booking => {
              const s         = STATUS_STYLES[booking.status]
              const isInquiry = booking.source === 'inquiry'
              const title     = booking.experience?.title
                ?? (isInquiry && booking.target_species?.length
                  ? `Custom trip · ${booking.target_species.join(', ')}`
                  : 'Fishing trip')
              const href = isInquiry
                ? `/account/trips/${booking.id}`
                : `/account/bookings/${booking.id}`
              const dateFormatted = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString(
                'en-GB',
                { day: 'numeric', month: 'short', year: 'numeric' },
              )
              const isActionable = booking.status === 'offer_sent' || booking.status === 'accepted' || booking.status === 'offer_accepted'

              return (
                <Link
                  key={booking.id}
                  href={href}
                  className={`grid ${GRID_CLASS} items-center gap-3 px-6 py-4 transition-colors hover:bg-[#F8F4EE]`}
                  style={{
                    background: isActionable ? 'rgba(230,126,80,0.02)' : undefined,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="rounded-xl overflow-hidden flex-shrink-0"
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
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(10,46,77,0.22)' }}>
                        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                          <path d="M4 20C8 13 16 10 24 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M22 12L26 16L22 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Trip title */}
                  <div className="min-w-0">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{title}</p>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full f-body"
                      style={{
                        background: isInquiry ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                        color:      isInquiry ? '#7C3AED' : '#2563EB',
                      }}
                    >
                      {isInquiry ? 'Request' : 'Booking'}
                    </span>
                  </div>

                  {/* Guide */}
                  <p className="text-[#0A2E4D]/70 text-sm f-body truncate">
                    {booking.guide?.full_name ?? '—'}
                  </p>

                  {/* Date */}
                  <p className="text-[#0A2E4D]/65 text-xs f-body">{dateFormatted}</p>

                  {/* Guests */}
                  <p className="text-[#0A2E4D] text-sm font-medium f-body">
                    {booking.guests}
                  </p>

                  {/* Amount */}
                  <div>
                    {booking.total_eur != null ? (
                      <p className="text-[#0A2E4D] text-sm font-bold f-display">€{booking.total_eur}</p>
                    ) : (
                      <p
                        className="text-[11px] font-semibold f-body px-2 py-0.5 rounded-full inline-block"
                        style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}
                      >
                        TBD
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>

                  {/* Arrow */}
                  <p
                    className="text-xs font-bold f-body"
                    style={{ color: isActionable ? '#E67E50' : 'rgba(10,46,77,0.38)' }}
                  >
                    {isActionable ? 'Action →' : 'View →'}
                  </p>
                </Link>
              )
            })}
          </div>
          </TableCard>
          </div>
        </>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background:   '#FDFAF7',
        borderRadius: '24px',
        border:       '1px solid rgba(10,46,77,0.07)',
        boxShadow:    '0 2px 16px rgba(10,46,77,0.05)',
        overflow:     'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '820px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function TableHeader({ columns, gridClass }: { columns: string[]; gridClass: string }) {
  return (
    <div
      className={`grid ${gridClass} gap-3 px-6 py-3`}
      style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
    >
      {columns.map((col, i) => (
        <p key={i} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {col}
        </p>
      ))}
    </div>
  )
}
