import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'
import { User, LogOut } from 'lucide-react'

export const revalidate = 0

export const metadata = { title: 'Dashboard — FjordAnglers' }

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

type TripState = 'unresponded' | 'needs_offer' | 'offer_sent' | 'confirmed'

const TRIP_STATE: Record<TripState, { label: string; dot: string; text: string }> = {
  unresponded: { label: 'Awaiting your response', dot: '#F59E0B', text: '#92400E' },
  needs_offer: { label: 'Create your offer',      dot: '#0A2E4D', text: '#0A2E4D' },
  offer_sent:  { label: 'Offer sent',             dot: '#E67E50', text: '#B45309' },
  confirmed:   { label: 'Confirmed',              dot: '#10B981', text: '#065F46' },
}

function tripState(
  guideAcceptance: string | null,
  hasOffer: boolean,
  status: string,
): TripState {
  if (status === 'deposit_paid' || status === 'completed') return 'confirmed'
  if (guideAcceptance == null) return 'unresponded'
  if (guideAcceptance === 'accepted' && !hasOffer) return 'needs_offer'
  if (guideAcceptance === 'accepted' && hasOffer) return 'offer_sent'
  return 'needs_offer'
}

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id, full_name, status')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/login')

  const firstName = guide.full_name?.split(' ')[0] ?? 'there'

  const statusLabel: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending review', bg: 'rgba(217,119,6,0.1)',  color: '#B45309' },
    active:    { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    verified:  { label: 'Active',         bg: 'rgba(74,222,128,0.1)', color: '#16A34A' },
    suspended: { label: 'Suspended',      bg: 'rgba(239,68,68,0.1)',  color: '#DC2626' },
  }
  const statusStyle = statusLabel[guide.status] ?? statusLabel['pending']!

  // Fetch active trips assigned to this guide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawTrips } = await (svc as any)
    .from('inquiries')
    .select('id, angler_name, requested_dates, guide_acceptance, status')
    .eq('assigned_guide_id', guide.id)
    .not('status', 'in', '("cancelled","lost")')
    .order('assigned_at', { ascending: false })

  type TripRow = {
    id: string
    angler_name: string
    requested_dates: string[] | null
    guide_acceptance: string | null
    status: string
  }

  const trips: TripRow[] = rawTrips ?? []

  // Fetch guide_options to detect offer submission
  const offerMap: Record<string, boolean> = {}
  if (trips.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdRows } = await (svc as any)
      .from('inquiry_trip_details')
      .select('inquiry_id, guide_options')
      .in('inquiry_id', trips.map(t => t.id))
    for (const row of tdRows ?? []) {
      offerMap[row.inquiry_id] = Array.isArray(row.guide_options) && row.guide_options.length > 0
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-lg">

      {/* Header */}
      <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
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

      {/* Active trips */}
      {trips.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-3"
            style={{ color: 'rgba(10,46,77,0.38)' }}>
            Your trips
          </p>
          <div className="flex flex-col gap-2">
            {trips.map(trip => {
              const state = tripState(trip.guide_acceptance, offerMap[trip.id] ?? false, trip.status)
              const st = TRIP_STATE[state]
              const dates = trip.requested_dates ?? []

              return (
                <Link
                  key={trip.id}
                  href={`/dashboard/trips/${trip.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.005]"
                    style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
                  >
                    {/* Color dot */}
                    <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: st.dot }} />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold f-body truncate" style={{ color: '#0A2E4D' }}>
                        {trip.angler_name}
                      </p>
                      {dates.length > 0 && (
                        <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          {dates.slice(0, 2).map(fmtDate).join(', ')}
                          {dates.length > 2 ? ` +${dates.length - 2}` : ''}
                        </p>
                      )}
                    </div>

                    {/* State label */}
                    <p className="text-[10px] font-bold f-body flex-shrink-0 text-right"
                      style={{ color: st.text }}>
                      {st.label}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>

          <Link href="/dashboard/trips"
            className="block text-center text-xs f-body font-semibold mt-3"
            style={{ color: 'rgba(10,46,77,0.38)', textDecoration: 'none' }}>
            View all trips →
          </Link>
        </div>
      )}

      {/* Action cards */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/profile/edit"
          className="flex items-center gap-5 px-6 py-5 rounded-2xl transition-all hover:scale-[1.01]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)', textDecoration: 'none' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(10,46,77,0.06)' }}>
            <User size={20} strokeWidth={1.5} style={{ color: '#0A2E4D' }} />
          </div>
          <div>
            <p className="text-base font-bold f-body" style={{ color: '#0A2E4D' }}>Edit profile</p>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>Update your info, bio & photos</p>
          </div>
        </Link>

        {/* Logout */}
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm f-body font-semibold px-4 py-2.5 rounded-xl transition-all"
            style={{ color: 'rgba(10,46,77,0.4)', background: 'transparent' }}
          >
            <LogOut size={14} strokeWidth={1.6} />
            Log out
          </button>
        </form>
      </div>

    </div>
  )
}
