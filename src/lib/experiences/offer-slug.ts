/**
 * Offer (experience page) slugs — the generator behind the page form's URL slug field (FA-1.89).
 * Pure: no I/O. New slugs are ASCII, lowercase, single-hyphen separated, no edge hyphens.
 * Validation (`slugSchema` in `v2-editor.ts`) is deliberately looser: live slugs and aliases with
 * "--" exist and must stay saveable.
 */

/** Letters NFKD does not decompose into base letter + mark. */
const TRANSLITERATE: Record<string, string> = {
  ø: 'o', æ: 'ae', å: 'a', ð: 'd', þ: 'th', ł: 'l', ß: 'ss', đ: 'd', ı: 'i', œ: 'oe',
}

/** Lowercase ASCII words separated by single hyphens; may still have a hyphen at either edge. */
function hyphenate(text: string): string {
  return Array.from(text.toLowerCase())
    .map(ch => TRANSLITERATE[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
}

/** "Fly fishing – Taupō & Tongariro" → "fly-fishing-taupo-and-tongariro". */
export function slugify(text: string): string {
  return hyphenate(text).replace(/^-+|-+$/g, '')
}

/**
 * The same rule for a slug being typed by hand: keeps one trailing hyphen so the next word can
 * follow it. `finishSlug` removes it on save.
 */
export function slugifyDraft(text: string): string {
  return hyphenate(text).replace(/^-+/, '')
}

/** A typed slug as saved: only the trailing hyphen a draft may end with is removed. */
export function finishSlug(slug: string): string {
  return slug.trim().replace(/-+$/, '')
}
