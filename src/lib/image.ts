/**
 * Image URL helpers.
 *
 * Supabase Image Transformations (render endpoint) require the Pro plan.
 * On free tier we serve raw storage URLs and let next/image handle
 * resizing + WebP conversion via its built-in /_next/image pipeline.
 *
 * These helpers are kept as typed pass-throughs so call-sites stay clean
 * and can be switched to transform URLs later by editing this file only.
 */

/**
 * Returns the raw storage URL unchanged.
 * next/image resizes and converts to WebP automatically based on the
 * `sizes` attribute and the requesting device's viewport.
 */
export function getImageUrl(
  rawUrl: string | null | undefined,
): string | null {
  if (rawUrl == null || rawUrl === '') return null
  return rawUrl
}

// ─── Presets (semantic aliases — all return raw URL for now) ──────────────────

/** Experience / guide cover hero. */
export const heroFull = (url: string | null | undefined) => getImageUrl(url)

/** Gallery lightbox slide. */
export const gallerySlide = (url: string | null | undefined) => getImageUrl(url)

/** Card thumbnail in listing grids. */
export const cardThumb = (url: string | null | undefined) => getImageUrl(url)

/** Guide / user avatar. */
export const avatarImg = (url: string | null | undefined) => getImageUrl(url)
