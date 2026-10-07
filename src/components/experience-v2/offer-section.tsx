'use client'

/**
 * The frame every S3–S9 section sits in (FA-1.54): an anchor, a `data-section` marker the
 * tests and the screenshots key on, one heading, and — on mobile only — an accordion.
 *
 * Desktop always shows the content; the open/closed state only hides it below `sm`. The
 * heading is rendered twice (a plain one for desktop, a button for mobile) and CSS shows one
 * of them, so a desktop visitor never tabs onto a button that does nothing.
 */

import { useState, type ReactNode } from 'react'

export type OfferSectionProps = {
  /** `S3` … `S9` — the wireframe's own names. */
  section: string
  /** The anchor the top bar links to, without the `#`. */
  anchor?: string
  title:   string
  /** Mobile accordion. Omitted = the section is always open. */
  accordion?: { defaultOpen: boolean }
  children: ReactNode
}

const headingClass = 'f-display text-2xl font-bold leading-tight'

export default function OfferSection({ section, anchor, title, accordion, children }: OfferSectionProps) {
  const [open, setOpen] = useState(accordion?.defaultOpen ?? true)

  const collapsible = accordion != null

  return (
    <section
      id={anchor}
      data-section={section}
      className="mt-10 scroll-mt-20 border-t pt-6"
      style={{ borderColor: 'rgba(10,46,77,0.14)' }}
    >
      {collapsible ? (
        <>
          <h2 className={`${headingClass} hidden sm:block`}>{title}</h2>
          <h2 className="sm:hidden">
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls={`offer-${section}-body`}
              className={`${headingClass} flex w-full items-center justify-between gap-3 text-left`}
              style={{ minHeight: 44 }}
            >
              {title}
              <span aria-hidden className="flex-none text-xl font-normal">{open ? '−' : '+'}</span>
            </button>
          </h2>
        </>
      ) : (
        <h2 className={headingClass}>{title}</h2>
      )}

      <div
        id={`offer-${section}-body`}
        data-open={open}
        className={`mt-4 ${open ? '' : 'hidden sm:block'}`}
      >
        {children}
      </div>
    </section>
  )
}
