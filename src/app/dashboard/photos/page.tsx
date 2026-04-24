import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import GuidePhotosManager from '@/components/dashboard/GuidePhotosManager'
import type { GalleryImage } from '@/components/admin/multi-image-upload'

/**
 * /dashboard/photos — Guide's personal photo gallery management.
 *
 * Guides upload their best fishing photos here.
 * FjordAnglers uses these photos when building the guide's experience pages —
 * the admin ExperiencePageForm shows a "From gallery" picker that pulls from here.
 */

export const metadata = {
  title: 'Photos — Guide Dashboard',
}

export default async function GuidePhotosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user == null) redirect('/login')

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // Fetch existing photos ordered by position
  const { data: rows } = await svc
    .from('guide_photos')
    .select('url, is_cover, sort_order')
    .eq('guide_id', guide.id)
    .order('sort_order', { ascending: true })

  const initialPhotos: GalleryImage[] = (rows ?? []).map((p, i) => ({
    url:        p.url,
    is_cover:   p.is_cover,
    sort_order: i,
  }))

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[860px]">

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="mb-8">
        <p
          className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-1">
          Your <span style={{ fontStyle: 'italic' }}>Photos</span>
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
          Upload your best fishing photos. FjordAnglers uses these when building your experience pages.
        </p>
      </div>

      {/* ─── Photo manager card ──────────────────────────────── */}
      <div
        className="rounded-[24px] p-6 lg:p-8"
        style={{
          background:  '#FDFAF7',
          border:      '1px solid rgba(10,46,77,0.07)',
          boxShadow:   '0 2px 14px rgba(10,46,77,0.05)',
        }}
      >
        <GuidePhotosManager initialPhotos={initialPhotos} guideId={guide.id} />
      </div>

      {/* ─── Tips ────────────────────────────────────────────── */}
      <div
        className="mt-6 rounded-[20px] px-5 py-4"
        style={{ background: 'rgba(230,126,80,0.04)', border: '1px solid rgba(230,126,80,0.12)' }}
      >
        <p className="text-xs font-bold f-body mb-2" style={{ color: '#0A2E4D' }}>
          Photo tips
        </p>
        <ul className="space-y-1 text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
          <li>• Landscape shots showing the water and surroundings perform best</li>
          <li>• Action shots — casting, netting, or holding a catch — tell the story</li>
          <li>• Aim for at least 5 photos for FA to have good selection</li>
          <li>• High resolution (3 MB+) preferred — we serve optimised versions</li>
        </ul>
      </div>

    </div>
  )
}
