/**
 * S12 "What to bring" (FA-1.55) — `experience_pages.what_to_bring`, a plain `text[]` the
 * admin fills line by line. Closed by default on mobile: it matters once the trip is booked,
 * not while deciding to send an inquiry.
 */

import OfferSection from './offer-section'
import { Box, BulletList } from './offer-box'

export type OfferBringProps = { whatToBring: string[] }

export default function OfferBring({ whatToBring }: OfferBringProps) {
  // The empty-field guard: no list, no section.
  if (whatToBring.length === 0) return null

  return (
    <OfferSection section="S12" eyebrow="Packing" title="What to bring" accordion={{ defaultOpen: false }}>
      <Box>
        <BulletList items={whatToBring} />
      </Box>
    </OfferSection>
  )
}
