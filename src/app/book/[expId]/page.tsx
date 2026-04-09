import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BookingFlow } from './BookingFlow'
import type { DurationOptionPayload } from '@/actions/experiences'

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ expId: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const { expId } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const svc = createServiceClient()

  // Fetch experience + auth in parallel
  const [
    { data: exp },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from('experiences')
      .select('id, title, price_per_person_eur, max_guests, duration_options, booking_type, guide_id, location_city, location_country')
      .eq('id', expId)
      .eq('published', true)
      .single(),
    supabase.auth.getUser(),
  ])

  if (exp == null || (exp.booking_type !== 'classic' && exp.booking_type !== 'both')) {
    notFound()
  }

  // Fetch guide
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, commission_rate, avatar_url, city')
    .eq('id', exp.guide_id)
    .single()

  // Fetch blocked ranges via service client (bypasses RLS — public-facing data).
  // Use experience-specific calendars when linked (calendar_experiences), otherwise
  // fall back to all guide calendars — same logic as the trip detail page.
  const today     = new Date().toISOString().slice(0, 10)
  const yearAhead = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

  const [
    { data: expCalendars },
    { data: allGuideCalendars },
  ] = await Promise.all([
    svc.from('calendar_experiences').select('calendar_id').eq('experience_id', expId),
    svc.from('guide_calendars').select('id').eq('guide_id', exp.guide_id),
  ])

  const specificIds  = (expCalendars ?? []).map((c: { calendar_id: string }) => c.calendar_id)
  const calendarIds  = specificIds.length > 0
    ? specificIds
    : (allGuideCalendars ?? []).map((c: { id: string }) => c.id)

  const { data: blockedRanges } = calendarIds.length > 0
    ? await svc
        .from('calendar_blocked_dates')
        .select('date_start, date_end')
        .in('calendar_id', calendarIds)
        .gte('date_end', today)
        .lte('date_start', yearAhead)
    : { data: [] as Array<{ date_start: string; date_end: string }> }

  // Fetch angler profile name if logged in
  let anglerName = ''
  if (user != null) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    anglerName = profile?.full_name ?? ''
  }

  const locationCity = exp.location_city ?? guide?.city ?? null
  const locationCountry = exp.location_country ?? null

  return (
    <BookingFlow
      experience={{
        id: exp.id,
        title: exp.title,
        price_per_person_eur: exp.price_per_person_eur ?? 0,
        max_guests: exp.max_guests ?? 12,
        duration_options: exp.duration_options as DurationOptionPayload[] | null,
      }}
      guideName={guide?.full_name ?? 'Guide'}
      guideAvatarUrl={guide?.avatar_url ?? null}
      locationCity={locationCity}
      locationCountry={locationCountry}
      commissionRate={guide?.commission_rate ?? 0.10}
      blockedRanges={blockedRanges ?? []}
      initialUser={user != null ? { id: user.id, email: user.email ?? '', name: anglerName } : null}
      initialDatesStr={sp.dates ?? ''}
      initialPkgLabel={sp.pkg ?? ''}
      initialGuests={sp.guests != null ? Math.max(1, parseInt(sp.guests)) : 1}
    />
  )
}
