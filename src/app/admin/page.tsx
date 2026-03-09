import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin overview — top-level dashboard for FjordAnglers admins.
 * Shows key platform numbers and surfaces the primary action: Add Guide Profile.
 */
export default async function AdminPage() {
  const supabase = await createClient()

  // ── Parallel stats fetches ─────────────────────────────────────────────────
  const [
    { count: totalGuides },
    { count: betaListings },
    { count: activeGuides },
    { count: pendingGuides },
    { count: totalLeads },
    { count: newLeads },
  ] = await Promise.all([
    supabase.from('guides').select('id', { count: 'exact', head: true }),
    supabase.from('guides').select('id', { count: 'exact', head: true }).eq('is_beta_listing', true),
    supabase.from('guides').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('guides').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ])

  const STATS = [
    {
      label: 'Total guides',
      value: (totalGuides ?? 0).toString(),
      sub: `${activeGuides ?? 0} active`,
      accent: '#0A2E4D',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="6" r="3" />
          <path d="M1 16c0-3.5 2.5-6 6-6s6 2.5 6 6" />
          <circle cx="14" cy="6" r="2.5" />
          <path d="M14 10.5c2 0 3.5 1.5 3.5 4" />
        </svg>
      ),
    },
    {
      label: 'Guide profiles',
      value: (betaListings ?? 0).toString(),
      sub: 'admin-created',
      accent: '#E67E50',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="14" height="12" rx="2" />
          <line x1="6" y1="9" x2="12" y2="9" />
          <line x1="9" y1="6" x2="9" y2="12" />
        </svg>
      ),
    },
    {
      label: 'Pending review',
      value: (pendingGuides ?? 0).toString(),
      sub: 'awaiting verification',
      accent: '#C96030',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="9" r="7" />
          <line x1="9" y1="5" x2="9" y2="9.5" />
          <line x1="9" y1="12" x2="9" y2="13" />
        </svg>
      ),
    },
    {
      label: 'Leads',
      value: (totalLeads ?? 0).toString(),
      sub: `${newLeads ?? 0} new`,
      accent: '#1B4F72',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            FjordAnglers Admin
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Platform <span style={{ fontStyle: 'italic' }}>Overview</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            Manage guides, listings and leads from one place.
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

      {/* ─── Stats ──────────────────────────────────────────────── */}
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
              <p className="text-[11px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.42)' }}>
                {stat.label}
              </p>
              <span style={{ color: stat.accent, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p className="text-[#0A2E4D] text-2xl font-bold leading-none f-display">{stat.value}</p>
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Primary action card ─────────────────────────────────── */}
      <div
        className="px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{
          background: 'linear-gradient(105deg, #0A1F35 0%, #1B4F72 100%)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <span
            className="inline-block text-[9px] font-bold uppercase tracking-[0.22em] px-2.5 py-1 rounded-full mb-3 f-body"
            style={{ background: 'rgba(230,126,80,0.2)', color: '#E67E50' }}
          >
            Admin Created
          </span>
          <h2 className="text-white text-xl font-bold f-display mb-2">
            Add a guide profile to the marketplace
          </h2>
          <p className="text-white/45 text-sm f-body leading-relaxed" style={{ maxWidth: '460px' }}>
            Add a guide manually to populate the marketplace. Profiles appear
            publicly on <span className="text-white/65">/guides</span> immediately — no guide sign-up required.
            Perfect for onboarding early partners.
          </p>
        </div>

        <div className="flex flex-col gap-3 flex-shrink-0">
          <Link
            href="/admin/guides/new"
            className="flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body whitespace-nowrap"
            style={{ background: '#E67E50' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
              <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
            </svg>
            Add Guide Profile
          </Link>
          <Link
            href="/admin/guides"
            className="text-center text-white/40 text-xs f-body hover:text-white/65 transition-colors"
          >
            View all guides →
          </Link>
        </div>
      </div>

      {/* ─── Quick guide status breakdown ────────────────────────── */}
      <div
        className="mt-6"
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-7 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
        >
          <div>
            <h2 className="text-[#0A2E4D] text-base font-bold f-display">Guide pipeline</h2>
            <p className="text-[#0A2E4D]/38 text-xs mt-0.5 f-body">All guides across all statuses</p>
          </div>
          <Link
            href="/admin/guides"
            className="text-xs font-medium f-body transition-colors hover:text-[#E67E50]"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Manage all →
          </Link>
        </div>

        <div className="px-7 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Active',    count: activeGuides ?? 0,       color: '#16A34A', bg: 'rgba(74,222,128,0.1)' },
            { label: 'Admin',     count: betaListings ?? 0,       color: '#E67E50', bg: 'rgba(230,126,80,0.1)' },
            { label: 'Pending',   count: pendingGuides ?? 0,      color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
            { label: 'Total',     count: totalGuides ?? 0,        color: '#0A2E4D', bg: 'rgba(10,46,77,0.07)' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full self-start f-body"
                style={{ background: item.bg, color: item.color }}
              >
                {item.label}
              </span>
              <p className="text-[#0A2E4D] text-3xl font-bold f-display">{item.count}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
