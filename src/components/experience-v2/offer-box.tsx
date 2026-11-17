/**
 * The surfaces S3–S14 share (FA-1.54; restyled from the 2026-11 mockup,
 * docs/design/site-2026-11/experience.dc.html): the cream card with a sand hairline, the
 * muted text colour, and the check / cross lists. Kept in one place so the sections cannot
 * drift apart. The grain blocks themselves come from src/components/site/grain.module.css.
 */

import type { ReactNode } from 'react'
import { CREAM, INK, LINE, MUTED, SALMON, SALMON_ON_DARK } from '@/components/site/ui'

export const mutedStyle = { color: MUTED }

/** The lift of a card that floats over the page — the sticky widget. */
export const cardShadow = '0 18px 44px rgba(10,46,77,.10)'

export const hairline = LINE

export function Box({
  children,
  accent = false,
  className = '',
}: {
  children: ReactNode
  /** The one box in a pair that carries the positive message (S5 "Ideal if…"). */
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={`rounded-[14px] p-5 ${className}`}
      style={accent
        ? { background: 'rgba(10,46,77,0.045)', border: '1px solid rgba(10,46,77,0.10)' }
        : { background: CREAM, border: `1px solid ${LINE}` }}
    >
      {children}
    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] flex-none">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SALMON} strokeWidth="2.2" strokeLinecap="round" className="mt-[3px] flex-none">
      <path d="M6 6l12 12" /><path d="M18 6 6 18" />
    </svg>
  )
}

/**
 * One row of a check / cross list. `dark` = white text with a light-salmon tick, for a grain
 * block; `cross` = the "Not included" row on cream.
 */
export function ListRow({ children, mark }: { children: ReactNode; mark: 'dark' | 'light' | 'cross' }) {
  return (
    <li className="flex gap-2.5 text-[15.5px] leading-normal" style={{ color: mark === 'dark' ? '#FFFFFF' : INK }}>
      {mark === 'cross' ? <CrossIcon /> : <CheckIcon color={mark === 'dark' ? SALMON_ON_DARK : '#0A2E4D'} />}
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** A ticked list that renders nothing for no items, so callers need no guard of their own. */
export function BulletList({ items, mark = 'light', className = 'flex flex-col gap-2' }: {
  items: readonly string[]
  mark?: 'dark' | 'light' | 'cross'
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <ul className={`m-0 list-none p-0 ${className}`}>
      {items.map((item, i) => <ListRow key={`${i}-${item}`} mark={mark}>{item}</ListRow>)}
    </ul>
  )
}
