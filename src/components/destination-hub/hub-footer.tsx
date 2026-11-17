/**
 * The hub redesign's footer (docs/design/blog-hubs-2026-11): full width, on a darker grain block.
 * Hub pages only for now — every other page keeps `SiteFooter`.
 *
 * The blog has no category pages yet, so the Journal column links to the blog itself; links the
 * mockup has with no page behind them ("About", "Become a guide") are left out.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { hubCrumbName } from '@/lib/seo/hub-jsonld'
import { Eyebrow, ON_DARK, PrimaryButton } from './hub-ui'
import s from './hub.module.css'

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

export function HubFooter({ ctaHref }: { ctaHref: string }) {
  return (
    <footer className={`${s.blur} ${s.foot} mt-24`}>
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
              <PrimaryButton href={ctaHref}>Plan your trip</PrimaryButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-9">
            <Column title="Destinations">
              {DESTINATION_HUBS.map(hub => (
                <FooterLink key={hub.slug} href={`/${hub.slug}`}>{hubCrumbName(hub)}</FooterLink>
              ))}
            </Column>
            <Column title="Journal">
              {JOURNAL.map(label => <FooterLink key={label} href="/blog">{label}</FooterLink>)}
            </Column>
            <Column title="FjordAnglers">
              <FooterLink href="/trips">Trips</FooterLink>
              <FooterLink href="/guides">Guides</FooterLink>
              <FooterLink href="https://instagram.com/fjordanglers">Instagram</FooterLink>
            </Column>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,.22)' }}>
          <Image src="/brand/white-logo.png" alt="FjordAnglers" width={143} height={28} style={{ height: 28, width: 'auto' }} />
          <p className="f-body m-0 flex flex-wrap gap-x-6 gap-y-1.5 text-[14px]" style={{ color: '#E3EAF0' }}>
            <span>© 2026 FjordAnglers</span>
            <Link href="/legal/terms-of-service" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Terms</Link>
            <Link href="/legal/privacy-policy" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Privacy</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
