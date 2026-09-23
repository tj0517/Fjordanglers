'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users, Map, MessageSquare, CalendarDays,
  Menu, X, ShieldCheck, BarChart2, Wallet, LogOut, TrendingUp, ClipboardList, BookOpen,
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
  { label: 'Weekly',       href: '/admin/weekly',      icon: <CalendarDays size={16} strokeWidth={1.6} /> },
  { label: 'Overview',     href: '/admin',             icon: <LayoutDashboard size={16} strokeWidth={1.6} />, exact: true },
  { label: 'Guides',       href: '/admin/guides',      icon: <Users size={16} strokeWidth={1.6} /> },
  { label: 'Experiences',  href: '/admin/experiences', icon: <Map size={16} strokeWidth={1.6} /> },
  { label: 'Inquiries',    href: '/admin/inquiries',   icon: <MessageSquare size={16} strokeWidth={1.6} /> },
  { label: 'Unmatched',    href: '/admin/inquiries/unmatched', icon: <MessageSquare size={14} strokeWidth={1.6} />, subItem: true },
  { label: 'Pipeline',     href: '/admin/pipeline',    icon: <TrendingUp size={16} strokeWidth={1.6} /> },
  { label: 'Ads',          href: '/admin/ads',         icon: <BarChart2 size={16} strokeWidth={1.6} /> },
  { label: 'Finances',     href: '/admin/finances',    icon: <Wallet size={16} strokeWidth={1.6} /> },
  { label: 'Forms',        href: '/admin/forms',       icon: <ClipboardList size={16} strokeWidth={1.6} /> },
  { label: 'Knowledge',    href: '/admin/knowledge',   icon: <BookOpen size={16} strokeWidth={1.6} /> },
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
        className={[
          'flex items-center gap-3 rounded-xl text-sm f-body transition-all no-underline',
          item.subItem ? 'py-2 pr-3 pl-8 text-[0.8125rem]' : 'py-2.5 px-3',
          active
            ? 'text-accent bg-accent/12 font-semibold'
            : item.subItem
              ? 'text-white/40'
              : 'text-white/55',
        ].join(' ')}
        aria-current={active ? 'page' : undefined}
      >
        <span className={active ? 'text-accent flex-shrink-0' : 'text-white/30 flex-shrink-0'}>
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
          className="f-display font-bold text-[19px] leading-none text-white no-underline"
        >
          Fjord<span className="text-accent">Anglers</span>
        </Link>
      </div>

      {/* Admin badge */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/12 border border-accent/20">
          <ShieldCheck size={14} strokeWidth={1.6} className="text-accent flex-shrink-0" />
          <span className="text-xs font-semibold f-body text-accent">Admin panel</span>
        </div>
      </div>

      <div className="h-px bg-white/8 mx-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* Back to site + Logout */}
      <div className="border-t border-white/8">
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm f-body text-white/35 no-underline transition-colors hover:text-white/60"
          >
            ← Back to site
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm f-body text-white/35 bg-transparent cursor-pointer transition-colors hover:text-white/60"
            >
              <LogOut size={14} strokeWidth={1.6} className="text-white/25 flex-shrink-0" />
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
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen bg-primary">
        {body}
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-primary">
        <Link
          href="/admin"
          className="f-display font-bold text-[17px] text-white no-underline"
        >
          Fjord<span className="text-accent">Anglers</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold f-body px-2 py-1 rounded-md bg-accent/15 text-accent">
            Admin
          </span>
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-xl text-white bg-white/8"
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
          <div className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col bg-primary shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <span className="f-display font-bold text-[19px] text-white">
                Fjord<span className="text-accent">Anglers</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/60 bg-white/8"
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
