'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminSidebarProps = {
  adminName: string
  newLeadsCount?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)

const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5.5" cy="5" r="2.5" />
    <path d="M1 13c0-2.5 2-4 4.5-4S10 10.5 10 13" />
    <circle cx="11" cy="5" r="2" />
    <path d="M11 9c1.5 0 3 1 3 3" />
  </svg>
)

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="6.5" y="1" width="2" height="13" rx="1" />
    <rect x="1" y="6.5" width="13" height="2" rx="1" />
  </svg>
)

const IconInbox = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="13" height="13" rx="2" />
    <path d="M1 9h3.5l1 2h4l1-2H14" />
  </svg>
)

const IconList = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <line x1="5.5" y1="4" x2="14" y2="4" />
    <line x1="5.5" y1="7.5" x2="14" y2="7.5" />
    <line x1="5.5" y1="11" x2="14" y2="11" />
    <circle cx="2.5" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="2.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="2.5" cy="11" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const IconChat = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 2h11a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" />
  </svg>
)

const IconArrowLeft = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <polyline points="7,2 3,6 7,10" />
    <line x1="3" y1="6" x2="11" y2="6" />
  </svg>
)

const IconLogout = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h3" />
    <polyline points="9,9 12,6.5 9,4" />
    <line x1="5" y1="6.5" x2="12" y2="6.5" />
  </svg>
)

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Overview',         href: '/admin',              icon: <IconGrid />,  exact: true  },
  { label: 'Guides',           href: '/admin/guides',       icon: <IconUsers />, exact: false },
  { label: 'Trips',      href: '/admin/trips',  icon: <IconList />,  exact: false },
  { label: 'Leads',            href: '/admin/leads',        icon: <IconInbox />, exact: false },
  { label: 'Inquiries',        href: '/admin/inquiries',   icon: <IconChat />,  exact: false },
  { label: 'Add Guide Profile', href: '/admin/guides/new',  icon: <IconPlus />,  exact: false },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSidebar({ adminName, newLeadsCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col"
      style={{
        width: '240px',
        background: '#07111C',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        zIndex: 40,
      }}
    >
      {/* Grain texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: GRAIN_BG,
          backgroundSize: '200px 200px',
          opacity: 0.055,
          mixBlendMode: 'screen',
        }}
      />

      {/* Logo + admin badge */}
      <div
        className="relative px-6 pt-6 pb-5"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Link href="/">
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={140}
            height={36}
            className="h-7 w-auto"
            style={{ opacity: 0.7 }}
          />
        </Link>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] f-body" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Admin Panel
          </p>
          {/* Admin indicator dot */}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#E67E50', boxShadow: '0 0 6px rgba(230,126,80,0.6)' }}
          />
        </div>
      </div>

      {/* Admin identity card */}
      <div
        className="relative px-4 py-3"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-2xl"
          style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.12)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold f-display"
            style={{ background: 'linear-gradient(135deg, #E67E50 0%, #C96030 100%)' }}
          >
            {adminName[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate f-body leading-tight">{adminName}</p>
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full mt-0.5 f-body"
              style={{ background: 'rgba(230,126,80,0.2)', color: '#E67E50' }}
            >
              Admin
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" style={{ zIndex: 1 }}>
        {/* Section label */}
        <p
          className="px-3 pb-2 text-[9px] uppercase tracking-[0.22em] font-semibold f-body"
          style={{ color: 'rgba(255,255,255,0.18)' }}
        >
          Management
        </p>

        {NAV.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          const isCreateNew = item.href === '/admin/guides/new'

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all f-body"
              style={
                isCreateNew
                  ? {
                      background: isActive
                        ? 'rgba(230,126,80,0.18)'
                        : 'rgba(230,126,80,0.08)',
                      color: '#E67E50',
                      border: isActive
                        ? '1px solid rgba(230,126,80,0.25)'
                        : '1px solid rgba(230,126,80,0.12)',
                      marginTop: '6px',
                    }
                  : {
                      background: isActive ? 'rgba(230,126,80,0.1)' : 'transparent',
                      color: isActive ? '#E67E50' : 'rgba(255,255,255,0.45)',
                      border: isActive ? '1px solid rgba(230,126,80,0.15)' : '1px solid transparent',
                    }
              }
            >
              <span style={{ opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {/* New leads badge */}
              {item.href === '/admin/leads' && newLeadsCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full f-body leading-none"
                  style={{ background: '#E67E50', color: 'white', minWidth: '16px', textAlign: 'center' }}
                >
                  {newLeadsCount > 99 ? '99+' : newLeadsCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: sign out + back to site */}
      <div
        className="relative px-4 pb-5 pt-4"
        style={{ zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.06] mb-0.5"
            style={{ color: 'rgba(255,255,255,0.35)', cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            <IconLogout />
            Sign out
          </button>
        </form>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.04]"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          <IconArrowLeft />
          Back to site
        </Link>
      </div>
    </aside>
  )
}
