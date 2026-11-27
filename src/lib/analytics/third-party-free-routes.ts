/**
 * Routes where no third-party script is loaded (FA-M.04): no Google Ads `AW-…` / GTM (tj D1 a),
 * and no cookie banner, Meta Pixel or Clarity (tj Decision 3 a, 2026-11-17).
 *
 * Each of these sends the full page URL: the Ads `config` call sends a page view with the URL as
 * its page-location parameter (consent "denied" does not stop that cookie-less ping), the Pixel's
 * `PageView` carries the URL, and Clarity records the session with it. A page whose URL carries a
 * secret — a link token — would therefore leak it to Google, Meta and Microsoft.
 *
 * EVERY TOKEN PAGE MUST BE ON THIS LIST. An entry ending in "/" is a path prefix; any other entry
 * matches that exact path only (the query string and `#` part are ignored).
 * `/r/` — guide request (FA-M.04); `/offers/` — deposit offer, `/reviews/` — review form,
 * `/invite/` — guide account invite, `/guide-intake/` — guide intake form (FA-1.96);
 * `/login` — exact path: an invited guide is sent to `/login?next=/invite/<code>` (FA-1.96, tj (b));
 * `/connect-calendar/` — guide calendar connect link (FA-M.09);
 * `/auth/reset/confirm` — exact path: password-reset landing page, `?token_hash=` in the query (FA-M.15).
 */
export const THIRD_PARTY_FREE_ROUTES: readonly string[] = [
  '/r/',
  '/offers/',
  '/reviews/',
  '/invite/',
  '/guide-intake/',
  '/login',
  '/connect-calendar/',
  '/auth/reset/confirm',
]

/** False on a route whose URL must not reach a third party; true everywhere else. */
export function thirdPartyScriptsAllowed(pathname: string | null): boolean {
  if (pathname == null) return true
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname
  return !THIRD_PARTY_FREE_ROUTES.some(entry =>
    entry.endsWith('/') ? path.startsWith(entry) : path === entry,
  )
}
