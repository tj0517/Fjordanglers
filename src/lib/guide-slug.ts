/**
 * Guide slugs — the one place that decides what a valid slug is and when a guide may be active
 * (FA-1.86). Pure: no I/O. The database enforces the same rule (`guides_active_requires_slug`,
 * "status <> 'active' or a non-blank slug"); this module gives the admin a readable error first.
 */

const GUIDE_SLUG_MAX_LENGTH = 80

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Letters NFKD does not decompose into base letter + mark. */
const TRANSLITERATE: Record<string, string> = {
  ø: 'o', æ: 'ae', å: 'a', ð: 'd', þ: 'th', ł: 'l', ß: 'ss', đ: 'd', ı: 'i', œ: 'oe',
}

/** `name-country` in the shape of the slugs already on prod (e.g. `inge-ronning-norway`). */
export function suggestGuideSlug(fullName: string, country: string): string {
  const raw = `${fullName} ${country}`.trim().toLowerCase()
  const folded = Array.from(raw)
    .map(ch => TRANSLITERATE[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, GUIDE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '')
}

/** Null when `slug` is a usable public profile slug, otherwise a message for the admin. */
export function validateGuideSlug(slug: string | null | undefined): string | null {
  const value = slug?.trim() ?? ''
  if (value === '') return 'A slug is required.'
  if (value.length > GUIDE_SLUG_MAX_LENGTH) return `The slug must be at most ${GUIDE_SLUG_MAX_LENGTH} characters.`
  if (!SLUG_RE.test(value)) return 'The slug may contain only lowercase letters, digits and single hyphens (e.g. "inge-ronning-norway").'
  return null
}

/** A guide can be `active` only with a slug; returns the error to show, or null if it may. */
export function activationBlocker(status: string, slug: string | null | undefined): string | null {
  if (status !== 'active') return null
  if ((slug?.trim() ?? '') === '') {
    return 'A guide cannot be activated without a slug. Set the slug first — it becomes the public profile URL.'
  }
  return null
}

/** An active guide keeps its slug: renaming means deactivating first (the old URL would break). */
export function slugChangeBlocker(
  current: { status: string; slug: string | null },
  nextSlug: string | null | undefined,
): string | null {
  if (current.status !== 'active') return null
  const currentSlug = current.slug?.trim() ?? ''
  if (currentSlug === '') return null
  if (nextSlug == null || nextSlug.trim() === currentSlug) return null
  return 'The slug of an active guide cannot be changed — its public URL would break. Deactivate the guide first.'
}
