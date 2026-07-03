'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users, Map, MessageSquare,
  Anchor, Menu, X, ShieldCheck, BarChart2, Wallet, LogOut,
} from 'lucide-react'
import { signOut } from '@/actions/auth'

// ─── Nav definitions ──────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  exact?: boolean
  subItem?: boolean
}

const navItems: NavItem[] = [
  { label: 'Overview',     href: '/admin',             icon: <LayoutDashboard size={16} strokeWidth={1.6} />, exact: true },
  { label: 'Guides',       href: '/admin/guides',      icon: <Users size={16} strokeWidth={1.6} /> },
  { label: 'Experiences',  href: '/admin/experiences', icon: <Map size={16} strokeWidth={1.6} /> },
  { label: 'Trips',        href: '/admin/trips',       icon: <Anchor size={16} strokeWidth={1.6} /> },
  { label: 'Inquiries',    href: '/admin/inquiries',   icon: <MessageSquare size={16} strokeWidth={1.6} /> },
  { label: 'Unmatched',   href: '/admin/inquiries/unmatched', icon: <MessageSquare size={14} strokeWidth={1.6} />, subItem: true },
  { label: 'Ads',          href: '/admin/ads',         icon: <BarChart2 size={16} strokeWidth={1.6} /> },
  { label: 'Finances',     href: '/admin/finances',    icon: <Wallet size={16} strokeWidth={1.6} /> },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidenav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item)
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-xl text-sm f-body transition-all"
        style={{
          paddingLeft:    item.subItem ? '2rem' : '0.75rem',
          paddingRight:   '0.75rem',
          paddingTop:     item.subItem ? '0.5rem' : '0.625rem',
          paddingBottom:  item.subItem ? '0.5rem' : '0.625rem',
          color:          active ? '#E67E50' : item.subItem ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)',
          background:     active ? 'rgba(230,126,80,0.12)' : 'transparent',
          fontWeight:     active ? 600 : 400,
          fontSize:       item.subItem ? '0.8125rem' : undefined,
          textDecoration: 'none',
        }}
      >
        <span style={{ color: active ? '#E67E50' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          {item.icon}
        </span>
        {item.label}
      </Link>
    )
  }

  // ── Shared sidebar body ─────────────────────────────────────────────────────
  const body = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/"
          className="f-display font-bold text-[19px] leading-none"
          style={{ color: '#fff', textDecoration: 'none' }}
        >
          Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
        </Link>
      </div>

      {/* Admin badge */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(230,126,80,0.12)', border: '1px solid rgba(230,126,80,0.2)' }}
        >
          <ShieldCheck size={14} strokeWidth={1.6} style={{ color: '#E67E50', flexShrink: 0 }} />
          <span className="text-xs font-semibold f-body" style={{ color: '#E67E50' }}>Admin panel</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* Back to site + Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm f-body transition-all"
            style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
          >
            ← Back to site
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm f-body transition-all"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'transparent', cursor: 'pointer' }}
            >
              <LogOut size={14} strokeWidth={1.6} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen"
        style={{ background: '#0A2E4D' }}
      >
        {body}
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: '#0A2E4D' }}
      >
        <Link
          href="/admin"
          className="f-display font-bold text-[17px]"
          style={{ color: '#fff', textDecoration: 'none' }}
        >
          Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold f-body px-2 py-1 rounded-md" style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}>
            Admin
          </span>
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-xl"
            style={{ color: '#fff', background: 'rgba(255,255,255,0.08)' }}
            aria-label="Open navigation"
          >
            <Menu size={18} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col"
            style={{ background: '#0A2E4D', boxShadow: '4px 0 24px rgba(0,0,0,0.3)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="f-display font-bold text-[19px]" style={{ color: '#fff' }}>
                Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)' }}
                aria-label="Close navigation"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </div>
            {body}
          </div>
        </>
      )}
    </>
  )
}
