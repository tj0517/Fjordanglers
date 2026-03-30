'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface TripDetailNavProps {
  backHref?: string
}

/**
 * Fixed nav for /trips/[id].
 * Transparent + white logo over the dark hero → solid cream + dark logo on scroll.
 */
export function TripDetailNav({ backHref = '/trips' }: TripDetailNavProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 inset-x-0 z-[100] flex items-center px-6 md:px-10"
      style={{
        height: '72px',
        background: scrolled ? 'rgba(248,244,238,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.6)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.6)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(10,46,77,0.08)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 28px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 0.45s ease, backdrop-filter 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease',
      }}
    >
      {/* Back button */}
      <Link
        href={backHref}
        className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-60 f-body"
        style={{
          color: scrolled ? 'rgba(10,46,77,0.65)' : 'rgba(255,255,255,0.85)',
          transition: 'color 0.3s ease',
        }}
      >
        <ArrowLeft size={16} strokeWidth={2.2} />
        Back
      </Link>

      {/* Logo — centred */}
      <div className="flex-1 flex justify-center">
        <Link href="/">
          <Image
            src={scrolled ? '/brand/dark-logo.png' : '/brand/white-logo.png'}
            alt="FjordAnglers"
            width={130}
            height={32}
            className="h-7 w-auto"
            style={{ transition: 'opacity 0.3s ease' }}
          />
        </Link>
      </div>

      {/* Spacer to keep logo truly centred */}
      <div style={{ width: '72px' }} aria-hidden="true" />
    </nav>
  )
}
