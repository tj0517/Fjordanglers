import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeleteGuideButton from '@/components/admin/delete-guide-button'
import DeleteExperienceButton from '@/components/admin/delete-experience-button'
import LinkGuideButton from '@/components/admin/link-guide-button'
import LinkGuidePanel from '@/components/admin/link-guide-panel'
import CopyInviteLink from '@/components/admin/copy-invite-link'
import { AdminGuideActions } from './AdminGuideActions'

/**
 * /admin/guides/[id] — Guide detail page for admin.
 *
 * Shows guide profile info + full list of their experiences.
 * Admin can add experiences for any guide (incl. beta listings).
 */

const STATUS_STYLES = {
  active:    { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Active' },
  pending:   { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Pending' },
  verified:  { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Verified' },
  suspended: { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Suspended' },
} as const

export default async function AdminGuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ── Fetch guide + experiences in parallel ─────────────────────────────────
  const [{ data: guide }, { data: experiences }] = await Promise.all([
    supabase
      .from('guides')
      .select('id, user_id, full_name, country, city, status, is_beta_listing, avatar_url, cover_url, fish_expertise, languages, bio, verified_at, invite_email, lead_id, created_at, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
      .eq('id', id)
      .single(),
    supabase
      .from('experiences')
      .select('id, title, fish_types, price_per_person_eur, duration_hours, duration_days, difficulty, published, location_city, location_country, created_at')
      .eq('guide_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (guide == null) notFound()

  const exps = experiences ?? []
  const s = STATUS_STYLES[guide.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[900px]">

      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/guides" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70" style={{ color: 'rgba(10,46,77,0.38)' }}>Guides</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>{guide.full_name}</span>
      </div>

      {/* ─── Guide profile card ──────────────────────────────────────── */}
      <div
        className="p-7 mb-7 rounded-3xl flex items-start gap-6"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
          style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}
        >
          {guide.avatar_url != null ? (
            <Image src={guide.avatar_url} alt={guide.full_name} width={80} height={80} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold f-display" style={{ background: '#0A2E4D' }}>
              {guide.full_name[0]}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[#0A2E4D] text-xl font-bold f-display">{guide.full_name}</h1>
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full f-body"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.label}
                </span>
                {guide.is_beta_listing && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full f-body"
                    style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}
                  >
                    Beta
                  </span>
                )}
              </div>
              <p className="text-[#0A2E4D]/50 text-sm f-body">
                {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {guide.status === 'active' || guide.status === 'verified' ? (
                <Link
                  href={`/guides/${guide.id}`}
                  target="_blank"
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all f-body"
                  style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <path d="M1.5 9.5L9.5 1.5M6 1.5h3.5v3.5" />
                  </svg>
                  Public profile
                </Link>
              ) : (
                <span
                  title="Guide must be active to view public profile"
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full cursor-not-allowed f-body"
                  style={{ background: 'rgba(10,46,77,0.04)', color: 'rgba(10,46,77,0.3)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <path d="M1.5 9.5L9.5 1.5M6 1.5h3.5v3.5" />
                  </svg>
                  Public profile
                </span>
              )}
              <Link
                href={`/admin/guides/${guide.id}/edit`}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 f-body"
                style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M7.5 1.5l2 2-6 6H1.5v-2l6-6z" />
                </svg>
                Edit guide
              </Link>
              {/* Invite link + manual link — shown only when no auth user is linked */}
              {guide.user_id == null && (
                <>
                  <CopyInviteLink guideId={guide.id} />
                  <LinkGuidePanel guideId={guide.id} />
                </>
              )}
              <Link
                href={`/admin/guides/${guide.id}/payouts`}
                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 f-body"
                style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M1 8.5h9M1 6h6M1 3.5h4" />
                </svg>
                Payouts
              </Link>
              <Link
                href={`/admin/guides/${guide.id}/trips/new`}
                className="flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body"
                style={{ background: '#E67E50' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                  <rect x="4.5" y="0.5" width="2" height="10" rx="1" />
                  <rect x="0.5" y="4.5" width="10" height="2" rx="1" />
                </svg>
                Add Trip
              </Link>
              <DeleteGuideButton
                guideId={guide.id}
                guideName={guide.full_name}
                hasAuthUser={guide.user_id != null}
              />
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {guide.fish_expertise.slice(0, 4).map(fish => (
              <span key={fish} className="text-[10px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(201,96,48,0.08)', color: '#9E4820' }}>
                {fish}
              </span>
            ))}
            {guide.fish_expertise.length > 4 && (
              <span className="text-[10px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}>
                +{guide.fish_expertise.length - 4} more
              </span>
            )}
          </div>

          {/* invite_email badge — shown only if admin set one (optional, legacy) */}
          {guide.invite_email != null && (
            <div
              className="mt-4 px-4 py-2.5 rounded-xl flex items-center gap-2"
              style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.1)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#2563EB" strokeWidth="1.3" className="flex-shrink-0">
                <rect x="1" y="3.5" width="10" height="7" rx="1.5" />
                <path d="M1 6l5 3 5-3" />
              </svg>
              <p className="text-[11px] f-body" style={{ color: '#1D4ED8' }}>
                <strong>Email match:</strong> {guide.invite_email}
                {guide.user_id != null ? (
                  <span className="ml-1.5 font-semibold" style={{ color: '#16A34A' }}>✓ linked</span>
                ) : (
                  <span className="ml-1.5 opacity-55">— waiting</span>
                )}
              </p>
              {guide.user_id == null && (
                <div className="ml-auto flex-shrink-0">
                  <LinkGuideButton guideId={guide.id} inviteEmail={guide.invite_email} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Account & Stripe ───────────────────────────────────────── */}
      <div
        className="p-7 mb-7 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        <h2 className="text-[#0A2E4D] text-base font-bold f-display mb-5">Account & Stripe</h2>
        <AdminGuideActions
          guideId={guide.id}
          currentStatus={guide.status as 'active' | 'pending' | 'suspended' | 'verified'}
          stripeAccountId={guide.stripe_account_id ?? null}
          stripePayoutsEnabled={guide.stripe_payouts_enabled}
          stripeChargesEnabled={guide.stripe_charges_enabled}
        />
      </div>

      {/* ─── Experiences ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#0A2E4D] text-lg font-bold f-display">
          Trips <span className="text-[#0A2E4D]/35 text-sm font-normal f-body">({exps.length})</span>
        </h2>
        <Link
          href={`/admin/guides/${guide.id}/trips/new`}
          className="flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
            <rect x="4.5" y="0.5" width="2" height="10" rx="1" />
            <rect x="0.5" y="4.5" width="10" height="2" rx="1" />
          </svg>
          Add Trip
        </Link>
      </div>

      {exps.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center rounded-3xl"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.1)' }}
        >
          <p className="text-[#0A2E4D]/30 text-sm f-body mb-3">No trips yet for this guide.</p>
          <Link
            href={`/admin/guides/${guide.id}/trips/new`}
            className="text-xs font-semibold f-body transition-colors hover:text-[#C96030]"
            style={{ color: '#E67E50' }}
          >
            Create the first trip →
          </Link>
        </div>
      ) : (
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
              gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              background: 'rgba(10,46,77,0.02)',
              minWidth: '560px',
            }}
          >
            {['Trip', 'Location', 'Price', 'Duration', 'Status'].map(col => (
              <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{col}</p>
            ))}
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '560px' }}>
            {exps.map(exp => {
              const duration = exp.duration_hours != null
                ? `${exp.duration_hours}h`
                : `${exp.duration_days ?? '?'} days`

              return (
                <div
                  key={exp.id}
                  className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr' }}
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{exp.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {exp.fish_types.slice(0, 2).map(f => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 rounded f-body" style={{ background: 'rgba(201,96,48,0.08)', color: '#9E4820' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[#0A2E4D]/55 text-xs f-body">
                    {[exp.location_city, exp.location_country].filter(Boolean).join(', ') || '—'}
                  </p>
                  <p className="text-[#0A2E4D] text-sm font-semibold f-body">€{exp.price_per_person_eur}</p>
                  <p className="text-[#0A2E4D]/55 text-xs f-body">{duration}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body"
                      style={
                        exp.published
                          ? { background: 'rgba(74,222,128,0.1)', color: '#16A34A' }
                          : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }
                      }
                    >
                      {exp.published ? 'Live' : 'Draft'}
                    </span>
                    <Link
                      href={`/admin/guides/${guide.id}/trips/${exp.id}/edit`}
                      className="text-[10px] font-medium f-body transition-colors hover:text-[#E67E50]"
                      style={{ color: 'rgba(10,46,77,0.38)' }}
                    >
                      Edit
                    </Link>
                    <DeleteExperienceButton
                      experienceId={exp.id}
                      title={exp.title}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          </div>{/* /overflow-x-auto */}
        </div>
      )}
    </div>
  )
}
