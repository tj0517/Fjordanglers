'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { Calendar, Compass, MessageSquare, ArrowLeft, LogOut } from 'lucide-react'

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: 'My Bookings',  href: '/account/bookings', icon: <Calendar      size={15} strokeWidth={1.5} /> },
  { label: 'My Requests',  href: '/account/trips',    icon: <MessageSquare size={15} strokeWidth={1.5} /> },
  { label: 'Browse Trips', href: '/trips',             icon: <Compass       size={15} strokeWidth={1.5} />, external: true },
] as const


const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountSidebar({ displayName }: { displayName: string }) {
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

      {/* Logo */}
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
        <p className="text-[10px] uppercase tracking-[0.22em] mt-1.5 f-body" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Angler Panel
        </p>
      </div>

      {/* Profile card */}
      <div
        className="relative px-4 py-3"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: '#0A2E4D', border: '2px solid rgba(230,126,80,0.35)' }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate f-body leading-tight">{displayName}</p>
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full mt-0.5 f-body"
              style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}
            >
              Angler
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" style={{ zIndex: 1 }}>
        {NAV.map((item) => {
          const isActive = pathname.startsWith(item.href) && !('external' in item && item.external)
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all f-body"
              style={{
                background: isActive ? 'rgba(230,126,80,0.1)' : 'transparent',
                color: isActive ? '#E67E50' : 'rgba(255,255,255,0.45)',
                border: isActive ? '1px solid rgba(230,126,80,0.15)' : '1px solid transparent',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
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
            <LogOut size={13} strokeWidth={1.5} />
            Sign out
          </button>
        </form>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.04]"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Back to site
        </Link>
      </div>
    </aside>
  )
}
