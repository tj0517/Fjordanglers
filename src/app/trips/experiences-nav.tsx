'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Home',   href: '/' },
  { label: 'Trips',  href: '/trips' },
  { label: 'Guides', href: '/guides' },
  { label: 'Blog',   href: '/blog' },
  { label: 'About',  href: '/about' },
]

export function ExperiencesNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen]         = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef                  = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const sync = () =>
      document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const solid = scrolled || open

  return (
    <nav
      ref={navRef}
      className="fixed top-0 inset-x-0 z-[1100]"
      style={{
        background: 'rgba(10,46,77,0.96)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: solid ? '0 4px 32px rgba(0,0,0,0.25)' : 'none',
        transition: 'box-shadow 0.4s ease',
      }}
    >
      <div>
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="h-[72px] px-4 md:px-8 lg:px-14">
          <div className="max-w-[1360px] mx-auto h-full relative flex items-center">

            {/* Logo — left */}
            <Link href="/" className="flex-shrink-0 z-10">
              <Image src="/brand/white-logo.png" alt="FjordAnglers" width={140} height={36} className="h-8 w-auto" priority />
            </Link>

            {/* Center: nav links (desktop) */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-8">
              {NAV_LINKS.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[16px] font-medium f-body transition-colors"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right: Plan your trip + hamburger */}
            <div className="ml-auto flex items-center gap-3 z-10">
              <Link
                href="/plan-your-trip"
                className="hidden md:inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-lg text-white f-body transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ background: '#E67E50' }}
              >
                Plan your trip →
              </Link>

              {/* Hamburger (mobile) */}
              <button
                onClick={() => setOpen(v => !v)}
                className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg transition-all duration-200"
                style={{ background: open ? 'rgba(230,126,80,0.20)' : 'rgba(255,255,255,0.10)' }}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                {[
                  { transform: open ? 'translateY(6.5px) rotate(45deg)' : 'none' },
                  { opacity: open ? 0 : undefined, transform: open ? 'scaleX(0)' : 'none' },
                  { transform: open ? 'translateY(-6.5px) rotate(-45deg)' : 'none' },
                ].map((style, i) => (
                  <span
                    key={i}
                    className="block rounded-full transition-all duration-300 origin-center"
                    style={{
                      width: '18px',
                      height: '1.5px',
                      background: '#0A2E4D',
                      opacity: style.opacity ?? 0.8,
                      transform: style.transform,
                    }}
                  />
                ))}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search row */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-2">
          {children}
        </div>

        {/* Desktop search row (below top bar) */}
        <div className="hidden md:block px-4 md:px-8 lg:px-14 pb-3">
          <div className="max-w-[1360px] mx-auto flex items-center gap-3">
            {children}
          </div>
        </div>

        {/* Slide-down mobile menu */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: open ? '400px' : '0px' }}
        >
          <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
            <div className="flex flex-col gap-1 pt-3 mb-3">
              {NAV_LINKS.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-[15px] font-medium px-4 py-2.5 rounded-xl f-body transition-all hover:bg-[#0A2E4D]/[0.06]"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-[14px] font-medium px-4 py-2.5 rounded-xl f-body text-center transition-all hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.5)' }}
              >
                Sign in
              </Link>
              <Link
                href="/plan-your-trip"
                onClick={() => setOpen(false)}
                className="text-[14px] font-semibold px-4 py-3 rounded-xl text-white text-center f-body transition-all hover:brightness-110"
                style={{ background: '#E67E50' }}
              >
                Plan your trip →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </nav>
  )
}
