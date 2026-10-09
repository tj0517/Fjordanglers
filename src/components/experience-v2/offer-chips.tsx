/**
 * S1 chips — what the angler needs before reading a word of prose (FA-1.53):
 * where, how long, how many of them per guide, when, how hard, and whether gear is included.
 *
 * A chip with no data behind it is left out rather than shown empty — an offer page with
 * seven half-filled chips reads worse than one with four full ones.
 */

import { CalendarDays, Gauge, MapPin, Package, Sun, Users, type LucideIcon } from 'lucide-react'
import { seasonLabel } from '@/lib/season-months'
import { cardShadow } from './offer-box'

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

type Chip = { icon: LucideIcon; label: string }

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

  const chips = ([
    region !== '' ? { icon: MapPin, label: region } : null,
    { icon: CalendarDays, label: lengthLabel(minDays, maxDays) },
    { icon: Users, label: anglersLabel(maxAnglersPerGuide) },
    season != null ? { icon: Sun, label: `season ${season}` } : null,
    skillLevel != null ? { icon: Gauge, label: `level ${skillLevel} / 5` } : null,
    gearIncluded(includes) ? { icon: Package, label: 'gear included' } : null,
  ] as (Chip | null)[]).filter((c): c is Chip => c != null)

  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" data-testid="offer-chips">
      {chips.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2.5 pr-3.5 text-sm font-medium"
          style={{ boxShadow: cardShadow, color: 'var(--fa-navy)' }}
        >
          <Icon aria-hidden size={15} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.55)' }} />
          {label}
        </li>
      ))}
    </ul>
  )
}
