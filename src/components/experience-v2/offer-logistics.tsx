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
import { Box, mutedStyle } from './offer-box'
import SeasonBar from './offer-season-bar'
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[3fr_2fr]">
        {hasMap && (
          // `isolate`: Leaflet gives its panes z-index 200–700 and its controls 1000, and
          // nothing above them made a stacking context, so they competed with the page's own
          // layers — the map was drawn over the mobile booking bar (z-40) and the inquiry
          // wizard (z-50). Its own stacking context keeps all of that inside the map.
          <div data-testid="offer-map" className="isolate">
            <OfferLocationMap
              lat={locationLat!}
              lng={locationLng!}
              zoom={REGION_ZOOM}
              geojson={null}
            />
            <p className="mt-1.5 text-[12px]" style={mutedStyle}>
              {region} — the fishing area, not an exact meeting point.
            </p>
          </div>
        )}

        {(hasFacts || hasSeason) && (
          <Box className="flex flex-col gap-3.5">
            {nearestAirport != null && (
              <p className="text-[15px]">
                <b>Nearest airport:</b> {nearestAirport}
              </p>
            )}

            {suggestedLodging.length > 0 && (
              <div className="text-[15px]">
                <b>Where to stay:</b>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {suggestedLodging.map((place, i) => (
                    <li key={`${i}-${place.name}`}>
                      {place.url != null ? (
                        <a href={place.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {place.name}
                        </a>
                      ) : (
                        place.name
                      )}
                      {place.note != null && (
                        <span style={mutedStyle}> — {place.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px]" style={mutedStyle}>
                  Suggestions only — you book your own lodging.
                </p>
              </div>
            )}

            <SeasonBar seasonMonths={seasonMonths} peakMonths={peakMonths} periods={seasonPeriods} />
          </Box>
        )}
      </div>
    </OfferSection>
  )
}
