/**
 * The public site's footer (2026-11 redesign, docs/design/blog-hubs-2026-11): a darker grain block
 * framed like the photo heroes — 12 px in from the edges and the bottom at any width, 28 px
 * corners (tj, 2026-11-20).
 *
 * The blog has no category pages, so each Journal entry opens the list filtered to that category
 * (`/blog?category=…`, FA-1.97: the list reads it as its starting filter; a category with no post
 * shows the full list). Links the mockup has with no page behind them ("About", "Become a guide")
 * are left out. Kept from the old footer although the mockup does not have them (tj, 2026-11-17):
 * guide sign-in, and the Cookie Policy and Legal Notice next to Terms and Privacy.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { hubCrumbName } from '@/lib/seo/hub-jsonld'
import { Eyebrow, ON_DARK, PrimaryButton } from '@/components/site/ui'
import s from '@/components/site/grain.module.css'
import { PLAN_YOUR_TRIP_HREF } from './nav'

const JOURNAL = ['Regulations', 'Seasons', 'Species', 'Planning'] as const

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[130px] flex-col gap-1">
      <div className="mb-2"><Eyebrow dark>{title}</Eyebrow></div>
      {children}
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const style = { color: ON_DARK, textDecoration: 'none' } as const
  const className = 'f-body inline-flex min-h-[32px] items-center text-[15px] hover:opacity-80'
  if (href.startsWith('http')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>
  }
  return <Link href={href} className={className} style={style}>{children}</Link>
}

export function SiteFooter() {
  return (
    <footer
      className={`${s.blur} ${s.foot} mx-auto mb-3 mt-24 overflow-hidden`}
      style={{ width: 'calc(100% - 24px)', borderRadius: 28 }}
    >
      <div className="mx-auto flex flex-col gap-14 px-6" style={{ maxWidth: 1200, paddingTop: 'clamp(44px, 6vw, 80px)', paddingBottom: 36 }}>
        <div className="flex flex-wrap justify-between gap-x-16 gap-y-10">
          <div className="flex max-w-[460px] flex-[1_1_320px] flex-col gap-[22px]">
            <p
              className="f-display"
              style={{ margin: 0, fontWeight: 600, fontSize: 'clamp(30px, 3.6vw, 44px)', lineHeight: 1.08, letterSpacing: '-.015em', color: '#FFFFFF' }}
            >
              You talk to the guide who takes you out.
            </p>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href={PLAN_YOUR_TRIP_HREF} dark>Plan your trip</PrimaryButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-9">
            <Column title="Destinations">
              {DESTINATION_HUBS.map(hub => (
                <FooterLink key={hub.slug} href={`/${hub.slug}`}>{hubCrumbName(hub)}</FooterLink>
              ))}
            </Column>
            <Column title="Journal">
              {JOURNAL.map(label => <FooterLink key={label} href={`/blog?category=${label.toLowerCase()}`}>{label}</FooterLink>)}
            </Column>
            <Column title="FjordAnglers">
              <FooterLink href="/trips">Trips</FooterLink>
              <FooterLink href="/guides">Guides</FooterLink>
              <FooterLink href="https://instagram.com/fjordanglers">Instagram</FooterLink>
              <FooterLink href="/login">Guide sign-in</FooterLink>
            </Column>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,.22)' }}>
          <Image src="/brand/white-logo.png" alt="FjordAnglers" width={143} height={28} style={{ height: 28, width: 'auto' }} />
          <p className="f-body m-0 flex flex-wrap gap-x-6 gap-y-1.5 text-[14px]" style={{ color: '#E3EAF0' }}>
            <span>© 2026 FjordAnglers</span>
            <Link href="/legal/terms-of-service" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Terms</Link>
            <Link href="/legal/privacy-policy" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/legal/cookie-policy" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Cookie Policy</Link>
            <Link href="/legal/legal-notice" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Legal Notice</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
