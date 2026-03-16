/**
 * experience-helpers.ts
 *
 * Utility functions to derive display values from the `packages` JSONB column.
 *
 * Packages can be in one of two shapes depending on when the record was created:
 *
 *   Old shape (migration from duration_options):
 *     { label, hours, days, price_eur, pricing_type?, includes_lodging }
 *
 *   New spec shape (trips-spec.md §5):
 *     { id, label, duration_hours, duration_days, pricing_model, price_eur,
 *       group_prices, level, max_group, min_group, availability }
 *
 * All functions gracefully handle null / empty packages arrays.
 */

// ─── Internal helpers ─────────────────────────────────────────────────────────

type Pkg = Record<string, unknown>

function asPkgs(packages: unknown): Pkg[] {
  if (!Array.isArray(packages)) return []
  return packages as Pkg[]
}

// ─── Derived value extractors ─────────────────────────────────────────────────

/**
 * Minimum price across all packages.
 * Handles both `price_eur` (old + new shape) keys.
 */
export function pkgMinPrice(packages: unknown): number | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null
  const prices = pkgs
    .map(p => {
      const v = p.price_eur
      return typeof v === 'number' ? v : null
    })
    .filter((p): p is number => p != null)
  return prices.length > 0 ? Math.min(...prices) : null
}

/**
 * Maximum group size across all packages (new shape only: `max_group`).
 * Falls back to null for old-shape records (pre-migration).
 */
export function pkgMaxGroup(packages: unknown): number | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null
  const groups = pkgs
    .map(p => {
      const v = p.max_group
      return typeof v === 'number' ? v : null
    })
    .filter((g): g is number => g != null)
  return groups.length > 0 ? Math.max(...groups) : null
}

/**
 * Level / difficulty from the first package (new shape: `level`).
 * Returns null for old-shape records that don't have a level field.
 */
export function pkgPrimaryLevel(packages: unknown): string | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null
  const level = pkgs[0].level
  return typeof level === 'string' ? level : null
}

/**
 * Human-readable duration string for display.
 *
 * Single-package: returns the label if set, otherwise "Xh" or "X days".
 * Multi-package: returns joined labels / short durations (e.g. "Half day · Full day").
 *
 * Handles both old shape (hours/days) and new shape (duration_hours/duration_days).
 */
export function pkgDurationStr(packages: unknown): string | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null

  const describeOne = (p: Pkg): string => {
    if (typeof p.label === 'string' && p.label.trim() !== '') return p.label
    const h = (p.duration_hours ?? p.hours) as number | null | undefined
    const d = (p.duration_days  ?? p.days)  as number | null | undefined
    if (typeof h === 'number') return `${h}h`
    if (typeof d === 'number') return `${d}d`
    return '—'
  }

  if (pkgs.length === 1) {
    const p = pkgs[0]
    if (typeof p.label === 'string' && p.label.trim() !== '') return p.label
    const h = (p.duration_hours ?? p.hours) as number | null | undefined
    const d = (p.duration_days  ?? p.days)  as number | null | undefined
    if (typeof h === 'number') return `${h} hours`
    if (typeof d === 'number') return `${d} ${d === 1 ? 'day' : 'days'}`
    return null
  }

  return pkgs.map(describeOne).join(' · ')
}

/**
 * Duration hours from the first package (for filter / sorting compatibility).
 * Reads `duration_hours` (new) or `hours` (old shape).
 */
export function pkgFirstHours(packages: unknown): number | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null
  const h = (pkgs[0].duration_hours ?? pkgs[0].hours) as number | null | undefined
  return typeof h === 'number' ? h : null
}

/**
 * Duration days from the first package.
 * Reads `duration_days` (new) or `days` (old shape).
 */
export function pkgFirstDays(packages: unknown): number | null {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return null
  const d = (pkgs[0].duration_days ?? pkgs[0].days) as number | null | undefined
  return typeof d === 'number' ? d : null
}

// ─── Form ↔ DB conversion ──────────────────────────────────────────────────────

/**
 * Shape compatible with DurationOptionPayload from @/actions/experiences.
 * Defined here to avoid circular imports; the shapes are structurally identical.
 */
export type PackageDurationOption = {
  label:            string
  hours:            number | null
  days:             number | null
  pricing_type:     'per_person' | 'per_boat' | 'per_group'
  price_eur:        number
  group_prices?:    Record<string, number>
  includes_lodging: boolean
}

/**
 * Convert the `packages` JSONB column value back to the `DurationOptionPayload[]`
 * format expected by ExperienceForm.
 *
 * Used in edit pages to seed form defaults from the DB packages column.
 * Handles both old (duration_options) and new (packages spec) shapes.
 */
export function packagesToDurationOptions(packages: unknown): PackageDurationOption[] {
  const pkgs = asPkgs(packages)
  if (pkgs.length === 0) return []

  return pkgs.map(p => {
    // Normalise pricing model / type field name
    const rawModel = (p.pricing_model ?? p.pricing_type) as string | undefined
    const pricingType: 'per_person' | 'per_boat' | 'per_group' =
      rawModel === 'per_boat' || rawModel === 'per_group' ? rawModel : 'per_person'

    // Normalise group prices
    const rawGP = p.group_prices
    const groupPrices =
      rawGP != null && typeof rawGP === 'object' && !Array.isArray(rawGP)
        ? (rawGP as Record<string, number>)
        : undefined

    return {
      label:            typeof p.label === 'string' ? p.label : '',
      hours:            typeof (p.duration_hours ?? p.hours) === 'number'
        ? (p.duration_hours ?? p.hours) as number
        : null,
      days:             typeof (p.duration_days ?? p.days) === 'number'
        ? (p.duration_days ?? p.days) as number
        : null,
      pricing_type:     pricingType,
      price_eur:        typeof p.price_eur === 'number' ? p.price_eur : 0,
      group_prices:     groupPrices,
      includes_lodging: Boolean(p.includes_lodging ?? false),
    }
  })
}
