/**
 * S14 "Check availability" (FA-1.55) — the end of the page, and step 1 of 3 of the form.
 *
 * The section is a frame; the form itself is `InquiryInline`, which shares its state with the
 * full-screen wizard every CTA above opens. `#zapytanie` is the anchor FA-1.53 wired the top
 * bar, the hero CTA and the sticky widget to, so it stays as it is.
 *
 * No accordion: the one section the whole page leads to is never collapsed.
 */

import { InquiryInline } from '@/components/inquiry-wizard/inquiry-wizard'
import OfferSection from './offer-section'

export default function OfferInquiry() {
  return (
    <OfferSection section="S14" anchor="zapytanie" title="Send your inquiry">
      <InquiryInline />
    </OfferSection>
  )
}
