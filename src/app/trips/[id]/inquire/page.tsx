import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import InquireForm from './InquireForm'
import type { AvailConfigRow } from '@/components/trips/booking-widget'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function InquirePage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ dates?: string; group?: string }>
}) {
  const { id } = await params
  const sp     = await searchParams

  // Fetch experience (public, service client)
  const serviceClient = createServiceClient()
  const { data: experience } = await serviceClient
    .from('experiences')
    .select('id, title, guide_id, fish_types, inquiry_form_config, guides(id, full_name, avatar_url)')
    .eq('id', id)
    .eq('published', true)
    .single()

  if (!experience) notFound()

  const guide = Array.isArray(experience.guides)
    ? experience.guides[0]
    : experience.guides

  // Fetch guide availability config + blocked dates in parallel
  const [availConfigRes, blockedDatesRes] = await Promise.all([
    serviceClient
      .from('experience_availability_config')
      .select('available_months, available_weekdays, advance_notice_hours, max_advance_days, slots_per_day, start_time')
      .eq('experience_id', id)
      .maybeSingle(),
    serviceClient
      .from('experience_blocked_dates')
      .select('date_start, date_end')
      .eq('experience_id', id),
  ])

  const availabilityConfig = (availConfigRes.data ?? null) as AvailConfigRow | null
  const blockedDates       = (blockedDatesRes.data ?? []) as { date_start: string; date_end: string }[]

  // Check if user is logged in — pre-fill their name + email if so
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let anglerName:  string | null = null
  let anglerEmail: string | null = null

  if (user != null) {
    anglerEmail = user.email ?? null
    // Try to get full_name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    anglerName = profile?.full_name ?? null
  }

  // Parse pre-filled values from URL
  const prefilledDates = sp.dates ? sp.dates.split(',').filter(Boolean) : []
  const prefilledGroup = sp.group ? Math.max(1, Math.min(50, Number(sp.group) || 1)) : 1

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-lg mx-auto px-4 py-12">

        {/* Back link */}
        <a
          href={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 text-sm f-body mb-8 transition-colors"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <polyline points="9,2 5,7 9,12" />
          </svg>
          Back to trip
        </a>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold f-body mb-2"
             style={{ color: '#E67E50' }}>
            Send a request
          </p>
          <h1 className="text-3xl font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
            {experience.title}
          </h1>
          {guide != null && (
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Guide: {guide.full_name}
            </p>
          )}
        </div>

        <InquireForm
          experienceId={experience.id}
          guideId={guide?.id ?? null}
          prefilledDates={prefilledDates}
          prefilledGroup={prefilledGroup}
          anglerName={anglerName}
          anglerEmail={anglerEmail}
          formConfig={experience.inquiry_form_config}
          availabilityConfig={availabilityConfig}
          blockedDates={blockedDates}
          fishTypes={experience.fish_types ?? []}
        />

      </div>
    </div>
  )
}
