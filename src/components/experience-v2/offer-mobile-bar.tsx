'use client'

/**
 * The mobile bottom bar (FA-1.53) — the widget's job on a 390 px screen.
 *
 * Appears once the visitor is past the hero (600 px, the figure the task fixes) and gets
 * out of the way at `#zapytanie`, the inquiry form: a fixed bar over the form it points at
 * would cover the field being typed into. The form itself arrives in FA-1.55 — until then
 * the anchor is an empty target, and the bar simply never hides, which is the correct
 * behaviour for a page with nothing to cover.
 *
 * Desktop never sees this: the sticky card in the right column is the same widget.
 */

import { useEffect, useState, type ReactNode } from 'react'

export default function OfferMobileBar({ children }: { children: ReactNode }) {
  const [pastHero, setPastHero] = useState(false)
  const [atForm, setAtForm]     = useState(false)

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const form = document.getElementById('zapytanie')
    if (form == null) return

    const observer = new IntersectionObserver(
      entries => setAtForm(entries.some(e => e.isIntersecting)),
      { rootMargin: '0px 0px -25% 0px' },
    )
    observer.observe(form)
    return () => observer.disconnect()
  }, [])

  const visible = pastHero && !atForm

  return (
    <div
      data-testid="offer-mobile-bar"
      data-visible={visible}
      aria-hidden={!visible}
      className="fixed inset-x-0 bottom-0 z-40 flex items-center px-4 py-3 transition-transform duration-200 md:hidden"
      style={{
        background:  'var(--fa-navy)',
        color:       '#fff',
        boxShadow:   '0 -4px 16px rgba(10,46,77,0.25)',
        transform:   visible ? 'translateY(0)' : 'translateY(110%)',
        // Out of the tab order while it is off-screen, so a keyboard user does not
        // land on a button nobody can see.
        visibility:  visible ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  )
}
