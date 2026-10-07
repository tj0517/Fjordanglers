'use client'

/**
 * S0 — the light bar above an offer page (FA-1.53).
 *
 * Deliberately not the site navigation: this page has one job, and a full menu is an
 * invitation to leave it. Logo, two in-page anchors, the currency picker and WhatsApp.
 * The anchors point at sections FA-1.54 (`#jak-dziala`) and FA-1.55 (`#faq`) build; they
 * are the ids those tasks already name, so they keep working as the page fills in.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useCurrency } from './currency-context'

export default function OfferTopBar({ whatsappUrl }: { whatsappUrl: string | null }) {
  const { display, setDisplay, available } = useCurrency()

  return (
    <header
      className="sticky top-0 z-30 border-b bg-white"
      style={{ borderColor: 'rgba(10,46,77,0.12)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:h-16 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="FjordAnglers — home">
          <Image src="/brand/sygnet.png" alt="" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="f-display text-base font-bold sm:text-lg" style={{ color: 'var(--fa-navy)' }}>
            FjordAnglers
          </span>
        </Link>

        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          <a href="#jak-dziala" className="hidden hover:underline sm:inline" style={{ color: 'var(--fa-navy)' }}>
            How it works
          </a>
          <a href="#faq" className="hidden hover:underline sm:inline" style={{ color: 'var(--fa-navy)' }}>
            FAQ
          </a>

          {available.length > 1 && (
            <label className="flex items-center">
              <span className="sr-only">Show prices in</span>
              <select
                value={display}
                onChange={e => setDisplay(e.target.value)}
                className="rounded-full border bg-white px-3 py-1 text-sm"
                style={{ borderColor: 'rgba(10,46,77,0.25)', color: 'var(--fa-navy)' }}
              >
                {available.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          )}

          {whatsappUrl != null && (
            <a
              href={whatsappUrl}
              className="font-semibold hover:underline"
              style={{ color: 'var(--fa-navy)' }}
              rel="noopener noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
