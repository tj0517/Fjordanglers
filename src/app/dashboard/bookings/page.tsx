import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { CountryFlag } from '@/components/ui/country-flag'
import { Bell, Calendar, Archive } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']

type BookingRow = Database['public']['Tables']['bookings']['Row'] & {
  experience: { title: string } | null
}

type TabKey = 'action' | 'upcoming' | 'past'

type UnifiedItem = {
  id:             string
  source:         'direct' | 'inquiry'
  anglerName:     string
  anglerEmail:    string
  anglerCountry:  string | null
  tripTitle:      string
  dateLabel:      string
  guests:         number | null
  totalEur:       number | null
  guidePayoutEur: number | null
  statusBg:       string
  statusColor:    string
  statusLabel:    string
  href:           string
  isPrimary:      boolean
  sortDate:       string
}

// ─── Status maps ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  pending:        { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'New'          },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', label: 'Reviewing'    },
  offer_sent:     { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Offer Sent'   },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Accepted'     },
  accepted:       { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Accepted'     },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Confirmed'    },
  completed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Completed'    },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Cancelled'    },
  refunded:       { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Refunded'     },
  declined:       { bg: 'rgba(239,68,68,0.08)',  color: '#B91C1C', label: 'Declined'     },
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const GRID_CLASS = 'grid-cols-[88px_2fr_1.5fr_1.4fr_55px_120px_100px_70px]'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view }   = await searchParams
  const activeTab: TabKey =
    view === 'upcoming' ? 'upcoming' :
    view === 'past'     ? 'past'     : 'action'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    redirect('/login?next=/dashboard/bookings')
  }

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <p className="text-[#0A2E4D]/55 f-body text-sm">No guide profile found.</p>
      </div>
    )
  }

  // ── Fetch all bookings for this guide (unified table) ──────────────────────
  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('*, experience:experiences(title)')
    .eq('guide_id', guide.id)
    .order('booking_date', { ascending: true, nullsFirst: false })

  const bookings = (rawBookings ?? []) as unknown as BookingRow[]

  // ── Map to unified display items ───────────────────────────────────────────

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function mapBooking(b: BookingRow): UnifiedItem {
    const s      = STATUS_STYLES[b.status]
    const source = (b.source ?? 'direct') as 'direct' | 'inquiry'

    // Date label: inquiry bookings may have offer_date_from/to, else booking_date/date_to
    let dateLabel = '—'
    const offerFrom = b.offer_date_from
    const offerTo   = b.offer_date_to
    // `date_to` is the end date for both inquiry date ranges and multi-day direct bookings
    const dateTo    = b.date_to

    if (offerFrom != null) {
      dateLabel = offerFrom === offerTo || offerTo == null
        ? fmtDate(offerFrom)
        : `${fmtDate(offerFrom)} – ${fmtDate(offerTo)}`
    } else if (b.booking_date != null) {
      dateLabel = dateTo != null && dateTo !== b.booking_date
        ? `${fmtDate(b.booking_date)} – ${fmtDate(dateTo)}`
        : new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })
    }

    // Sort date — prefer offer date, then booking_date
    const sortDate = offerFrom ?? b.booking_date ?? b.created_at

    // Action flag: guide needs to respond
    const isPrimary =
      b.status === 'pending' ||
      b.status === 'reviewing'

    // Revenue shown only when a real price exists.
    // For inquiry bookings, total_eur starts at 0 until guide sends a priced offer.
    // Treat 0 (and anything ≤ 0) as "not yet set" — show a placeholder instead of €0.
    const rawTotal      = b.offer_price_eur != null ? b.offer_price_eur : b.total_eur
    const displayTotal  = rawTotal != null && rawTotal > 0 ? rawTotal : null
    const rawPayout     = b.guide_payout_eur
    const displayPayout = rawPayout != null && rawPayout > 0 ? rawPayout : null

    // Trip title
    const isCustom  = b.experience_id == null
    const tripTitle =
      b.experience?.title ??
      (isCustom ? (source === 'inquiry' ? 'Custom inquiry' : 'Custom Trip') : '—')

    // Link: inquiry bookings go to /dashboard/inquiries/[id] (same page, different URL)
    const href = source === 'inquiry'
      ? `/dashboard/inquiries/${b.id}`
      : `/dashboard/bookings/${b.id}`

    return {
      id:             b.id,
      source,
      anglerName:     b.angler_full_name ?? 'Guest',
      anglerEmail:    b.angler_email ?? '',
      anglerCountry:  b.angler_country,
      tripTitle,
      dateLabel,
      guests:         b.guests,
      totalEur:       displayTotal,
      guidePayoutEur: displayPayout,
      statusBg:       s.bg,
      statusColor:    s.color,
      statusLabel:    s.label,
      href,
      isPrimary,
      sortDate:       sortDate ?? b.created_at,
    }
  }

  // Tab filtering
  const ACTION_STATUSES   = new Set<BookingStatus>(['pending', 'reviewing'])
  const UPCOMING_STATUSES = new Set<BookingStatus>(['offer_sent', 'offer_accepted', 'accepted', 'confirmed'])
  const PAST_STATUSES     = new Set<BookingStatus>(['completed', 'cancelled', 'refunded', 'declined'])

  const actionItems: UnifiedItem[] = bookings
    .filter(b => ACTION_STATUSES.has(b.status))
    .map(mapBooking)
    .sort((a, b) => (a.sortDate < b.sortDate ? -1 : 1))

  const upcomingItems: UnifiedItem[] = bookings
    .filter(b => UPCOMING_STATUSES.has(b.status))
    .map(mapBooking)
    .sort((a, b) => (a.sortDate < b.sortDate ? -1 : 1))

  const pastItems: UnifiedItem[] = bookings
    .filter(b => PAST_STATUSES.has(b.status))
    .map(mapBooking)
    .sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1))

  const activeItems =
    activeTab === 'action'   ? actionItems   :
    activeTab === 'upcoming' ? upcomingItems : pastItems

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.guide_payout_eur ?? 0), 0)

  const newInquiries = bookings.filter(
    b => b.source === 'inquiry' && b.status === 'pending',
  ).length

  const STATS = [
    { label: 'Needs action',  value: actionItems.length,                        sub: 'require your response'  },
    { label: 'Upcoming',      value: upcomingItems.length,                      sub: 'confirmed trips'        },
    { label: 'New inquiries', value: newInquiries,                              sub: 'unread requests'        },
    { label: 'Total earned',  value: `€${Math.round(totalRevenue).toLocaleString()}`, sub: 'guide payout'    },
  ]

  const TABS = [
    { key: 'action'   as TabKey, label: 'Needs Action', count: actionItems.length   },
    { key: 'upcoming' as TabKey, label: 'Upcoming',     count: upcomingItems.length },
    { key: 'past'     as TabKey, label: 'Past',         count: pastItems.length     },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 w-full max-w-[1120px]">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Bookings &amp; <span style={{ fontStyle: 'italic' }}>Requests</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Inquiries, confirmed bookings and trip history — all in one place.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map(stat => (
          <div
            key={stat.label}
            className="px-6 py-5"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              boxShadow:    '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
              {stat.label}
            </p>
            <p className="text-[#0A2E4D] text-2xl font-bold f-display">{stat.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(tab => {
          const on       = activeTab === tab.key
          const hasAlert = tab.key === 'action' && tab.count > 0

          return (
            <Link
              key={tab.key}
              href={`?view=${tab.key}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all f-body"
              style={{
                background: on ? '#0A2E4D' : 'rgba(10,46,77,0.05)',
                border:     on ? '1.5px solid #0A2E4D' : '1.5px solid transparent',
              }}
            >
              {hasAlert && !on && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
              )}
              <span className="text-sm font-bold" style={{ color: on ? 'white' : '#0A2E4D' }}>
                {tab.label}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: on
                    ? 'rgba(255,255,255,0.18)'
                    : hasAlert
                    ? 'rgba(230,126,80,0.15)'
                    : 'rgba(10,46,77,0.1)',
                  color: on
                    ? 'white'
                    : hasAlert
                    ? '#E67E50'
                    : 'rgba(10,46,77,0.5)',
                }}
              >
                {tab.count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      {activeItems.length === 0 ? (
        <EmptyState
          icon={
            activeTab === 'action'   ? <BellIcon />     :
            activeTab === 'upcoming' ? <CalendarIcon /> : <ArchiveIcon />
          }
          title={
            activeTab === 'action'   ? 'All caught up!'          :
            activeTab === 'upcoming' ? 'No upcoming trips'       : 'No past bookings yet'
          }
          body={
            activeTab === 'action'
              ? 'No new inquiries or bookings need your attention right now.'
              : activeTab === 'upcoming'
              ? 'Accepted and confirmed bookings will appear here.'
              : 'Completed and cancelled bookings will be archived here.'
          }
        />
      ) : (
        <>
          {/* ── Mobile cards ──────────────────────────────────────────── */}
          <div className="sm:hidden flex flex-col gap-3">
            {activeItems.map(item => (
              <MobileBookingCard key={item.id} item={item} />
            ))}
          </div>
          {/* ── Desktop table ─────────────────────────────────────────── */}
          <div className="hidden sm:block">
          <TableCard>
          <TableHeader
            columns={['Type', 'Angler', 'Trip', 'Date', 'Guests', 'Amount', 'Status', '']}
            gridClass={GRID_CLASS}
          />
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {activeItems.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className={`grid ${GRID_CLASS} items-center gap-3 px-6 py-4 transition-colors hover:bg-[#F8F4EE]`}
                style={{
                  background: item.isPrimary ? 'rgba(230,126,80,0.02)' : undefined,
                }}
              >
                {/* Type badge */}
                <div>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-full f-body whitespace-nowrap"
                    style={{
                      background: item.isPrimary
                        ? 'rgba(230,126,80,0.14)'
                        : item.source === 'inquiry'
                        ? 'rgba(139,92,246,0.1)'
                        : 'rgba(59,130,246,0.1)',
                      color: item.isPrimary
                        ? '#E67E50'
                        : item.source === 'inquiry'
                        ? '#7C3AED'
                        : '#2563EB',
                    }}
                  >
                    {item.isPrimary && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#E67E50' }}
                      />
                    )}
                    {item.source === 'inquiry' ? 'Request' : 'Booking'}
                  </span>
                </div>

                {/* Angler */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.anglerCountry != null && (
                      <CountryFlag country={item.anglerCountry} size={14} />
                    )}
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">
                      {item.anglerName}
                    </p>
                  </div>
                  {item.anglerEmail !== '' && (
                    <p className="text-[#0A2E4D]/38 text-xs f-body truncate">{item.anglerEmail}</p>
                  )}
                  {item.anglerCountry != null && (
                    <p className="text-[#0A2E4D]/38 text-xs f-body">{item.anglerCountry}</p>
                  )}
                </div>

                {/* Trip */}
                <p className="text-[#0A2E4D]/70 text-sm f-body truncate">{item.tripTitle}</p>

                {/* Date */}
                <p className="text-[#0A2E4D]/65 text-xs f-body">{item.dateLabel}</p>

                {/* Guests */}
                <p className="text-[#0A2E4D] text-sm font-medium f-body">
                  {item.guests != null ? String(item.guests) : '—'}
                </p>

                {/* Amount — guide sees only their payout */}
                <div>
                  {item.guidePayoutEur != null ? (
                    <p className="text-[#E67E50] text-sm font-bold f-display">€{item.guidePayoutEur}</p>
                  ) : item.totalEur != null ? (
                    <p className="text-[#0A2E4D] text-sm font-bold f-display">€{item.totalEur}</p>
                  ) : item.source === 'inquiry' ? (
                    /* Inquiry with no offer price yet — waiting for guide to send offer */
                    <p
                      className="text-[11px] font-semibold f-body px-2 py-0.5 rounded-full inline-block"
                      style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}
                    >
                      Custom
                    </p>
                  ) : (
                    <p className="text-[#0A2E4D]/28 text-sm f-body">—</p>
                  )}
                </div>

                {/* Status */}
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
                  style={{ background: item.statusBg, color: item.statusColor }}
                >
                  {item.statusLabel}
                </span>

                {/* Action arrow */}
                <p
                  className="text-xs font-bold f-body"
                  style={{ color: item.isPrimary ? '#E67E50' : 'rgba(10,46,77,0.38)' }}
                >
                  {item.isPrimary ? 'Respond →' : 'View →'}
                </p>
              </Link>
            ))}
          </div>
          </TableCard>
          </div>
        </>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MobileBookingCard({ item }: { item: UnifiedItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-2xl px-4 py-4"
      style={{
        background:  item.isPrimary ? 'rgba(230,126,80,0.02)' : '#FDFAF7',
        border:      item.isPrimary ? '1px solid rgba(230,126,80,0.18)' : '1px solid rgba(10,46,77,0.07)',
        boxShadow:   '0 2px 8px rgba(10,46,77,0.04)',
      }}
    >
      {/* Type + Status */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-full f-body"
          style={{
            background: item.isPrimary ? 'rgba(230,126,80,0.14)' : item.source === 'inquiry' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
            color:      item.isPrimary ? '#E67E50' : item.source === 'inquiry' ? '#7C3AED' : '#2563EB',
          }}
        >
          {item.isPrimary && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
          )}
          {item.source === 'inquiry' ? 'Request' : 'Booking'}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
          style={{ background: item.statusBg, color: item.statusColor }}
        >
          {item.statusLabel}
        </span>
      </div>

      {/* Angler */}
      <div className="flex items-center gap-1.5 mb-0.5">
        {item.anglerCountry != null && (
          <CountryFlag country={item.anglerCountry} size={13} />
        )}
        <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{item.anglerName}</p>
      </div>

      {/* Trip */}
      <p className="text-[#0A2E4D]/60 text-xs f-body truncate mb-2">{item.tripTitle}</p>

      {/* Date · Guests · Amount */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs f-body">
        <span style={{ color: 'rgba(10,46,77,0.55)' }}>{item.dateLabel}</span>
        {item.guests != null && (
          <span style={{ color: 'rgba(10,46,77,0.55)' }}>
            {item.guests} {item.guests === 1 ? 'guest' : 'guests'}
          </span>
        )}
        {item.guidePayoutEur != null ? (
          <span className="font-bold f-display" style={{ color: '#E67E50' }}>€{item.guidePayoutEur}</span>
        ) : item.totalEur != null ? (
          <span className="font-bold f-display" style={{ color: '#0A2E4D' }}>€{item.totalEur}</span>
        ) : null}
      </div>

      {/* CTA */}
      <p
        className="mt-2.5 text-xs font-bold f-body text-right"
        style={{ color: item.isPrimary ? '#E67E50' : 'rgba(10,46,77,0.38)' }}
      >
        {item.isPrimary ? 'Respond →' : 'View →'}
      </p>
    </Link>
  )
}

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
        <div style={{ minWidth: '860px' }}>
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

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      style={{
        background:   '#FDFAF7',
        borderRadius: '24px',
        border:       '2px dashed rgba(10,46,77,0.12)',
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(230,126,80,0.1)' }}
      >
        {icon}
      </div>
      <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">{title}</h3>
      <p className="text-[#0A2E4D]/45 text-sm f-body">{body}</p>
    </div>
  )
}

function BellIcon()    { return <Bell    size={22} strokeWidth={1.5} style={{ color: '#E67E50' }} /> }
function CalendarIcon() { return <Calendar size={22} strokeWidth={1.5} style={{ color: '#E67E50' }} /> }
function ArchiveIcon() { return <Archive  size={22} strokeWidth={1.5} style={{ color: '#E67E50' }} /> }
