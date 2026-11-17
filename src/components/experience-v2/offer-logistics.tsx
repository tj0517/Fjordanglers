/**
 * S11 "Where it is, and when" (FA-1.55) — the map, the two logistics facts an angler books
 * flights on, and the twelve-month season bar.
 *
 * The map is the component the offer page already uses (`OfferLocationMap`), so there is one
 * Leaflet setup in the codebase, not two. It renders only with both coordinates: a lone
 * latitude draws the middle of the ocean.
 *
 * The season bar, with what each part of the season is like, is `SeasonBar`
 * (./offer-season-bar.tsx) — a client component, so this section stays a server one.
 */

import OfferSection from './offer-section'
import { OfferLocationMap } from '@/components/offer/OfferLocationMap'
import SeasonBar from './offer-season-bar'
import { CREAM, ON_DARK, SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import type { LodgingSuggestion, SeasonPeriod } from '@/lib/experience-v2-content'

export type OfferLogisticsProps = {
  locationLat:      number | null
  locationLng:      number | null
  nearestAirport:   string | null
  suggestedLodging: LodgingSuggestion[]
  seasonMonths:     number[]
  peakMonths:       number[]
  seasonPeriods:    SeasonPeriod[]
  region:           string
}

/** The zoom the region-level map of an offer page opens at; `experience_pages` stores none. */
const REGION_ZOOM = 8

export default function OfferLogistics({
  locationLat,
  locationLng,
  nearestAirport,
  suggestedLodging,
  seasonMonths,
  peakMonths,
  seasonPeriods,
  region,
}: OfferLogisticsProps) {
  const hasMap    = locationLat != null && locationLng != null
  const hasFacts  = nearestAirport != null || suggestedLodging.length > 0
  const hasSeason = seasonMonths.length > 0 || peakMonths.length > 0

  // The empty-field guard: no map, no facts and no season — nothing to put under a heading.
  if (!hasMap && !hasFacts && !hasSeason) return null

  return (
    <OfferSection section="S11" eyebrow="Getting there" title="Where it is, and when" accordion={{ defaultOpen: true }}>
      <div className="flex flex-wrap items-stretch gap-6">
        {hasMap && (
          <div data-testid="offer-map" className="min-w-0 flex-[1_1_360px]">
            <div className="overflow-hidden rounded-[20px]">
              <OfferLocationMap
                lat={locationLat!}
                lng={locationLng!}
                zoom={REGION_ZOOM}
                geojson={null}
              />
            </div>
            <p className="mt-2 text-[12.5px]" style={{ color: '#4F6275' }}>
              {region} — the fishing area, not an exact meeting point.
            </p>
          </div>
        )}

        {(hasFacts || hasSeason) && (
          <div className={`${grain.blur} ${grain.finland} flex min-w-0 flex-[1_1_420px] flex-col gap-2.5 self-start rounded-[20px] p-3.5`}>
            {hasSeason && (
              <div className="rounded-[14px] px-4 py-5 sm:px-[22px]" style={{ background: `${CREAM}F7` }}>
                <SeasonBar seasonMonths={seasonMonths} peakMonths={peakMonths} periods={seasonPeriods} />
              </div>
            )}

            {hasFacts && (
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                {nearestAirport != null && (
                  <Fact label="Nearest airport">{nearestAirport}</Fact>
                )}

                {suggestedLodging.length > 0 && (
                  <Fact label="Where to stay">
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {suggestedLodging.map((place, i) => (
                        <li key={`${i}-${place.name}`}>
                          {place.url != null ? (
                            <a href={place.url} target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-[3px]" style={{ textDecorationColor: SALMON_ON_DARK }}>
                              {place.name}
                            </a>
                          ) : (
                            place.name
                          )}
                          {place.note != null && (
                            <span className="mt-1 block text-[13.5px] font-medium" style={{ color: ON_DARK }}>{place.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <span className="mt-1.5 block text-[12.5px] font-medium" style={{ color: ON_DARK }}>
                      Suggestions only — you book your own lodging.
                    </span>
                  </Fact>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </OfferSection>
  )
}

/** One frosted tile on the grain block (the mockup's `.fq`): label over value. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${grain.fq} flex min-w-0 flex-col gap-1`} style={{ padding: '13px 18px' }}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: SALMON_ON_DARK }}>{label}</span>
      <div className="text-[15.5px] font-semibold leading-[1.35] text-white">{children}</div>
    </div>
  )
}
