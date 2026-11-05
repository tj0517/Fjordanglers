/**
 * Canonical URL for a paginated listing (`/trips`, `/guides`).
 *
 * - any active filter  → the bare listing (filtered views are not indexed in their own right);
 * - page N ≥ 2         → itself (`?page=N`), so offers/profiles beyond page 1 are reachable by crawl;
 * - anything else      → the bare listing.
 *
 * Takes `unknown` because Next hands over whatever is in the query string: a repeated
 * key arrives as an array, a garbage `page` as arbitrary text.
 */
export function listingCanonicalUrl(
  listingUrl: string,
  page: unknown,
  filters: readonly unknown[],
): string {
  const filtered = filters.some(v => (typeof v === 'string' ? v !== '' : Array.isArray(v) && v.length > 0))
  if (filtered) return listingUrl

  if (typeof page === 'string' && /^\d+$/.test(page)) {
    const n = Number(page)
    if (n >= 2) return `${listingUrl}?page=${n}`
  }
  return listingUrl
}
