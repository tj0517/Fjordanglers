/**
 * S1 chips — what the angler needs before reading a word of prose (FA-1.53):
 * where, how long, how many of them per guide, when, and whether gear is included.
 *
 * A chip with no data behind it is left out rather than shown empty — an offer page with
 * seven half-filled chips reads worse than one with four full ones.
 *
 * Each chip can be typed in the admin (`hero_facts`, FA-1.63); a typed value is shown as
 * typed, and a chip with nothing typed is computed as before — chip by chip.
 *
 * Drawn as the site's uppercase tags (2026-11 mockup): sand, and salmon for "gear included".
 */

import { seasonLabel } from '@/lib/season-months'
import type { HeroFacts } from '@/lib/experience-v2-content'
import type { DayLength } from '@/lib/experiences/v2-editor'
import { Tag } from '@/components/site/ui'

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

const DAY_LENGTH_LABEL: Record<DayLength, string> = {
  full_day:  'full day',
  half_day:  'half day',
  multi_day: 'multi-day',
}

type Chip = { label: string; gear?: boolean }

export default function OfferChips({
  region,
  minDays,
  maxDays,
  maxAnglersPerGuide,
  seasonMonths,
  includes,
  heroFacts,
}: {
  region:             string
  minDays:            number
  maxDays:            number | null
  maxAnglersPerGuide: number
  seasonMonths:       number[]
  includes:           string[]
  heroFacts:          HeroFacts | null
}) {
  const months   = seasonLabel(seasonMonths)
  const location = heroFacts?.location ?? region
  const season   = heroFacts?.season ?? (months == null ? null : `season ${months}`)
  const gear     = heroFacts?.gearIncluded ?? gearIncluded(includes)

  const chips = ([
    location !== '' ? { label: location } : null,
    { label: heroFacts?.dayLength != null ? DAY_LENGTH_LABEL[heroFacts.dayLength] : lengthLabel(minDays, maxDays) },
    { label: heroFacts?.groupSize ?? anglersLabel(maxAnglersPerGuide) },
    season != null ? { label: season } : null,
    gear ? { label: 'gear included', gear: true } : null,
  ] as (Chip | null)[]).filter((c): c is Chip => c != null)

  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" data-testid="offer-chips">
      {chips.map(({ label, gear: isGear }) => (
        <li key={label} className="flex"><Tag tone={isGear === true ? 'salmon' : 'sand'}>{label}</Tag></li>
      ))}
    </ul>
  )
}
