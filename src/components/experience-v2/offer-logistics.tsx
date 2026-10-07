/**
 * S11 "Where it is, and when" (FA-1.55) — the map, the two logistics facts an angler books
 * flights on, and the twelve-month season bar.
 *
 * The map is the component the offer page already uses (`OfferLocationMap`), so there is one
 * Leaflet setup in the codebase, not two. It renders only with both coordinates: a lone
 * latitude draws the middle of the ocean.
 *
 * The season bar is drawn from `season_months` and `peak_months`, which the admin stores as
 * month numbers. `peak_months` entries outside `season_months` are shown as peak anyway —
 * the data says "best", and silently hiding a month the admin marked would be worse than an
 * inconsistent-looking bar that they can see and fix.
 */

import OfferSection from './offer-section'
import { OfferLocationMap } from '@/components/offer/OfferLocationMap'
import { Box, mutedStyle } from './offer-box'
import type { LodgingSuggestion } from '@/lib/experience-v2-content'

export type OfferLogisticsProps = {
  locationLat:      number | null
  locationLng:      number | null
  nearestAirport:   string | null
  suggestedLodging: LodgingSuggestion[]
  seasonMonths:     number[]
  peakMonths:       number[]
  region:           string
}

/** Wide enough to read at 390 px: one letter per month, with the full name in the title. */
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The zoom the region-level map of an offer page opens at; `experience_pages` stores none. */
const REGION_ZOOM = 8

function SeasonBar({ seasonMonths, peakMonths }: { seasonMonths: number[]; peakMonths: number[] }) {
  const season = new Set(seasonMonths)
  const peak   = new Set(peakMonths)
  if (season.size === 0 && peak.size === 0) return null

  return (
    <div data-testid="offer-season-bar">
      <p className="mb-1.5 text-[13px] uppercase tracking-wide" style={mutedStyle}>
        Season, month by month
      </p>
      <ol className="grid grid-cols-12 gap-[3px] text-center text-[11px]">
        {MONTH_INITIALS.map((initial, index) => {
          const month  = index + 1
          const isPeak = peak.has(month)
          const isOpen = season.has(month)
          const state  = isPeak ? 'peak' : isOpen ? 'open' : 'closed'
          return (
            <li
              key={month}
              data-month={month}
              data-state={state}
              title={`${MONTH_NAMES[index]} — ${isPeak ? 'best' : isOpen ? 'open' : 'closed'}`}
              className="rounded py-2"
              style={
                isPeak
                  ? { background: 'var(--fa-navy)', color: '#fff' }
                  : isOpen
                    ? { background: 'rgba(10,46,77,0.22)' }
                    : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.45)' }
              }
            >
              <span aria-hidden>{initial}</span>
              <span className="sr-only">{MONTH_NAMES[index]}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-[12px]" style={mutedStyle}>
        dark = best months · mid = open · pale = closed
      </p>
    </div>
  )
}

export default function OfferLogistics({
  locationLat,
  locationLng,
  nearestAirport,
  suggestedLodging,
  seasonMonths,
  peakMonths,
  region,
}: OfferLogisticsProps) {
  const hasMap    = locationLat != null && locationLng != null
  const hasFacts  = nearestAirport != null || suggestedLodging.length > 0
  const hasSeason = seasonMonths.length > 0 || peakMonths.length > 0

  // The empty-field guard: no map, no facts and no season — nothing to put under a heading.
  if (!hasMap && !hasFacts && !hasSeason) return null

  return (
    <OfferSection section="S11" title="Where it is, and when" accordion={{ defaultOpen: true }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[3fr_2fr]">
        {hasMap && (
          <div data-testid="offer-map">
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

            <SeasonBar seasonMonths={seasonMonths} peakMonths={peakMonths} />
          </Box>
        )}
      </div>
    </OfferSection>
  )
}
