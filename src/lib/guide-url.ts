/**
 * Public profile path of a guide — `/guides/[slug]`, or `null` when the guide has no slug.
 *
 * Public surfaces never link a profile by UUID (FA-1.86, tj D1): a guide without a slug gets
 * no link and no sitemap / JSON-LD entry. Admin and the guide dashboard are deliberately not
 * covered — a pending guide legitimately has no slug yet and is reached by id there.
 */
export function guideProfilePath(guide: { slug?: string | null }): string | null {
  const slug = guide.slug?.trim()
  return slug != null && slug !== '' ? `/guides/${slug}` : null
}

/**
 * The slug of a guide whose profile is public — `getGuide()` serves only an active, not hidden
 * guide, and only one with a slug has a URL (FA-1.86) — or null. A public profile is also indexable
 * only with at least one active offer (FA-1.86, tj D3); that half is the caller's to guarantee. A
 * trip card under an article (FA-1.97) guarantees it by being one: the card is an active offer of
 * this guide.
 */
export function publicGuideSlug(guide: { slug?: string | null; status?: string | null; is_hidden?: boolean | null }): string | null {
  if (guide.status !== 'active' || guide.is_hidden !== false) return null
  const slug = guide.slug?.trim()
  return slug != null && slug !== '' ? slug : null
}
