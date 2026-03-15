/**
 * Landscape asset library
 *
 * Upload photos to Supabase Storage → bucket: "landscapes"
 * Naming convention: {country-slug}-{n}.jpg  (e.g. norway-1.jpg, norway-2.jpg)
 *
 * Public URL base:
 *   https://uwxrstbplaoxfghrchcy.supabase.co/storage/v1/object/public/landscapes/
 *
 * Recommended: 5–10 photos per country, landscape orientation, ≥ 2400px wide.
 * Good sources: your own shots, licensed stock (Adobe, Shutterstock),
 * or free (Unsplash/Pexels — check licence for commercial use).
 */

const BASE =
  'https://uwxrstbplaoxfghrchcy.supabase.co/storage/v1/object/public/landscapes'

// ─── Asset registry ───────────────────────────────────────────────────────────
// Add filenames here as you upload them. The picker will rotate through them.

const LANDSCAPES: Record<string, string[]> = {
  norway:  ['norge-1.jpg', 'norway-2.jpg'],
  sweden:  ['norge-1.jpg', 'norway-2.jpg'], // no Sweden photos yet — use Norway as fallback
  finland: ['finland-1.jpg', 'finland-2.jpg'],
  iceland: ['iceland-1.jpg', 'iceland-2.jpg'],
  denmark: ['denmark-1.jpg', 'denmark-2.jpg'],
  // fallback pool used when country is unknown
  default: ['norge-1.jpg', 'iceland-1.jpg', 'finland-1.jpg'],
}

// ─── Country slug normaliser ──────────────────────────────────────────────────

function toSlug(country: string | null | undefined): string {
  return (country ?? '').toLowerCase().trim()
}

// ─── Deterministic index (no random flicker on re-render) ────────────────────

function deterministicIndex(id: string, poolSize: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % poolSize
}

// ─── Flat library list (for the form picker) ─────────────────────────────────

export const LANDSCAPE_LIBRARY: string[] = [
  ...new Set(Object.values(LANDSCAPES).flat()),
].map(f => `${BASE}/${f}`)

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full public URL of a landscape photo.
 * @param country  Country name from DB (e.g. "Norway")
 * @param id       Experience or guide ID — used for deterministic rotation
 */
export function getLandscapeUrl(
  country: string | null | undefined,
  id: string,
): string {
  const slug = toSlug(country)
  const pool = LANDSCAPES[slug] ?? LANDSCAPES.default
  const filename = pool[deterministicIndex(id, pool.length)]
  return `${BASE}/${filename}`
}
