import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { CountryFlag } from '@/components/ui/country-flag'
import { Bell, Calendar, Archive } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = Database['public']['Enums']['booking_status']
type InquiryStatus = Database['public']['Enums']['trip_inquiry_status']

type BookingRow = Database['public']['Tables']['bookings']['Row'] & {
  experience: { title: string } | null
}

type InquiryRow = {
  id:             string
  angler_name:    string
  angler_email:   string
  dates_from:     string | null
  dates_to:       string | null
  target_species: unknown
  group_size:     number | null
  status:         InquiryStatus
  created_at:     string
}

type TabKey = 'action' | 'upcoming' | 'past'

type UnifiedItem = {
  id:             string
  itemType:       'inquiry' | 'booking'
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

const BOOKING_STATUS: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Confirmed' },
  pending:   { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'Pending'   },
  cancelled: { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Cancelled' },
  completed: { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Completed' },
  refunded:  { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Refunded'  },
  accepted:  { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Accepted'  },
  declined:  { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C', label: 'Declined'  },
}

const INQUIRY_STATUS: Record<InquiryStatus, { bg: string; color: string; label: string }> = {
  inquiry:        { bg: 'rgba(230,126,80,0.12)', color: '#E67E50', label: 'New'        },
  reviewing:      { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', label: 'Reviewing'  },
  offer_sent:     { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Offer Sent' },
  offer_accepted: { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Accepted'   },
  confirmed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Confirmed'  },
  completed:      { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Completed'  },
  cancelled:      { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Cancelled'  },
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const GRID = '88px 2fr 1.5fr 1.4fr 55px 120px 100px 70px'

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

  const supabase      = await createClient()
  const serviceClient = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          Please{' '}
          <Link href="/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to view your bookings.
        </p>
      </div>
    )
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

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const [bookingsRes, assignedRes, unassignedRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, experience:experiences(title)')
      .eq('guide_id', guide.id)
      .order('booking_date', { ascending: true }),

    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, angler_email, dates_from, dates_to, target_species, group_size, status, created_at')
      .eq('assigned_guide_id', guide.id)
      .order('created_at', { ascending: false }),

    serviceClient
      .from('trip_inquiries')
      .select('id, angler_name, angler_email, dates_from, dates_to, target_species, group_size, status, created_at')
      .is('assigned_guide_id', null)
      .in('status', ['inquiry', 'reviewing'])
      .order('created_at', { ascending: false }),
  ])

  const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[]

  // Merge & deduplicate inquiries
  const seen = new Set<string>()
  const inquiries = [...(assignedRes.data ?? []), ...(unassignedRes.data ?? [])]
    .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) as InquiryRow[]

  // ── Map to unified items ───────────────────────────────────────────────────

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function mapInquiry(i: InquiryRow): UnifiedItem {
    const s = INQUIRY_STATUS[i.status]
    const dateLabel =
      i.dates_from != null
        ? `${fmtDate(i.dates_from)} – ${i.dates_to != null ? fmtDate(i.dates_to) : '?'}`
        : '—'
    return {
      id:             i.id,
      itemType:       'inquiry',
      anglerName:     i.angler_name,
      anglerEmail:    i.angler_email,
      anglerCountry:  null,
      tripTitle:      'Custom inquiry',
      dateLabel,
      guests:         i.group_size,
      totalEur:       null,
      guidePayoutEur: null,
      statusBg:       s.bg,
      statusColor:    s.color,
      statusLabel:    s.label,
      href:           `/dashboard/inquiries/${i.id}`,
      isPrimary:      i.status === 'inquiry' || i.status === 'reviewing',
      sortDate:       i.dates_from ?? i.created_at,
    }
  }

  function mapBooking(b: BookingRow): UnifiedItem {
    const s      = BOOKING_STATUS[b.status]
    const isCustom = b.experience_id == null
    return {
      id:             b.id,
      itemType:       'booking',
      anglerName:     b.angler_full_name ?? 'Guest',
      anglerEmail:    b.angler_email ?? '',
      anglerCountry:  b.angler_country,
      tripTitle:      b.experience?.title ?? (isCustom ? 'Custom Trip' : '—'),
      dateLabel:      new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      guests:         b.guests,
      totalEur:       b.total_eur,
      guidePayoutEur: b.guide_payout_eur,
      statusBg:       s.bg,
      statusColor:    s.color,
      statusLabel:    s.label,
      href:           `/dashboard/bookings/${b.id}`,
      isPrimary:      b.status === 'pending',
      sortDate:       b.booking_date,
    }
  }

  // Tab 1 — guide must respond/act
  const actionItems: UnifiedItem[] = [
    ...inquiries.filter(i => i.status === 'inquiry' || i.status === 'reviewing').map(mapInquiry),
    ...bookings.filter(b => b.status === 'pending').map(mapBooking),
  ].sort((a, b) => (a.sortDate < b.sortDate ? -1 : 1))

  // Tab 2 — confirmed / in-progress trips
  const upcomingItems: UnifiedItem[] = [
    ...inquiries
      .filter(i => i.status === 'offer_sent' || i.status === 'offer_accepted' || i.status === 'confirmed')
      .map(mapInquiry),
    ...bookings
      .filter(b => b.status === 'accepted' || b.status === 'confirmed')
      .map(mapBooking),
  ].sort((a, b) => (a.sortDate < b.sortDate ? -1 : 1))

  // Tab 3 — ended / archived
  const pastItems: UnifiedItem[] = [
    ...inquiries
      .filter(i => i.status === 'completed' || i.status === 'cancelled')
      .map(mapInquiry),
    ...bookings
      .filter(b =>
        b.status === 'completed' ||
        b.status === 'cancelled'  ||
        b.status === 'refunded'   ||
        b.status === 'declined',
      )
      .map(mapBooking),
  ].sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1))

  const activeItems =
    activeTab === 'action'   ? actionItems   :
    activeTab === 'upcoming' ? upcomingItems : pastItems

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.guide_payout_eur, 0)

  const STATS = [
    { label: 'Needs action',  value: actionItems.length,                                sub: 'require your response'  },
    { label: 'Upcoming',      value: upcomingItems.length,                              sub: 'confirmed trips'        },
    { label: 'New inquiries', value: inquiries.filter(i => i.status === 'inquiry').length, sub: 'unread requests'     },
    { label: 'Total earned',  value: `€${Math.round(totalRevenue).toLocaleString()}`,   sub: 'guide payout'          },
  ]

  const TABS = [
    { key: 'action'   as TabKey, label: 'Needs Action', count: actionItems.length   },
    { key: 'upcoming' as TabKey, label: 'Upcoming',     count: upcomingItems.length },
    { key: 'past'     as TabKey, label: 'Past',         count: pastItems.length     },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1120px]">

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
        <TableCard>
          <TableHeader
            columns={['Type', 'Angler', 'Trip', 'Date', 'Guests', 'Amount', 'Status', '']}
            grid={GRID}
          />
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {activeItems.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className="grid items-center px-6 py-4 transition-colors hover:bg-[#F8F4EE]"
                style={{
                  gridTemplateColumns: GRID,
                  gap:        '12px',
                  display:    'grid',
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
                        : item.itemType === 'inquiry'
                        ? 'rgba(139,92,246,0.1)'
                        : 'rgba(59,130,246,0.1)',
                      color: item.isPrimary
                        ? '#E67E50'
                        : item.itemType === 'inquiry'
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
                    {item.itemType === 'inquiry' ? 'Request' : 'Booking'}
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

                {/* Amount */}
                <div>
                  {item.totalEur != null ? (
                    <>
                      <p className="text-[#0A2E4D] text-sm font-bold f-display">€{item.totalEur}</p>
                      {item.guidePayoutEur != null && (
                        <p className="text-[#16A34A] text-xs f-body">€{item.guidePayoutEur} you</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[#0A2E4D]/28 text-sm f-body">—</p>
                  )}
                </div>

                {/* Status */}
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full self-start f-body"
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
      {children}
    </div>
  )
}

function TableHeader({ columns, grid }: { columns: string[]; grid: string }) {
  return (
    <div
      className="grid px-6 py-3"
      style={{
        gridTemplateColumns: grid,
        borderBottom: '1px solid rgba(10,46,77,0.07)',
        gap: '12px',
      }}
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
