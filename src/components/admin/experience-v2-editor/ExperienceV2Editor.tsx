'use client'

/**
 * The "Offer v2" tab of the admin experience page (FA-1.56): everything FA-1.50 added to
 * the schema, edited in one place. Each section saves on its own, through one action in
 * src/actions/experience-pages.ts — this tree never touches Supabase.
 *
 * `data` is what the database holds now; it is replaced after every save (router.refresh),
 * so anything derived from it — the base price row, the readiness list — is current, while
 * each section keeps its own draft.
 */

import type { ExperienceV2EditorData } from '@/actions/experience-pages'
import { basePriceCents } from '@/lib/experiences/v2-editor'
import { ContentSection } from './ContentSection'
import { Notice } from './fields'
import { GuidesSection } from './GuidesSection'
import { OfferSection } from './OfferSection'
import { OptionsSection } from './OptionsSection'
import { PriceGridSection } from './PriceGridSection'
import { PublicationSection } from './PublicationSection'

export function ExperienceV2Editor({ data }: { data: ExperienceV2EditorData }) {
  const { page } = data
  const baseCents = basePriceCents(data.prices, page.maxAnglersPerGuide, data.today)

  return (
    <div className="flex flex-col gap-6">
      {data.shapeWarnings.length > 0 && (
        <Notice tone="warning">
          Stored data did not have the expected shape and is shown empty: {data.shapeWarnings.join(', ')}.
          Saving that section replaces what is stored.
        </Notice>
      )}

      <GuidesSection
        experienceId={page.id}
        guides={data.guides}
        available={data.availableGuides}
        legacyGuideId={page.legacyGuideId}
        baseCents={baseCents}
        maxAnglersPerGuide={page.maxAnglersPerGuide}
        currency={page.currency}
      />
      <OfferSection page={page} />
      <PriceGridSection
        experienceId={page.id}
        prices={data.prices}
        currency={page.currency}
        maxAnglersPerGuide={page.maxAnglersPerGuide}
        feeBp={page.feeBp}
        today={data.today}
      />
      <ContentSection page={page} />
      <OptionsSection options={data.options} currency={page.currency} />
      <PublicationSection data={data} />
    </div>
  )
}
