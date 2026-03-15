import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExperienceForm from '@/components/trips/experience-form'

/**
 * /admin/guides/[id]/trips/new
 *
 * Admin creates an experience for a specific guide.
 * Works for both beta listings (user_id=null) and regular guide accounts.
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: guide } = await supabase.from('guides').select('full_name').eq('id', id).single()
  return { title: guide != null ? `New Trip for ${guide.full_name} — Admin` : 'New Trip' }
}

export default async function AdminNewExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, is_beta_listing, status')
    .eq('id', id)
    .single()

  if (guide == null) notFound()

  return (
    <div className="px-10 py-10 max-w-[840px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/guides" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Guides</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href={`/admin/guides/${guide.id}`} className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>
          {guide.full_name}
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>New Trip</span>
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(230,126,80,0.12)', border: '1px solid rgba(230,126,80,0.2)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#E67E50" strokeWidth="1.6">
              <path d="M2 13C2 9.5 4.5 7 8 7s6 2.5 6 6" />
              <circle cx="8" cy="4" r="2.5" />
              <line x1="11.5" y1="1" x2="11.5" y2="5.5" />
              <line x1="9.5" y1="3" x2="13.5" y2="3" />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] f-body font-semibold" style={{ color: '#E67E50' }}>
            Admin · Creating for guide
          </p>
        </div>

        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          New trip for{' '}
          <span style={{ fontStyle: 'italic' }}>{guide.full_name}</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '560px' }}>
          {guide.is_beta_listing
            ? 'This guide is a beta listing — creating trips on their behalf will make them visible to anglers immediately.'
            : 'Trip will be associated with this guide and visible based on its publish setting.'
          }
        </p>

        {/* Info pills */}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          {[
            { icon: '🎣', text: guide.country },
            { icon: guide.is_beta_listing ? '🔶' : '✓', text: guide.is_beta_listing ? 'Beta listing' : 'Verified guide' },
          ].map(pill => (
            <span
              key={pill.text}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              <span>{pill.icon}</span>
              {pill.text}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────────── */}
      <ExperienceForm
        guideId={guide.id}
        mode="create"
        guideName={guide.full_name}
        context="admin"
        successPath={`/admin/guides/${guide.id}`}
      />

    </div>
  )
}
