'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Home',   href: '/' },
  { label: 'Trips',  href: '/trips' },
  { label: 'Guides', href: '/guides' },
  { label: 'Blog',   href: '/blog' },
  { label: 'About',  href: '/about' },
]

interface HomeNavProps {
  pinned?: boolean
  topOffset?: number
  initialVariant?: 'dark' | 'light'
}

export function HomeNav({ pinned = false, topOffset = 0, initialVariant = 'dark' }: HomeNavProps) {
  const [pastHero, setPastHero] = useState(false)
  const [open, setOpen]         = useState(false)
  const navRef                  = useRef<HTMLElement>(null)

  useEffect(() => {
    if (pinned) return
    const onScroll = () => setPastHero(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pinned])

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

  const solid    = pinned || pastHero || open
  // nav is always dark (navy) — transparent over hero, solid navy on scroll
  const linkColor  = 'rgba(255,255,255,0.82)'
  const pillBg     = solid ? 'rgba(255,255,255,0.10)' : 'rgba(4,10,20,0.38)'
  const pillBorder = 'rgba(255,255,255,0.12)'
  const pillBlur   = 'blur(20px) saturate(1.4)'

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 z-[1000]"
      style={{ top: `${topOffset}px` }}
    >
      {/* ── Bar background ────────────────────────────────────────────────────
          Transparent over hero → dark navy on scroll                          */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-0 pointer-events-none"
        style={{
          height: '90px',
          background: solid ? 'rgba(10,46,77,0.96)' : 'transparent',
          backdropFilter:       solid ? 'blur(24px) saturate(1.6)' : 'none',
          WebkitBackdropFilter: solid ? 'blur(24px) saturate(1.6)' : 'none',
          borderBottom: solid ? '1px solid rgba(255,255,255,0.08)' : 'none',
          boxShadow:    solid ? '0 4px 32px rgba(0,0,0,0.25)'      : 'none',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}
      />

      {/* ── Top bar content ──────────────────────────────────────────────────── */}
      <div className="h-[90px] px-4 md:px-8 lg:px-14 relative" style={{ zIndex: 1 }}>
        <div className="max-w-[1360px] mx-auto h-full relative flex items-center">

          {/* Logo — left, always white */}
          <Link href="/" className="flex-shrink-0 z-10">
            <Image
              src="/brand/white-logo.png"
              alt="FjordAnglers"
              width={160}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Nav links — absolutely centered, glass pill */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex">
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-full transition-all duration-500"
              style={{
                background:           pillBg,
                backdropFilter:       pillBlur,
                WebkitBackdropFilter: pillBlur,
                border:               `1px solid ${pillBorder}`,
              }}
            >
              {NAV_LINKS.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[16px] font-medium f-body px-4 py-1.5 rounded-full transition-colors hover:opacity-80"
                  style={{ color: linkColor }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Plan your trip CTA (always shown) + hamburger */}
          <div className="ml-auto flex items-center gap-3 z-10">
            <Link
              href="/plan-your-trip"
              className="hidden md:inline-flex items-center text-[13px] font-semibold px-5 py-2 rounded-full f-body transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: '#E67E50', color: '#fff' }}
            >
              Plan your trip →
            </Link>

            {/* Hamburger (mobile) */}
            <button
              onClick={() => setOpen(v => !v)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg transition-all duration-200"
              style={{
                background: open ? 'rgba(230,126,80,0.20)' : 'rgba(255,255,255,0.12)',
              }}
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
                    background: '#fff',
                    opacity: style.opacity ?? 0.8,
                    transform: style.transform,
                  }}
                />
              ))}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile slide-down menu ────────────────────────────────────────────── */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: open ? '400px' : '0px',
          background: 'rgba(248,244,238,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
          <div className="flex flex-col gap-1 pt-3 mb-3">
            {NAV_LINKS.map(item => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-[15px] font-medium px-4 py-2.5 rounded-xl f-body transition-all hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.65)' }}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
            <Link
              href="/plan-your-trip"
              onClick={() => setOpen(false)}
              className="block text-[14px] font-semibold px-4 py-3 rounded-xl text-white text-center f-body transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              Plan your trip →
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
