import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExperienceForm, { type ExperienceFormDefaults } from '@/components/trips/experience-form'
import InquiryFormConfigEditor from '@/components/trips/InquiryFormConfigEditor'
import type { DurationOptionPayload, GroupPricingPayload } from '@/actions/experiences'
import type * as GeoJSON from 'geojson'

/**
 * /dashboard/trips/[id]/edit — Guide edits their own experience.
 *
 * Fetches the experience from DB, maps to ExperienceFormDefaults,
 * mounts ExperienceForm in 'edit' mode.
 * RLS prevents access to other guides' experiences on the server action level.
 * We also do a client-side guard here (guide must own this experience).
 */

export default async function DashboardEditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) redirect(`/login?next=/dashboard/trips/${id}/edit`)

  // Fetch the guide
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/guides/apply')

  // Fetch the experience + images + linked accommodations — verify ownership
  const [{ data: exp }, { data: guideAccommodations }, { data: expAccommodations }] = await Promise.all([
    supabase
      .from('experiences')
      .select('*, images:experience_images(id, url, is_cover, sort_order)')
      .eq('id', id)
      .eq('guide_id', guide.id)   // ← ownership guard
      .single(),
    supabase
      .from('guide_accommodations')
      .select('id, name, type, description, max_guests, location_note')
      .eq('guide_id', guide.id)
      .order('name'),
    supabase
      .from('experience_accommodations')
      .select('accommodation_id')
      .eq('experience_id', id),
  ])

  if (exp == null) notFound()

  // Map DB row → form defaults
  const images = (exp.images ?? []) as Array<{ url: string; is_cover: boolean; sort_order: number }>
  const defaults: ExperienceFormDefaults = {
    title:                exp.title,
    description:          exp.description,
    fish_types:           exp.fish_types,
    technique:            exp.technique ?? '',
    difficulty:           (exp.difficulty ?? null) as import('@/types').Difficulty | null,
    catch_and_release:    exp.catch_and_release ?? false,
    duration_type:        exp.duration_hours != null ? 'hours' : 'days',
    duration_value:       String(exp.duration_hours ?? exp.duration_days ?? ''),
    max_guests:           String(exp.max_guests),
    price_per_person_eur: String(exp.price_per_person_eur),
    location_country:     exp.location_country ?? '',
    location_city:        exp.location_city ?? '',
    meeting_point:        exp.meeting_point_address ?? '',
    location_lat:         exp.location_lat ?? null,
    location_lng:         exp.location_lng ?? null,
    what_included:        exp.what_included,
    what_excluded:        exp.what_excluded,
    published:            exp.published,
    images,
    landscape_url:        exp.landscape_url ?? null,
    // ── Structured fields ────────────────────────────────────────────────────
    duration_options:     (exp.duration_options as unknown as DurationOptionPayload[]) ?? undefined,
    season_from:          exp.season_from ?? null,
    season_to:            exp.season_to ?? null,
    fishing_methods:      exp.fishing_methods ?? [],
    group_pricing:        (exp.group_pricing as unknown as GroupPricingPayload) ?? null,
    location_area:        (exp.location_area as unknown as GeoJSON.Polygon) ?? null,
    location_spots:       (exp.location_spots as unknown as import('@/types').LocationSpot[]) ?? null,
    booking_type:         (exp.booking_type as 'classic' | 'icelandic') ?? 'classic',
    accommodation_ids:    (expAccommodations ?? []).map(r => r.accommodation_id),
    // ── Trip content fields (were missing — root cause of empty form fields) ─
    itinerary:               (exp.itinerary as unknown as import('@/actions/experiences').ItineraryStep[]) ?? null,
    location_description:    exp.location_description ?? null,
    boat_description:        exp.boat_description ?? null,
    accommodation_description: exp.accommodation_description ?? null,
    food_description:        exp.food_description ?? null,
    license_description:     exp.license_description ?? null,
    gear_description:        exp.gear_description ?? null,
    transport_description:   exp.transport_description ?? null,
    price_range_min_eur:     exp.price_range_min_eur ?? null,
    price_range_max_eur:     exp.price_range_max_eur ?? null,
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/dashboard" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Dashboard</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/dashboard/trips" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Trips</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body truncate max-w-[200px] font-semibold" style={{ color: '#0A2E4D' }}>{exp.title}</span>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>Edit</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full f-body"
            style={
              exp.published
                ? { background: 'rgba(74,222,128,0.12)', color: '#16A34A' }
                : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }
            }
          >
            {exp.published ? '● Live' : '○ Draft'}
          </span>
        </div>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Edit <span style={{ fontStyle: 'italic' }}>{exp.title}</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body">
          Changes are saved immediately when you click Save Changes.
        </p>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <ExperienceForm
        guideId={guide.id}
        mode="edit"
        expId={exp.id}
        defaultValues={defaults}
        guideName={guide.full_name}
        context="guide"
        successPath="/dashboard/trips"
        guideAccommodations={guideAccommodations ?? []}
        inquiryFormConfigSlot={
          <InquiryFormConfigEditor
            expId={exp.id}
            initialConfig={exp.inquiry_form_config}
          />
        }
      />
    </div>
  )
}
