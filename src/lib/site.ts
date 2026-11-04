/**
 * The one canonical public origin of the site (no trailing slash).
 *
 * Every URL the app generates for search engines and for assets that must live
 * on the public host — canonical, `metadataBase`, `og:url`, JSON-LD, sitemap,
 * the `Sitemap:` line in robots.txt, e-mail logo URLs — is built from this
 * constant. The apex `fjordanglers.com` is a permanent redirect to it
 * (FA-1.79, audit decision D1).
 *
 * NOT for transactional links (Stripe success URLs, offer/deposit links): those
 * come from `getAppUrl()` / `NEXT_PUBLIC_APP_URL` so preview and local hosts
 * keep working.
 *
 * Plain module on purpose — no imports, safe in server and client code.
 */
export const SITE_URL = 'https://www.fjordanglers.com'
