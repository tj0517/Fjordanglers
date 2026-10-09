/**
 * S3 "At a glance" (FA-1.54): six facts a visitor checks before reading anything else.
 * A card whose field is empty is not drawn — never "Terrain: —".
 */

import { Footprints, Languages, MapPin, Target, Users, type LucideIcon } from 'lucide-react'
import OfferSection from './offer-section'
import { Box, mutedStyle } from './offer-box'
import { languageNames } from '@/lib/experience-v2-content'

export type OfferAtAGlanceProps = {
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

  // Species are not a card here: "What you fish for" in the story section shows them with
  // a photo and a description, and the same name twice in 400 px reads as padding.
  const cards: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Target,     label: 'Techniques',        value: props.technique.join(', ') },
    { icon: MapPin,     label: 'Start and pick-up', value: meeting },
    {
      icon:  Users,
      label: 'Group size',
      value: props.maxAnglersPerGuide === 1
        ? '1 angler per guide'
        : `1–${props.maxAnglersPerGuide} anglers per guide`,
    },
    { icon: Languages,  label: 'Guide speaks', value: languageNames(props.languages).join(', ') },
    { icon: Footprints, label: 'Terrain',      value: terrainText(props.walkingKmMin, props.walkingKmMax) ?? '' },
  ].filter(card => card.value !== '')

  // Group size is a NOT NULL column, so there is always at least one card.
  return (
    <OfferSection section="S3" eyebrow="The essentials" title="At a glance">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ icon: Icon, label, value }) => (
          <Box key={label} className="flex items-start gap-3.5">
            <span
              aria-hidden
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
              style={{ background: 'rgba(10,46,77,0.06)' }}
            >
              <Icon size={19} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold uppercase tracking-[0.12em]" style={mutedStyle}>{label}</span>
              <span className="mt-1 block text-[15px] font-medium leading-snug">{value}</span>
            </span>
          </Box>
        ))}
      </div>
    </OfferSection>
  )
}
