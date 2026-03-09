import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ExperienceImage = Pick<
  Database['public']['Tables']['experience_images']['Row'],
  'id' | 'url' | 'is_cover' | 'sort_order'
>

type ExperienceRow = Database['public']['Tables']['experiences']['Row'] & {
  images: ExperienceImage[]
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner:     'All Levels',
  intermediate: 'Intermediate',
  expert:       'Expert',
}

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(74,222,128,0.1)',   color: '#16A34A' },
  intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
  expert:       { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function ExperiencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (user == null) {
    return (
      <div className="px-10 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">My Experiences</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          Please{' '}
          <Link href="/auth/login" className="text-[#E67E50] underline underline-offset-2">sign in</Link>
          {' '}to manage your experiences.
        </p>
      </div>
    )
  }

  // ── Guide lookup ────────────────────────────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) {
    return (
      <div className="px-10 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Guide Dashboard
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">My Experiences</h1>
        <p className="text-[#0A2E4D]/55 f-body text-sm">
          No guide profile found.{' '}
          <Link href="/guides/apply" className="text-[#E67E50] underline underline-offset-2">Apply to become a guide →</Link>
        </p>
      </div>
    )
  }

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  // 1) Guide's experiences with their images
  // 2) All confirmed/completed bookings for this guide (to compute counts + revenue)
  const [{ data: expRows }, { data: bookingRows }] = await Promise.all([
    supabase
      .from('experiences')
      .select('*, images:experience_images(id, url, is_cover, sort_order)')
      .eq('guide_id', guide.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('experience_id, guide_payout_eur')
      .eq('guide_id', guide.id)
      .in('status', ['confirmed', 'completed']),
  ])

  const experiences = (expRows ?? []) as ExperienceRow[]

  // Build per-experience booking count map and aggregate revenue
  const bookingCountPerExp: Record<string, number> = {}
  let totalRevenue = 0
  bookingRows?.forEach(b => {
    bookingCountPerExp[b.experience_id] = (bookingCountPerExp[b.experience_id] ?? 0) + 1
    totalRevenue += b.guide_payout_eur
  })

  const totalBookings = bookingRows?.length ?? 0
  const avgPrice =
    experiences.length > 0
      ? Math.round(
          experiences.reduce((sum, e) => sum + e.price_per_person_eur, 0) / experiences.length
        )
      : 0

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Guide Dashboard
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">My Experiences</h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Manage your listed fishing experiences.
          </p>
        </div>

        <Link
          href="/dashboard/experiences/new"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
          style={{ background: '#E67E50' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
            <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
          </svg>
          New Experience
        </Link>
      </div>

      {/* ─── Stats mini row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {([
          {
            label: 'Total listed',
            value: experiences.length,
            sub: 'all experiences',
          },
          {
            label: 'Avg price / person',
            value: experiences.length > 0 ? `€${avgPrice}` : '—',
            sub: 'across all trips',
          },
          {
            label: 'All-time bookings',
            value: totalBookings,
            sub: `€${Math.round(totalRevenue).toLocaleString()} earned`,
          },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="px-6 py-5"
            style={{
              background: '#FDFAF7',
              borderRadius: '20px',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
              {s.label}
            </p>
            <p className="text-[#0A2E4D] text-2xl font-bold f-display">{s.value}</p>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Experience cards ────────────────────────────────────── */}
      {experiences.length > 0 ? (
        <div className="flex flex-col gap-4">
          {experiences.map((exp) => {
            // Sort images by sort_order, prefer is_cover as cover photo
            const sorted = [...exp.images].sort((a, b) => a.sort_order - b.sort_order)
            const cover = sorted.find(i => i.is_cover)?.url ?? sorted[0]?.url ?? null
            const duration =
              exp.duration_hours != null
                ? `${exp.duration_hours}h`
                : `${exp.duration_days ?? '?'} days`
            const diffStyle =
              exp.difficulty != null
                ? (DIFFICULTY_COLOR[exp.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' })
                : null
            const bookings = bookingCountPerExp[exp.id] ?? 0

            return (
              <div
                key={exp.id}
                style={{
                  background: '#FDFAF7',
                  borderRadius: '24px',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                  overflow: 'hidden',
                }}
              >
                <div className="flex items-stretch">

                  {/* Cover image */}
                  <div className="relative w-56 flex-shrink-0">
                    {cover != null ? (
                      <Image
                        src={cover}
                        alt={exp.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                    )}
                    {/* Published badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full f-body"
                        style={{
                          background: exp.published ? 'rgba(74,222,128,0.85)' : 'rgba(0,0,0,0.55)',
                          color: exp.published ? '#fff' : 'rgba(255,255,255,0.75)',
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        {exp.published ? '● Live' : '○ Draft'}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-7 py-6 flex flex-col justify-between min-w-0">
                    <div>
                      {/* Tags */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {exp.location_country != null && (
                          <span
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                          >
                            {exp.location_country}
                          </span>
                        )}
                        {exp.fish_types.slice(0, 2).map(fish => (
                          <span
                            key={fish}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                          >
                            {fish}
                          </span>
                        ))}
                        {diffStyle != null && exp.difficulty != null && (
                          <span
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                            style={{ background: diffStyle.bg, color: diffStyle.color }}
                          >
                            {DIFFICULTY_LABEL[exp.difficulty]}
                          </span>
                        )}
                      </div>

                      <h3 className="text-[#0A2E4D] font-bold text-lg leading-snug mb-1 f-display">
                        {exp.title}
                      </h3>
                      <p className="text-[#0A2E4D]/45 text-sm leading-relaxed line-clamp-2 f-body">
                        {exp.description}
                      </p>
                    </div>

                    {/* Bottom row */}
                    <div
                      className="flex items-center justify-between mt-5 pt-4"
                      style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
                    >
                      {/* Metrics */}
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[#0A2E4D] text-lg font-bold f-display">
                            €{exp.price_per_person_eur}
                            <span className="text-sm font-normal text-[#0A2E4D]/40 f-body">/pp</span>
                          </p>
                        </div>
                        <div className="w-px h-7" style={{ background: 'rgba(10,46,77,0.09)' }} />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.15em] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            Duration
                          </p>
                          <p className="text-[#0A2E4D] text-sm font-semibold f-body">{duration}</p>
                        </div>
                        <div className="w-px h-7" style={{ background: 'rgba(10,46,77,0.09)' }} />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.15em] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            Bookings
                          </p>
                          <p className="text-[#0A2E4D] text-sm font-semibold f-body">{bookings}</p>
                        </div>
                        <div className="w-px h-7" style={{ background: 'rgba(10,46,77,0.09)' }} />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.15em] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                            Max guests
                          </p>
                          <p className="text-[#0A2E4D] text-sm font-semibold f-body">{exp.max_guests}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/experiences/${exp.id}`}
                          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:bg-[#F3EDE4] f-body"
                          style={{ color: 'rgba(10,46,77,0.55)' }}
                          target="_blank"
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <path d="M1.5 9.5L9.5 1.5M6 1.5h3.5v3.5" />
                          </svg>
                          Preview
                        </Link>
                        <Link
                          href={`/dashboard/experiences/${exp.id}/edit`}
                          className="text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-105 f-body"
                          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                        >
                          Edit →
                        </Link>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ─── Empty state ─────────────────────────────────────────── */
        <div
          className="flex flex-col items-center justify-center py-24 px-8 text-center"
          style={{
            background: '#FDFAF7',
            borderRadius: '24px',
            border: '2px dashed rgba(10,46,77,0.12)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(230,126,80,0.1)' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#E67E50" strokeWidth="1.5">
              <circle cx="11" cy="11" r="9" />
              <path d="M13.5 8.5L11 14 8.5 11 14 8.5z" fill="#E67E50" stroke="none" />
            </svg>
          </div>
          <h3 className="text-[#0A2E4D] text-xl font-bold mb-2 f-display">No experiences yet</h3>
          <p className="text-[#0A2E4D]/45 text-sm mb-6 f-body">
            Create your first experience to start receiving bookings.
          </p>
          <Link
            href="/dashboard/experiences/new"
            className="text-white text-sm font-semibold px-6 py-3 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            Create First Experience →
          </Link>
        </div>
      )}

    </div>
  )
}
