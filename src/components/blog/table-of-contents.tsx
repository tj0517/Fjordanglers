'use client'

import { useEffect, useRef, useState } from 'react'

interface Section {
  id: string
  label: string
}

interface Props {
  sections: readonly Section[]
}

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
      { rootMargin: '-10% 0px -70% 0px' },
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

  const activeIndex = sections.findIndex(s => s.id === activeId)

  return (
    <>
      {/* ── Desktop: fixed left sidebar ─────────────────────────── */}
      <aside
        className="hidden xl:block"
        style={{
          position: 'fixed',
          left: 'max(1.5rem, calc(50% - 480px))',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '180px',
          zIndex: 40,
        }}
      >
        <p style={{
          fontSize: '10px', fontWeight: 700, color: 'rgba(10,46,77,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '1rem',
        }}>
          Contents
        </p>

        {/* Track + dots */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Vertical line with progress fill */}
          <div style={{ position: 'relative', width: '2px', flexShrink: 0 }}>
            {/* Background track */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10,46,77,0.1)', borderRadius: '99px',
            }} />
            {/* Active fill */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: `${((activeIndex + 1) / sections.length) * 100}%`,
              background: '#E67E50', borderRadius: '99px',
              transition: 'height 0.35s ease',
            }} />
          </div>

          {/* Section links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {sections.map((s, i) => {
              const isActive = s.id === activeId
              const isPast = i < activeIndex
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', padding: '5px 0',
                    fontSize: '12px', lineHeight: 1.4,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive
                      ? '#E67E50'
                      : isPast
                        ? 'rgba(10,46,77,0.55)'
                        : 'rgba(10,46,77,0.35)',
                    transition: 'color 0.2s, font-weight 0.2s',
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* ── Mobile / tablet: inline collapsible card ────────────── */}
      <div
        className="xl:hidden"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.09)',
          borderRadius: '14px',
          marginBottom: '2.5rem',
          overflow: 'hidden',
        }}
      >
        {/* Header / toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A2E4D', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Contents
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

        {/* Section list */}
        {open && (
          <nav style={{ borderTop: '1px solid rgba(10,46,77,0.07)', padding: '0.5rem 0 0.75rem' }}>
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
                    color: isActive ? '#E67E50' : 'rgba(10,46,77,0.6)',
                  }}
                >
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: isActive ? '#E67E50' : 'rgba(10,46,77,0.25)',
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
    </>
  )
}
