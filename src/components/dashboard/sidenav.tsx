'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, Anchor, CalendarDays, MessageSquare,
  Image as ImageIcon, BedDouble, User, Settings, Menu, X,
} from 'lucide-react'

// ─── Nav definitions ──────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  exact?: boolean
}

const mainItems: NavItem[] = [
  { label: 'Overview',      href: '/dashboard',              icon: <LayoutDashboard size={16} strokeWidth={1.6} />, exact: true },
  { label: 'Bookings',      href: '/dashboard/bookings',     icon: <Inbox size={16} strokeWidth={1.6} /> },
  { label: 'Trips',         href: '/dashboard/trips',        icon: <Anchor size={16} strokeWidth={1.6} /> },
  { label: 'Calendar',      href: '/dashboard/calendar',     icon: <CalendarDays size={16} strokeWidth={1.6} /> },
  { label: 'Inquiries',     href: '/dashboard/inquiries',    icon: <MessageSquare size={16} strokeWidth={1.6} /> },
]

const contentItems: NavItem[] = [
  { label: 'Photos',          href: '/dashboard/photos',         icon: <ImageIcon size={16} strokeWidth={1.6} /> },
  { label: 'Accommodations',  href: '/dashboard/accommodations', icon: <BedDouble size={16} strokeWidth={1.6} /> },
]

const bottomItems: NavItem[] = [
  { label: 'Profile',   href: '/dashboard/profile',  icon: <User size={16} strokeWidth={1.6} /> },
  { label: 'Settings',  href: '/dashboard/account',  icon: <Settings size={16} strokeWidth={1.6} /> },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  guideName: string
  avatarUrl: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardSidenav({ guideName, avatarUrl }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const firstName = (guideName ?? '').split(' ')[0] || 'Guide'

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item)
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm f-body transition-all"
        style={{
          color:      active ? '#E67E50' : 'rgba(10,46,77,0.55)',
          background: active ? 'rgba(230,126,80,0.08)' : 'transparent',
          fontWeight: active ? 600 : 500,
          textDecoration: 'none',
        }}
      >
        <span style={{ color: active ? '#E67E50' : 'rgba(10,46,77,0.38)', flexShrink: 0 }}>
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
          style={{ color: '#0A2E4D', textDecoration: 'none' }}
        >
          Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
        </Link>
      </div>

      {/* Guide identity chip */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(10,46,77,0.05)' }}
        >
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold f-body"
            style={{ background: 'rgba(10,46,77,0.12)', color: '#0A2E4D' }}
          >
            {avatarUrl
              ? <Image src={avatarUrl} alt={guideName} width={32} height={32} className="w-full h-full object-cover" />
              : firstName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
              {guideName || 'Guide'}
            </p>
            <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>Guide account</p>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(10,46,77,0.07)' }} />

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {mainItems.map(item => <NavLink key={item.href} item={item} />)}

        <div style={{ height: 1, background: 'rgba(10,46,77,0.07)', margin: '8px 4px' }} />

        {contentItems.map(item => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* Bottom nav */}
      <div style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
        <div className="px-3 py-3 flex flex-col gap-0.5">
          {bottomItems.map(item => <NavLink key={item.href} item={item} />)}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen"
        style={{ background: '#FDFAF7', borderRight: '1px solid rgba(10,46,77,0.09)' }}
      >
        {body}
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: '#F3EDE4', borderBottom: '1px solid rgba(10,46,77,0.09)' }}
      >
        <Link
          href="/dashboard"
          className="f-display font-bold text-[17px]"
          style={{ color: '#0A2E4D', textDecoration: 'none' }}
        >
          Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl"
          style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.06)' }}
          aria-label="Open navigation"
        >
          <Menu size={18} strokeWidth={1.6} />
        </button>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/25"
            onClick={() => setOpen(false)}
          />
          <div
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col"
            style={{ background: '#FDFAF7', boxShadow: '4px 0 24px rgba(10,46,77,0.12)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
            >
              <span className="f-display font-bold text-[19px]" style={{ color: '#0A2E4D' }}>
                Fjord<span style={{ color: '#E67E50' }}>Anglers</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ color: '#0A2E4D', background: 'rgba(10,46,77,0.06)' }}
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
