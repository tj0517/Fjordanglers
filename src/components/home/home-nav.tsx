'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User as UserIcon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS = [
  { label: 'Trips', href: '/trips' },
  { label: 'Guides', href: '/guides' },
]

interface HomeNavProps {
  pinned?: boolean
  topOffset?: number
  /** Controls colors when nav is transparent (top of page, not scrolled).
   *  'dark'  = white logo + white lines (use over dark hero images — default)
   *  'light' = dark logo + dark lines (use over light-background pages)
   */
  initialVariant?: 'dark' | 'light'
}

export function HomeNav({ pinned = false, topOffset = 0, initialVariant = 'dark' }: HomeNavProps) {
  const [pastHero, setPastHero] = useState(false)
  const [open, setOpen]         = useState(false)
  const [user, setUser]         = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [guideAvatarUrl, setGuideAvatarUrl] = useState<string | null>(null)
  const navRef                  = useRef<HTMLElement>(null)

  // ── Auth state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    // Get current session — set authLoaded=true only after we know the state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoaded(true)
      // Fetch guide avatar if user is a guide
      if (data.user?.user_metadata?.role === 'guide') {
        supabase.from('guides').select('avatar_url').eq('user_id', data.user.id).maybeSingle()
          .then(({ data: g }) => { if (g?.avatar_url) setGuideAvatarUrl(g.avatar_url) })
      }
    }).catch(() => { setAuthLoaded(true) })

    // Keep in sync on sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoaded(true)
    })

    return () => { subscription.unsubscribe() }
  }, [])

  // ── Scroll + keyboard + outside click ──────────────────────────────────────
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

  const solid    = pinned || pastHero || open
  const showDark = solid || initialVariant === 'light'

  // Initials for avatar bubble (first letter of name or email)
  const initials = user
    ? ((user.user_metadata?.full_name as string | undefined) ?? user.email ?? '?')[0].toUpperCase()
    : ''

  // Route to the right area based on role
  const role     = (user?.user_metadata?.role as string | undefined) ?? ''
  const dashHref = role === 'admin' ? '/admin' : role === 'guide' ? '/dashboard' : '/account/bookings'

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
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="h-[72px] flex items-center px-4 md:px-8 lg:px-14">
          <div className="max-w-[1360px] mx-auto w-full flex items-center justify-between">

          <Link href="/" className="flex-shrink-0">
            <Image
              src={showDark ? '/brand/dark-logo.png' : '/brand/white-logo.png'}
              alt="FjordAnglers"
              width={160}
              height={40}
              className="h-8 w-auto transition-all duration-300"
              priority
            />
          </Link>

          <div className="flex items-center gap-2">

            {/* ── Auth loading skeleton ──────────────────────────────────── */}
            {!authLoaded && (
              <div
                className="hidden md:block w-24 h-8 rounded-xl animate-pulse"
                style={{ background: showDark ? 'rgba(10,46,77,0.08)' : 'rgba(255,255,255,0.1)' }}
              />
            )}

            {/* ── Logged-out: Join as Guide CTA ─────────────────────────── */}
            {authLoaded && user == null && (
              <Link
                href="/guides/apply"
                className="hidden md:inline-flex text-[14px] font-semibold px-5 py-2 rounded-xl text-white f-body transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: '#E67E50' }}
              >
                Join as Guide
              </Link>
            )}

            {/* ── Logged-in: avatar bubble → dashboard ──────────────────── */}
            {authLoaded && user != null && (
              <Link
                href={dashHref}
                title={role === 'guide' ? 'Go to dashboard' : 'My account'}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl overflow-hidden transition-all hover:brightness-95 active:scale-[0.96] flex-shrink-0"
                style={{
                  background: showDark ? '#0A2E4D' : 'rgba(255,255,255,0.18)',
                }}
              >
                {guideAvatarUrl != null ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guideAvatarUrl} alt={initials} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-[13px] f-body" style={{ color: '#fff', letterSpacing: '0.02em' }}>
                    {initials}
                  </span>
                )}
              </Link>
            )}

            {/* ── Hamburger ─────────────────────────────────────────────── */}
            <button
              onClick={() => setOpen(v => !v)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-xl transition-all duration-200"
              style={{
                background: open
                  ? 'rgba(230,126,80,0.15)'
                  : showDark
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
                    background: showDark ? '#0A2E4D' : '#fff',
                    opacity: style.opacity ?? 0.8,
                    transform: style.transform,
                  }}
                />
              ))}
            </button>
          </div>
          </div>
        </div>

        {/* ── Slide-down menu ─────────────────────────────────────────────── */}
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
              {/* Loading skeleton for mobile menu */}
              {!authLoaded && (
                <div
                  className="h-11 rounded-xl animate-pulse"
                  style={{ background: 'rgba(10,46,77,0.07)' }}
                />
              )}

              {authLoaded && user == null && (
                <>
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
                </>
              )}

              {authLoaded && user != null && (
                <Link
                  href={dashHref}
                  onClick={() => setOpen(false)}
                  className="text-[14px] font-semibold px-4 py-3 rounded-xl text-white text-center f-body transition-all hover:brightness-110 flex items-center justify-center gap-2"
                  style={{ background: '#0A2E4D' }}
                >
                  <UserIcon size={15} strokeWidth={1.5} aria-hidden="true" />
                  {role === 'guide' ? 'My Dashboard' : 'My Account'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
