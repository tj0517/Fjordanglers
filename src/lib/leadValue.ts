import { type RegionGroup, getRegionGroup } from '@/lib/countries'

export type TripLength = '1' | '2-3' | '4-7' | '7+'

const BASE_VALUES: Record<RegionGroup, Record<TripLength, number>> = {
  Nordic: {
    '1':   650,
    '2-3': 2500,
    '4-7': 5000,
    '7+':  7500,
  },
  Patagonia: {
    '1':   650,
    '2-3': 2500,
    '4-7': 5000,
    '7+':  7500,
  },
  'New Zealand': {
    '1':   500,
    '2-3': 1200,
    '4-7': 3000,
    '7+':  5000,
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
