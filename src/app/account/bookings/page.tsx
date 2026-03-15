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
  deposit_eur: number | null
  status: BookingStatus
  experience: { id: string; title: string } | null
  guide: { full_name: string; avatar_url: string | null } | null
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account/bookings')
  }

  // Fetch bookings with experience + guide data
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select(
      'id, booking_date, guests, total_eur, deposit_eur, status, experiences(id, title, experience_images(url, is_cover, sort_order)), guides(full_name, avatar_url)',
    )
    .eq('angler_id', user.id)
    .order('created_at', { ascending: false })

  // Massage data into clean shape
  const bookings: AnglerBooking[] = (rawBookings ?? []).map(b => {
    const exp = b.experiences as unknown as {
      id: string
      title: string
      experience_images: { url: string; is_cover: boolean; sort_order: number }[]
    } | null

    const images = exp?.experience_images ?? []
    const cover =
      images.find(img => img.is_cover) ??
      images.sort((a, b) => a.sort_order - b.sort_order)[0]

    return {
      id: b.id,
      booking_date: b.booking_date,
      guests: b.guests ?? 1,
      total_eur: b.total_eur,
      deposit_eur: b.deposit_eur,
      status: b.status,
      experience: exp ? { id: exp.id, title: exp.title } : null,
      guide: b.guides as unknown as { full_name: string; avatar_url: string | null } | null,
      experience_image: cover?.url ?? null,
    }
  })

  return (
    <div
      className="min-h-screen"
      style={{ background: '#F3EDE4' }}
    >
      {/* ── Simple top bar ────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(243,237,228,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.06)',
        }}
      >
        <Link href="/experiences" className="f-body text-sm" style={{ color: 'rgba(10,46,77,0.5)' }}>
          ← Experiences
        </Link>
        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
          My Bookings
        </p>
        <div className="w-20" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            My Account
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            My <span style={{ fontStyle: 'italic' }}>Bookings</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} total
          </p>
        </div>

        {/* Empty state */}
        {bookings.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 text-center"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '2px dashed rgba(10,46,77,0.12)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'rgba(230,126,80,0.1)' }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                stroke="#E67E50"
                strokeWidth="1.5"
              >
                <rect x="3" y="4" width="16" height="14" rx="2" />
                <line x1="3" y1="9" x2="19" y2="9" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="14" y1="2" x2="14" y2="6" />
              </svg>
            </div>
            <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">No bookings yet</h3>
            <p className="text-[#0A2E4D]/45 text-sm f-body mb-6">
              Your fishing adventures will appear here once you book.
            </p>
            <Link
              href="/experiences"
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full f-body transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              Browse Experiences →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.map(booking => {
              const s = STATUS_STYLES[booking.status]
              const dateFormatted = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString(
                'en-GB',
                { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
              )

              return (
                <div
                  key={booking.id}
                  className="flex gap-5 items-start"
                  style={{
                    background: '#FDFAF7',
                    borderRadius: '20px',
                    border: '1px solid rgba(10,46,77,0.08)',
                    boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
                    padding: '20px',
                  }}
                >
                  {/* Experience thumbnail */}
                  <div
                    className="flex-shrink-0 rounded-2xl overflow-hidden"
                    style={{ width: 80, height: 80, background: 'rgba(10,46,77,0.06)' }}
                  >
                    {booking.experience_image != null ? (
                      <Image
                        src={booking.experience_image}
                        alt={booking.experience?.title ?? 'Experience'}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span style={{ color: 'rgba(10,46,77,0.2)', fontSize: 28 }}>🎣</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-[#0A2E4D] text-base font-bold f-display leading-snug truncate">
                        {booking.experience?.title ?? 'Experience'}
                      </h3>
                      <span
                        className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </div>

                    {/* Guide line */}
                    {booking.guide != null && (
                      <div className="flex items-center gap-2 mb-2">
                        {booking.guide.avatar_url != null ? (
                          <Image
                            src={booking.guide.avatar_url}
                            alt={booking.guide.full_name}
                            width={20}
                            height={20}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ background: '#0A2E4D' }}
                          >
                            {booking.guide.full_name[0]}
                          </div>
                        )}
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                          {booking.guide.full_name}
                        </p>
                      </div>
                    )}

                    {/* Details row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      <span>📅 {dateFormatted}</span>
                      <span>
                        👥 {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
                      </span>
                      <span className="font-semibold" style={{ color: '#0A2E4D' }}>
                        €{booking.total_eur}
                      </span>
                      {booking.deposit_eur != null && (
                        <span style={{ color: '#E67E50' }}>
                          Deposit paid: €{booking.deposit_eur}
                        </span>
                      )}
                    </div>

                    {/* Rebook link */}
                    {booking.experience != null && (
                      <Link
                        href={`/experiences/${booking.experience.id}`}
                        className="inline-block mt-3 text-xs font-semibold f-body transition-opacity hover:opacity-70"
                        style={{ color: '#E67E50' }}
                      >
                        View experience →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
