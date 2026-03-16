import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExperienceForm, { type ExperienceFormDefaults } from '@/components/trips/experience-form'
import type { DurationOptionPayload, InclusionsPayload, GroupPricingPayload, ItineraryStep } from '@/actions/experiences'
import type * as GeoJSON from 'geojson'

/**
 * /admin/guides/[id]/trips/[expId]/edit
 *
 * Admin edits any experience — no ownership check required.
 * After save, redirects back to the parent guide's manage page.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; expId: string }>
}) {
  const { expId } = await params
  const supabase = await createClient()
  const { data: exp } = await supabase
    .from('experiences')
    .select('title')
    .eq('id', expId)
    .single()
  return { title: exp != null ? `Edit: ${exp.title} — Admin` : 'Edit Trip' }
}

export default async function AdminEditExperiencePage({
  params,
}: {
  params: Promise<{ id: string; expId: string }>
}) {
  const { id: guideId, expId } = await params
  const supabase = await createClient()

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [{ data: guide }, { data: exp }] = await Promise.all([
    supabase
      .from('guides')
      .select('id, full_name, is_beta_listing')
      .eq('id', guideId)
      .single(),
    supabase
      .from('experiences')
      .select('*, images:experience_images(id, url, is_cover, sort_order)')
      .eq('id', expId)
      .eq('guide_id', guideId) // sanity check — experience must belong to this guide
      .single(),
  ])

  if (guide == null || exp == null) notFound()

  // ── Map DB row → form defaults ──────────────────────────────────────────────
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
    meeting_point:        exp.meeting_point ?? '',
    location_lat:         exp.location_lat ?? null,
    location_lng:         exp.location_lng ?? null,
    what_included:        exp.what_included,
    what_excluded:        exp.what_excluded,
    published:            exp.published,
    images,
    landscape_url:        exp.landscape_url ?? null,
    // ── Structured fields (the ones that were missing — root cause of pricing reset) ──
    duration_options:     (exp.duration_options as unknown as DurationOptionPayload[]) ?? undefined,
    season_from:          exp.season_from ?? null,
    season_to:            exp.season_to ?? null,
    fishing_methods:      exp.fishing_methods ?? [],
    inclusions_data:      (exp.inclusions as unknown as InclusionsPayload) ?? null,
    group_pricing:        (exp.group_pricing as unknown as GroupPricingPayload) ?? null,
    location_area:        (exp.location_area as unknown as GeoJSON.Polygon) ?? null,
    location_spots:       (exp.location_spots as unknown as import('@/types').LocationSpot[]) ?? null,
    booking_type:         (exp.booking_type as 'classic' | 'icelandic') ?? 'classic',
    // Trip content fields (columns added by DB migration — cast via unknown record)
    itinerary:                    ((exp as Record<string, unknown>).itinerary as ItineraryStep[] | null) ?? null,
    location_description:         (exp as Record<string, unknown>).location_description as string ?? null,
    boat_description:             (exp as Record<string, unknown>).boat_description as string ?? null,
    accommodation_description:    (exp as Record<string, unknown>).accommodation_description as string ?? null,
    food_description:             (exp as Record<string, unknown>).food_description as string ?? null,
    license_description:          (exp as Record<string, unknown>).license_description as string ?? null,
    gear_description:             (exp as Record<string, unknown>).gear_description as string ?? null,
    transport_description:        (exp as Record<string, unknown>).transport_description as string ?? null,
  }

  return (
    <div className="px-10 py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Admin
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/trips" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Trips
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href={`/admin/guides/${guide.id}`} className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {guide.full_name}
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body truncate max-w-[200px]" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {exp.title}
        </span>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>Edit</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
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
          {guide.is_beta_listing && (
            <span
              className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full f-body"
              style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
            >
              Beta guide
            </span>
          )}
        </div>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-1">
          Edit <span style={{ fontStyle: 'italic' }}>{exp.title}</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body">
          Guide: <span className="font-medium" style={{ color: 'rgba(10,46,77,0.65)' }}>{guide.full_name}</span>
          {' · '}Changes saved immediately on submit.
        </p>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <ExperienceForm
        guideId={guide.id}
        mode="edit"
        expId={exp.id}
        defaultValues={defaults}
        guideName={guide.full_name}
        context="admin"
        successPath={`/admin/guides/${guide.id}`}
      />
    </div>
  )
}
