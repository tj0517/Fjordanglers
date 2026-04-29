'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import {
  LayoutGrid, Users, Plus, Inbox, List, MessageSquare,
  ClipboardList, ArrowLeft, LogOut,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminSidebarProps = {
  adminName: string
  newLeadsCount?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Overview',          href: '/admin',                  icon: <LayoutGrid    size={15} strokeWidth={1.5} />, exact: true  },
  { label: 'Guides',            href: '/admin/guides',           icon: <Users         size={15} strokeWidth={1.5} />, exact: false },
  { label: 'Experiences',       href: '/admin/experiences',      icon: <List          size={15} strokeWidth={1.5} />, exact: false },
  { label: 'Submissions',       href: '/admin/submissions',      icon: <ClipboardList size={15} strokeWidth={1.5} />, exact: false },
  { label: 'Leads',             href: '/admin/leads',            icon: <Inbox         size={15} strokeWidth={1.5} />, exact: false },
  { label: 'Inquiries',         href: '/admin/inquiries',        icon: <MessageSquare size={15} strokeWidth={1.5} />, exact: false },
  { label: 'Add Guide Profile', href: '/admin/guides/new',       icon: <Plus          size={15} strokeWidth={1.5} />, exact: false },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSidebar({ adminName, newLeadsCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col w-14 lg:w-60"
      style={{
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
        className="relative px-3 lg:px-6 pt-5 pb-4"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Full logo — desktop only */}
        <Link href="/" className="hidden lg:block">
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={140}
            height={36}
            className="h-7 w-auto"
            style={{ opacity: 0.7 }}
          />
        </Link>
        {/* Icon dot — mobile only */}
        <Link href="/" className="lg:hidden flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full"
            style={{ background: '#E67E50', boxShadow: '0 0 8px rgba(230,126,80,0.5)' }}
          />
        </Link>
        <div className="hidden lg:flex items-center gap-2 mt-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] f-body" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Admin Panel
          </p>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#E67E50', boxShadow: '0 0 6px rgba(230,126,80,0.6)' }}
          />
        </div>
      </div>

      {/* Admin identity card — desktop only */}
      <div
        className="relative hidden lg:block px-4 py-3"
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
      <nav className="relative flex-1 px-2 lg:px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" style={{ zIndex: 1 }}>
        {/* Section label — desktop only */}
        <p
          className="hidden lg:block px-3 pb-2 text-[9px] uppercase tracking-[0.22em] font-semibold f-body"
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
              title={item.label}
              className="flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-3 py-2.5 rounded-xl text-sm font-medium transition-all f-body"
              style={
                isCreateNew
                  ? {
                      background: isActive ? 'rgba(230,126,80,0.18)' : 'rgba(230,126,80,0.08)',
                      color: '#E67E50',
                      border: isActive ? '1px solid rgba(230,126,80,0.25)' : '1px solid rgba(230,126,80,0.12)',
                      marginTop: '6px',
                    }
                  : {
                      background: isActive ? 'rgba(230,126,80,0.1)' : 'transparent',
                      color: isActive ? '#E67E50' : 'rgba(255,255,255,0.45)',
                      border: isActive ? '1px solid rgba(230,126,80,0.15)' : '1px solid transparent',
                    }
              }
            >
              <span style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }}>{item.icon}</span>
              <span className="hidden lg:block flex-1">{item.label}</span>
              {/* New leads badge — desktop only */}
              {item.href === '/admin/leads' && newLeadsCount > 0 && (
                <span
                  className="hidden lg:inline text-[9px] font-bold px-1.5 py-0.5 rounded-full f-body leading-none"
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
        className="relative px-2 lg:px-4 pb-5 pt-4"
        style={{ zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="w-full flex items-center justify-center lg:justify-start gap-2 px-0 lg:px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.06] mb-0.5"
            style={{ color: 'rgba(255,255,255,0.35)', cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            <LogOut size={13} strokeWidth={1.5} />
            <span className="hidden lg:block">Sign out</span>
          </button>
        </form>

        <Link
          href="/"
          title="Back to site"
          className="flex items-center justify-center lg:justify-start gap-2 px-0 lg:px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.04]"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          <span className="hidden lg:block">Back to site</span>
        </Link>
      </div>
    </aside>
  )
}
