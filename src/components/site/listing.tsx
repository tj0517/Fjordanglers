/**
 * The list pages' controls (docs/design/site-2026-11/guides.dc.html, also /trips): a filter as a
 * row of link buttons with the current one in navy, and the numbered pagination. Both are plain
 * links, so a filter or a page is a URL the server renders.
 */

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { CREAM, LINE, MUTED, NAVY, buttonClass } from './ui'

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px',
  borderRadius: 9, fontSize: '14.5px', fontWeight: 600, textDecoration: 'none',
}
const chipOn: CSSProperties  = { ...chipBase, background: NAVY, color: '#FFFFFF', border: `1.5px solid ${NAVY}` }
const chipOff: CSSProperties = { ...chipBase, background: CREAM, color: NAVY, border: `1.5px solid ${LINE}` }

/** "Country: [All countries] [Iceland] …" — `href(undefined)` is the "All" link. */
export function FilterRow({ label, all, options, value, href }: {
  label: string
  all: string
  options: readonly string[]
  value: string | undefined
  href: (option: string | undefined) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2">
      <span className="f-body min-w-[84px] text-[12.5px] font-bold uppercase" style={{ letterSpacing: '.12em', color: MUTED }}>{label}</span>
      <div role="group" aria-label={`Filter by ${label.toLowerCase()}`} className="flex flex-wrap gap-2">
        <Link href={href(undefined)} className={`f-body ${buttonClass.chip}`} style={value ? chipOff : chipOn} aria-current={value ? undefined : 'true'}>{all}</Link>
        {options.map(option => (
          <Link key={option} href={href(option)} className={`f-body ${buttonClass.chip}`} style={value === option ? chipOn : chipOff} aria-current={value === option ? 'true' : undefined}>
            {option}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Prev, up to seven numbers with "…" gaps, Next; Prev and Next stay visible but inert at the ends. */
export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  const items: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i)
  } else {
    items.push(1)
    if (page > 3) items.push('…')
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (page < totalPages - 2) items.push('…')
    items.push(totalPages)
  }

  const box: CSSProperties = { ...chipBase, minWidth: 44, padding: '0 12px' }
  const off: CSSProperties = { ...box, background: CREAM, color: NAVY, border: `1.5px solid ${LINE}` }
  const disabled: CSSProperties = { ...off, opacity: 0.4 }

  return (
    <nav aria-label="Pagination" className="f-body flex flex-wrap justify-center gap-2">
      {page > 1 ? <Link href={href(page - 1)} className={buttonClass.chip} style={off}>← Prev</Link> : <span style={disabled}>← Prev</span>}
      {items.map((item, idx) =>
        item === '…' ? (
          <span key={`e-${idx}`} style={{ ...box, color: MUTED }}>…</span>
        ) : item === page ? (
          <span key={item} aria-current="page" style={{ ...box, background: NAVY, color: '#FFFFFF' }}>{item}</span>
        ) : (
          <Link key={item} href={href(item)} className={buttonClass.chip} style={off}>{item}</Link>
        ),
      )}
      {page < totalPages ? <Link href={href(page + 1)} className={buttonClass.chip} style={off}>Next →</Link> : <span style={disabled}>Next →</span>}
    </nav>
  )
}

/** `base` with `params` (empty values dropped) and `page` — a page link that keeps the filters. */
export function pageHref(base: string, params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  sp.set('page', page.toString())
  return `${base}?${sp.toString()}`
}
