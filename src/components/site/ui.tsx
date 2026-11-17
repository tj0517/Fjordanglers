/**
 * The small pieces every page of the 2026-11 redesign repeats (docs/design/blog-hubs-2026-11 and
 * docs/design/site-2026-11, "Wspólne zasady"): eyebrow + heading, the button styles, the arrow and
 * the uppercase tag.
 */

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

export const NAVY      = '#0A2E4D'
export const DEEP_NAVY = '#071C30'
export const MUTED     = '#4F6275'
export const SALMON    = '#E67E50'
export const SALMON_ON_DARK = '#F6B596'
export const CREAM     = '#FDFAF7'
export const PAGE_BG   = '#F3EDE4'
export const LINE      = '#E3DBCE'
export const ON_DARK   = '#EEF2F5'
/** Body copy on a light surface, and the softer line under a heading on a dark one. */
export const INK       = '#33485C'
export const ON_DARK_SOFT = '#E3EAF0'
/** The sand of tags and of the assurance strip. */
export const SAND      = '#E9DFCF'

const eyebrowStyle: CSSProperties = {
  margin: 0, fontSize: '12.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
}

/** Eyebrow over an h2. `dark` = the block sits on a photo or navy. */
export function SectionHeading({
  eyebrow, title, dark = false, size = 34, children,
}: { eyebrow: string; title: string; dark?: boolean; size?: number; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <p className="f-body" style={{ ...eyebrowStyle, color: dark ? SALMON_ON_DARK : SALMON }}>{eyebrow}</p>
      <h2
        className="f-display"
        style={{ margin: 0, fontWeight: 700, fontSize: `clamp(28px, 4vw, ${size}px)`, lineHeight: 1.12, letterSpacing: '-.01em', color: dark ? '#FFFFFF' : NAVY }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className="f-body" style={{ ...eyebrowStyle, color: dark ? SALMON_ON_DARK : SALMON }}>{children}</p>
}

const buttonBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 20px',
  borderRadius: 10, fontSize: '14.5px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
}

/** The large size: the home hero's and the closing block's CTA. */
const buttonLarge: CSSProperties = { minHeight: 54, padding: '0 28px', fontSize: '16.5px' }

/**
 * Salmon fill, beige text, navy outline — the main CTA on every page (README "Wspólne zasady").
 * Exported for a CTA that has to be a plain `<a>` with its own click handler (the offer page's
 * widget opens the inquiry form instead of navigating).
 */
export const primaryButtonStyle: CSSProperties = {
  ...buttonBase, fontWeight: 700, background: SALMON, color: PAGE_BG, border: `1.5px solid ${NAVY}`,
}

export function PrimaryButton({ href, children, size = 'md' }: { href: string; children: ReactNode; size?: 'md' | 'lg' }) {
  return (
    <Link
      href={href}
      className="f-body"
      style={{ ...primaryButtonStyle, ...(size === 'lg' ? buttonLarge : {}) }}
    >
      {children}
    </Link>
  )
}

/** Cream fill, navy outline — the second button on a light surface ("All guides →"). */
export function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="f-body" style={{ ...buttonBase, background: CREAM, color: NAVY, border: `1.5px solid ${NAVY}` }}>
      {children}
    </Link>
  )
}

/** White outline on a dark surface. External links (mailto:, wa.me) render a plain anchor. */
export function GhostButton({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  const style: CSSProperties = { ...buttonBase, color: '#FFFFFF', border: '1.5px solid rgba(255,255,255,.7)' }
  if (external) {
    const newTab = href.startsWith('http')
    return (
      <a href={href} className="f-body" style={style} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  }
  return <Link href={href} className="f-body" style={style}>{children}</Link>
}

export function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  )
}

/** "All guides →" — the link at the right of a section heading. */
export function HeadingLink({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <Link
      href={href}
      className="f-body"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 15, fontWeight: 600, color: dark ? '#FFFFFF' : NAVY, textDecoration: 'none' }}
    >
      {children}<Arrow />
    </Link>
  )
}

/** "Kristina Placko & Daryl Paskell" → "KP": the stand-in for a missing avatar. */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}

const TAG_BACKGROUND = { cream: CREAM, sand: SAND, salmon: SALMON } as const

/** The small uppercase label on a card photo. `salmon` is the offer page's "Gear included". */
export function Tag({ children, tone = 'cream' }: { children: ReactNode; tone?: keyof typeof TAG_BACKGROUND }) {
  return (
    <span
      className="f-body"
      style={{
        display: 'inline-block', padding: '6px 9px', borderRadius: 5, background: TAG_BACKGROUND[tone],
        color: NAVY, fontSize: '11.5px', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  )
}
