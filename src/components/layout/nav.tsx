'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const LINKS = [
  ['/', 'Home'],
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/about', 'About'],
] as const

export function SiteNav() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Homepage: transparent at top, dark on scroll. Every other page: always dark.
  const hasBg     = !isHome || scrolled
  const navBg     = hasBg ? 'rgba(6,16,34,0.95)' : 'transparent'
  const navBorder = hasBg ? 'rgba(255,255,255,0.08)' : 'transparent'

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
          transition: 'background 0.3s ease, border-color 0.3s ease',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* CTA — desktop */}
          <Link
            href="/trips"
            className="nav-cta f-body text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#E67E50', color: '#fff', textDecoration: 'none', padding: '10px 22px', borderRadius: '9999px', whiteSpace: 'nowrap' }}
          >
            Explore trips →
          </Link>

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
        </div>
      )}
    </>
  )
}
