'use client'

/**
 * The public site's navigation (2026-11 redesign, docs/design/blog-hubs-2026-11): a floating cream
 * bar with the logo, three links and "Plan your trip", pinned to the top of every page, in one row
 * that fits the 72 px the pages without a photo hero leave for it (tj, 2026-11-17). On a page that
 * opens on a framed photo hero (home, hubs, guides) the bar starts a little further down, over the
 * photo (nav.module.css, tj 2026-11-20).
 *
 * Scrolled past the top, the bar narrows — same height — and the three links move into the menu
 * button; "Plan your trip" stays in the bar, on the right (tj, 2026-11-20). Back at the top they return.
 * Below `md` the bar always holds just the logo and the menu button (tj, 2026-11-17). The menu
 * closes on Escape (focus goes back to the button), on a link click and on navigation — it
 * remembers the path it was opened on, so a new path closes it without an effect.
 *
 * Links only to pages that exist: the mockup's "Destinations" and "About" have no page yet. There
 * is no account menu (tj, 2026-11-17); a guide signs in from the footer.
 */

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Arrow, CREAM, LINE, NAVY } from '@/components/site/ui'
import s from '@/components/site/grain.module.css'
import n from './nav.module.css'
import b from '@/components/site/buttons.module.css'

const LINKS = [
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/blog', 'Journal'],
] as const

/** Every "Plan your trip" on the site leads to the trip list (tj, 2026-11-17). */
export const PLAN_YOUR_TRIP_HREF = '/trips'

/** `className` carries the display (`hidden md:inline-flex`, `flex`) — the base has none, so the two never fight. */
function PlanYourTrip({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <Link
      href={PLAN_YOUR_TRIP_HREF}
      onClick={onClick}
      className={`${s.blur} ${s.fjord} ${b.btn} ${b.pill} flex-none items-center justify-center rounded-full ${className}`}
      style={{ textDecoration: 'none' }}
    >
      <span className="f-body inline-flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold" style={{ color: '#FFFFFF' }}>
        Plan your trip<Arrow />
      </span>
    </Link>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open
        ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>
        : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
    </svg>
  )
}

/** Scroll offsets at which the bar shrinks and grows back — apart, so it does not flicker in between. */
const SHRINK_AT = 64
const GROW_AT = 24

/** Width and opacity ease together; reduced motion switches the easing off. */
const EASE = 'transition-all duration-300 ease-out motion-reduce:transition-none'

export function SiteNav() {
  const pathname = usePathname()
  const [openOn, setOpenOn] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const open = openOn != null && openOn === pathname
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpenOn(null)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        setCompact(was => {
          const next = was ? y > GROW_AT : y > SHRINK_AT
          // Back at the top on a wide screen the links return to the bar, so the menu has nothing left to show.
          if (was && !next && window.matchMedia('(min-width: 768px)').matches) setOpenOn(null)
          return next
        })
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const close = () => setOpenOn(null)

  return (
    <header
      className={`${n.header} fixed inset-x-0 top-0 z-50 px-3 sm:px-7 ${EASE}`}
      data-compact={compact || undefined}
    >
      <div
        className={`mx-auto ${EASE}`}
        style={{
          maxWidth: compact ? 920 : 1240, borderRadius: 30, background: CREAM,
          border: `1px solid ${LINE}`,
          boxShadow: compact ? '0 12px 32px rgba(10,46,77,.14)' : '0 10px 30px rgba(10,46,77,.07)',
        }}
      >
        <div className="flex items-center" style={{ padding: '8px 8px 8px 20px' }}>
          <Link href="/" aria-label="FjordAnglers home" className="inline-flex min-h-[44px] flex-none items-center">
            <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={143} height={28} priority style={{ height: 28, width: 'auto' }} />
          </Link>
          <nav
            aria-label="Main"
            className={`hidden min-w-0 flex-1 items-center justify-center gap-x-1 overflow-hidden px-5 md:flex ${EASE}`}
            style={compact
              ? { maxWidth: 0, paddingLeft: 0, paddingRight: 0, opacity: 0, visibility: 'hidden' }
              : { maxWidth: 1240, opacity: 1, visibility: 'visible' }}
            aria-hidden={compact || undefined}
            data-testid="site-nav-links"
          >
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`${b.navLink} f-body inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-[14px] text-[15px] font-semibold`}
                style={{ color: NAVY, textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex flex-none items-center">
            <PlanYourTrip className="hidden min-h-[44px] px-5 md:inline-flex" />
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpenOn(open ? null : pathname)}
              className={`${b.icon} inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full ${EASE} ${
                compact ? 'md:ml-2' : 'md:invisible md:w-0 md:border-transparent md:opacity-0'
              }`}
              style={{ color: NAVY, border: `1px solid ${LINE}`, background: 'transparent' }}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
        <nav
          id={menuId}
          aria-label="Menu"
          hidden={!open}
          className={`flex-col gap-1 px-3 pb-3 ${compact ? '' : 'md:hidden'}`}
          style={{ display: open ? 'flex' : 'none' }}
          data-testid="site-nav-menu"
        >
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              className={`${b.navLink} f-body flex min-h-[48px] items-center rounded-2xl px-4 text-[16px] font-semibold`}
              style={{ color: NAVY, textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
          {/* On a wide screen "Plan your trip" never leaves the bar, so the menu holds only the links there. */}
          <PlanYourTrip className="mt-1 flex min-h-[48px] w-full px-6 md:hidden" onClick={close} />
        </nav>
      </div>
    </header>
  )
}
