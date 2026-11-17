// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

/**
 * FA-M.04, tj Decision 3 (a) — on `/r/…` the cookie banner, the Meta Pixel and Clarity are not
 * rendered, even when consent is already stored as `accepted`; on a normal page they still are.
 * Client render (jsdom): consent is read from localStorage, which the server render never sees.
 */

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = '000000000000001'
  process.env.NEXT_PUBLIC_CLARITY_ID = 'testclarity'
  return { pathname: '/' }
})

vi.mock('next/navigation', () => ({ usePathname: () => env.pathname }))
vi.mock('next/script', () => ({
  default: ({ id }: { id?: string }) => <script data-next-script={id} />,
}))

import { CookieBanner } from '@/components/ui/cookie-banner'

const TOKEN = 'A'.repeat(43)
const CONSENT_KEY = 'fa_cookie_consent'
const BANNER = 'We use cookies'

function show(pathname: string, consent: 'accepted' | null): string {
  env.pathname = pathname
  if (consent == null) localStorage.removeItem(CONSENT_KEY)
  else localStorage.setItem(CONSENT_KEY, consent)
  return render(<CookieBanner gtmId="GTM-TEST" />).container.innerHTML
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('cookie banner, Meta Pixel, Clarity — not on /r/…, still on normal pages', () => {
  it('/r/<token> with consent stored as accepted renders neither the Pixel nor Clarity', () => {
    const html = show(`/r/${TOKEN}`, 'accepted')
    expect(html).not.toContain('meta-pixel-init')
    expect(html).not.toContain('clarity-init')
    expect(html).not.toMatch(/facebook|clarity\.ms/)
  })

  it('/r/<token> with no consent stored renders no banner', () => {
    expect(show(`/r/${TOKEN}`, null)).not.toContain(BANNER)
  })

  it('/ with consent stored as accepted renders the Pixel and Clarity', () => {
    const html = show('/', 'accepted')
    expect(html).toContain('data-next-script="meta-pixel-init"')
    expect(html).toContain('data-next-script="clarity-init"')
  })

  it('/ with no consent stored renders the banner', () => {
    expect(show('/', null)).toContain(BANNER)
  })
})
