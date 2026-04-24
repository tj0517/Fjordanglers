import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ExperiencePageForm, { type ExperiencePageFormInitialData } from '@/components/admin/ExperiencePageForm'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()
  const { data } = await svc.from('experience_pages').select('experience_name').eq('id', id).single()
  return { title: data ? `Edit: ${data.experience_name} — Admin` : 'Edit Experience — Admin' }
}

export default async function AdminExperienceEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const svc = createServiceClient()

  const { data: page } = await svc
    .from('experience_pages')
    .select('*')
    .eq('id', id)
    .single()

  if (page == null) notFound()

  // Fetch guide photos if a guide is linked
  let guidePhotos: string[] = []
  if (page.guide_id) {
    const { data: photos } = await svc
      .from('guide_photos')
      .select('url')
      .eq('guide_id', page.guide_id)
      .order('sort_order', { ascending: true })
    guidePhotos = (photos ?? []).map(p => p.url).filter(Boolean)
  }

  const initialData: ExperiencePageFormInitialData = {
    experience_name:           page.experience_name,
    slug:                      page.slug,
    country:                   page.country,
    region:                    page.region,
    price_from:                Number(page.price_from),
    season_start:              page.season_start ?? null,
    season_end:                page.season_end ?? null,
    status:                    (page.status as 'draft' | 'active' | 'archived') ?? 'draft',
    difficulty:                page.difficulty ?? null,
    physical_effort:           page.physical_effort ?? null,
    non_angler_friendly:       page.non_angler_friendly ?? false,
    technique:                 (page.technique as string[] | null) ?? [],
    target_species:            (page.target_species as string[] | null) ?? [],
    environment:               (page.environment as string[] | null) ?? [],
    hero_image_url:            page.hero_image_url ?? null,
    gallery_image_urls:        (page.gallery_image_urls as string[] | null) ?? [],
    story_text:                page.story_text ?? null,
    catches_text:              page.catches_text ?? null,
    rod_setup:                 page.rod_setup ?? null,
    best_months:               page.best_months ?? null,
    season_months:             (page.season_months as number[] | null) ?? [],
    peak_months:               (page.peak_months as number[] | null) ?? [],
    meeting_point_name:        page.meeting_point_name ?? null,
    meeting_point_description: page.meeting_point_description ?? null,
    includes:                  (page.includes as string[] | null) ?? [],
    excludes:                  (page.excludes as string[] | null) ?? [],
    meta_title:                page.meta_title ?? null,
    meta_description:          page.meta_description ?? null,
    og_image_url:              page.og_image_url ?? null,
    location_lat:              page.location_lat ?? null,
    location_lng:              page.location_lng ?? null,
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[900px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/experiences" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Experiences</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href={`/admin/experiences/${id}`} className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {page.experience_name}
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>Edit</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold f-display text-[#0A2E4D] mb-1">Edit experience page</h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Changes are saved immediately. Public page updates at{' '}
          <span style={{ color: '#E67E50' }}>/experiences/{page.slug}</span>
        </p>
      </div>

      <ExperiencePageForm
        mode="edit"
        experienceId={id}
        initialData={initialData}
        guidePhotos={guidePhotos}
      />
    </div>
  )
}
