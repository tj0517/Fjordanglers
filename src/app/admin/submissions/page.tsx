import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { ClipboardList, ArrowRight } from 'lucide-react'

/**
 * /admin/submissions — FA admin view of all guide trip submissions.
 *
 * Guides fill GuideSubmissionForm → creates guide_submissions row.
 * FA reviews here and clicks "Start building →" to open the full ExperienceForm.
 */

export const metadata = {
  title: 'Trip Submissions — Admin',
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  submitted:   { label: 'Awaiting review', color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
  in_progress: { label: 'In progress',     color: '#2563EB', bg: 'rgba(37,99,235,0.1)'  },
  published:   { label: 'Published',       color: '#16A34A', bg: 'rgba(74,222,128,0.1)' },
  rejected:    { label: 'Rejected',        color: '#DC2626', bg: 'rgba(239,68,68,0.1)'  },
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonths(months: number[] | null): string {
  if (!months || months.length === 0) return '—'
  return months.map(m => MONTH_ABBR[m - 1] ?? m).join(', ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SubmissionsPage() {
  const svc = createServiceClient()

  const { data: rows } = await svc
    .from('guide_submissions')
    .select('id, guide_id, location_name, country, region, species, season_months, price_approx_eur, max_anglers, status, created_at')
    .order('created_at', { ascending: false })

  const submissions = rows ?? []

  // Fetch guide names for all submissions
  const guideIds = [...new Set(submissions.map(s => s.guide_id))]
  const { data: guideRows } = guideIds.length > 0
    ? await svc.from('guides').select('id, full_name').in('id', guideIds)
    : { data: [] }
  const guideNameMap: Record<string, string> = {}
  ;(guideRows ?? []).forEach(g => { guideNameMap[g.id] = g.full_name })

  // Count by status
  const counts = {
    submitted:   submissions.filter(s => s.status === 'submitted').length,
    in_progress: submissions.filter(s => s.status === 'in_progress').length,
    published:   submissions.filter(s => s.status === 'published').length,
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Admin
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          Trip <span style={{ fontStyle: 'italic' }}>Submissions</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Guides submit info here — review and start building their experience page.
        </p>
      </div>

      {/* ─── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Awaiting review', value: counts.submitted,   color: '#D97706' },
          { label: 'In progress',     value: counts.in_progress, color: '#2563EB' },
          { label: 'Published',       value: counts.published,   color: '#16A34A' },
        ].map(s => (
          <div
            key={s.label}
            className="px-5 py-4 rounded-[18px]"
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {s.label}
            </p>
            <p className="text-3xl font-bold f-display" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Submissions list ────────────────────────────────── */}
      {submissions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center rounded-[24px]"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.12)' }}
        >
          <ClipboardList size={32} strokeWidth={1.3} style={{ color: 'rgba(10,46,77,0.2)', marginBottom: '12px' }} />
          <p className="text-[#0A2E4D]/45 text-sm f-body">No submissions yet.</p>
          <p className="text-[#0A2E4D]/28 text-xs mt-1 f-body">Guides submit their trip info via the dashboard.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map(sub => {
            const st = STATUS_STYLE[sub.status] ?? STATUS_STYLE.submitted
            const guideName = guideNameMap[sub.guide_id] ?? 'Unknown guide'
            const date = new Date(sub.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })

            return (
              <Link
                key={sub.id}
                href={`/admin/submissions/${sub.id}`}
                className="group flex items-center gap-5 px-6 py-5 rounded-[20px] transition-all hover:shadow-lg"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 2px 10px rgba(10,46,77,0.04)',
                }}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  <ClipboardList size={16} strokeWidth={1.5} style={{ color: '#0A2E4D' }} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-bold f-body text-[#0A2E4D] truncate">
                      {sub.location_name}
                      {sub.region ? `, ${sub.region}` : ''}
                    </p>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {sub.country}
                    {sub.species.length > 0 && <> · {sub.species.slice(0, 3).join(', ')}{sub.species.length > 3 ? ` +${sub.species.length - 3}` : ''}</>}
                    {sub.season_months && sub.season_months.length > 0 && <> · {fmtMonths(sub.season_months)}</>}
                  </p>
                </div>

                {/* Guide + price + date */}
                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>{guideName}</p>
                  <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    {sub.price_approx_eur != null ? `≈ €${sub.price_approx_eur}/pp` : 'Price TBD'}
                    {' · '}{sub.max_anglers != null ? `${sub.max_anglers} max` : ''}
                  </p>
                  <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>{date}</p>
                </div>

                <ArrowRight
                  size={14}
                  strokeWidth={1.5}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                  style={{ color: '#0A2E4D' }}
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
