import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import DeleteGuideButton from '@/components/admin/delete-guide-button'
import DeleteExperienceButton from '@/components/admin/delete-experience-button'
import LinkGuideButton from '@/components/admin/link-guide-button'
import LinkGuidePanel from '@/components/admin/link-guide-panel'
import CopyInviteLink from '@/components/admin/copy-invite-link'
import { AdminGuideActions } from './AdminGuideActions'
import { MigratePhotosButton } from './MigratePhotosButton'
import { ExternalLink, Pencil, Mail, Plus, Images } from 'lucide-react'

const STATUS_STYLES = {
  active:    { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Active'    },
  pending:   { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Pending'   },
  verified:  { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Verified'  },
  suspended: { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Suspended' },
} as const

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6 mb-6 rounded-3xl"
      style={{
        background: '#FDFAF7',
        border: '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
      }}
    >
      <h2 className="text-[#0A2E4D] text-base font-bold f-display mb-5">{title}</h2>
      {children}
    </div>
  )
}

function CheckRow({ label, done, note }: { label: string; done: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
        style={{
          background: done ? 'rgba(74,222,128,0.15)' : 'rgba(220,38,38,0.1)',
          color: done ? '#16A34A' : '#DC2626',
        }}
      >
        {done ? '✓' : '✗'}
      </span>
      <div>
        <p
          className="text-sm f-body"
          style={{ color: done ? '#0A2E4D' : '#DC2626', fontWeight: done ? 400 : 600 }}
        >
          {label}
        </p>
        {note != null && (
          <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{note}</p>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
      <p className="text-[11px] uppercase tracking-[0.1em] font-semibold f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.38)' }}>
        {label}
      </p>
      <div className={`text-sm f-body text-right ${mono ? 'font-mono' : ''}`} style={{ color: '#0A2E4D' }}>
        {value}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminGuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: guide }, { data: experiences }, { data: bookings }, { data: guidePhotosRaw }] = await Promise.all([
    supabase
      .from('guides')
      .select(`
        id, user_id, full_name, country, city, status, is_beta_listing,
        avatar_url, cover_url, landscape_url, bio, tagline, specialties,
        fish_expertise, languages, certifications, years_experience,
        verified_at, created_at, updated_at, invite_email, lead_id,
        stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled,
        photo_marketing_consent, cancellation_policy, commission_rate, pricing_model,
        calendar_disabled, calendar_mode,
        instagram_url, youtube_url, website_url, facebook_url, google_profile_url,
        average_rating, total_reviews, google_rating, google_review_count,
        boat_type, boat_name, boat_capacity, boat_length_m, boat_engine,
        is_hidden, slug
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('experiences')
      .select('id, title, fish_types, price_per_person_eur, duration_hours, duration_days, difficulty, published, location_city, location_country, created_at')
      .eq('guide_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('status, total_eur, guide_payout_eur')
      .eq('guide_id', id),
    supabase
      .from('guide_photos')
      .select('id, url, sort_order')
      .eq('guide_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (guide == null) notFound()

  const exps        = experiences ?? []
  const allBookings = bookings ?? []
  const guidePhotos = guidePhotosRaw ?? []
  const s = STATUS_STYLES[guide.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending

  // ── Booking stats ─────────────────────────────────────────────────────────
  const confirmedBookings = allBookings.filter(b => ['confirmed', 'completed'].includes(b.status))
  const totalRevenue      = allBookings
    .filter(b => !['cancelled', 'refunded', 'declined'].includes(b.status))
    .reduce((sum, b) => sum + b.total_eur, 0)
  const guideEarnings     = confirmedBookings.reduce((sum, b) => sum + b.guide_payout_eur, 0)

  // ── Profile completeness ──────────────────────────────────────────────────
  const hasBoat    = guide.boat_type != null
  const hasSocial  = [guide.instagram_url, guide.youtube_url, guide.website_url, guide.facebook_url].some(u => u != null)

  const checks = [
    { label: 'Avatar photo',                    done: guide.avatar_url != null,                              note: guide.avatar_url == null ? 'No profile photo uploaded' : undefined },
    { label: 'Cover / banner photo',             done: guide.cover_url != null,                               note: guide.cover_url == null ? 'No cover photo' : undefined },
    { label: 'Bio written',                      done: guide.bio != null && guide.bio.trim().length > 20,     note: !guide.bio ? 'No bio text' : guide.bio.trim().length <= 20 ? 'Bio too short' : undefined },
    { label: 'Tagline set',                      done: guide.tagline != null && guide.tagline.trim().length > 0 },
    { label: 'Languages listed',                 done: guide.languages.length > 0 },
    { label: 'Years of experience',              done: guide.years_experience != null },
    { label: 'Certifications / licences',        done: (guide.certifications ?? []).length > 0,               note: 'Professional licence or certification' },
    { label: 'Social or web presence',           done: hasSocial,                                             note: hasSocial ? undefined : 'No Instagram, YouTube, website, or Facebook' },
    { label: 'Photo & content consent',          done: guide.photo_marketing_consent,                         note: guide.photo_marketing_consent ? 'Accepted ✓' : 'NOT accepted — cannot use their photos in marketing' },
    { label: 'Calendar active',                  done: !guide.calendar_disabled,                              note: guide.calendar_disabled ? 'Calendar is disabled — anglers cannot book' : undefined },
    { label: 'Stripe connected & ready',         done: guide.stripe_charges_enabled && guide.stripe_payouts_enabled },
  ]

  const completedCount = checks.filter(c => c.done).length
  const completionPct  = Math.round(completedCount / checks.length * 100)

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

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
        className="p-7 mb-6 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
        }}
      >
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}>
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
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-[#0A2E4D] text-xl font-bold f-display">{guide.full_name}</h1>
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full f-body" style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                  {guide.is_beta_listing && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full f-body" style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>
                      Beta
                    </span>
                  )}
                  {guide.is_hidden && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full f-body" style={{ background: 'rgba(107,114,128,0.12)', color: '#6B7280' }}>
                      Hidden
                    </span>
                  )}
                </div>
                <p className="text-[#0A2E4D]/50 text-sm f-body">
                  {guide.city != null ? `${guide.city}, ` : ''}{guide.country}
                  {guide.tagline != null && (
                    <span className="ml-2 italic" style={{ color: 'rgba(10,46,77,0.35)' }}>"{guide.tagline}"</span>
                  )}
                </p>
                <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.35)' }}>
                  Added {new Date(guide.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {guide.verified_at != null && ` · Verified ${new Date(guide.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  {guide.slug != null && ` · slug: ${guide.slug}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {(guide.status === 'active' || guide.status === 'verified') ? (
                  <Link href={`/guides/${guide.id}`} target="_blank"
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all f-body"
                    style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                  >
                    <ExternalLink width={11} height={11} strokeWidth={1.3} />
                    Public profile
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full f-body cursor-not-allowed" style={{ background: 'rgba(10,46,77,0.04)', color: 'rgba(10,46,77,0.3)' }}>
                    <ExternalLink width={11} height={11} strokeWidth={1.3} />
                    Public profile
                  </span>
                )}
                <Link href={`/admin/guides/${guide.id}/edit`}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 f-body"
                  style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                >
                  <Pencil width={11} height={11} strokeWidth={1.3} />
                  Edit guide
                </Link>
                {guide.user_id == null && (
                  <>
                    <CopyInviteLink guideId={guide.id} />
                    <LinkGuidePanel guideId={guide.id} />
                  </>
                )}
                <Link href={`/admin/guides/${guide.id}/payouts`}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 f-body"
                  style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                >
                  <Mail width={11} height={11} strokeWidth={1.3} />
                  Payouts
                </Link>
                <Link href={`/admin/guides/${guide.id}/trips/new`}
                  className="flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all hover:brightness-110 f-body"
                  style={{ background: '#E67E50' }}
                >
                  <Plus width={11} height={11} />
                  Add Trip
                </Link>
                <DeleteGuideButton guideId={guide.id} guideName={guide.full_name} hasAuthUser={guide.user_id != null} />
              </div>
            </div>

            {/* Fish expertise tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {guide.fish_expertise.slice(0, 5).map(fish => (
                <span key={fish} className="text-[10px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(201,96,48,0.08)', color: '#9E4820' }}>{fish}</span>
              ))}
              {guide.fish_expertise.length > 5 && (
                <span className="text-[10px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}>+{guide.fish_expertise.length - 5} more</span>
              )}
            </div>

            {/* Invite email badge */}
            {guide.invite_email != null && (
              <div className="mt-4 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.1)' }}>
                <Mail width={12} height={12} stroke="#2563EB" strokeWidth={1.3} className="flex-shrink-0" />
                <p className="text-[11px] f-body" style={{ color: '#1D4ED8' }}>
                  <strong>Invite email:</strong> {guide.invite_email}
                  {guide.user_id != null ? (
                    <span className="ml-1.5 font-semibold" style={{ color: '#16A34A' }}>✓ linked</span>
                  ) : (
                    <span className="ml-1.5 opacity-55">— waiting for registration</span>
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
      </div>

      {/* ─── Account & Stripe + Booking Stats ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

        {/* Account & Stripe */}
        <div
          className="p-6 rounded-3xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
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

        {/* Booking Stats */}
        <div
          className="p-6 rounded-3xl"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
        >
          <h2 className="text-[#0A2E4D] text-base font-bold f-display mb-5">Booking Stats</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total bookings',   value: allBookings.length.toString(),                     sub: 'all time' },
              { label: 'Confirmed',        value: confirmedBookings.length.toString(),               sub: 'confirmed + completed' },
              { label: 'Total revenue',    value: `€${totalRevenue.toFixed(0)}`,                     sub: 'excl. cancelled' },
              { label: 'Guide earnings',   value: `€${guideEarnings.toFixed(0)}`,                    sub: 'payout total' },
            ].map((stat) => (
              <div key={stat.label} className="p-3.5 rounded-2xl" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}>
                <p className="text-[10px] uppercase tracking-[0.15em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.label}</p>
                <p className="text-2xl font-bold f-display text-[#0A2E4D]">{stat.value}</p>
                <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.35)' }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Ratings row */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {guide.average_rating != null && (
              <span className="text-sm font-semibold f-body" style={{ color: '#D97706' }}>
                ★ {guide.average_rating.toFixed(1)} <span className="font-normal text-xs" style={{ color: 'rgba(10,46,77,0.4)' }}>({guide.total_reviews} reviews)</span>
              </span>
            )}
            {guide.google_rating != null && (
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Google: ★ {guide.google_rating.toFixed(1)} ({guide.google_review_count ?? 0})
              </span>
            )}
            {guide.average_rating == null && guide.google_rating == null && (
              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No ratings yet</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Profile Completeness & Consents ─────────────────────────── */}
      <div
        className="p-6 mb-6 rounded-3xl"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
      >
        {/* Header with score */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#0A2E4D] text-base font-bold f-display">Profile Completeness & Consents</h2>
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 rounded-full overflow-hidden" style={{ background: 'rgba(10,46,77,0.08)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct >= 80 ? '#16A34A' : completionPct >= 50 ? '#D97706' : '#DC2626',
                }}
              />
            </div>
            <span
              className="text-sm font-bold f-body"
              style={{ color: completionPct >= 80 ? '#16A34A' : completionPct >= 50 ? '#D97706' : '#DC2626' }}
            >
              {completedCount}/{checks.length}
            </span>
          </div>
        </div>

        {/* Checklist — 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {checks.map((c) => (
            <CheckRow key={c.label} label={c.label} done={c.done} note={c.note} />
          ))}
        </div>
      </div>

      {/* ─── Guide Details ────────────────────────────────────────────── */}
      <div
        className="p-6 mb-6 rounded-3xl"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
      >
        <h2 className="text-[#0A2E4D] text-base font-bold f-display mb-5">Guide Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Business & Booking column */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-3" style={{ color: 'rgba(10,46,77,0.38)' }}>Business</p>
            <div className="flex flex-col">
              <InfoRow label="Commission rate" value={`${(guide.commission_rate * 100).toFixed(0)}%`} />
              <InfoRow label="Pricing model"   value={<span className="capitalize">{guide.pricing_model.replace('_', ' ')}</span>} />
              <InfoRow
                label="Cancellation policy"
                value={
                  <span className="text-right" style={{ maxWidth: 200, wordBreak: 'break-word', display: 'block' }}>
                    {guide.cancellation_policy || '—'}
                  </span>
                }
              />
              <InfoRow label="Calendar mode"   value={guide.calendar_mode || '—'} />
              <InfoRow
                label="Calendar status"
                value={
                  <span style={{ color: guide.calendar_disabled ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                    {guide.calendar_disabled ? 'Disabled' : 'Active'}
                  </span>
                }
              />
              <InfoRow
                label="Hidden from public"
                value={
                  <span style={{ color: guide.is_hidden ? '#D97706' : '#16A34A', fontWeight: 600 }}>
                    {guide.is_hidden ? 'Yes — not visible' : 'No — visible'}
                  </span>
                }
              />
              <InfoRow label="Years experience" value={guide.years_experience != null ? `${guide.years_experience} years` : '—'} />
            </div>

            {(guide.certifications ?? []).length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>Certifications</p>
                <div className="flex flex-wrap gap-1.5">
                  {(guide.certifications ?? []).map(c => (
                    <span key={c} className="text-[11px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(37,99,235,0.08)', color: '#1D4ED8' }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {(guide.specialties ?? []).length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>Specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {(guide.specialties ?? []).map(sp => (
                    <span key={sp} className="text-[11px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>{sp}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>Languages</p>
              <div className="flex flex-wrap gap-1.5">
                {guide.languages.length > 0 ? guide.languages.map(l => (
                  <span key={l} className="text-[11px] px-2.5 py-1 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>{l}</span>
                )) : <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>None set</span>}
              </div>
            </div>
          </div>

          {/* Social & Boat column */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-3" style={{ color: 'rgba(10,46,77,0.38)' }}>Social & Web</p>
            <div className="flex flex-col">
              <InfoRow
                label="Instagram"
                value={guide.instagram_url != null
                  ? <a href={guide.instagram_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" style={{ maxWidth: 200 }}>{guide.instagram_url}</a>
                  : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                }
              />
              <InfoRow
                label="YouTube"
                value={guide.youtube_url != null
                  ? <a href={guide.youtube_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" style={{ maxWidth: 200 }}>{guide.youtube_url}</a>
                  : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                }
              />
              <InfoRow
                label="Website"
                value={guide.website_url != null
                  ? <a href={guide.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" style={{ maxWidth: 200 }}>{guide.website_url}</a>
                  : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                }
              />
              <InfoRow
                label="Facebook"
                value={guide.facebook_url != null
                  ? <a href={guide.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" style={{ maxWidth: 200 }}>{guide.facebook_url}</a>
                  : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                }
              />
              <InfoRow
                label="Google Profile"
                value={guide.google_profile_url != null
                  ? <a href={guide.google_profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" style={{ maxWidth: 200 }}>{guide.google_profile_url}</a>
                  : <span style={{ color: 'rgba(10,46,77,0.3)' }}>—</span>
                }
              />
            </div>

            {/* Consent summary */}
            <div className="mt-5 p-4 rounded-2xl" style={{ background: guide.photo_marketing_consent ? 'rgba(74,222,128,0.07)' : 'rgba(220,38,38,0.06)', border: `1px solid ${guide.photo_marketing_consent ? 'rgba(74,222,128,0.2)' : 'rgba(220,38,38,0.15)'}` }}>
              <p className="text-[10px] uppercase tracking-[0.15em] font-bold f-body mb-1" style={{ color: guide.photo_marketing_consent ? '#16A34A' : '#DC2626' }}>
                Photo & Content Consent
              </p>
              <p className="text-sm font-bold f-body" style={{ color: guide.photo_marketing_consent ? '#16A34A' : '#DC2626' }}>
                {guide.photo_marketing_consent ? '✓ Accepted' : '✗ Not accepted'}
              </p>
              <p className="text-[10px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {guide.photo_marketing_consent
                  ? 'We can use their photos in marketing materials.'
                  : 'Cannot use their photos or content in marketing without explicit consent.'}
              </p>
            </div>

            {/* Boat section */}
            {hasBoat && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold f-body mb-3" style={{ color: 'rgba(10,46,77,0.38)' }}>Boat</p>
                <div className="flex flex-col">
                  <InfoRow label="Type"     value={guide.boat_type ?? '—'} />
                  <InfoRow label="Name"     value={guide.boat_name ?? '—'} />
                  <InfoRow label="Capacity" value={guide.boat_capacity != null ? `${guide.boat_capacity} people` : '—'} />
                  <InfoRow label="Length"   value={guide.boat_length_m != null ? `${guide.boat_length_m}m` : '—'} />
                  <InfoRow label="Engine"   value={guide.boat_engine ?? '—'} />
                </div>
              </div>
            )}
          </div>
        </div>
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
          <Plus size={11} />
          Add Trip
        </Link>
      </div>

      {exps.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center rounded-3xl"
          style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.1)' }}
        >
          <p className="text-[#0A2E4D]/30 text-sm f-body mb-3">No trips yet for this guide.</p>
          <Link href={`/admin/guides/${guide.id}/trips/new`} className="text-xs font-semibold f-body transition-colors hover:text-[#C96030]" style={{ color: '#E67E50' }}>
            Create the first trip →
          </Link>
        </div>
      ) : (
        <div style={{ background: '#FDFAF7', borderRadius: '24px', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <div className="grid px-6 py-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr', borderBottom: '1px solid rgba(10,46,77,0.07)', background: 'rgba(10,46,77,0.02)', minWidth: '560px' }}>
              {['Trip', 'Location', 'Price', 'Duration', 'Status'].map(col => (
                <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{col}</p>
              ))}
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '560px' }}>
              {exps.map(exp => {
                const duration = exp.duration_hours != null ? `${exp.duration_hours}h` : `${exp.duration_days ?? '?'} days`
                return (
                  <div key={exp.id} className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors" style={{ gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr' }}>
                    <div className="min-w-0 pr-4">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{exp.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {exp.fish_types.slice(0, 2).map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded f-body" style={{ background: 'rgba(201,96,48,0.08)', color: '#9E4820' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[#0A2E4D]/55 text-xs f-body">{[exp.location_city, exp.location_country].filter(Boolean).join(', ') || '—'}</p>
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body">€{exp.price_per_person_eur}</p>
                    <p className="text-[#0A2E4D]/55 text-xs f-body">{duration}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full f-body"
                        style={exp.published ? { background: 'rgba(74,222,128,0.1)', color: '#16A34A' } : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.5)' }}
                      >
                        {exp.published ? 'Live' : 'Draft'}
                      </span>
                      <Link href={`/admin/guides/${guide.id}/trips/${exp.id}/edit`} className="text-[10px] font-medium f-body transition-colors hover:text-[#E67E50]" style={{ color: 'rgba(10,46,77,0.38)' }}>Edit</Link>
                      <Link
                        href={`/admin/experiences/new?experience_id=${exp.id}&guide_id=${guide.id}`}
                        className="text-[10px] font-semibold f-body px-2 py-0.5 rounded-full transition-all"
                        style={{ background: 'rgba(230,126,80,0.1)', color: '#E67E50' }}
                      >
                        + Exp page
                      </Link>
                      <DeleteExperienceButton experienceId={exp.id} title={exp.title} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Guide Photo Gallery ──────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-[#0A2E4D] text-lg font-bold f-display flex items-center gap-2">
              <Images size={18} style={{ color: '#E67E50' }} />
              Photo Gallery
              <span className="text-[#0A2E4D]/35 text-sm font-normal f-body">
                ({guidePhotos.length})
              </span>
            </h2>
            <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
              These photos are used in the experience page builder — no re-uploads needed.
            </p>
          </div>
          {/* Migration button — moves existing flat-path files to {guide_id}/ folder */}
          {guidePhotos.length > 0 && (
            <MigratePhotosButton guideId={guide.id} />
          )}
        </div>

        {guidePhotos.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center rounded-3xl"
            style={{ background: '#FDFAF7', border: '2px dashed rgba(10,46,77,0.1)' }}
          >
            <Images size={28} strokeWidth={1.2} style={{ color: 'rgba(10,46,77,0.18)', marginBottom: 10 }} />
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              No photos uploaded yet.
            </p>
            <p className="text-[11px] f-body mt-1" style={{ color: 'rgba(10,46,77,0.28)' }}>
              Guide uploads photos at /dashboard/photos
            </p>
          </div>
        ) : (
          <div
            className="rounded-[24px] p-5"
            style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
          >
            <div className="flex flex-wrap gap-2.5">
              {guidePhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden rounded-2xl flex-shrink-0"
                  style={{
                    width:  idx === 0 ? 140 : 100,
                    height: idx === 0 ? 100 : 72,
                  }}
                >
                  <Image
                    src={photo.url}
                    alt={`Photo ${idx + 1}`}
                    fill
                    sizes="140px"
                    className="object-cover"
                  />
                  {idx === 0 && (
                    <div
                      className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full f-body"
                      style={{ background: '#E67E50', color: '#fff' }}
                    >
                      Cover
                    </div>
                  )}
                  {/* Is this photo already in the guide's organised folder? */}
                  {photo.url.includes(`/${guide.id}/`) && (
                    <div
                      className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(74,222,128,0.9)' }}
                      title="Organised in guide folder"
                    >
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L2.8 5.5L6 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] f-body mt-3" style={{ color: 'rgba(10,46,77,0.35)' }}>
              Green dot = file organised in guide&apos;s folder ({guide.id.slice(0, 8)}…).
              Click &quot;Move to guide folder&quot; above to migrate any remaining flat-path files.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
