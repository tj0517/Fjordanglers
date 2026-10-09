'use client'

/**
 * The frame every S3–S14 section sits in (FA-1.54): an anchor, a `data-section` marker the
 * tests and the screenshots key on, an eyebrow, one heading, and — on mobile only — an
 * accordion.
 *
 * Desktop always shows the content; the open/closed state only hides it below `sm`. The
 * heading is rendered twice (a plain one for desktop, a button for mobile) and CSS shows one
 * of them, so a desktop visitor never tabs onto a button that does nothing.
 */

import { useState, type ReactNode } from 'react'
import { hairline } from './offer-box'

export type OfferSectionProps = {
  /** `S3` … `S14` — the wireframe's own names. */
  section: string
  /** The anchor the top bar links to, without the `#`. */
  anchor?: string
  /** Two or three words above the heading, set in small caps. */
  eyebrow?: string
  title:   string
  /** Mobile accordion. Omitted = the section is always open. */
  accordion?: { defaultOpen: boolean }
  children: ReactNode
}

const headingClass = 'f-display text-[26px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[32px]'

export default function OfferSection({ section, anchor, eyebrow, title, accordion, children }: OfferSectionProps) {
  const [open, setOpen] = useState(accordion?.defaultOpen ?? true)

  const collapsible = accordion != null

  const eyebrowEl = eyebrow != null && (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(10,46,77,0.5)' }}>
      {eyebrow}
    </p>
  )

  return (
    <section
      id={anchor}
      data-section={section}
      className="mt-12 scroll-mt-24 border-t pt-10 sm:mt-14 sm:pt-12"
      style={{ borderColor: hairline }}
    >
      {collapsible ? (
        <>
          <div className="hidden sm:block">
            {eyebrowEl}
            <h2 className={headingClass}>{title}</h2>
          </div>
          <div className="sm:hidden">
            {eyebrowEl}
            <h2>
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={`offer-${section}-body`}
                className={`${headingClass} flex w-full items-center justify-between gap-3 text-left`}
                style={{ minHeight: 44 }}
              >
                {title}
                <span
                  aria-hidden
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg font-normal"
                  style={{ background: 'rgba(10,46,77,0.06)' }}
                >
                  {open ? '−' : '+'}
                </span>
              </button>
            </h2>
          </div>
        </>
      ) : (
        <>
          {eyebrowEl}
          <h2 className={headingClass}>{title}</h2>
        </>
      )}

      <div
        id={`offer-${section}-body`}
        data-open={open}
        className={`mt-6 ${open ? '' : 'hidden sm:block'}`}
      >
        {children}
      </div>
    </section>
  )
}
