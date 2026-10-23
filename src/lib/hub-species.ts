/**
 * Species chips of a country hub (FA-1.65, tj D2 2026-10-23) — pure, shared by the data
 * layer (which list to show) and the client filter (which cards a chip keeps).
 *
 * `target_species` is admin-typed free text, so "Brown Trout", "brown trout" and
 * " Brown  Trout" are one species. Two strings are the same species when their keys match.
 */

/** Trimmed, inner whitespace collapsed — how a species is printed. */
function normaliseSpecies(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** What two spellings of one species have in common. */
export function speciesKey(name: string): string {
  return normaliseSpecies(name).toLowerCase()
}

/**
 * The union of the offers' species, deduplicated by key. The first spelling seen is the one
 * printed. Most offers first (what the hub is mostly about), then alphabetical.
 */
function deriveSpecies(perOffer: readonly (readonly string[])[]): string[] {
  const seen = new Map<string, { label: string; offers: number }>()

  for (const list of perOffer) {
    const keys = new Set<string>()
    for (const raw of list) {
      const label = normaliseSpecies(raw)
      if (label === '') continue
      const key = speciesKey(label)
      if (keys.has(key)) continue
      keys.add(key)
      const entry = seen.get(key)
      if (entry == null) seen.set(key, { label, offers: 1 })
      else entry.offers += 1
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.offers - a.offers || a.label.localeCompare(b.label))
    .map(e => e.label)
}

/** The chips a hub shows: its own list when it has one (D2 override), else the derived one. */
export function hubSpecies(override: readonly string[] | undefined, perOffer: readonly (readonly string[])[]): string[] {
  const own = (override ?? []).map(normaliseSpecies).filter(s => s !== '')
  return own.length > 0 ? own : deriveSpecies(perOffer)
}

/** Whether an offer with these species stays visible under the chip. */
export function offerHasSpecies(offerSpecies: readonly string[], chip: string): boolean {
  const key = speciesKey(chip)
  return offerSpecies.some(s => speciesKey(s) === key)
}
