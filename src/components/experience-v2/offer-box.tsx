/**
 * The surfaces S3–S14 share (FA-1.54): a white card lifted by a soft shadow instead of a
 * 1 px border, and the muted text colour. Kept in one place so the sections cannot drift
 * apart. Borders made the page read as a wireframe — the shadow and the glacier-white page
 * ground are what give a card its edge now.
 */

import type { ReactNode } from 'react'

export const mutedStyle = { color: 'rgba(10,46,77,0.62)' }

/** Two-layer shadow: a hairline for the edge, a wide soft one for the lift. */
export const cardShadow = '0 1px 2px rgba(10,46,77,0.06), 0 12px 32px -12px rgba(10,46,77,0.14)'

export const hairline = 'rgba(10,46,77,0.08)'

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
      className={`rounded-2xl p-5 ${className}`}
      style={accent
        ? { background: 'rgba(10,46,77,0.045)', boxShadow: `inset 0 0 0 1px rgba(10,46,77,0.10)` }
        : { background: '#fff', boxShadow: cardShadow }}
    >
      {children}
    </div>
  )
}

/** A bulleted list that renders nothing for no items, so callers need no guard of their own. */
export function BulletList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
      {items.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}
    </ul>
  )
}
