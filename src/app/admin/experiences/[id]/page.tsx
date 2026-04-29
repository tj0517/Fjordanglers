import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ExternalLink, Pencil } from 'lucide-react'

export const metadata = { title: 'Experience Page — Admin' }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: 'rgba(10,46,77,0.55)', bg: 'rgba(10,46,77,0.07)'   },
  active:   { label: 'Active',   color: '#16A34A',             bg: 'rgba(74,222,128,0.1)'  },
  archived: { label: 'Archived', color: '#6B7280',             bg: 'rgba(107,114,128,0.1)' },
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{label}</p>
      <div className="text-sm f-body" style={{ color: '#0A2E4D' }}>{value}</div>
    </div>
  )
}

export default async function AdminExperienceDetailPage({
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

  const st   = STATUS_STYLE[page.status] ?? STATUS_STYLE.draft
  const date = new Date(page.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[900px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/experiences" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Experiences</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>{page.experience_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold f-display text-[#0A2E4D]">{page.experience_name}</h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {page.country}{page.region ? `, ${page.region}` : ''} · Created {date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {page.status === 'active' && (
            <Link href={`/experiences/${page.slug}`} target="_blank"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full f-body"
              style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
              <ExternalLink size={12} strokeWidth={1.5} /> View live
            </Link>
          )}
          <Link href={`/admin/experiences/${page.id}/edit`}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full f-body"
            style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}>
            <Pencil size={12} strokeWidth={1.5} /> Edit
          </Link>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        <div className="rounded-[22px] overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(10,46,77,0.02)' }}>
            <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Page Content</h2>
          </div>
          <div className="px-6 pb-4">
            <Row label="URL" value={<span style={{ color: '#E67E50' }}>/experiences/{page.slug}</span>} />
            <Row label="Price from" value={`€${page.price_from} ${page.currency}`} />
            <Row label="Season" value={page.season_start && page.season_end ? `${page.season_start} – ${page.season_end}` : '—'} />
            <Row label="Best months" value={page.best_months ?? '—'} />
            <Row label="Difficulty" value={page.difficulty ?? '—'} />
            <Row label="Physical effort" value={page.physical_effort ?? '—'} />
            <Row label="Non-angler friendly" value={page.non_angler_friendly ? 'Yes' : 'No'} />
            <Row label="Target species" value={
              (page.target_species as string[] | null)?.length
                ? <div className="flex flex-wrap gap-1 mt-0.5">
                    {(page.target_species as string[]).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full f-body"
                        style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>{s}</span>
                    ))}
                  </div>
                : '—'
            } />
            <Row label="Technique" value={
              (page.technique as string[] | null)?.length
                ? (page.technique as string[]).join(', ')
                : '—'
            } />
            <Row label="Environment" value={
              (page.environment as string[] | null)?.length
                ? (page.environment as string[]).join(', ')
                : '—'
            } />
            {page.story_text && (
              <div className="py-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.38)' }}>Story</p>
                <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.7)' }}>
                  {page.story_text.slice(0, 300)}{page.story_text.length > 300 ? '…' : ''}
                </p>
              </div>
            )}
            <Row label="Includes" value={
              (page.includes as string[] | null)?.length
                ? (page.includes as string[]).join(' · ')
                : '—'
            } />
            <Row label="Excludes" value={
              (page.excludes as string[] | null)?.length
                ? (page.excludes as string[]).join(' · ')
                : '—'
            } />
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[22px] px-5 py-4"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
            <h2 className="text-sm font-bold f-display text-[#0A2E4D] mb-3">Media</h2>
            {page.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.hero_image_url} alt="Hero" className="w-full rounded-xl object-cover" style={{ height: '140px' }} />
            ) : (
              <div className="w-full rounded-xl flex items-center justify-center"
                style={{ height: '100px', background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.28)', fontSize: '12px' }}>
                No hero image
              </div>
            )}
            <p className="text-xs f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {(page.gallery_image_urls as string[] | null)?.length ?? 0} gallery images
            </p>
          </div>

          <div className="rounded-[22px] px-5 py-4"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
            <h2 className="text-sm font-bold f-display text-[#0A2E4D] mb-2">Meeting point</h2>
            <p className="text-sm f-body font-semibold" style={{ color: '#0A2E4D' }}>{page.meeting_point_name ?? '—'}</p>
            {page.meeting_point_description && (
              <p className="text-xs f-body mt-1 leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
                {page.meeting_point_description.slice(0, 120)}…
              </p>
            )}
          </div>

          <div className="rounded-[22px] px-5 py-4"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.09)' }}>
            <p className="text-xs font-bold f-body mb-1" style={{ color: '#0A2E4D' }}>Public URL</p>
            <p className="text-xs f-body break-all" style={{ color: '#E67E50' }}>
              /experiences/{page.slug}
            </p>
            <p className="text-[10px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {page.status === 'active' ? '● Live' : page.status === 'draft' ? '○ Draft (not public)' : '✕ Archived'}
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
