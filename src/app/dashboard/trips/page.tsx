import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const revalidate = 0

export const metadata = { title: 'My Trips — Guide Dashboard' }

// Country → flag emoji
const COUNTRY_FLAG: Record<string, string> = {
  PL: '🇵🇱', DE: '🇩🇪', FR: '🇫🇷', GB: '🇬🇧', NL: '🇳🇱',
  SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', DK: '🇩🇰', IS: '🇮🇸',
  CZ: '🇨🇿', SK: '🇸🇰', HU: '🇭🇺', AT: '🇦🇹', CH: '🇨🇭',
  US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺',
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30)  return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month ago'
  return `${months} months ago`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function GuideTripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawTrips } = await (svc as any)
    .from('inquiries')
    .select('id, angler_name, angler_country, requested_dates, party_size, assigned_at, trip_id')
    .eq('assigned_guide_id', guide.id)
    .not('status', 'in', '("cancelled","lost")')
    .order('assigned_at', { ascending: false })

  type TripRow = {
    id: string
    angler_name: string
    angler_country: string | null
    requested_dates: string[] | null
    party_size: number
    assigned_at: string
    trip_id: string | null
    experience_name?: string | null
  }

  const trips: TripRow[] = rawTrips ?? []

  // Fetch experience names for all trip_ids
  const tripIds = [...new Set(trips.map(t => t.trip_id).filter(Boolean))] as string[]
  const expMap: Record<string, string> = {}
  if (tripIds.length > 0) {
    const { data: exps } = await svc
      .from('experiences')
      .select('id, title')
      .in('id', tripIds)
    for (const exp of exps ?? []) {
      expMap[exp.id] = exp.title
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold f-body mb-1"
           style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          My Trips
        </h1>
        <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Enquiries assigned to you by FjordAnglers
        </p>
      </div>

      {/* Trips list */}
      {trips.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-3xl mb-3">🎣</p>
          <p className="text-base font-semibold f-body" style={{ color: '#0A2E4D' }}>
            No trips assigned yet
          </p>
          <p className="text-sm f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Tymon will notify you when a new booking comes in.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map(trip => {
            const flag = COUNTRY_FLAG[trip.angler_country ?? ''] ?? ''
            const dates = (trip.requested_dates ?? [])
            const expName = trip.trip_id ? expMap[trip.trip_id] : null

            return (
              <Link
                key={trip.id}
                href={`/dashboard/trips/${trip.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="rounded-2xl px-5 py-4 transition-all hover:scale-[1.005]"
                  style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
                >
                  <p className="text-base font-bold f-body truncate mb-0.5" style={{ color: '#0A2E4D' }}>
                    {flag && <span className="mr-1.5">{flag}</span>}
                    {trip.angler_name}
                  </p>
                  {expName != null && (
                    <p className="text-xs f-body mb-2 truncate" style={{ color: 'rgba(10,46,77,0.5)' }}>
                      {expName}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {trip.party_size} {trip.party_size === 1 ? 'angler' : 'anglers'}
                    </span>
                    {dates.length > 0 && (
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {dates.slice(0, 2).map(fmtDate).join(', ')}
                        {dates.length > 2 ? ` +${dates.length - 2} more` : ''}
                      </span>
                    )}
                    <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.32)' }}>
                      Assigned {timeAgo(trip.assigned_at)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}
