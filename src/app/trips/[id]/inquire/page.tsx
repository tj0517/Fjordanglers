import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import InquireForm from './InquireForm'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import { decodePeriodsParam } from '@/lib/periods'
import type { DurationOptionPayload } from '@/actions/experiences'
import { ChevronLeft } from 'lucide-react'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function InquirePage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ dates?: string; group?: string; periods?: string; mode?: string }>
}) {
  const { id } = await params
  const sp     = await searchParams

  // Fetch experience (public, service client)
  const serviceClient = createServiceClient()
  const { data: experience } = await serviceClient
    .from('experiences')
    .select('id, title, guide_id, fish_types, inquiry_form_config, price_per_person_eur, duration_options, guides(id, full_name, avatar_url)')
    .eq('id', id)
    .eq('published', true)
    .single()

  if (!experience) notFound()

  const guide = Array.isArray(experience.guides)
    ? experience.guides[0]
    : experience.guides

  // Fetch availability config + blocked dates (always from calendar_blocked_dates)
  const { data: calExp } = await serviceClient
    .from('calendar_experiences')
    .select('calendar_id')
    .eq('experience_id', id)
    .maybeSingle()

  const [availConfigRes, blockedDatesRes] = await Promise.all([
    serviceClient
      .from('experience_availability_config')
      .select('available_months, available_weekdays, advance_notice_hours, max_advance_days, slots_per_day, start_time')
      .eq('experience_id', id)
      .maybeSingle(),
    calExp != null
      ? serviceClient
          .from('calendar_blocked_dates')
          .select('date_start, date_end')
          .eq('calendar_id', calExp.calendar_id)
      : Promise.resolve({ data: [] as Array<{ date_start: string; date_end: string }> }),
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
  const prefilledDates   = sp.dates   ? sp.dates.split(',').filter(Boolean) : []
  const prefilledPeriods = sp.periods ? decodePeriodsParam(sp.periods)      : []
  const prefilledGroup   = sp.group   ? Math.max(1, Math.min(50, Number(sp.group) || 1)) : 1
  const isDirectMode     = sp.mode === 'direct'

  // ── Price range (widełki) — shown to angler before they submit ────────────
  const durationOpts = Array.isArray(experience.duration_options)
    ? (experience.duration_options as unknown as DurationOptionPayload[])
    : []

  let priceMin: number | null = null
  let priceMax: number | null = null

  if (durationOpts.length > 0) {
    const allPrices = durationOpts.flatMap(o => {
      if (o.pricing_type === 'per_group' && o.group_prices) {
        const vals = Object.values(o.group_prices).filter((v): v is number => typeof v === 'number')
        return vals.length > 0 ? vals : [o.price_eur]
      }
      return [o.price_eur]
    })
    priceMin = Math.min(...allPrices)
    priceMax = Math.max(...allPrices)
  } else if (experience.price_per_person_eur != null) {
    priceMin = experience.price_per_person_eur
    priceMax = experience.price_per_person_eur
  }

  const isRange        = priceMin != null && priceMax != null && priceMin !== priceMax
  const pricingLabel   = isRange
    ? `€${priceMin!.toLocaleString('de-DE')} – €${priceMax!.toLocaleString('de-DE')}`
    : priceMin != null
    ? `From €${priceMin.toLocaleString('de-DE')}`
    : null

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>
      <div className="max-w-lg mx-auto px-4 py-12">

        {/* Back link */}
        <a
          href={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 text-sm f-body mb-8 transition-colors"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          <ChevronLeft size={14} strokeWidth={1.6} />
          Back to trip
        </a>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold f-body mb-2"
             style={{ color: '#E67E50' }}>
            {isDirectMode ? 'Message the guide' : 'Send a request'}
          </p>
          <h1 className="text-3xl font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
            {experience.title}
          </h1>
          {guide != null && (
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Guide: {guide.full_name}
            </p>
          )}
          {isDirectMode && (
            <p className="text-sm f-body mt-2 leading-relaxed" style={{ color: 'rgba(10,46,77,0.52)' }}>
              Have questions before booking? Ask the guide directly — no payment required.
            </p>
          )}

          {/* Price range — visible to angler before submitting */}
          {pricingLabel != null && (
            <div
              className="mt-5 flex items-center justify-between px-4 py-3.5 rounded-2xl"
              style={{
                background: 'rgba(230,126,80,0.07)',
                border:     '1px solid rgba(230,126,80,0.18)',
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5"
                   style={{ color: 'rgba(10,46,77,0.4)' }}>
                  {isRange ? 'Price range' : 'Starting price'}
                </p>
                <p className="text-xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                  {pricingLabel}
                </p>
              </div>
              <p className="text-[11px] f-body text-right max-w-[130px]"
                 style={{ color: 'rgba(10,46,77,0.42)', lineHeight: 1.4 }}>
                {isRange
                  ? 'depends on group size & package'
                  : 'per person · guide confirms exact price'}
              </p>
            </div>
          )}
        </div>

        <InquireForm
          experienceId={experience.id}
          guideId={guide?.id ?? null}
          prefilledDates={prefilledDates}
          prefilledPeriods={prefilledPeriods}
          prefilledGroup={prefilledGroup}
          anglerName={anglerName}
          anglerEmail={anglerEmail}
          formConfig={experience.inquiry_form_config}
          availabilityConfig={availabilityConfig}
          blockedDates={blockedDates}
          fishTypes={experience.fish_types ?? []}
          isDirectMode={isDirectMode}
          durationOptions={durationOpts}
        />

      </div>
    </div>
  )
}
