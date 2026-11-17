/**
 * The hub redesign's navigation (docs/design/blog-hubs-2026-11): a floating cream bar that sits
 * on the hero photo, not fixed. Hub pages only for now — every other page keeps `SiteNav`.
 *
 * Links only to pages that exist: the mockup's "Destinations" and "About" have no page yet.
 */

import Image from 'next/image'
import Link from 'next/link'
import { Arrow, CREAM, LINE, NAVY } from './hub-ui'
import s from './hub.module.css'

const LINKS = [
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/blog', 'Journal'],
] as const

export function HubNav({ ctaHref }: { ctaHref: string }) {
  return (
    <header className="absolute inset-x-0 top-0 z-[5] px-4 pt-6 sm:px-7 sm:pt-7">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-2"
        style={{
          maxWidth: 1240, padding: '8px 8px 8px 24px', borderRadius: 30, background: CREAM,
          border: `1px solid ${LINE}`, boxShadow: '0 10px 30px rgba(10,46,77,.07)',
        }}
      >
        <Link href="/" aria-label="FjordAnglers home" className="inline-flex min-h-[44px] items-center">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={143} height={28} priority style={{ height: 28, width: 'auto' }} />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
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
        <Link
          href={ctaHref}
          className={`${s.blur} ${s.fjord} inline-flex min-h-[48px] items-center justify-center rounded-full px-6`}
          style={{ textDecoration: 'none' }}
        >
          <span className="f-body inline-flex items-center gap-2 text-[15px] font-semibold" style={{ color: '#FFFFFF' }}>
            Plan your trip<Arrow />
          </span>
        </Link>
      </div>
    </header>
  )
}
