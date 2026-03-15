import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarGrid from '@/components/dashboard/calendar-grid'

export const revalidate = 0  // always fetch fresh data — calendar changes frequently

export const metadata = { title: 'Calendar — FjordAnglers Dashboard' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect('/login?next=/dashboard/calendar')

  // ── Guide profile ───────────────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // ── Resolve year / month from URL (default = current month) ────────────────
  const sp = await searchParams
  const now = new Date()
  const year  = Number(sp.year  ?? now.getFullYear())
  const month = Number(sp.month ?? now.getMonth() + 1)

  // Clamp to a sane range
  const safeYear  = Math.min(Math.max(year, 2020), 2099)
  const safeMonth = Math.min(Math.max(month, 1), 12)

  const firstDay = toDateStr(safeYear, safeMonth, 1)
  const lastDay  = toDateStr(safeYear, safeMonth, new Date(safeYear, safeMonth, 0).getDate())

  // ── Experiences ─────────────────────────────────────────────────────────────
  const { data: experiences } = await supabase
    .from('experiences')
    .select('id, title, published')
    .eq('guide_id', guide.id)
    .order('title')

  const expIds = (experiences ?? []).map((e) => e.id)

  // ── Blocked ranges overlapping the viewed month ─────────────────────────────
  // Overlap condition: date_start <= lastDay AND date_end >= firstDay
  const blockedQuery = expIds.length > 0
    ? supabase
        .from('experience_blocked_dates')
        .select('id, experience_id, date_start, date_end, reason')
        .in('experience_id', expIds)
        .lte('date_start', lastDay)
        .gte('date_end', firstDay)
        .order('date_start')
    : null

  // ── Bookings in the viewed month ────────────────────────────────────────────
  const bookingsQuery = expIds.length > 0
    ? supabase
        .from('bookings')
        .select('id, experience_id, booking_date, guests, status, angler_full_name')
        .in('experience_id', expIds)
        .gte('booking_date', firstDay)
        .lte('booking_date', lastDay)
        .in('status', ['pending', 'confirmed'])
        .order('booking_date')
    : null

  const [blockedResult, bookingsResult] = await Promise.all([
    blockedQuery  ?? Promise.resolve({ data: [] }),
    bookingsQuery ?? Promise.resolve({ data: [] }),
  ])

  const blocked  = (blockedResult.data  ?? []) as Array<{
    id: string; experience_id: string; date_start: string; date_end: string; reason: string | null
  }>
  const bookings = (bookingsResult.data ?? []) as Array<{
    id: string; experience_id: string; booking_date: string; guests: number; status: string; angler_full_name: string | null
  }>

  // ── Stats ───────────────────────────────────────────────────────────────────
  const blockedDaysCount = blocked.reduce((acc, b) => {
    const start = new Date(b.date_start)
    const end   = new Date(b.date_end)
    return acc + Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  }, 0)

  return (
    <div className="px-10 py-10 max-w-[900px]">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold f-display mb-1"
          style={{ color: '#0A2E4D' }}
        >
          Availability Calendar
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Block dates when you're unavailable — anglers won't see those days for booking.
        </p>
      </div>

      {/* ─── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Trips',
            value: String(expIds.length),
            sub:   expIds.length === 1 ? 'managed trip' : 'managed trips',
          },
          {
            label: 'Blocked periods',
            value: String(blocked.length),
            sub:   `${blockedDaysCount} day${blockedDaysCount !== 1 ? 's' : ''} this month`,
          },
          {
            label: 'Bookings this month',
            value: String(bookings.length),
            sub:   'pending or confirmed',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl px-5 py-4"
            style={{
              background:   '#FDFAF7',
              border:       '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body mb-1"
               style={{ color: 'rgba(10,46,77,0.38)' }}>
              {s.label}
            </p>
            <p className="text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>{s.value}</p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Calendar grid ────────────────────────────────────────────────── */}
      <CalendarGrid
        year={safeYear}
        month={safeMonth}
        experiences={experiences ?? []}
        blocked={blocked}
        bookings={bookings}
      />

    </div>
  )
}
