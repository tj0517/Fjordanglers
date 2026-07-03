import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar'

export const revalidate = 0

export const metadata = { title: 'Availability — FjordAnglers Dashboard' }

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login?next=/dashboard/calendar')

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // Fetch blocked dates for this guide (up to 1 year ahead)
  const today     = new Date().toISOString().slice(0, 10)
  const yearAhead = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from('guide_unavailable_dates')
    .select('date')
    .eq('guide_id', guide.id)
    .gte('date', today)
    .lte('date', yearAhead)
    .order('date')

  const blockedDates: string[] = (rows ?? []).map((r: { date: string }) => r.date)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10">

      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          Availability
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          All days are available by default. Click a day to block it.
        </p>
      </div>

      <AvailabilityCalendar initialDates={blockedDates} />

    </div>
  )
}
