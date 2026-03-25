import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BookingRespondForm from './BookingRespondForm'

type Props = { params: Promise<{ id: string }> }

export default async function RespondPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/bookings/${id}/respond`)

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!guide) redirect('/dashboard/bookings')

  const serviceClient = createServiceClient()

  // Booking must be pending and belong to this guide
  const { data: booking } = await serviceClient
    .from('bookings')
    .select('*, experience:experiences(id, title, price_per_person_eur, experience_images(url, is_cover, sort_order))')
    .eq('id', id)
    .eq('guide_id', guide.id)
    .single()

  if (!booking || booking.status !== 'pending') {
    redirect(`/dashboard/bookings/${id}`)
  }

  // Guide's weekly schedules → show blocked days on calendar
  const { data: schedules } = await serviceClient
    .from('guide_weekly_schedules')
    .select('period_from, period_to, blocked_weekdays')
    .eq('guide_id', guide.id)

  // Experience blocked date ranges (if experience exists)
  const blockedDates =
    booking.experience_id != null
      ? await serviceClient
          .from('experience_blocked_dates')
          .select('date_start, date_end')
          .eq('experience_id', booking.experience_id)
          .then(r => r.data ?? [])
      : []

  const exp = booking.experience as unknown as {
    id: string
    title: string
    price_per_person_eur: number | null
    experience_images: { url: string; is_cover: boolean; sort_order: number }[]
  } | null

  const images = exp?.experience_images ?? []
  const coverUrl =
    images.find(img => img.is_cover)?.url ??
    images.sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null

  const requestedDates = (booking.requested_dates as string[] | null) ?? undefined

  return (
    <BookingRespondForm
      bookingId={id}
      anglerName={booking.angler_full_name ?? 'Angler'}
      anglerEmail={booking.angler_email ?? ''}
      anglerCountry={booking.angler_country ?? null}
      experienceTitle={exp?.title ?? 'Fishing trip'}
      experienceId={exp?.id ?? null}
      coverUrl={coverUrl}
      windowFrom={booking.booking_date}
      anglerRequestedDates={requestedDates}
      durationOption={booking.duration_option}
      guests={booking.guests}
      totalEur={booking.total_eur}
      depositEur={booking.deposit_eur}
      pricePerPersonEur={exp?.price_per_person_eur ?? null}
      specialRequests={booking.special_requests}
      guideWeeklySchedules={schedules ?? []}
      blockedDates={blockedDates}
    />
  )
}
