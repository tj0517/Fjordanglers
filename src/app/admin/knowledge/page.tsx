import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { COUNTRIES } from '@/lib/countries'
import { ToggleActiveButton } from './ToggleActiveButton'
import { Plus, BookOpen } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KnowledgeRow {
  id: string
  kind: string
  country: string | null
  guide_id: string | null
  title: string
  active: boolean
  updated_at: string
  updated_by: string | null
  guide_name: string | null
  updater_name: string | null
}

const KIND_ORDER = ['instructions', 'tone', 'destination', 'guide'] as const
const KIND_LABELS: Record<string, string> = {
  instructions: 'Instructions',
  tone:         'Tone of voice',
  destination:  'Destinations',
  guide:        'Guides',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>
}) {
  const { country: filterCountry } = await searchParams
  const supabase = createServiceClient()

  const [{ data: rawRows }, { data: guides }] = await Promise.all([
    supabase
      .from('agent_knowledge')
      .select(`
        id, kind, country, guide_id, title, active, updated_at, updated_by,
        guides:guide_id ( full_name )
      `)
      .order('kind')
      .order('updated_at', { ascending: false }),
    supabase
      .from('guides')
      .select('id, full_name, status')
      .order('full_name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: KnowledgeRow[] = (rawRows ?? []).map((r: any) => ({
    id:           r.id,
    kind:         r.kind,
    country:      r.country,
    guide_id:     r.guide_id,
    title:        r.title,
    active:       r.active,
    updated_at:   r.updated_at,
    updated_by:   r.updated_by,
    guide_name:   r.guides?.full_name ?? null,
    updater_name: null,
  }))

  // Apply country filter
  const filtered = filterCountry != null && filterCountry !== ''
    ? rows.filter(r => r.kind !== 'destination' || r.country === filterCountry)
    : rows

  // Group by kind
  const grouped = KIND_ORDER.map(kind => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    entries: filtered.filter(r => r.kind === kind),
  }))

  // Gaps
  const activeGuideIds = new Set(
    rows.filter(r => r.kind === 'guide' && r.active).map(r => r.guide_id),
  )
  const activeGuides = (guides ?? []).filter(g => g.status === 'active' || g.status === 'verified')
  const guidesWithoutEntry = activeGuides.filter(g => !activeGuideIds.has(g.id))

  const activeDestinationCountries = new Set(
    rows.filter(r => r.kind === 'destination' && r.active).map(r => r.country),
  )
  const countriesWithoutEntry = COUNTRIES.filter(c => !activeDestinationCountries.has(c))

  const hasActiveInstructions = rows.some(r => r.kind === 'instructions' && r.active)

  const hasGaps = guidesWithoutEntry.length > 0 || countriesWithoutEntry.length > 0 || !hasActiveInstructions

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={18} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
            <h1 className="text-[#0A2E4D] text-xl font-bold f-display">Agent Knowledge</h1>
          </div>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            What the agent knows. Changes take effect on the next &ldquo;zaproponuj&rdquo;.
          </p>
        </div>
        <Link
          href="/admin/knowledge/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          <Plus size={14} strokeWidth={2} />
          New entry
        </Link>
      </div>

      {/* Country filter */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Filter by country:
        </span>
        <FilterChip href="/admin/knowledge" active={filterCountry == null || filterCountry === ''} label="All" />
        {COUNTRIES.map(c => (
          <FilterChip key={c} href={`/admin/knowledge?country=${encodeURIComponent(c)}`} active={filterCountry === c} label={c} />
        ))}
      </div>

      {/* Gaps section */}
      {hasGaps && (
        <div
          className="p-5 mb-8 rounded-3xl"
          style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}
        >
          <h2 className="text-sm font-bold f-display mb-4" style={{ color: '#DC2626' }}>Gaps</h2>
          <div className="space-y-2">
            {!hasActiveInstructions && (
              <GapRow
                message="No active instructions entry — the agent has no system prompt."
                href="/admin/knowledge/new?kind=instructions"
              />
            )}
            {guidesWithoutEntry.map(g => (
              <GapRow
                key={g.id}
                message={`${g.full_name} — no active knowledge entry.`}
                href={`/admin/knowledge/new?kind=guide&guide_id=${g.id}`}
              />
            ))}
            {countriesWithoutEntry.map(c => (
              <GapRow
                key={c}
                message={`${c} — no active destination entry.`}
                href={`/admin/knowledge/new?kind=destination&country=${encodeURIComponent(c)}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Knowledge list grouped by kind */}
      <div className="space-y-8">
        {grouped.map(({ kind, label, entries }) => (
          <section key={kind}>
            <h2 className="text-base font-bold f-display mb-4" style={{ color: '#0A2E4D' }}>
              {label}
              <span className="ml-2 text-xs font-normal f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                ({entries.length})
              </span>
            </h2>

            {entries.length === 0 ? (
              <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                No entries.{' '}
                <Link href={`/admin/knowledge/new?kind=${kind}`} style={{ color: '#E67E50' }}>
                  Create one.
                </Link>
              </p>
            ) : (
              <div
                className="rounded-3xl overflow-hidden"
                style={{ border: '1px solid rgba(10,46,77,0.07)' }}
              >
                {entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{
                      background: i % 2 === 0 ? '#FDFAF7' : '#FAF6F0',
                      borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : undefined,
                      opacity: entry.active ? 1 : 0.6,
                    }}
                  >
                    {/* Status dot */}
                    <span
                      className="flex-shrink-0 w-2 h-2 rounded-full"
                      style={{ background: entry.active ? '#16A34A' : 'rgba(10,46,77,0.25)' }}
                      title={entry.active ? 'Active' : 'Inactive'}
                    />

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                        {entry.title}
                      </p>
                      <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {entry.guide_name != null && <span>Guide: {entry.guide_name} · </span>}
                        {entry.country != null && <span>{entry.country} · </span>}
                        {entry.updater_name != null
                          ? `Updated by ${entry.updater_name}`
                          : 'Updated'}
                        {' '}·{' '}
                        {new Date(entry.updated_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/admin/knowledge/${entry.id}/edit`}
                        className="text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all hover:brightness-90"
                        style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                      >
                        Edit
                      </Link>
                      <ToggleActiveButton id={entry.id} active={entry.active} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all no-underline"
      style={{
        background: active ? 'rgba(230,126,80,0.12)' : 'rgba(10,46,77,0.07)',
        color:      active ? '#E67E50' : 'rgba(10,46,77,0.6)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </Link>
  )
}

function GapRow({ message, href }: { message: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm f-body" style={{ color: '#DC2626' }}>
        ✗ {message}
      </p>
      <Link
        href={href}
        className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all hover:brightness-90"
        style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}
      >
        Fix
      </Link>
    </div>
  )
}
