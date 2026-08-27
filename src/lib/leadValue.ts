export type TripLength = '1' | '2-3' | '4-7' | '7+'

const BASE_VALUES: Record<TripLength, number> = {
  '1':   100,
  '2-3': 400,
  '4-7': 900,
  '7+':  1600,
}

export interface LeadValueParams {
  tripLength: TripLength
  groupSize:  number
  location?:  string
}

/**
 * Returns estimated commission in PLN for a lead.
 * Base value × min(groupSize, 4) / 2  (2 anglers = base, 1 = half, 4+ = double).
 */
export function estimateLeadValue({ tripLength, groupSize }: LeadValueParams): number {
  const base       = BASE_VALUES[tripLength]
  const multiplier = Math.min(groupSize, 4) / 2
  return Math.round(base * multiplier)
}
