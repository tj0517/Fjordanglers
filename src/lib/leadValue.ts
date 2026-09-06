import { type RegionGroup, getRegionGroup } from '@/lib/countries'

export type TripLength = '1' | '2-3' | '4-7' | '7+'

// New Zealand rates are not decided yet (tj, 2026-09-05) — using Nordic values
// until a decision is made. Do not interpolate from NZ page prices.
const BASE_VALUES: Record<RegionGroup, Record<TripLength, number>> = {
  Nordic: {
    '1':   100,
    '2-3': 400,
    '4-7': 900,
    '7+':  1600,
  },
  Patagonia: {
    '1':   150,
    '2-3': 600,
    '4-7': 1200,
    '7+':  2000,
  },
  'New Zealand': {
    '1':   100,
    '2-3': 400,
    '4-7': 900,
    '7+':  1600,
  },
}

const DEFAULT_GROUP: RegionGroup = 'Nordic'

export interface LeadValueParams {
  tripLength: TripLength
  groupSize:  number
  location?:  string
}

/**
 * Returns estimated commission in PLN for a lead.
 * Base value (per destination region) × min(groupSize, 4) / 2
 * (2 anglers = base, 1 = half, 4+ = double).
 * Unknown or missing location falls back to Nordic rates.
 */
export function estimateLeadValue({ tripLength, groupSize, location }: LeadValueParams): number {
  const group      = (location != null ? getRegionGroup(location) : null) ?? DEFAULT_GROUP
  const base       = BASE_VALUES[group][tripLength]
  const multiplier = Math.min(groupSize, 4) / 2
  return Math.round(base * multiplier)
}
