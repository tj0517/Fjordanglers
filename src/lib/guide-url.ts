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
