import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { IcelandicInquireForm } from './IcelandicInquireForm'
import type { IcelandicFormConfig } from '@/types'

/**
 * /trips/[id]/inquire — full Icelandic Flow enquiry form.
 *
 * Server Component. Parses URL params (periods, guests) pre-filled from the widget,
 * fetches the experience + inquiry_form_config, then renders the client form.
 *
 * URL format:
 *   ?periods=2024-06-15..2024-06-22,2024-07-01..2024-07-07&guests=2
 */

export default async function IcelandicInquirePage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ periods?: string; guests?: string; duration?: string }>
}) {
  const { id } = await params
  const sp      = await searchParams

  // ── Parse URL params ─────────────────────────────────────────────────────
  const periodsRaw = sp.periods ?? ''
  const initialPeriods = periodsRaw
    .split(',')
    .filter(Boolean)
    .map(p => {
      const [from, to] = p.split('..')
      return { from: from ?? '', to: to ?? from ?? '' }
    })
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to))

  const initialGuests       = Math.max(1, parseInt(sp.guests   ?? '1',  10) || 1)
  const initialDurationDays = Math.max(1, Math.min(30, parseInt(sp.duration ?? '1', 10) || 1))

  // ── Fetch experience ─────────────────────────────────────────────────────
  const supabase = await createClient()

  const { data: rawExp } = await supabase
    .from('experiences')
    .select('id, title, booking_type, max_guests, inquiry_form_config, fish_types, fishing_methods, guide_id, published, guide:guides(id, full_name, avatar_url)')
    .eq('id', id)
    .eq('published', true)
    .single()

  if (rawExp == null || rawExp.booking_type !== 'icelandic') notFound()

  const exp = rawExp as typeof rawExp & {
    guide: { id: string; full_name: string; avatar_url: string | null }
  }

  // ── Fetch guide's blocked dates (for the calendar in step 1) ────────────
  //
  // calendar_blocked_dates has NO guide_id column — must join through calendars:
  //   1. Experience-specific: calendar_experiences WHERE experience_id = exp.id
  //   2. Fallback: guide_calendars WHERE guide_id = exp.guide.id (all guide calendars)
  //
  // Service client bypasses RLS — calendar availability is public-facing data
  // (same pattern as fetchBookingWidgetData in /trips/[id]/page.tsx).
  const svc   = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Step 1 — experience-specific calendars
  const { data: expCalendars } = await svc
    .from('calendar_experiences')
    .select('calendar_id')
    .eq('experience_id', exp.id)

  let calendarIds: string[] = (expCalendars ?? []).map(
    (c: { calendar_id: string }) => c.calendar_id,
  )

  // Step 2 — fallback: all guide calendars
  if (calendarIds.length === 0) {
    const { data: guideCalendars } = await svc
      .from('guide_calendars')
      .select('id')
      .eq('guide_id', exp.guide.id)
    calendarIds = (guideCalendars ?? []).map((c: { id: string }) => c.id)
  }

  // Step 3 — blocked date ranges for those calendars
  const blockedRanges: Array<{ date_start: string; date_end: string }> = []
  if (calendarIds.length > 0) {
    const { data: rawBlocked } = await svc
      .from('calendar_blocked_dates')
      .select('date_start, date_end')
      .in('calendar_id', calendarIds)
      .gte('date_end', today)
    blockedRanges.push(...(rawBlocked ?? []))
  }

  // ── Get auth user + profile ───────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  let initialUser: { id: string; email: string; name: string } | null = null
  if (user != null) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    initialUser = { id: user.id, email: user.email ?? '', name: profile?.full_name ?? '' }
  }

  return (
    <IcelandicInquireForm
      experience={{
        id:                  exp.id,
        title:               exp.title,
        max_guests:          exp.max_guests ?? 99,
        inquiry_form_config: (exp.inquiry_form_config as unknown as IcelandicFormConfig | null) ?? null,
        targetSpecies:       rawExp.fish_types ?? [],
        fishingMethods:      rawExp.fishing_methods ?? [],
      }}
      guide={{
        id:         exp.guide.id,
        full_name:  exp.guide.full_name,
        avatar_url: exp.guide.avatar_url,
      }}
      initialPeriods={initialPeriods}
      initialGuests={initialGuests}
      initialDurationDays={initialDurationDays}
      initialUser={initialUser}
      backHref={`/trips/${id}`}
      blockedRanges={blockedRanges}
    />
  )
}
