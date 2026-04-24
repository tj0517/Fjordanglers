import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react'
import StartBuildingButton from './StartBuildingButton'

/**
 * /admin/submissions/[id] — FA detail view of a single guide submission.
 *
 * Shows all guide-provided info. FA can:
 *  A. "Create experience page →" — opens ExperiencePageForm pre-filled from this submission
 *  B. "Start building →" (legacy) — opens full ExperienceForm in admin context
 */

export const metadata = {
  title: 'Submission Detail — Admin',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonths(months: number[] | null): string {
  if (!months || months.length === 0) return '—'
  return months.map(m => MONTH_ABBR[m - 1] ?? m).join(', ')
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  submitted:   { label: 'Awaiting review', color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
  in_progress: { label: 'In progress',     color: '#2563EB', bg: 'rgba(37,99,235,0.1)'  },
  published:   { label: 'Published',       color: '#16A34A', bg: 'rgba(74,222,128,0.1)' },
  rejected:    { label: 'Rejected',        color: '#DC2626', bg: 'rgba(239,68,68,0.1)'  },
}

const TRIP_TYPE_LABEL: Record<string, string> = {
  half_day:  'Half day',
  full_day:  'Full day',
  multi_day: 'Multi-day',
}

const INCLUDES_LABEL: Record<string, string> = {
  guide_service: 'Guide service',
  boat:          'Boat',
  equipment:     'Fishing equipment',
  license:       'Fishing license',
  accommodation: 'Accommodation',
  meals:         'Meals / catering',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
        {label}
      </p>
      <div className="text-sm f-body font-medium" style={{ color: '#0A2E4D' }}>{value}</div>
    </div>
  )
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map(item => (
        <span
          key={item}
          className="text-xs px-2.5 py-1 rounded-full f-body font-semibold"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const svc = createServiceClient()

  const { data: sub } = await svc
    .from('guide_submissions')
    .select('*')
    .eq('id', id)
    .single()

  if (sub == null) notFound()

  // Fetch guide info
  const { data: guide } = await svc
    .from('guides')
    .select('id, full_name, invite_email, country')
    .eq('id', sub.guide_id)
    .single()

  const st = STATUS_STYLE[sub.status] ?? STATUS_STYLE.submitted
  const submittedDate = new Date(sub.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[900px]">

      {/* ─── Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link
          href="/admin/submissions"
          className="flex items-center gap-1.5 text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          Submissions
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>
          {sub.location_name}
        </span>
      </div>

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
              {sub.location_name}
            </h1>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body flex-shrink-0"
              style={{ background: st.bg, color: st.color }}
            >
              {st.label}
            </span>
          </div>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {sub.country}{sub.region ? `, ${sub.region}` : ''} · Submitted {submittedDate}
          </p>
        </div>

        {/* CTAs — only for submitted or in_progress */}
        {(sub.status === 'submitted' || sub.status === 'in_progress') && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/experiences/new?submission_id=${sub.id}`}
              className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-full f-body transition-all hover:brightness-110"
              style={{ background: '#E67E50', color: '#fff', boxShadow: '0 4px 14px rgba(230,126,80,0.35)' }}
            >
              <Sparkles size={13} strokeWidth={1.5} />
              Create experience page →
            </Link>
            <StartBuildingButton
              submissionId={sub.id}
              guideId={sub.guide_id}
              status={sub.status}
            />
          </div>
        )}

        {/* If published, show link to experience */}
        {sub.status === 'published' && sub.experience_id != null && (
          <Link
            href={`/trips/${sub.experience_id}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl f-body transition-all hover:brightness-105"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#16A34A', border: '1px solid rgba(74,222,128,0.3)' }}
          >
            <ExternalLink size={13} strokeWidth={1.5} />
            View experience
          </Link>
        )}
      </div>

      {/* ─── Two-column layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* Left — submission details */}
        <div
          className="rounded-[22px] overflow-hidden"
          style={{
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.07)',
            boxShadow: '0 2px 14px rgba(10,46,77,0.05)',
          }}
        >
          {/* Section header */}
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(10,46,77,0.02)' }}
          >
            <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Submission Info</h2>
          </div>

          <div className="px-6 pb-2">
            <InfoRow label="Location" value={
              <>
                {sub.location_name}
                {sub.region ? <span style={{ color: 'rgba(10,46,77,0.45)' }}>, {sub.region}</span> : ''}
                <span style={{ color: 'rgba(10,46,77,0.45)' }}>, {sub.country}</span>
              </>
            } />
            <InfoRow label="Target species" value={<ChipList items={sub.species} />} />
            <InfoRow label="Fishing methods" value={<ChipList items={sub.fishing_methods ?? []} />} />
            <InfoRow label="Best season" value={fmtMonths(sub.season_months)} />
            <InfoRow label="Trip types" value={
              sub.trip_types && sub.trip_types.length > 0
                ? <ChipList items={sub.trip_types.map(t => TRIP_TYPE_LABEL[t] ?? t)} />
                : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
            } />
            <InfoRow label="Max group size" value={sub.max_anglers != null ? `${sub.max_anglers} anglers` : '—'} />
            <InfoRow label="Approx. price" value={
              sub.price_approx_eur != null
                ? `≈ €${sub.price_approx_eur} per person / day`
                : <span style={{ color: 'rgba(10,46,77,0.3)' }}>Not specified</span>
            } />
            <InfoRow label="What's included" value={
              sub.includes && sub.includes.length > 0
                ? <ChipList items={sub.includes.map(v => INCLUDES_LABEL[v] ?? v)} />
                : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
            } />
            {sub.includes_notes && (
              <InfoRow label="Includes notes" value={
                <span style={{ color: 'rgba(10,46,77,0.7)' }}>{sub.includes_notes}</span>
              } />
            )}
          </div>

          {/* Personal note — full width if present */}
          {sub.personal_note && (
            <div className="px-6 pb-6 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
                About the guide / spot
              </p>
              <div
                className="px-4 py-4 rounded-xl text-sm f-body leading-relaxed"
                style={{
                  background: 'rgba(230,126,80,0.04)',
                  border: '1px solid rgba(230,126,80,0.15)',
                  color: 'rgba(10,46,77,0.75)',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{sub.personal_note}&rdquo;
              </div>
            </div>
          )}
        </div>

        {/* Right — guide info + actions */}
        <div className="flex flex-col gap-4">

          {/* Guide card */}
          <div
            className="rounded-[22px] overflow-hidden"
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 14px rgba(10,46,77,0.05)',
            }}
          >
            <div
              className="px-5 py-4"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(10,46,77,0.02)' }}
            >
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Guide</h2>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Name</p>
                <p className="text-sm font-semibold f-body text-[#0A2E4D]">{guide?.full_name ?? 'Unknown'}</p>
              </div>
              {guide?.invite_email && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Email</p>
                  <a
                    href={`mailto:${guide.invite_email}`}
                    className="text-sm f-body underline underline-offset-2"
                    style={{ color: '#E67E50' }}
                  >
                    {guide.invite_email}
                  </a>
                </div>
              )}
              {guide?.country && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Country</p>
                  <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>{guide.country}</p>
                </div>
              )}
              {guide?.id && (
                <Link
                  href={`/admin/guides/${guide.id}`}
                  className="text-xs font-semibold f-body mt-1 hover:opacity-80 transition-opacity"
                  style={{ color: 'rgba(10,46,77,0.45)' }}
                >
                  View guide profile →
                </Link>
              )}
            </div>
          </div>

          {/* FA notes placeholder */}
          {sub.fa_notes && (
            <div
              className="rounded-[22px] px-5 py-4"
              style={{
                background: '#FDFAF7',
                border: '1px solid rgba(10,46,77,0.07)',
                boxShadow: '0 2px 14px rgba(10,46,77,0.05)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
                FA Notes
              </p>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.7)' }}>
                {sub.fa_notes}
              </p>
            </div>
          )}

          {/* Build action card */}
          {(sub.status === 'submitted' || sub.status === 'in_progress') && (
            <div
              className="rounded-[22px] px-5 py-5"
              style={{
                background: 'rgba(230,126,80,0.05)',
                border: '1px solid rgba(230,126,80,0.18)',
              }}
            >
              <p className="text-xs font-bold f-body mb-1" style={{ color: '#0A2E4D' }}>Ready to build?</p>
              <p className="text-xs f-body leading-relaxed mb-3" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Create the public experience page pre-filled with this submission&apos;s data.
              </p>
              <Link
                href={`/admin/experiences/new?submission_id=${sub.id}`}
                className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl text-sm font-bold f-body transition-all hover:brightness-105"
                style={{ background: '#E67E50', color: '#fff' }}
              >
                <Sparkles size={13} strokeWidth={1.5} />
                Create experience page
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
