'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/actions/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavUser = {
  name: string | null
  role: 'admin' | 'guide' | 'angler'
  avatarUrl: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LINKS = [
  ['/', 'Home'],
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/about', 'About'],
] as const

function getDashboard(role: NavUser['role']): { href: string; label: string } | null {
  if (role === 'guide')  return { href: '/dashboard', label: 'My dashboard' }
  if (role === 'admin')  return { href: '/admin',     label: 'Admin panel'  }
  return null // angler — no dedicated dashboard yet
}

// ─── UserMenu (desktop dropdown) ──────────────────────────────────────────────

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const initial   = user.name?.charAt(0).toUpperCase() ?? '?'
  const dashboard = getDashboard(user.role)

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        style={{
          width: '42px', height: '42px',
          borderRadius: '50%',
          background: open ? 'rgba(230,126,80,0.18)' : 'rgba(8,18,38,0.72)',
          border: `1px solid ${open ? 'rgba(230,126,80,0.5)' : 'rgba(255,255,255,0.18)'}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name ?? 'Account'}
            width={42}
            height={42}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        ) : (
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)', lineHeight: 1 }}>
            {initial}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            minWidth: '200px',
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.1)',
            borderRadius: '18px',
            boxShadow: '0 8px 36px rgba(4,12,22,0.18)',
            padding: '8px',
            zIndex: 100,
          }}
        >
          {/* Identity */}
          <div style={{ padding: '10px 12px 12px' }}>
            <p className="f-body" style={{ color: '#0A2E4D', fontSize: '14px', fontWeight: 600, margin: 0 }}>
              {user.name ?? 'Account'}
            </p>
            <p className="f-body" style={{ color: 'rgba(10,46,77,0.45)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '2px 0 0' }}>
              {user.role}
            </p>
          </div>

          <div style={{ height: 1, background: 'rgba(10,46,77,0.08)', margin: '0 4px 4px' }} />

          {/* Dashboard / admin link */}
          {dashboard && (
            <Link
              href={dashboard.href}
              onClick={() => setOpen(false)}
              className="f-body"
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: '12px',
                textDecoration: 'none',
                color: '#0A2E4D',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {dashboard.label}
            </Link>
          )}

          {/* Sign out */}
          <div style={{ height: 1, background: 'rgba(10,46,77,0.08)', margin: '4px 4px 4px' }} />
          <form action={signOut}>
            <button
              type="submit"
              className="f-body"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(10,46,77,0.5)',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'block',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── SiteNav ──────────────────────────────────────────────────────────────────

export function SiteNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname()
  const isHome           = pathname === '/'
  const isExperiencePage = pathname.startsWith('/experiences/')

  const [scrolled,  setScrolled]  = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const lastScrollY      = useRef(0)
  const isExperienceRef  = useRef(isExperiencePage)
  isExperienceRef.current = isExperiencePage

  // Reset when leaving experience pages
  useEffect(() => {
    if (!isExperiencePage) {
      setNavHidden(false)
      lastScrollY.current = 0
    }
  }, [isExperiencePage])

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)

      if (isExperienceRef.current) {
        const goingDown = y > lastScrollY.current

        if (goingDown && y > 80) {
          setNavHidden(true)
          setMenuOpen(false)
        } else if (y <= 80) {
          setNavHidden(false)
        }
      }

      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const hasBg     = !isHome || scrolled
  const navBg     = hasBg ? 'rgba(6,16,34,0.95)' : 'transparent'
  const navBorder = hasBg ? 'rgba(255,255,255,0.08)' : 'transparent'

  const dashboard = user ? getDashboard(user.role) : null

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 50,
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: navBg,
          borderBottom: `1px solid ${navBorder}`,
          backdropFilter: hasBg ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: hasBg ? 'blur(16px)' : 'none',
          transform: navHidden ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={148}
            height={34}
            style={{ objectFit: 'contain', objectPosition: 'left center' }}
            priority
          />
        </Link>

        {/* Center pill — desktop only */}
        <div
          className="nav-pill"
          style={{
            alignItems: 'center',
            gap: '4px',
            padding: '6px 8px',
            borderRadius: '9999px',
            background: 'rgba(8,18,38,0.72)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="f-body text-[14px] font-medium transition-opacity hover:opacity-70"
              style={{ color: '#fff', textDecoration: 'none', padding: '6px 16px', borderRadius: '9999px', whiteSpace: 'nowrap' }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* CTA — desktop */}
          <Link
            href="/trips"
            className="nav-cta f-body text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#E67E50', color: '#fff', textDecoration: 'none', padding: '10px 22px', borderRadius: '9999px', whiteSpace: 'nowrap' }}
          >
            Explore trips →
          </Link>

          {/* User icon — desktop, logged-in only */}
          {user && (
            <div className="nav-cta">
              <UserMenu user={user} />
            </div>
          )}

          {/* Hamburger — mobile */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            style={{
              background: 'rgba(8,18,38,0.72)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '10px',
              width: '42px',
              height: '42px',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="16" y2="16"/>
                <line x1="16" y1="2" x2="2" y2="16"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="5" x2="16" y2="5"/>
                <line x1="2" y1="9" x2="16" y2="9"/>
                <line x1="2" y1="13" x2="16" y2="13"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            position: 'fixed',
            top: '72px',
            left: 0,
            right: 0,
            zIndex: 49,
            background: 'rgba(6,16,34,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '16px 16px 20px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="f-body text-[16px] font-medium transition-opacity hover:opacity-70"
                style={{ color: '#fff', textDecoration: 'none', padding: '12px 8px', borderRadius: '8px' }}
              >
                {label}
              </Link>
            ))}
          </div>

          <Link
            href="/trips"
            onClick={() => setMenuOpen(false)}
            className="f-body text-[15px] font-semibold text-center block transition-opacity hover:opacity-90"
            style={{ background: '#E67E50', color: '#fff', textDecoration: 'none', padding: '14px', borderRadius: '12px' }}
          >
            Explore trips →
          </Link>

          {/* Logged-in section — mobile */}
          {user && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0 12px' }} />

              {/* Dashboard / admin link */}
              {dashboard && (
                <Link
                  href={dashboard.href}
                  onClick={() => setMenuOpen(false)}
                  className="f-body text-[15px] font-semibold text-center block transition-opacity hover:opacity-90"
                  style={{
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    textDecoration: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    marginBottom: '8px',
                  }}
                >
                  {dashboard.label}
                </Link>
              )}

              {/* Sign out */}
              <form action={signOut}>
                <button
                  type="submit"
                  className="f-body text-[14px] font-medium w-full transition-opacity hover:opacity-70"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    padding: '10px 8px',
                    textAlign: 'center',
                    width: '100%',
                    display: 'block',
                  }}
                >
                  Sign out — {user.name ?? user.role}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
