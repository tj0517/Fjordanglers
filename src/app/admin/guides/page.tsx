import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import LinkGuideButton from '@/components/admin/link-guide-button'
import { CountryFlag } from '@/components/ui/country-flag'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Active' },
  pending:   { bg: 'rgba(217,119,6,0.1)',    color: '#D97706', label: 'Pending' },
  verified:  { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A', label: 'Verified' },
  suspended: { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626', label: 'Suspended' },
} as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminGuidesPage() {
  const supabase = await createClient()

  const [{ data: guides }, { data: expCounts }] = await Promise.all([
    supabase
      .from('guides')
      .select('id, full_name, country, city, status, is_beta_listing, user_id, invite_email, avatar_url, fish_expertise, created_at, verified_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('experiences')
      .select('guide_id')
      .eq('published', true),
  ])

  const allGuides = guides ?? []

  const listingCountByGuide = (expCounts ?? []).reduce<Record<string, number>>((acc, { guide_id }) => {
    acc[guide_id] = (acc[guide_id] ?? 0) + 1
    return acc
  }, {})
  const betaCount  = allGuides.filter(g => g.is_beta_listing).length
  const activeCount = allGuides.filter(g => g.status === 'active').length

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Admin → Guides
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            All <span style={{ fontStyle: 'italic' }}>Guides</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {allGuides.length} total · {activeCount} active · {betaCount} admin-created
          </p>
        </div>

        <Link
          href="/admin/guides/new"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
            <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
          </svg>
          Add Guide Profile
        </Link>
      </div>

      {/* ─── Table ────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          className="grid px-6 py-3"
          style={{
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
            borderBottom: '1px solid rgba(10,46,77,0.07)',
            background: 'rgba(10,46,77,0.02)',
          }}
        >
          {['Guide', 'Location', 'Specialty', 'Listings', 'Status', 'Added'].map(col => (
            <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {col}
            </p>
          ))}
        </div>

        {allGuides.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <p className="text-[#0A2E4D]/30 text-sm f-body">No guides yet.</p>
            <Link
              href="/admin/guides/new"
              className="mt-4 text-xs font-semibold f-body"
              style={{ color: '#E67E50' }}
            >
              Add your first guide profile →
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {allGuides.map((guide) => {
              const status = guide.status as keyof typeof STATUS_STYLES
              const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
              const topFish = guide.fish_expertise.slice(0, 2).join(', ')
              const added = new Date(guide.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })

              return (
                <div
                  key={guide.id}
                  className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}
                >
                  {/* Guide */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                      style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}
                    >
                      {guide.avatar_url != null ? (
                        <Image
                          src={guide.avatar_url}
                          alt={guide.full_name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-sm font-bold f-display"
                          style={{ background: '#0A2E4D' }}
                        >
                          {guide.full_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{guide.full_name}</p>
                        {guide.is_beta_listing && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full flex-shrink-0 f-body"
                            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
                          >
                            Beta
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/admin/guides/${guide.id}`}
                          className="text-[11px] f-body font-medium hover:text-[#E67E50] transition-colors"
                          style={{ color: 'rgba(10,46,77,0.55)' }}
                        >
                          Manage →
                        </Link>
                        <Link
                          href={`/admin/guides/${guide.id}/edit`}
                          className="text-[11px] f-body font-medium hover:text-[#E67E50] transition-colors"
                          style={{ color: 'rgba(10,46,77,0.45)' }}
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/guides/${guide.id}`}
                          target="_blank"
                          className="text-[11px] f-body hover:text-[#E67E50] transition-colors"
                          style={{ color: 'rgba(10,46,77,0.38)' }}
                        >
                          Public ↗
                        </Link>
                        {/* Quick-link button — only for unlinked beta listings with invite email */}
                        {guide.user_id == null && guide.invite_email != null && (
                          <LinkGuideButton guideId={guide.id} inviteEmail={guide.invite_email} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <p className="text-[#0A2E4D]/65 text-sm f-body">
                    <CountryFlag country={guide.country} /> {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
                  </p>

                  {/* Specialty */}
                  <p className="text-[#0A2E4D]/55 text-xs f-body truncate">
                    {topFish !== '' ? topFish : '—'}
                    {guide.fish_expertise.length > 2 && ` +${guide.fish_expertise.length - 2}`}
                  </p>

                  {/* Listings */}
                  <p className="text-[#0A2E4D]/65 text-sm f-body font-medium">
                    {listingCountByGuide[guide.id] ?? 0}
                  </p>

                  {/* Status */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full self-start f-body"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>

                  {/* Added */}
                  <p className="text-[#0A2E4D]/38 text-xs f-body">{added}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
