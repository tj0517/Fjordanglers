/**
 * S3–S9 of the v2 offer page (FA-1.54), in reading order — scan first, read second,
 * meet the guide before the day, money last:
 *
 *   S3 at a glance · story (slot) · S7 your guides · S6 the day ·
 *   S12 what to bring · S4 included / not · S8 how booking works · S9 price and deposit
 *
 * The wireframe's numbering is kept on `data-section`; the order on the page is the
 * product decision of 2026-10-09 (tj): facts in five seconds, the story when interested,
 * the guide — the product, in an agency — right after it.
 *
 * Decyzja tj 2026-10-20 (Figma review, FA-1.62): "What to bring" (S12) moved up from the
 * bottom of the page to sit right before "Included" (S4), and S5 "Who it's for" is no longer
 * rendered. `OfferFit`, its `suited_for` / `not_suited_for` / `expectations_text` data and
 * the admin fields are kept on purpose — hidden, not removed — so S5 can come back by adding
 * one line here; its tests live in ./offer-fit.test.tsx.
 *
 * Takes the one object `getExperienceV2` returns and hands each section its slice — no
 * section reads anything else, and none queries (CLAUDE.md rule 3). Each section decides
 * for itself whether it has anything to show; a section with nothing to show renders
 * nothing, so the page never has a heading over an empty body.
 */

import type { ReactNode } from 'react'
import type { ExperienceV2 } from '@/lib/supabase/queries'
import OfferAtAGlance from './offer-at-a-glance'
import OfferIncluded from './offer-included'
import OfferBring from './offer-bring'
import OfferDay from './offer-day'
import OfferGuides from './offer-guides'
import OfferHowItWorks from './offer-how-it-works'
import OfferPriceTable from './offer-price-table'

export default function OfferBody({ page, story }: { page: ExperienceV2; story?: ReactNode }) {
  const primary = page.guides.find(g => g.isPrimary) ?? page.guides[0] ?? null

  const archetypes = page.options.filter(o => o.kind === 'archetype')
  const addons     = page.options.filter(o => o.kind === 'addon')

  return (
    <>
      <OfferAtAGlance
        technique={page.technique}
        meetingPointName={page.meetingPointName}
        meetingPointDescription={page.meetingPointDescription}
        maxAnglersPerGuide={page.maxAnglersPerGuide}
        languages={primary?.languages ?? []}
        walkingKmMin={page.walkingKmMin}
        walkingKmMax={page.walkingKmMax}
        heroFacts={page.heroFacts}
      />
      {story}
      <OfferGuides guides={page.guides} photoUrls={page.galleryImageUrls} responseSlaHours={page.responseSlaHours} />
      <OfferDay
        offerMode={page.offerMode}
        daySchedule={page.daySchedule}
        archetypes={archetypes}
        currency={page.currency}
      />
      <OfferBring whatToBring={page.whatToBring} />
      <OfferIncluded
        includes={page.includes}
        excludes={page.excludes}
        license={page.license}
        tipGuidanceText={page.tipGuidanceText}
        addons={addons}
        currency={page.currency}
      />
      <OfferHowItWorks offerEtaText={page.offerEtaText} feePct={page.feePct} />
      <OfferPriceTable
        offerMode={page.offerMode}
        prices={page.prices}
        feePct={page.feePct}
        currency={page.currency}
        maxAnglersPerGuide={page.maxAnglersPerGuide}
        minDays={page.minDays}
        priceFromCents={page.priceFromCents}
        priceToCents={page.priceToCents}
        archetypes={archetypes}
        weatherPolicyText={page.weatherPolicyText}
      />
    </>
  )
}
