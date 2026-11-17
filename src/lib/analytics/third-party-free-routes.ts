/**
 * Routes where no third-party script is loaded (FA-M.04): no Google Ads `AW-…` / GTM (tj D1 a),
 * and no cookie banner, Meta Pixel or Clarity (tj Decision 3 a, 2026-11-17).
 *
 * Each of these sends the full page URL: the Ads `config` call sends a page view with the URL as
 * its page-location parameter (consent "denied" does not stop that cookie-less ping), the Pixel's
 * `PageView` carries the URL, and Clarity records the session with it. A page whose URL carries a
 * secret — a link token — would therefore leak it to Google, Meta and Microsoft.
 *
 * EVERY TOKEN PAGE MUST BE ON THIS LIST. Entries are path prefixes ending in "/".
 * `/r/` — guide request (FA-M.04); `/offers/` — deposit offer, `/reviews/` — review form,
 * `/invite/` — guide account invite, `/guide-intake/` — guide intake form (FA-1.96).
 */
export const THIRD_PARTY_FREE_ROUTES: readonly string[] = [
  '/r/',
  '/offers/',
  '/reviews/',
  '/invite/',
  '/guide-intake/',
]

/** False on a route whose URL must not reach a third party; true everywhere else. */
export function thirdPartyScriptsAllowed(pathname: string | null): boolean {
  if (pathname == null) return true
  return !THIRD_PARTY_FREE_ROUTES.some(prefix => pathname.startsWith(prefix))
}
