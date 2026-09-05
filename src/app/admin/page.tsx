import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { Plus, AlertCircle, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Admin — FjordAnglers',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = createServiceClient()

  const { data: allGuidesData } = await supabase
    .from('guides')
    .select('id, status, user_id, stripe_account_id')

  const allG = allGuidesData ?? []

  const totalGuides    = allG.length
  const activeGuides   = allG.filter(g => g.status === 'active').length
  const pendingGuides  = allG.filter(g => g.status === 'pending').length
  const noStripeLinked = allG.filter(g => g.status === 'active' && g.user_id != null && g.stripe_account_id == null).length
  const notRegistered  = allG.filter(g => g.user_id == null).length

  // ── Attention items (only shown if count > 0) ─────────────────────────────
  const attentionItems = [
    pendingGuides > 0
      ? { count: pendingGuides,  label: 'guides pending approval',             href: '/admin/guides?filter=pending',      color: '#D97706', bg: 'rgba(217,119,6,0.1)'   }
      : null,
    noStripeLinked > 0
      ? { count: noStripeLinked, label: 'active guides with no Stripe account', href: '/admin/guides?filter=no_stripe',    color: '#DC2626', bg: 'rgba(239,68,68,0.1)'  }
      : null,
    notRegistered > 0
      ? { count: notRegistered,  label: 'profiles not yet claimed',             href: '/admin/guides?filter=unclaimed',    color: '#6B7280', bg: 'rgba(107,114,128,0.1)' }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const STATS = [
    { label: 'Total guides',   value: totalGuides,   sub: `${activeGuides} active`, urgent: false },
    { label: 'Pending review', value: pendingGuides, sub: 'awaiting approval',      urgent: pendingGuides > 0 },
  ]

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            FjordAnglers Admin
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Platform <span style={{ fontStyle: 'italic' }}>Overview</span>
          </h1>
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

      {/* ─── Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="p-5 rounded-[18px]"
            style={{
              background: '#FDFAF7',
              border: s.urgent ? '1px solid rgba(217,119,6,0.3)' : '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 12px rgba(10,46,77,0.05)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
              {s.label}
            </p>
            <p className="text-3xl font-bold f-display" style={{ color: s.urgent ? '#D97706' : '#0A2E4D' }}>
              {s.value}
            </p>
            <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.38)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Needs Attention ──────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div
          className="mb-6 overflow-hidden rounded-[20px]"
          style={{
            border: '1px solid rgba(230,126,80,0.2)',
            background: '#FDFAF7',
            boxShadow: '0 2px 12px rgba(10,46,77,0.04)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ borderBottom: '1px solid rgba(10,46,77,0.07)', background: 'rgba(230,126,80,0.04)' }}
          >
            <AlertCircle width={16} height={16} stroke="#E67E50" strokeWidth={1.6} aria-hidden="true" />
            <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Needs Attention</h2>
            <span
              className="text-[10px] font-bold f-body px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}
            >
              {attentionItems.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.06)' }}>
            {attentionItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#F8F4EE] transition-colors"
              >
                <span
                  className="text-xl font-bold f-display flex-shrink-0 w-7 text-right"
                  style={{ color: item.color }}
                >
                  {item.count}
                </span>
                <span className="text-sm f-body flex-1" style={{ color: 'rgba(10,46,77,0.7)' }}>
                  {item.label}
                </span>
                <ArrowRight width={14} height={14} stroke="rgba(10,46,77,0.28)" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Quick nav ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'All Guides', href: '/admin/guides',     icon: '🧭' },
          { label: 'Inquiries',  href: '/admin/inquiries',  icon: '📋' },
          { label: 'Add Guide',  href: '/admin/guides/new', icon: '+', accent: true },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] f-body text-sm font-semibold transition-all hover:brightness-105"
            style={{
              background: item.accent ? '#E67E50' : '#FDFAF7',
              color: item.accent ? 'white' : '#0A2E4D',
              border: item.accent ? 'none' : '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 1px 8px rgba(10,46,77,0.05)',
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

    </div>
  )
}
