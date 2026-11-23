'use client'

import { useEffect, useRef, useState } from 'react'
import { LINE, MUTED, NAVY, SALMON } from '@/components/site/ui'

/**
 * "In this article" (FA-1.97, docs/design/blog-2026-11/article.dc.html).
 *
 * From `lg` up it is a column beside the article: the `aside` is as tall as the article (it is a flex
 * item that stretches), and the list inside it is `position: sticky` below the site's nav, so it
 * starts under the hero and stops where the article ends — it never floats over the hero, the
 * sections below the article or the footer. Below `lg` it is the collapsible card at the top of the
 * article column. Nothing here is `position: fixed`.
 */

interface Section {
  id: string
  label: string
}

interface Props {
  sections: readonly Section[]
}

/** The fixed nav is ~72 px tall plus its offset; the list sticks a little below it. */
const STICKY_TOP = 96

export function TableOfContents({ sections }: Props) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const ticking = useRef(false)

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (ticking.current) return
        ticking.current = true
        requestAnimationFrame(() => {
          // Pick the entry closest to the top of the viewport
          const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          if (visible.length > 0) setActiveId(visible[0].target.id)
          ticking.current = false
        })
      },
      // The top edge is where the sticky list starts, under the nav.
      { rootMargin: `-${STICKY_TOP}px 0px -65% 0px` },
    )

    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setOpen(false)
  }

  return (
    <aside className="w-full lg:w-[240px] lg:flex-none lg:self-stretch">
      {/* ── lg and up: sticky list in a column as tall as the article ── */}
      <div
        className="hidden lg:flex"
        style={{
          position: 'sticky', top: STICKY_TOP, flexDirection: 'column', gap: 14,
          maxHeight: `calc(100vh - ${STICKY_TOP + 24}px)`, overflowY: 'auto',
        }}
      >
        <p className="f-body" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: MUTED }}>
          In this article
        </p>
        <nav aria-label="Table of contents">
          {sections.map(s => {
            const isActive = s.id === activeId
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                title={s.label}
                aria-current={isActive ? 'location' : undefined}
                onClick={e => {
                  e.preventDefault()
                  scrollTo(s.id)
                }}
                className="f-body"
                style={{
                  display: 'block', padding: '9px 0 9px 14px', textDecoration: 'none',
                  borderLeft: `2px solid ${isActive ? SALMON : LINE}`,
                  fontSize: '14.5px', lineHeight: 1.35,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? NAVY : MUTED,
                }}
              >
                {/* Long headings: two lines, then an ellipsis (full text on hover via title).
                    The clamp is on the span: on the link, its padding would show a third line. */}
                <span style={{
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', overflowWrap: 'anywhere',
                }}>
                  {s.label}
                </span>
              </a>
            )
          })}
        </nav>
      </div>

      {/* ── Below lg: inline collapsible card ──────────────────────── */}
      <div
        className="lg:hidden"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.09)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A2E4D', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            In this article
          </span>
          <span style={{
            fontSize: '12px', color: 'rgba(10,46,77,0.4)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>
            ▾
          </span>
        </button>

        {open && (
          <nav aria-label="Table of contents" style={{ borderTop: '1px solid rgba(10,46,77,0.07)', padding: '0.5rem 0 0.75rem' }}>
            {sections.map((s, i) => {
              const isActive = s.id === activeId
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', padding: '0.5rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    fontSize: '13px', lineHeight: 1.4,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? SALMON : 'rgba(10,46,77,0.6)',
                  }}
                >
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: isActive ? SALMON : 'rgba(10,46,77,0.25)',
                    minWidth: '14px',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.label}
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </aside>
  )
}
