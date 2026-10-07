/**
 * S1 chips — what the angler needs before reading a word of prose (FA-1.53):
 * where, how long, how many of them per guide, when, how hard, and whether gear is included.
 *
 * A chip with no data behind it is left out rather than shown empty — an offer page with
 * seven half-filled chips reads worse than one with four full ones.
 */

import { seasonLabel } from '@/lib/season-months'

/** Words in `experience_pages.includes` that mean the angler can turn up without tackle. */
const GEAR_WORDS = /\b(gear|rod|rods|tackle|equipment|flies|fly)\b/i

export function gearIncluded(includes: readonly string[]): boolean {
  return includes.some(item => GEAR_WORDS.test(item))
}

function lengthLabel(minDays: number, maxDays: number | null): string {
  if (maxDays != null && maxDays > minDays) return `${minDays}–${maxDays} days`
  if (minDays === 1) return 'full day'
  return `${minDays} days`
}

function anglersLabel(maxAnglersPerGuide: number): string {
  return maxAnglersPerGuide === 1
    ? '1 angler / guide'
    : `1–${maxAnglersPerGuide} anglers / guide`
}

export default function OfferChips({
  region,
  minDays,
  maxDays,
  maxAnglersPerGuide,
  seasonMonths,
  skillLevel,
  includes,
}: {
  region:             string
  minDays:            number
  maxDays:            number | null
  maxAnglersPerGuide: number
  seasonMonths:       number[]
  skillLevel:         number | null
  includes:           string[]
}) {
  const season = seasonLabel(seasonMonths)

  const chips = [
    region,
    lengthLabel(minDays, maxDays),
    anglersLabel(maxAnglersPerGuide),
    season != null ? `season ${season}` : null,
    skillLevel != null ? `level ${skillLevel} / 5` : null,
    gearIncluded(includes) ? 'gear included' : null,
  ].filter((c): c is string => c != null && c !== '')

  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" data-testid="offer-chips">
      {chips.map(chip => (
        <li
          key={chip}
          className="rounded-full border bg-white px-3 py-1.5 text-sm"
          style={{ borderColor: 'rgba(10,46,77,0.22)', color: 'var(--fa-navy)' }}
        >
          {chip}
        </li>
      ))}
    </ul>
  )
}
