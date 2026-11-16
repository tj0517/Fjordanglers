/**
 * Routes where the Google tags (Ads `AW-…` and GTM) are not loaded (FA-M.04, tj D1 a).
 *
 * The Ads `config` call sends a page view whose page-location parameter is the full URL, and
 * consent "denied" does not stop that cookie-less ping. A page whose URL carries a secret —
 * a link token — therefore leaks it to Google's logs.
 *
 * EVERY TOKEN PAGE MUST BE ON THIS LIST. Entries are path prefixes ending in "/".
 * (`/offers/` is not here yet — deferred row FA-M.04, separate task.)
 */
export const GOOGLE_TAG_FREE_ROUTES: readonly string[] = ['/r/']

/** False on a route whose URL must not reach Google; true everywhere else. */
export function googleTagsAllowed(pathname: string | null): boolean {
  if (pathname == null) return true
  return !GOOGLE_TAG_FREE_ROUTES.some(prefix => pathname.startsWith(prefix))
}
