/**
 * S3 "At a glance" (FA-1.54): six facts a visitor checks before reading anything else.
 * A card whose field is empty is not drawn — never "Terrain: —".
 *
 * "Start and pick-up" and "Group size" can be typed in the admin (`hero_facts`, FA-1.63);
 * with nothing typed they are computed as before, each on its own.
 *
 * Drawn as the mockup's frosted tiles (`.fq`) on a grain block, label over value, no icons.
 */

import OfferSection from './offer-section'
import { SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import { languageNames, type HeroFacts } from '@/lib/experience-v2-content'
import { anglersPerGuideLabel } from '@/lib/pricing/experience-price'

export type OfferAtAGlanceProps = {
  technique:          string[]
  meetingPointName:        string | null
  meetingPointDescription: string | null
  maxAnglersPerGuide: number
  /** The primary guide's languages. */
  languages:          string[]
  walkingKmMin:       number | null
  walkingKmMax:       number | null
  heroFacts:          HeroFacts | null
}

/** "6–12 km on foot", "up to 8 km on foot", "from 3 km on foot" — whichever ends exist. */
function terrainText(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return min === max ? `${min} km on foot` : `${min}–${max} km on foot`
  if (max != null) return `up to ${max} km on foot`
  if (min != null) return `from ${min} km on foot`
  return null
}

export default function OfferAtAGlance(props: OfferAtAGlanceProps) {
  const meeting = props.heroFacts?.startPickup ?? [props.meetingPointName, props.meetingPointDescription]
    .filter((part): part is string => part != null && part.trim() !== '')
    .join(' — ')

  // Species are not a card here: "What you fish for" in the story section shows them with
  // a photo and a description, and the same name twice in 400 px reads as padding.
  const cards: { label: string; value: string }[] = [
    { label: 'Techniques',        value: props.technique.join(', ') },
    { label: 'Start and pick-up', value: meeting },
    { label: 'Group size',        value: props.heroFacts?.groupSize ?? anglersPerGuideLabel(props.maxAnglersPerGuide) },
    { label: 'Guide speaks',      value: languageNames(props.languages).join(', ') },
    { label: 'Terrain',           value: terrainText(props.walkingKmMin, props.walkingKmMax) ?? '' },
  ].filter(card => card.value !== '')

  // Group size is a NOT NULL column, so there is always at least one card.
  return (
    <OfferSection section="S3" eyebrow="The essentials" title="At a glance">
      <div
        className={`${grain.blur} ${grain.nz} grid gap-2.5 rounded-[20px] p-3.5 sm:p-5`}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        {cards.map(({ label, value }) => (
          <span key={label} className={`${grain.fq} flex min-w-0 flex-col gap-1`} style={{ padding: '13px 18px' }}>
            <span className="block text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: SALMON_ON_DARK }}>{label}</span>
            <span className="block whitespace-pre-line text-[15.5px] font-semibold leading-[1.35] text-white">{value}</span>
          </span>
        ))}
      </div>
    </OfferSection>
  )
}
