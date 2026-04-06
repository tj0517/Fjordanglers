import Link from 'next/link'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/server'
import LinkGuideButton from '@/components/admin/link-guide-button'
import { QuickApproveButton } from '@/components/admin/quick-approve-button'
import { CountryFlag } from '@/components/ui/country-flag'
import { Plus } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Active'    },
  pending:   { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Pending'   },
  verified:  { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Verified'  },
  suspended: { bg: 'rgba(239,68,68,0.1)',   color: '#DC2626', label: 'Suspended' },
} as const

const FILTER_TABS = [
  { key: '',             label: 'All'          },
  { key: 'needs_action', label: 'Needs Action' },
  { key: 'active',       label: 'Active'       },
  { key: 'pending',      label: 'Pending'      },
  { key: 'no_trips',     label: 'No Trips'     },
  { key: 'no_payment',   label: 'No Payment'   },
  { key: 'no_stripe',    label: 'No Stripe'    },
  { key: 'unclaimed',    label: 'Unclaimed'    },
  { key: 'incomplete',   label: 'Incomplete'   },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = '' } = await searchParams
  const supabase = createServiceClient()

  const [{ data: guides }, { data: expCounts }] = await Promise.all([
    supabase
      .from('guides')
      .select('id, full_name, country, city, status, is_beta_listing, user_id, invite_email, avatar_url, cover_url, bio, photo_marketing_consent, fish_expertise, created_at, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, iban, payment_ready')
      .order('created_at', { ascending: false }),
    supabase
      .from('experiences')
      .select('guide_id')
      .eq('published', true),
  ])

  const allGuides = guides ?? []

  const tripCountByGuide = (expCounts ?? []).reduce<Record<string, number>>((acc, { guide_id }) => {
    acc[guide_id] = (acc[guide_id] ?? 0) + 1
    return acc
  }, {})

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getMissingProfile(g: typeof allGuides[number]): string[] {
    const m: string[] = []
    if (g.avatar_url == null) m.push('Avatar')
    if (!g.bio || g.bio.trim().length < 5) m.push('Bio')
    if (g.cover_url == null) m.push('Cover')
    if (!g.photo_marketing_consent) m.push('Consent')
    return m
  }

  function isNeedsAction(g: typeof allGuides[number]) {
    return (
      g.status === 'pending' ||
      (g.status === 'active' && g.user_id != null && g.stripe_account_id == null) ||
      (g.status === 'active' && g.user_id != null && (tripCountByGuide[g.id] ?? 0) === 0) ||
      g.user_id == null ||
      getMissingProfile(g).length > 0
    )
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredGuides = (() => {
    if (filter === 'pending')      return allGuides.filter(g => g.status === 'pending')
    if (filter === 'active')       return allGuides.filter(g => g.status === 'active')
    if (filter === 'no_payment')   return allGuides.filter(g => !g.payment_ready)
    if (filter === 'no_stripe')    return allGuides.filter(g => g.status === 'active' && g.user_id != null && g.stripe_account_id == null)
    if (filter === 'no_trips')     return allGuides.filter(g => g.status === 'active' && g.user_id != null && (tripCountByGuide[g.id] ?? 0) === 0)
    if (filter === 'unclaimed')    return allGuides.filter(g => g.user_id == null)
    if (filter === 'incomplete')   return allGuides.filter(g => getMissingProfile(g).length > 0)
    if (filter === 'needs_action') return allGuides.filter(isNeedsAction)
    return allGuides
  })()

  const activeCount  = allGuides.filter(g => g.status === 'active').length
  const pendingCount = allGuides.filter(g => g.status === 'pending').length

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1300px]">

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Admin → Guides
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            All <span style={{ fontStyle: 'italic' }}>Guides</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {allGuides.length} total · {activeCount} active · {pendingCount} pending
          </p>
        </div>
        <Link
          href="/admin/guides/new"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
          style={{ background: '#E67E50' }}
        >
          <Plus width={12} height={12} />
          Add Guide
        </Link>
      </div>

      {/* ─── Filter tabs ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTER_TABS.map((f) => {
          const isActive = filter === f.key
          return (
            <Link
              key={f.key}
              href={f.key ? `/admin/guides?filter=${f.key}` : '/admin/guides'}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold f-body transition-all"
              style={{
                background: isActive ? '#0A2E4D' : 'rgba(10,46,77,0.06)',
                color: isActive ? 'white' : 'rgba(10,46,77,0.55)',
                border: isActive ? '1px solid #0A2E4D' : '1px solid rgba(10,46,77,0.1)',
              }}
            >
              {f.label}
            </Link>
          )
        })}
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
        <div className="overflow-x-auto">
          {/* Header row */}
          <div
            className="grid px-5 py-3"
            style={{
              gridTemplateColumns: '2fr 1.2fr 0.9fr 0.9fr 1.2fr 0.5fr 1.2fr',
              borderBottom: '1px solid rgba(10,46,77,0.07)',
              background: 'rgba(10,46,77,0.02)',
              minWidth: '1020px',
            }}
          >
            {['Guide', 'Status', 'Account', 'Payment', 'Profile', 'Trips', 'Actions'].map(col => (
              <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                {col}
              </p>
            ))}
          </div>

          {filteredGuides.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center text-center">
              <p className="text-[#0A2E4D]/30 text-sm f-body">No guides match this filter.</p>
              <Link href="/admin/guides" className="mt-3 text-xs font-semibold f-body" style={{ color: '#E67E50' }}>
                Clear filter →
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)', minWidth: '1020px' }}>
              {filteredGuides.map((guide) => {
                const s = STATUS_STYLES[guide.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending
                const tripCount = tripCountByGuide[guide.id] ?? 0

                const isClaimed = guide.user_id != null
                const accountStyle = isClaimed
                  ? { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Claimed'   }
                  : { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Unclaimed' }

                const stripeActive = guide.stripe_account_id != null && guide.stripe_charges_enabled && guide.stripe_payouts_enabled
                const stripeStarted = guide.stripe_account_id != null && !stripeActive
                const hasIban = guide.iban != null && guide.iban !== ''

                const paymentStyle = (() => {
                  if (!guide.payment_ready)
                    return { bg: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)', label: 'None' }
                  if (stripeActive && hasIban)
                    return { bg: 'rgba(74,222,128,0.15)', color: '#15803D', label: 'Stripe + IBAN' }
                  if (stripeActive)
                    return { bg: 'rgba(74,222,128,0.1)',  color: '#16A34A', label: 'Stripe' }
                  if (hasIban && stripeStarted)
                    return { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'IBAN · Stripe…' }
                  if (hasIban)
                    return { bg: 'rgba(99,102,241,0.1)',  color: '#4F46E5', label: 'IBAN' }
                  // stripe started but no IBAN
                  return { bg: 'rgba(217,119,6,0.1)',   color: '#D97706', label: 'Stripe…' }
                })()

                const missingProfile = getMissingProfile(guide)

                const added = new Date(guide.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: '2-digit',
                })

                return (
                  <div
                    key={guide.id}
                    className="grid items-center px-5 py-3.5 hover:bg-[#F8F4EE] transition-colors"
                    style={{ gridTemplateColumns: '2fr 1.2fr 0.9fr 0.9fr 1.2fr 0.5fr 1.2fr' }}
                  >
                    {/* Guide */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                        style={{ border: '1.5px solid rgba(10,46,77,0.1)' }}
                      >
                        {guide.avatar_url != null ? (
                          <Image src={guide.avatar_url} alt={guide.full_name} width={36} height={36} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold f-display" style={{ background: '#0A2E4D' }}>
                            {guide.full_name[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[#0A2E4D] text-sm font-semibold f-body">{guide.full_name}</p>
                          {guide.is_beta_listing && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full f-body" style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50' }}>
                              Beta
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          <CountryFlag country={guide.country} />
                          {' '}{guide.city != null ? `${guide.city}, ` : ''}{guide.country} · {added}
                        </p>
                      </div>
                    </div>

                    {/* Status + quick approve */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full f-body"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                      {guide.status === 'pending' && <QuickApproveButton guideId={guide.id} />}
                    </div>

                    {/* Account */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full f-body self-start"
                      style={{ background: accountStyle.bg, color: accountStyle.color }}
                    >
                      {accountStyle.label}
                    </span>

                    {/* Payment */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full f-body self-start"
                      style={{ background: paymentStyle.bg, color: paymentStyle.color }}
                    >
                      {paymentStyle.label}
                    </span>

                    {/* Profile completeness */}
                    <div>
                      {missingProfile.length === 0 ? (
                        <span className="text-[11px] font-semibold f-body" style={{ color: '#16A34A' }}>✓ Complete</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {missingProfile.map(m => (
                            <span key={m} className="text-[10px] font-bold f-body" style={{ color: '#DC2626' }}>
                              ✗ {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trips count */}
                    <p
                      className="text-sm font-bold f-display"
                      style={{ color: tripCount === 0 ? 'rgba(10,46,77,0.2)' : '#0A2E4D' }}
                    >
                      {tripCount}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/admin/guides/${guide.id}`}
                        className="text-[11px] f-body font-semibold hover:text-[#E67E50] transition-colors"
                        style={{ color: '#0A2E4D' }}
                      >
                        Manage →
                      </Link>
                      <Link
                        href={`/admin/guides/${guide.id}/edit`}
                        className="text-[11px] f-body hover:text-[#E67E50] transition-colors"
                        style={{ color: 'rgba(10,46,77,0.45)' }}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/guides/${guide.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] f-body hover:text-[#E67E50] transition-colors"
                        style={{ color: 'rgba(10,46,77,0.3)' }}
                      >
                        ↗
                      </Link>
                      {guide.user_id == null && guide.invite_email != null && (
                        <LinkGuideButton guideId={guide.id} inviteEmail={guide.invite_email} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
