'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface TripDetailNavProps {
  backHref?: string
}

export function TripDetailNav({ backHref = '/trips' }: TripDetailNavProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid    = scrolled
  const linkColor = solid ? 'rgba(10,46,77,0.65)' : 'rgba(255,255,255,0.85)'

  return (
    <nav
      className="absolute md:fixed top-0 inset-x-0 z-[100]"
      style={{
        height: '72px',
        background: solid ? 'rgba(10,46,77,0.96)' : 'transparent',
        backdropFilter: solid ? 'blur(24px) saturate(1.6)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(24px) saturate(1.6)' : 'none',
        borderBottom: solid ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        boxShadow: solid ? '0 4px 32px rgba(0,0,0,0.25)' : 'none',
        transition: 'background 0.45s ease, backdrop-filter 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease',
      }}
    >
      <div className="h-full px-4 md:px-8 lg:px-14">
        <div className="max-w-[1360px] mx-auto h-full relative flex items-center">

          {/* Left: back button */}
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-60 f-body flex-shrink-0 z-10"
            style={{
              color: 'rgba(255,255,255,0.85)',
              textShadow: solid ? 'none' : '0 1px 8px rgba(0,0,0,0.4)',
              transition: 'color 0.3s ease',
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            <span className="hidden md:inline">Back</span>
          </Link>

          {/* Center: logo (desktop) / signet (mobile) */}
          <div className="absolute left-1/2 -translate-x-1/2">
            {/* Desktop: full logo */}
            <Link href="/" className="hidden md:block">
              <Image
                src={solid ? '/brand/dark-logo.png' : '/brand/white-logo.png'}
                alt="FjordAnglers"
                width={130}
                height={32}
                className="h-7 w-auto"
                style={{ transition: 'opacity 0.3s ease' }}
              />
            </Link>
            {/* Mobile: signet */}
            <Link href="/" className="md:hidden">
              <Image
                src="/brand/sygnet.png"
                alt="FjordAnglers"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Right: Plan your trip CTA (desktop) */}
          <div className="ml-auto z-10">
            <Link
              href="/plan-your-trip"
              className="hidden md:inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-lg text-white f-body transition-all hover:opacity-90 active:scale-[0.97]"
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
