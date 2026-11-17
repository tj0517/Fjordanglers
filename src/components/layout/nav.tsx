'use client'

/**
 * The public site's navigation (2026-11 redesign, docs/design/blog-hubs-2026-11): a floating cream
 * bar with the logo, three links and "Plan your trip".
 *
 *   overlay — the hub: the bar sits on the hero photo and scrolls away with the page.
 *   default — every other page: the bar is pinned to the top in one row that fits the 72 px those
 *             pages leave for it (tj, 2026-11-17).
 *
 * Below `md`, on every page, the bar holds the logo and a menu button; the links and "Plan your
 * trip" move into the menu (tj, 2026-11-17). The menu closes on Escape (focus goes back to the
 * button), on a link click and on navigation — it remembers the path it was opened on, so a new
 * path closes it without an effect.
 *
 * Links only to pages that exist: the mockup's "Destinations" and "About" have no page yet. There
 * is no account menu (tj, 2026-11-17); a guide signs in from the footer.
 */

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Arrow, CREAM, LINE, NAVY } from '@/components/destination-hub/hub-ui'
import s from '@/components/destination-hub/hub.module.css'

const LINKS = [
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/blog', 'Journal'],
] as const

/** Every "Plan your trip" on the site leads to the trip list (tj, 2026-11-17). */
export const PLAN_YOUR_TRIP_HREF = '/trips'

function PlanYourTrip({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <Link
      href={PLAN_YOUR_TRIP_HREF}
      onClick={onClick}
      className={`${s.blur} ${s.fjord} inline-flex flex-none items-center justify-center rounded-full ${className}`}
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

export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname()
  const [openOn, setOpenOn] = useState<string | null>(null)
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

  const close = () => setOpenOn(null)

  return (
    <header
      className={overlay
        ? 'absolute inset-x-0 top-0 z-[5] px-4 pt-6 sm:px-7 sm:pt-7'
        : 'fixed inset-x-0 top-0 z-50 px-3 pt-[6px] sm:px-7'}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 1240, borderRadius: 30, background: CREAM,
          border: `1px solid ${LINE}`, boxShadow: '0 10px 30px rgba(10,46,77,.07)',
        }}
      >
        <div
          className="flex items-center justify-between gap-x-5"
          style={{ padding: overlay ? '8px 8px 8px 24px' : '8px 8px 8px 20px' }}
        >
          <Link href="/" aria-label="FjordAnglers home" className="inline-flex min-h-[44px] flex-none items-center">
            <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={143} height={28} priority style={{ height: 28, width: 'auto' }} />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-x-1 md:flex">
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="f-body inline-flex min-h-[44px] items-center rounded-full px-[14px] text-[15px] font-semibold"
                style={{ color: NAVY, textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <PlanYourTrip className={`hidden md:inline-flex ${overlay ? 'min-h-[48px] px-6' : 'min-h-[44px] px-5'}`} />
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpenOn(open ? null : pathname)}
            className="inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full md:hidden"
            style={{ color: NAVY, border: `1px solid ${LINE}`, background: 'transparent' }}
          >
            <MenuIcon open={open} />
          </button>
        </div>
        <nav
          id={menuId}
          aria-label="Menu"
          hidden={!open}
          className="flex-col gap-1 px-3 pb-3 md:hidden"
          style={{ display: open ? 'flex' : 'none' }}
          data-testid="site-nav-menu"
        >
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="f-body flex min-h-[48px] items-center rounded-2xl px-4 text-[16px] font-semibold"
              style={{ color: NAVY, textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
          <PlanYourTrip className="mt-1 min-h-[48px] w-full px-6" onClick={close} />
        </nav>
      </div>
    </header>
  )
}
