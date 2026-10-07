/**
 * The bordered box and the muted text colour S3–S9 share (FA-1.54) — what the wireframe
 * calls `.box` and `.muted`. Kept in one place so the seven sections cannot drift apart.
 */

import type { ReactNode } from 'react'

export const mutedStyle = { color: 'rgba(10,46,77,0.62)' }

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
      className={`rounded-xl border bg-white p-4 ${className}`}
      style={{ borderColor: accent ? 'var(--fa-navy)' : 'rgba(10,46,77,0.16)' }}
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
