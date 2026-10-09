/**
 * S5 "Who it's for / who it isn't" (FA-1.54) — the section that talks a wrong-fit angler
 * out of sending an inquiry, which is worth more than the inquiry.
 *
 * Rendered only when at least one of the two lists has an entry. `expectations_text` alone
 * does not open the section: a quote under a heading with no lists reads as a fragment,
 * and an admin who wrote only the quote has not yet written the section.
 */

import OfferSection from './offer-section'
import { Box, BulletList, mutedStyle } from './offer-box'

export type OfferFitProps = {
  suitedFor:        string[]
  notSuitedFor:     string[]
  expectationsText: string | null
}

export default function OfferFit({ suitedFor, notSuitedFor, expectationsText }: OfferFitProps) {
  // The empty-field guard: no list, no section — never an empty heading.
  if (suitedFor.length === 0 && notSuitedFor.length === 0) return null

  return (
    <OfferSection section="S5" eyebrow="Is it for you" title="Who it's for — and who it isn't" accordion={{ defaultOpen: true }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {suitedFor.length > 0 && (
          <Box accent>
            <h3 className="mb-2.5 text-lg font-semibold">Ideal if…</h3>
            <BulletList items={suitedFor} />
          </Box>
        )}
        {notSuitedFor.length > 0 && (
          <Box>
            <h3 className="mb-2.5 text-lg font-semibold">Not for you if…</h3>
            <BulletList items={notSuitedFor} />
          </Box>
        )}
      </div>
      {expectationsText != null && (
        <blockquote className="mt-4 text-[15px] italic" style={mutedStyle}>
          “{expectationsText}”
        </blockquote>
      )}
    </OfferSection>
  )
}
