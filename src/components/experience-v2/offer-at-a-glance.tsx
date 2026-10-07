/**
 * S3 "At a glance" (FA-1.54): six facts a visitor checks before reading anything else.
 * A card whose field is empty is not drawn — never "Terrain: —".
 */

import OfferSection from './offer-section'
import { Box, mutedStyle } from './offer-box'

export type OfferAtAGlanceProps = {
  speciesNames:       string[]
  technique:          string[]
  meetingPointName:        string | null
  meetingPointDescription: string | null
  maxAnglersPerGuide: number
  /** The primary guide's languages. */
  languages:          string[]
  walkingKmMin:       number | null
  walkingKmMax:       number | null
}

/** "6–12 km on foot", "up to 8 km on foot", "from 3 km on foot" — whichever ends exist. */
function terrainText(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return min === max ? `${min} km on foot` : `${min}–${max} km on foot`
  if (max != null) return `up to ${max} km on foot`
  if (min != null) return `from ${min} km on foot`
  return null
}

export default function OfferAtAGlance(props: OfferAtAGlanceProps) {
  const meeting = [props.meetingPointName, props.meetingPointDescription]
    .filter((part): part is string => part != null && part.trim() !== '')
    .join(' — ')

  const cards: { label: string; value: string }[] = [
    { label: 'Species',      value: props.speciesNames.join(', ') },
    { label: 'Techniques',   value: props.technique.join(', ') },
    { label: 'Start and pick-up', value: meeting },
    {
      label: 'Group size',
      value: props.maxAnglersPerGuide === 1
        ? '1 angler per guide'
        : `1–${props.maxAnglersPerGuide} anglers per guide`,
    },
    { label: 'Guide speaks', value: props.languages.join(', ') },
    { label: 'Terrain',      value: terrainText(props.walkingKmMin, props.walkingKmMax) ?? '' },
  ].filter(card => card.value !== '')

  // Group size is a NOT NULL column, so there is always at least one card.
  return (
    <OfferSection section="S3" title="At a glance">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <Box key={card.label}>
            <p className="mb-1 text-[13px]" style={mutedStyle}>{card.label}</p>
            <p className="font-medium">{card.value}</p>
          </Box>
        ))}
      </div>
    </OfferSection>
  )
}
