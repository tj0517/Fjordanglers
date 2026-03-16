'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Trips', href: '/trips' },
  { label: 'Guides',      href: '/guides' },
]

export function ExperiencesNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef                = useRef<HTMLElement>(null)

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
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
        background: solid ? 'rgba(243,237,228,0.92)' : 'transparent',
        backdropFilter: solid ? 'blur(20px) saturate(1.6)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(20px) saturate(1.6)' : 'none',
        borderBottom: solid ? '1px solid rgba(10,46,77,0.08)' : '1px solid transparent',
        boxShadow: solid ? '0 1px 12px rgba(10,46,77,0.04)' : 'none',
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease',
      }}
    >
      <div>

        {/* Top bar */}
        <div className="flex items-center px-4 md:px-8 h-14 md:h-[88px]">

          {/* Logo */}
          <div className="flex-shrink-0 w-32 md:w-40">
            <Link href="/">
              <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={140} height={36} className="h-7 md:h-8 w-auto" priority />
            </Link>
          </div>

          {/* Search + filters — hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-3">
            {children}
          </div>

          {/* Join + Hamburger */}
          <div className="flex-1 md:flex-none flex items-center justify-end gap-3">
            <Link
              href="/guides/apply"
              className="hidden md:inline-flex text-[14px] font-semibold px-5 py-2 rounded-xl text-white f-body transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: '#E67E50' }}
            >
              Join as Guide
            </Link>
            <button
              onClick={() => setOpen(v => !v)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl transition-all duration-200"
              style={{ background: open ? 'rgba(230,126,80,0.15)' : 'rgba(10,46,77,0.08)' }}
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


        {/* Mobile search row */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-2">
          {children}
        </div>

        {/* Slide-down menu */}
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
                  style={{ color: 'rgba(10,46,77,0.65)' }}
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
                href="/guides/apply"
                onClick={() => setOpen(false)}
                className="text-[14px] font-semibold px-4 py-3 rounded-xl text-white text-center f-body transition-all hover:brightness-110"
                style={{ background: '#E67E50' }}
              >
                Join as Guide →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </nav>
  )
}
