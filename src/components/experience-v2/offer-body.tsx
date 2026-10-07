/**
 * S3–S9 of the v2 offer page, in the wireframe's order (FA-1.54):
 *
 *   S3 at a glance · S4 included / not · S5 who it's for · S6 the day ·
 *   S7 your guides · S8 how booking works · S9 price and deposit
 *
 * Takes the one object `getExperienceV2` returns and hands each section its slice — no
 * section reads anything else, and none queries (CLAUDE.md rule 3). Each section decides
 * for itself whether it has anything to show; a section with nothing to show renders
 * nothing, so the page never has a heading over an empty body.
 */

import type { ExperienceV2 } from '@/lib/supabase/queries'
import OfferAtAGlance from './offer-at-a-glance'
import OfferIncluded from './offer-included'
import OfferFit from './offer-fit'
import OfferDay from './offer-day'
import OfferGuides from './offer-guides'
import OfferHowItWorks from './offer-how-it-works'
import OfferPriceTable from './offer-price-table'

export default function OfferBody({ page }: { page: ExperienceV2 }) {
  const primary = page.guides.find(g => g.isPrimary) ?? page.guides[0] ?? null

  const archetypes = page.options.filter(o => o.kind === 'archetype')
  const addons     = page.options.filter(o => o.kind === 'addon')

  return (
    <>
      <OfferAtAGlance
        speciesNames={page.speciesNames}
        technique={page.technique}
        meetingPointName={page.meetingPointName}
        meetingPointDescription={page.meetingPointDescription}
        maxAnglersPerGuide={page.maxAnglersPerGuide}
        languages={primary?.languages ?? []}
        walkingKmMin={page.walkingKmMin}
        walkingKmMax={page.walkingKmMax}
      />
      <OfferIncluded
        includes={page.includes}
        excludes={page.excludes}
        license={page.license}
        tipGuidanceText={page.tipGuidanceText}
        addons={addons}
        currency={page.currency}
      />
      <OfferFit
        suitedFor={page.suitedFor}
        notSuitedFor={page.notSuitedFor}
        expectationsText={page.expectationsText}
      />
      <OfferDay
        offerMode={page.offerMode}
        daySchedule={page.daySchedule}
        archetypes={archetypes}
        currency={page.currency}
      />
      <OfferGuides guides={page.guides} />
      <OfferHowItWorks
        offerEtaText={page.offerEtaText}
        feePct={page.feePct}
        balancePaymentMethod={primary?.balancePaymentMethod ?? null}
      />
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
