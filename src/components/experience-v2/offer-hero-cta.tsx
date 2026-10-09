'use client'

/**
 * The mobile hero CTA (FA-1.53): an anchor to the inquiry section, so it works without
 * JavaScript — and, with it, the same full-screen form every other CTA on the page opens.
 * As a bare anchor it scrolled a 9 000 px page to the bottom, which read as "nothing
 * happened".
 */

import { useInquiryWizardOptional } from '@/components/inquiry-wizard/inquiry-wizard'

export default function OfferHeroCta({ href, children }: { href: string; children: React.ReactNode }) {
  const wizard = useInquiryWizardOptional()

  return (
    <a
      href={href}
      onClick={event => {
        if (wizard == null) return
        event.preventDefault()
        wizard.openAt(1)
      }}
      className="mt-5 block w-full rounded-xl px-4 py-3.5 text-center text-base font-bold md:hidden"
      style={{ background: 'var(--fa-salmon)', color: 'var(--fa-navy)' }}
      data-testid="offer-hero-cta"
    >
      {children}
    </a>
  )
}
