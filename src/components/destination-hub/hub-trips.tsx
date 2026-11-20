'use client'

/**
 * The trip cards of a country hub with the species filter above them (FA-1.65; redesign
 * docs/design/blog-hubs-2026-11): one grid, one row of filter buttons, no map. A button filters
 * the cards client-side by `target_species`; "All species" resets. A card click is counted as
 * `hub_card_click`.
 */

import { useState } from 'react'
import { useHubFunnel } from '@/components/analytics/hub-funnel'
import { offerHasSpecies, speciesKey } from '@/lib/hub-species'
import type { HubOffer } from '@/lib/supabase/queries'
import { TripCard, tripCardFromOffer } from '@/components/site/trip-card'
import { CREAM, LINE, MUTED, NAVY, SectionHeading } from '@/components/site/ui'

export type HubTripsProps = {
  offers:  HubOffer[]
  species: string[]
  /** "Iceland" in "Guided fishing trips in Iceland". */
  place?:  string
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="f-body inline-flex min-h-[44px] cursor-pointer items-center px-[18px] text-[14.5px] font-semibold"
      style={{
        borderRadius: 9,
        background: active ? NAVY : CREAM,
        color:      active ? '#FFFFFF' : NAVY,
        border:     `1.5px solid ${active ? NAVY : LINE}`,
      }}
    >
      {label}
    </button>
  )
}

export default function HubTrips({ offers, species, place }: HubTripsProps) {
  const [chip, setChip] = useState<string | null>(null)
  const funnel = useHubFunnel()

  if (offers.length === 0) return null

  const visible = chip == null ? offers : offers.filter(o => offerHasSpecies(o.targetSpecies, chip))

  return (
    <section id="trips" data-section="trips" className="flex scroll-mt-24 flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <SectionHeading eyebrow="Trips" title={place != null ? `Guided fishing trips in ${place}` : 'Guided fishing trips'} />
        {species.length > 0 && (
          <div role="group" aria-label="Filter by species" className="flex flex-wrap gap-2" data-testid="hub-species-chips">
            <FilterButton label="All species" active={chip == null} onClick={() => setChip(null)} />
            {species.map(name => (
              <FilterButton
                key={speciesKey(name)}
                label={name}
                active={chip != null && speciesKey(chip) === speciesKey(name)}
                onClick={() => setChip(current => (current === name ? null : name))}
              />
            ))}
          </div>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-x-7 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }} data-testid="hub-cards">
          {visible.map((offer, idx) => (
            <TripCard key={offer.id} trip={tripCardFromOffer(offer)} priority={idx < 4} onClick={() => funnel?.cardClick(offer.page.slug, idx + 1)} />
          ))}
        </div>
      ) : (
        <p className="f-body text-[15px]" style={{ color: MUTED }} data-testid="hub-cards-empty">
          No trips for {chip} yet.
        </p>
      )}
    </section>
  )
}
