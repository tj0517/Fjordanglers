import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { Plus, ExternalLink } from 'lucide-react'
import { GenerateDraftsButton } from './GenerateDraftsButton'
import { PublishAllDraftsButton } from './PublishAllDraftsButton'

export const metadata = {
  title: 'Experience Pages — Admin',
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: 'rgba(10,46,77,0.45)', bg: 'rgba(10,46,77,0.07)'   },
  active:   { label: 'Active',   color: '#16A34A',             bg: 'rgba(74,222,128,0.1)'  },
  archived: { label: 'Archived', color: '#6B7280',             bg: 'rgba(107,114,128,0.1)' },
}

export default async function AdminExperiencesPage() {
  const svc = createServiceClient()

  const { data: pages } = await svc
    .from('experience_pages')
    .select('id, experience_name, slug, country, region, status, price_from, target_species, created_at')
    .order('created_at', { ascending: false })

  const rows = pages ?? []

  const counts = {
    active:   rows.filter(r => r.status === 'active').length,
    draft:    rows.filter(r => r.status === 'draft').length,
    archived: rows.filter(r => r.status === 'archived').length,
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Admin
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Experience <span style={{ fontStyle: 'italic' }}>Pages</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            FA-curated editorial pages — the polished public trip listings.
          </p>
        </div>
        <div className="flex items-start gap-3 flex-shrink-0">
          <PublishAllDraftsButton draftCount={counts.draft} />
          <GenerateDraftsButton />
          <Link
            href="/admin/experiences/new"
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-all hover:brightness-110 f-body flex-shrink-0"
            style={{ background: '#E67E50' }}
          >
            <Plus size={13} strokeWidth={2} />
            New Page
          </Link>
        </div>
      </div>

      {/* ─── Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {([
          { label: 'Active',   value: counts.active,   color: '#16A34A' },
          { label: 'Draft',    value: counts.draft,    color: 'rgba(10,46,77,0.5)' },
          { label: 'Archived', value: counts.archived, color: '#6B7280' },
        ] as const).map(s => (
          <div key={s.label} className="px-5 py-4 rounded-[18px]"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>{s.label}</p>
            <p className="text-3xl font-bold f-display" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── List ────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[24px] text-center"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.12)' }}>
          <p className="text-[#0A2E4D]/45 text-sm f-body mb-4">No experience pages yet.</p>
          <Link href="/admin/experiences/new"
            className="text-white text-sm font-semibold px-6 py-3 rounded-full f-body"
            style={{ background: '#E67E50' }}>
            Create first experience →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.draft
            const date = new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <div key={row.id}
                className="flex items-center gap-4 px-6 py-4 rounded-[20px]"
                style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.04)' }}>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-bold f-body text-[#0A2E4D] truncate">{row.experience_name}</p>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {row.country}{row.region ? `, ${row.region}` : ''}
                    {(row.target_species as string[] | null)?.length
                      ? ` · ${(row.target_species as string[]).slice(0, 3).join(', ')}`
                      : ''}
                    {' · '}/experiences/{row.slug}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-sm font-bold f-body" style={{ color: '#0A2E4D' }}>from €{row.price_from}</p>
                  <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{date}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {row.status === 'active' && (
                    <Link href={`/experiences/${row.slug}`} target="_blank"
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full f-body transition-all hover:bg-[#F3EDE4]"
                      style={{ color: 'rgba(10,46,77,0.5)' }}>
                      <ExternalLink size={11} strokeWidth={1.3} /> View
                    </Link>
                  )}
                  <Link href={`/admin/experiences/${row.id}`}
                    className="text-xs font-semibold px-4 py-1.5 rounded-full f-body transition-all hover:brightness-105"
                    style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}>
                    Edit →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
