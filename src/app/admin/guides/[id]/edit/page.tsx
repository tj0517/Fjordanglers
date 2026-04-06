import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import EditGuideForm from '@/components/admin/edit-guide-form'

/**
 * /admin/guides/[id]/edit — Edit any guide profile.
 *
 * Fetches full guide data → pre-fills EditGuideForm.
 * Admin-only; layout.tsx handles role guard.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guides')
    .select('full_name')
    .eq('id', id)
    .single()
  return {
    title: data != null ? `Edit: ${data.full_name} — Admin` : 'Edit Guide',
  }
}

export default async function AdminEditGuidePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: guide }, { data: guideImages }] = await Promise.all([
    supabase
      .from('guides')
      .select(
        'id, full_name, country, city, bio, languages, fish_expertise, years_experience, avatar_url, cover_url, instagram_url, youtube_url, pricing_model, status, is_beta_listing, invite_email',
      )
      .eq('id', id)
      .single(),
    supabase
      .from('guide_images')
      .select('url, is_cover, sort_order')
      .eq('guide_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (guide == null) notFound()

  const guideWithImages = {
    ...guide,
    images: (guideImages ?? []) as { url: string; is_cover: boolean; sort_order: number }[],
  }

  return (
    <div className="px-10 py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link
          href="/admin"
          className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Admin
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link
          href="/admin/guides"
          className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Guides
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link
          href={`/admin/guides/${guide.id}`}
          className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          {guide.full_name}
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>
          Edit
        </span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {guide.is_beta_listing && (
            <span
              className="text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full f-body"
              style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
            >
              Beta listing
            </span>
          )}
        </div>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-1">
          Edit <span style={{ fontStyle: 'italic' }}>{guide.full_name}</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body">
          Changes are saved immediately on submit.
        </p>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────── */}
      <EditGuideForm guide={guideWithImages} />
    </div>
  )
}
