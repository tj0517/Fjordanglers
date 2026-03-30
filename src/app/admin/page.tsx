import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CountryFlag } from '@/components/ui/country-flag'
import { Plus, AlertCircle, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Admin — FjordAnglers',
}

// ─── Status style maps ────────────────────────────────────────────────────────

const INQUIRY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  inquiry:   { label: 'New',       color: '#E67E50', bg: 'rgba(230,126,80,0.1)' },
  reviewing: { label: 'Reviewing', color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
}

const LEAD_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'New',       color: '#E67E50', bg: 'rgba(230,126,80,0.1)' },
  contacted: { label: 'Contacted', color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { data: allGuidesData },
    { data: tripsData },
    { count: totalActiveLeads },
    { count: totalOpenInquiries },
    { data: recentLeads },
    { data: recentInquiries },
  ] = await Promise.all([
    supabase.from('guides').select('id, status, user_id, stripe_account_id'),
    supabase.from('experiences').select('guide_id').eq('published', true),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'contacted']),
    supabase
      .from('trip_inquiries')
      .select('id', { count: 'exact', head: true })
      .in('status', ['inquiry', 'reviewing']),
    supabase
      .from('leads')
      .select('id, name, country, status, created_at')
      .in('status', ['new', 'contacted'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('trip_inquiries')
      .select('id, angler_name, target_species, status, created_at')
      .in('status', ['inquiry', 'reviewing'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const allG = allGuidesData ?? []
  const guideIdsWithTrips = new Set((tripsData ?? []).map(e => e.guide_id))

  const totalGuides    = allG.length
  const activeGuides   = allG.filter(g => g.status === 'active').length
  const pendingGuides  = allG.filter(g => g.status === 'pending').length
  const noStripeLinked = allG.filter(g => g.status === 'active' && g.user_id != null && g.stripe_account_id == null).length
  const notRegistered  = allG.filter(g => g.user_id == null).length
  const noTripsActive  = allG.filter(g => g.status === 'active' && g.user_id != null && !guideIdsWithTrips.has(g.id)).length

  // ── Attention items (only shown if count > 0) ─────────────────────────────
  const attentionItems = [
    pendingGuides > 0
      ? { count: pendingGuides,  label: 'guides pending approval',             href: '/admin/guides?filter=pending',      color: '#D97706', bg: 'rgba(217,119,6,0.1)'   }
      : null,
    noStripeLinked > 0
      ? { count: noStripeLinked, label: 'active guides with no Stripe account', href: '/admin/guides?filter=no_stripe',    color: '#DC2626', bg: 'rgba(239,68,68,0.1)'  }
      : null,
    noTripsActive > 0
      ? { count: noTripsActive,  label: 'active guides with no published trips', href: '/admin/guides?filter=no_trips',   color: '#E67E50', bg: 'rgba(230,126,80,0.1)' }
      : null,
    notRegistered > 0
      ? { count: notRegistered,  label: 'profiles not yet claimed',             href: '/admin/guides?filter=unclaimed',    color: '#6B7280', bg: 'rgba(107,114,128,0.1)' }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const STATS = [
    { label: 'Total guides',   value: totalGuides,                   sub: `${activeGuides} active`,          urgent: false },
    { label: 'Pending review', value: pendingGuides,                 sub: 'awaiting approval',               urgent: pendingGuides > 0 },
    { label: 'Active leads',   value: totalActiveLeads ?? 0,         sub: 'new & contacted',                 urgent: false },
    { label: 'Open inquiries', value: totalOpenInquiries ?? 0,       sub: 'inquiry & reviewing',             urgent: false },
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

      {/* ─── Recent Leads + Open Inquiries ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Recent leads */}
        <div
          className="overflow-hidden rounded-[20px]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
            <div>
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Active Leads</h2>
              <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>New & contacted</p>
            </div>
            <Link href="/admin/leads" className="text-xs f-body font-medium hover:text-[#E67E50] transition-colors" style={{ color: 'rgba(10,46,77,0.38)' }}>
              View all →
            </Link>
          </div>
          {(recentLeads ?? []).length === 0 ? (
            <p className="px-5 py-10 text-sm text-center f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No active leads</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
              {(recentLeads ?? []).map((lead) => {
                const ls = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new
                return (
                  <div key={lead.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold f-body text-[#0A2E4D] truncate">{lead.name ?? '—'}</p>
                      <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {lead.country != null && <><CountryFlag country={lead.country} /> {lead.country} · </>}
                        {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                      style={{ background: ls.bg, color: ls.color }}
                    >
                      {ls.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Open inquiries */}
        <div
          className="overflow-hidden rounded-[20px]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
            <div>
              <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Open Inquiries</h2>
              <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Inquiry & reviewing</p>
            </div>
            <Link href="/admin/inquiries" className="text-xs f-body font-medium hover:text-[#E67E50] transition-colors" style={{ color: 'rgba(10,46,77,0.38)' }}>
              View all →
            </Link>
          </div>
          {(recentInquiries ?? []).length === 0 ? (
            <p className="px-5 py-10 text-sm text-center f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>No open inquiries</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
              {(recentInquiries ?? []).map((inq) => {
                const is = INQUIRY_STATUS[inq.status] ?? INQUIRY_STATUS.inquiry
                const species = inq.target_species.slice(0, 2).join(', ')
                return (
                  <div key={inq.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold f-body text-[#0A2E4D] truncate">{inq.angler_name}</p>
                      <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.4)' }}>
                        {species !== '' ? species : '—'} · {new Date(inq.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full f-body flex-shrink-0"
                      style={{ background: is.bg, color: is.color }}
                    >
                      {is.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Quick nav ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'All Guides',  href: '/admin/guides',    icon: '🧭' },
          { label: 'All Leads',   href: '/admin/leads',     icon: '📋' },
          { label: 'Inquiries',   href: '/admin/inquiries', icon: '💬' },
          { label: 'Add Guide',   href: '/admin/guides/new', icon: '+', accent: true },
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
