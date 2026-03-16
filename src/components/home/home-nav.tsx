'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Trips', href: '/trips' },
  { label: 'Guides',      href: '/guides' },
]

interface HomeNavProps {
  pinned?: boolean
  topOffset?: number
}

export function HomeNav({ pinned = false, topOffset = 0 }: HomeNavProps) {
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
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const solid = pinned || pastHero || open

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 z-50"
      style={{
        top: `${topOffset}px`,
        background: solid ? 'rgba(248,244,238,0.88)' : 'transparent',
        backdropFilter: solid ? 'blur(20px) saturate(1.6)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(20px) saturate(1.6)' : 'none',
        borderBottom: solid ? '1px solid rgba(10,46,77,0.08)' : '1px solid transparent',
        boxShadow: solid ? '0 4px 28px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 0.5s ease, backdrop-filter 0.5s ease, box-shadow 0.5s ease, border-color 0.5s ease',
      }}
    >
      <div className="overflow-hidden">
        {/* Top bar */}
        <div className="h-[72px] flex items-center justify-between px-6 md:px-10">

          <Link href="/" className="flex-shrink-0">
            <Image
              src={solid ? '/brand/dark-logo.png' : '/brand/white-logo.png'}
              alt="FjordAnglers"
              width={160}
              height={40}
              className="h-8 w-auto transition-all duration-300"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
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
              style={{
                background: open
                  ? 'rgba(230,126,80,0.15)'
                  : solid
                  ? 'rgba(10,46,77,0.08)'
                  : 'rgba(255,255,255,0.12)',
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
                    background: solid ? '#0A2E4D' : '#fff',
                    opacity: style.opacity ?? 0.8,
                    transform: style.transform,
                  }}
                />
              ))}
            </button>
          </div>
        </div>

        {/* Slide-down menu */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: open ? '400px' : '0px' }}
        >
          <div
            className="px-5 pb-5"
            style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
          >
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

            <div
              className="pt-3 flex flex-col gap-2"
              style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
            >
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
