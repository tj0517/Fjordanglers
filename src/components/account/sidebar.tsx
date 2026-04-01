'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { Calendar, MessageSquare, ArrowLeft, LogOut, Compass } from 'lucide-react'

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: 'My Bookings',  href: '/account/bookings', icon: <Calendar      size={15} strokeWidth={1.5} /> },
  { label: 'My Requests',  href: '/account/trips',    icon: <MessageSquare size={15} strokeWidth={1.5} /> },
] as const


const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-3 px-4 h-14"
        style={{
          background: 'rgba(243,237,228,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.08)',
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl flex-shrink-0"
          style={{ background: mobileOpen ? 'rgba(230,126,80,0.12)' : 'rgba(10,46,77,0.07)' }}
        >
          {[
            { transform: mobileOpen ? 'translateY(6.5px) rotate(45deg)' : 'none' },
            { opacity: mobileOpen ? 0 : undefined, transform: mobileOpen ? 'scaleX(0)' : 'none' },
            { transform: mobileOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none' },
          ].map((s, i) => (
            <span
              key={i}
              className="block rounded-full transition-all duration-300 origin-center"
              style={{ width: '18px', height: '1.5px', background: '#0A2E4D', opacity: s.opacity ?? 0.7, transform: s.transform }}
            />
          ))}
        </button>

        {/* Logo */}
        <Link href="/">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={120} height={30} className="h-6 w-auto" />
        </Link>

        {/* Display name */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>{displayName}</span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 f-body"
            style={{ background: '#0A2E4D', border: '2px solid rgba(230,126,80,0.3)' }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
            const isActive = pathname.startsWith(item.href)
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

        {/* Bottom: browse trips + sign out + back to site */}
        <div
          className="relative px-4 pb-5 pt-4"
          style={{ zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <Link
            href="/trips"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.06] mb-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <Compass size={13} strokeWidth={1.5} />
            Browse Trips
          </Link>

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
    </>
  )
}
