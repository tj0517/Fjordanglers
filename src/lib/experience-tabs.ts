/**
 * Mapping between the tab index on /experiences/[slug] and the URL hash.
 *
 * Tab 0 is Overview and has no hash. Tabs 1 and 2 keep the historical names
 * `day-trip` and `multi-day` — those addresses have been sent out and indexed,
 * so they must not change. Every further tab is `option-N`, N being the tab
 * index, so an experience with five options is fully addressable.
 *
 * Kept out of the component on purpose: this is the part that was wrong and it
 * is the part worth testing without a renderer.
 */

const TAB_1_HASH = 'day-trip'
const TAB_2_HASH = 'multi-day'

/** `option-3`, `option-12` — no leading zeros, no `option-0`, no `option-abc`. */
const OPTION_HASH = /^option-([1-9]\d*)$/

/** Hash for a tab index, or `null` for Overview (tab 0), which carries no hash. */
export function hashForTab(idx: number): string | null {
  if (!Number.isInteger(idx) || idx <= 0) return null
  if (idx === 1) return TAB_1_HASH
  if (idx === 2) return TAB_2_HASH
  return `option-${idx}`
}

/**
 * Tab index for a hash, clamped to the tabs this experience actually has.
 * Anything unknown, malformed or out of range is Overview (0) — a stale link
 * lands on the page rather than on a blank tab.
 *
 * `option-1` / `option-2` are deliberately NOT accepted: tabs 1 and 2 are
 * addressed by their historical names, so accepting both spellings would make
 * the mapping ambiguous.
 */
export function tabFromHash(hash: string, optionCount: number): number {
  if (hash === TAB_1_HASH) return optionCount > 0 ? 1 : 0
  if (hash === TAB_2_HASH) return optionCount > 1 ? 2 : 0

  const m = OPTION_HASH.exec(hash)
  if (m == null) return 0

  const idx = Number(m[1])
  if (idx < 3 || idx > optionCount) return 0
  return idx
}
