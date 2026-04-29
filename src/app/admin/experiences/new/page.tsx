import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import ExperiencePageForm from '@/components/admin/ExperiencePageForm'
import type { ExperiencePageFormProps } from '@/components/admin/ExperiencePageForm'

/**
 * /admin/experiences/new — FA creates a new experience_page.
 *
 * Supports two pre-fill sources:
 *   ?submission_id=UUID  — pre-fill from a guide_submission
 *   ?experience_id=UUID  — pre-fill from an existing experience (trip)
 */

export const metadata = {
  title: 'New Experience Page — Admin',
}

export default async function AdminNewExperiencePagePage({
  searchParams,
}: {
  searchParams: Promise<{ submission_id?: string; experience_id?: string; guide_id?: string }>
}) {
  const { submission_id, experience_id, guide_id } = await searchParams

  let prefill: ExperiencePageFormProps['prefill'] = undefined
  let prefillLabel: string | undefined
  let prefillSource: 'submission' | 'experience' | undefined
  let guidePhotos: string[] = []
  let backHref: string | undefined

  const svc = createServiceClient()

  // ── Pre-fill from guide_submission ────────────────────────────────────────
  if (submission_id) {
    const { data: sub } = await svc
      .from('guide_submissions')
      .select('guide_id, location_name, country, region, species, fishing_methods, season_months, price_approx_eur')
      .eq('id', submission_id)
      .single()

    if (sub != null) {
      prefill = {
        guide_id:       sub.guide_id,
        country:        sub.country,
        region:         sub.region ?? sub.location_name,
        species:        sub.species ?? [],
        technique:      (sub.fishing_methods as string[] | null) ?? [],
        season_months:  (sub.season_months as number[] | null) ?? [],
        price_approx:   sub.price_approx_eur,
        location_name:  sub.location_name,
      }
      prefillLabel  = sub.location_name
      prefillSource = 'submission'
      backHref      = `/admin/submissions/${submission_id}`

      if (sub.guide_id) {
        const { data: photos } = await svc
          .from('guide_photos')
          .select('url')
          .eq('guide_id', sub.guide_id)
          .order('sort_order', { ascending: true })
        guidePhotos = (photos ?? []).map(p => p.url)
      }
    }
  }

  // ── Pre-fill from existing experience (trip) ──────────────────────────────
  if (!prefill && experience_id) {
    const { data: exp } = await svc
      .from('experiences')
      .select('id, title, guide_id, location_city, location_country, fish_types, price_per_person_eur, difficulty')
      .eq('id', experience_id)
      .single()

    if (exp != null) {
      const resolvedGuideId = guide_id ?? exp.guide_id

      prefill = {
        guide_id:       resolvedGuideId,
        country:        exp.location_country ?? '',
        region:         exp.location_city ?? '',
        species:        (exp.fish_types as string[] | null) ?? [],
        technique:      [],
        season_months:  [],
        price_approx:   exp.price_per_person_eur,
        location_name:  exp.title,
      }
      prefillLabel  = exp.title
      prefillSource = 'experience'
      backHref      = resolvedGuideId ? `/admin/guides/${resolvedGuideId}` : undefined

      if (resolvedGuideId) {
        const { data: photos } = await svc
          .from('guide_photos')
          .select('url')
          .eq('guide_id', resolvedGuideId)
          .order('sort_order', { ascending: true })
        guidePhotos = (photos ?? []).map(p => p.url)
      }
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[900px]">

      {/* ─── Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/experiences" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>Experiences</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>New</span>
      </div>

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body font-semibold" style={{ color: '#E67E50' }}>
          New experience page
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Build a{' '}
          <span style={{ fontStyle: 'italic' }}>polished experience</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '560px' }}>
          Create the public-facing editorial page for this trip.
          Once saved with <strong>Active</strong> status, it&apos;s live at{' '}
          <span style={{ color: '#E67E50' }}>/experiences/[slug]</span>.
        </p>

        {/* Pre-fill notice */}
        {prefillLabel && (
          <div
            className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(230,126,80,0.07)', border: '1px solid rgba(230,126,80,0.2)' }}
          >
            <span className="text-lg">
              {prefillSource === 'experience' ? '🎣' : '📋'}
            </span>
            <div>
              <p className="text-xs font-bold f-body" style={{ color: '#E67E50' }}>
                {prefillSource === 'experience'
                  ? 'Pre-filled from existing trip'
                  : 'Pre-filled from guide submission'}
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Fields populated from: <strong>{prefillLabel}</strong>.
                Review and expand everything below.
              </p>
            </div>
            {backHref && (
              <Link
                href={backHref}
                className="ml-auto text-xs font-semibold f-body whitespace-nowrap hover:opacity-80"
                style={{ color: 'rgba(10,46,77,0.45)' }}
              >
                ← Back
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ─── Form ────────────────────────────────────────────── */}
      <ExperiencePageForm prefill={prefill} guidePhotos={guidePhotos} />

    </div>
  )
}
