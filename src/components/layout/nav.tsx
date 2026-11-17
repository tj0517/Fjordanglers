/**
 * The public site's navigation (2026-11 redesign, docs/design/blog-hubs-2026-11): a floating cream
 * bar with the logo, three links and "Plan your trip".
 *
 *   overlay — the hub: the bar sits on the hero photo and scrolls away with the page, and on a
 *             phone the links wrap under the logo, as in the mockup.
 *   default — every other page: the bar is pinned to the top in one row that fits the 72 px those
 *             pages leave for it; below `md` it keeps only the logo and the button (tj, 2026-11-17).
 *
 * Links only to pages that exist: the mockup's "Destinations" and "About" have no page yet. There
 * is no account menu (tj, 2026-11-17); a guide signs in from the footer.
 */

import Image from 'next/image'
import Link from 'next/link'
import { Arrow, CREAM, LINE, NAVY } from '@/components/destination-hub/hub-ui'
import s from '@/components/destination-hub/hub.module.css'

const LINKS = [
  ['/trips', 'Trips'],
  ['/guides', 'Guides'],
  ['/blog', 'Journal'],
] as const

/** Every "Plan your trip" on the site leads to the trip list (tj, 2026-11-17). */
export const PLAN_YOUR_TRIP_HREF = '/trips'

export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={overlay
        ? 'absolute inset-x-0 top-0 z-[5] px-4 pt-6 sm:px-7 sm:pt-7'
        : 'fixed inset-x-0 top-0 z-50 px-3 pt-[6px] sm:px-7'}
    >
      <div
        className={`mx-auto flex items-center justify-between gap-x-5 gap-y-2 ${overlay ? 'flex-wrap' : ''}`}
        style={{
          maxWidth: 1240, padding: overlay ? '8px 8px 8px 24px' : '8px 8px 8px 20px', borderRadius: 30, background: CREAM,
          border: `1px solid ${LINE}`, boxShadow: '0 10px 30px rgba(10,46,77,.07)',
        }}
      >
        <Link href="/" aria-label="FjordAnglers home" className="inline-flex min-h-[44px] flex-none items-center">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={143} height={28} priority style={{ height: 28, width: 'auto' }} />
        </Link>
        <nav aria-label="Main" className={overlay ? 'flex flex-wrap items-center gap-x-1 gap-y-0.5' : 'hidden items-center gap-x-1 md:flex'}>
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
          href={PLAN_YOUR_TRIP_HREF}
          className={`${s.blur} ${s.fjord} inline-flex flex-none items-center justify-center rounded-full ${overlay ? 'min-h-[48px] px-6' : 'min-h-[44px] px-5'}`}
          style={{ textDecoration: 'none' }}
        >
          <span className="f-body inline-flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold" style={{ color: '#FFFFFF' }}>
            Plan your trip<Arrow />
          </span>
        </Link>
      </div>
    </header>
  )
}
