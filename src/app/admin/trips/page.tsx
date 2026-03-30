import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DeleteExperienceButton from '@/components/admin/delete-experience-button'
import { Calendar, CheckCircle, AlertCircle, Euro } from 'lucide-react'

/**
 * /admin/experiences — Platform-wide experience management.
 *
 * Shows all trips across every guide with stats, filter tabs,
 * and per-row actions: view public, edit, delete.
 *
 * Filter: ?filter=live | draft | (none = all)
 */

export const metadata = {
  title: 'Trips — FjordAnglers Admin',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES = {
  beginner:     { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Beginner' },
  intermediate: { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Intermediate' },
  expert:       { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Expert' },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpWithGuide = {
  id: string
  guide_id: string
  title: string
  fish_types: string[]
  price_per_person_eur: number
  duration_hours: number | null
  duration_days: number | null
  difficulty: 'beginner' | 'intermediate' | 'expert' | null
  published: boolean
  location_city: string | null
  location_country: string | null
  created_at: string
  guide: { id: string; full_name: string } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const currentFilter = filter ?? ''

  const supabase = await createClient()

  const { data } = await supabase
    .from('experiences')
    .select(
      'id, guide_id, title, fish_types, price_per_person_eur, duration_hours, duration_days, difficulty, published, location_city, location_country, created_at, guide:guides(id, full_name)',
    )
    .order('created_at', { ascending: false })

  const allExps = (data ?? []) as unknown as ExpWithGuide[]

  // ── Stats (always from full dataset) ───────────────────────────────────────
  const liveCount  = allExps.filter((e) => e.published).length
  const draftCount = allExps.filter((e) => !e.published).length
  const avgPrice   = allExps.length > 0
    ? Math.round(allExps.reduce((s, e) => s + e.price_per_person_eur, 0) / allExps.length)
    : 0
  const maxPrice   = allExps.length > 0
    ? Math.max(...allExps.map((e) => e.price_per_person_eur))
    : 0

  // ── Filtered list ───────────────────────────────────────────────────────────
  const displayed =
    currentFilter === 'live'  ? allExps.filter((e) => e.published) :
    currentFilter === 'draft' ? allExps.filter((e) => !e.published) :
    allExps

  // ── Filter tabs config ──────────────────────────────────────────────────────
  const TABS = [
    { key: '',      label: 'All',   count: allExps.length },
    { key: 'live',  label: 'Live',  count: liveCount },
    { key: 'draft', label: 'Draft', count: draftCount },
  ] as const

  // ── Stat cards config ───────────────────────────────────────────────────────
  const STATS = [
    {
      label: 'Total',
      value: allExps.length.toString(),
      sub: 'all trips',
      accent: '#0A2E4D',
      icon: <Calendar width={18} height={18} />,
    },
    {
      label: 'Live',
      value: liveCount.toString(),
      sub: 'visible to anglers',
      accent: '#16A34A',
      icon: <CheckCircle width={18} height={18} />,
    },
    {
      label: 'Draft',
      value: draftCount.toString(),
      sub: 'not yet published',
      accent: '#D97706',
      icon: <AlertCircle width={18} height={18} />,
    },
    {
      label: 'Avg. price',
      value: `€${avgPrice}`,
      sub: `max €${maxPrice} / person`,
      accent: '#E67E50',
      icon: <Euro width={18} height={18} />,
    },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px]">

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Admin → Trips
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            All <span style={{ fontStyle: 'italic' }}>Trips</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {allExps.length} total
            {' · '}
            <span style={{ color: '#16A34A' }}>{liveCount} live</span>
            {' · '}
            {draftCount} draft
          </p>
        </div>
      </div>

      {/* ─── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="p-6 flex flex-col gap-3"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-[11px] uppercase tracking-[0.18em] f-body"
                style={{ color: 'rgba(10,46,77,0.42)' }}
              >
                {stat.label}
              </p>
              <span style={{ color: stat.accent, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p className="text-[#0A2E4D] text-2xl font-bold leading-none f-display">
              {stat.value}
            </p>
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Filter tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        {TABS.map((tab) => {
          const isActive = currentFilter === tab.key
          return (
            <Link
              key={tab.key}
              href={tab.key !== '' ? `/admin/trips?filter=${tab.key}` : '/admin/trips'}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium f-body transition-all"
              style={
                isActive
                  ? { background: '#0A2E4D', color: 'white' }
                  : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }
              }
            >
              {tab.label}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full f-body leading-none"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.18)', color: 'white' }
                    : { background: 'rgba(10,46,77,0.1)', color: 'rgba(10,46,77,0.45)' }
                }
              >
                {tab.count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        <div className="overflow-x-auto">
        {/* Table header */}
        <div
          className="grid px-6 py-3"
          style={{
            gridTemplateColumns: '2.5fr 1.4fr 1.1fr 0.8fr 0.8fr 0.9fr 1.6fr',
            borderBottom: '1px solid rgba(10,46,77,0.07)',
            background: 'rgba(10,46,77,0.02)',
            minWidth: '900px',
          }}
        >
          {['Trip', 'Guide', 'Location', 'Price', 'Duration', 'Status', 'Actions'].map((col) => (
            <p
              key={col}
              className="text-[10px] uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              {col}
            </p>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="px-6 py-20 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(10,46,77,0.05)' }}
            >
              <Calendar width={24} height={24} stroke="rgba(10,46,77,0.25)" strokeWidth={1.5} />
            </div>
            <p className="text-[#0A2E4D]/30 text-sm f-body">
              No {currentFilter === 'live' ? 'live' : currentFilter === 'draft' ? 'draft' : ''} trips yet.
            </p>
            {currentFilter !== '' && (
              <Link
                href="/admin/trips"
                className="mt-2 text-xs f-body font-medium transition-colors hover:text-[#C96030]"
                style={{ color: '#E67E50' }}
              >
                Clear filter →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '900px' }}>
            {displayed.map((exp) => {
              const duration = exp.duration_hours != null
                ? `${exp.duration_hours}h`
                : `${exp.duration_days ?? '?'} days`

              const diffStyle = exp.difficulty != null
                ? DIFFICULTY_STYLES[exp.difficulty]
                : null

              const location = [exp.location_city, exp.location_country]
                .filter(Boolean)
                .join(', ')

              const topFish = exp.fish_types.slice(0, 2).join(', ')
              const added = new Date(exp.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })

              return (
                <div
                  key={exp.id}
                  className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors"
                  style={{ gridTemplateColumns: '2.5fr 1.4fr 1.1fr 0.8fr 0.8fr 0.9fr 1.6fr' }}
                >
                  {/* Experience */}
                  <div className="min-w-0 pr-4">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate leading-tight">
                      {exp.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {exp.fish_types.slice(0, 2).map((f) => (
                        <span
                          key={f}
                          className="text-[9px] px-1.5 py-0.5 rounded f-body"
                          style={{ background: 'rgba(201,96,48,0.08)', color: '#9E4820' }}
                        >
                          {f}
                        </span>
                      ))}
                      {exp.fish_types.length > 2 && (
                        <span
                          className="text-[9px] f-body"
                          style={{ color: 'rgba(10,46,77,0.35)' }}
                        >
                          +{exp.fish_types.length - 2}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.28)' }}>
                      {added}
                    </p>
                  </div>

                  {/* Guide */}
                  <div className="min-w-0 pr-3">
                    {exp.guide != null ? (
                      <Link
                        href={`/admin/guides/${exp.guide.id}`}
                        className="text-xs font-medium f-body transition-colors hover:text-[#E67E50] truncate block"
                        style={{ color: 'rgba(10,46,77,0.65)' }}
                      >
                        {exp.guide.full_name}
                      </Link>
                    ) : (
                      <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                    )}
                  </div>

                  {/* Location */}
                  <p className="text-xs f-body truncate pr-2" style={{ color: 'rgba(10,46,77,0.55)' }}>
                    {location !== '' ? location : '—'}
                  </p>

                  {/* Price */}
                  <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                    €{exp.price_per_person_eur}
                  </p>

                  {/* Duration */}
                  <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                    {duration}
                  </p>

                  {/* Status + difficulty */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full self-start f-body"
                      style={
                        exp.published
                          ? { background: 'rgba(74,222,128,0.1)', color: '#16A34A' }
                          : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.45)' }
                      }
                    >
                      {exp.published ? 'Live' : 'Draft'}
                    </span>
                    {diffStyle != null && (
                      <span
                        className="text-[9px] font-medium px-2 py-0.5 rounded-full self-start f-body"
                        style={{ background: diffStyle.bg, color: diffStyle.color }}
                      >
                        {diffStyle.label}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* View public */}
                    <Link
                      href={`/trips/${exp.id}`}
                      target="_blank"
                      className="text-[10px] font-medium f-body transition-colors hover:text-[#E67E50]"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                      title="View public page"
                    >
                      View ↗
                    </Link>

                    {/* Edit */}
                    <Link
                      href={`/admin/guides/${exp.guide_id}/trips/${exp.id}/edit`}
                      className="text-[10px] font-medium f-body transition-colors hover:text-[#E67E50]"
                      style={{ color: 'rgba(10,46,77,0.55)' }}
                    >
                      Edit
                    </Link>

                    {/* Delete */}
                    <DeleteExperienceButton
                      experienceId={exp.id}
                      title={exp.title}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>{/* /overflow-x-auto */}
      </div>

      {/* ─── Footer info ────────────────────────────────────────────── */}
      {displayed.length > 0 && (
        <p className="mt-4 text-center text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
          Showing {displayed.length} of {allExps.length} trip{allExps.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
