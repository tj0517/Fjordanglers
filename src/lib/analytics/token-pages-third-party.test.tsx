// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

/**
 * FA-1.96 — every page whose URL carries a link token renders no third-party script: neither the
 * Google Ads tag nor GTM (GoogleTags), nor the cookie banner, the Meta Pixel or Clarity
 * (CookieBanner) — even with consent already stored as `accepted`. A normal page still renders all
 * of them. Same pattern as `src/app/r/[token]/request-page-third-party.test.tsx` (FA-M.04).
 * Client render (jsdom): consent is read from localStorage, which the server render never sees.
 */

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = '000000000000001'
  process.env.NEXT_PUBLIC_CLARITY_ID = 'testclarity'
  return { pathname: '/' }
})

vi.mock('next/navigation', () => ({ usePathname: () => env.pathname }))
vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => <script data-next-script={id ?? src} />,
}))

import { CookieBanner } from '@/components/ui/cookie-banner'
import { GoogleTags } from '@/components/analytics/GoogleTags'
import { thirdPartyScriptsAllowed } from '@/lib/analytics/third-party-free-routes'

const TOKEN = 'A'.repeat(43)
const CONSENT_KEY = 'fa_cookie_consent'
const BANNER = 'We use cookies'
const GOOGLE = /gtm-init|googletagmanager\.com|google-ads/
const META_CLARITY = /meta-pixel-init|clarity-init|facebook|clarity\.ms/

/** The four token routes this task adds (`/r/` is covered by FA-M.04's tests). */
const TOKEN_ROUTES = [
  `/offers/${TOKEN}`,
  `/reviews/${TOKEN}`,
  `/invite/${TOKEN}`,
  `/guide-intake/${TOKEN}`,
]

function show(pathname: string, consent: 'accepted' | null): string {
  env.pathname = pathname
  if (consent == null) localStorage.removeItem(CONSENT_KEY)
  else localStorage.setItem(CONSENT_KEY, consent)
  return render(
    <>
      <GoogleTags gtmId="GTM-TEST" />
      <CookieBanner gtmId="GTM-TEST" />
    </>,
  ).container.innerHTML
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('token pages — no Google tag, GTM, banner, Pixel or Clarity', () => {
  it.each(TOKEN_ROUTES)('%s with consent stored as accepted renders no third-party script', path => {
    const html = show(path, 'accepted')
    expect(html).not.toMatch(GOOGLE)
    expect(html).not.toMatch(META_CLARITY)
  })

  it.each(TOKEN_ROUTES)('%s with no consent stored renders no banner and no Google tag', path => {
    const html = show(path, null)
    expect(html).not.toContain(BANNER)
    expect(html).not.toMatch(GOOGLE)
  })
})

describe('/login — exact path, because an invited guide lands on /login?next=/invite/<code> (tj (b))', () => {
  it('/login with consent stored as accepted renders no third-party script', () => {
    const html = show('/login', 'accepted')
    expect(html).not.toMatch(GOOGLE)
    expect(html).not.toMatch(META_CLARITY)
  })

  it('/login with no consent stored renders no banner and no Google tag', () => {
    const html = show('/login', null)
    expect(html).not.toContain(BANNER)
    expect(html).not.toMatch(GOOGLE)
  })

  it('matching: /login and /login?next=… excluded; /loginx and / not; prefixes still prefixes', () => {
    expect(thirdPartyScriptsAllowed('/login')).toBe(false)
    expect(thirdPartyScriptsAllowed(`/login?next=${encodeURIComponent(`/invite/${TOKEN}`)}`)).toBe(false)
    expect(thirdPartyScriptsAllowed('/login#x')).toBe(false)
    expect(thirdPartyScriptsAllowed('/loginx')).toBe(true)
    expect(thirdPartyScriptsAllowed('/login/x')).toBe(true)
    expect(thirdPartyScriptsAllowed('/')).toBe(true)
    expect(thirdPartyScriptsAllowed('/offers/x')).toBe(false)
    expect(thirdPartyScriptsAllowed('/r/x')).toBe(false)
    expect(thirdPartyScriptsAllowed('/offersx')).toBe(true)
  })
})

describe('a normal page (/) — tags unchanged', () => {
  it('/ with consent stored as accepted renders GTM, the Ads tag, the Pixel and Clarity', () => {
    const html = show('/', 'accepted')
    expect(html).toContain('data-next-script="gtm-init"')
    expect(html).toContain('data-next-script="https://www.googletagmanager.com/gtag/js?id=AW-18171634204"')
    expect(html).toContain('data-next-script="google-ads"')
    expect(html).toContain('data-next-script="meta-pixel-init"')
    expect(html).toContain('data-next-script="clarity-init"')
  })

  it('/ with no consent stored renders the banner and the Google tags', () => {
    const html = show('/', null)
    expect(html).toContain(BANNER)
    expect(html).toMatch(GOOGLE)
  })
})

describe('/auth/reset/confirm — password-reset landing, the token is in ?token_hash= (FA-M.15)', () => {
  it('with consent stored as accepted renders no third-party script', () => {
    const html = show('/auth/reset/confirm', 'accepted')
    expect(html).not.toMatch(GOOGLE)
    expect(html).not.toMatch(META_CLARITY)
  })

  it('with no consent stored renders no banner and no Google tag', () => {
    const html = show('/auth/reset/confirm', null)
    expect(html).not.toContain(BANNER)
    expect(html).not.toMatch(GOOGLE)
  })

  it('is matched as an exact path only', () => {
    expect(thirdPartyScriptsAllowed('/auth/reset/confirm')).toBe(false)
    expect(thirdPartyScriptsAllowed('/auth/reset/confirm/x')).toBe(true)
  })
})
