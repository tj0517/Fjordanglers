'use client'

/**
 * The species chips and the offer cards of a country hub (FA-1.65) — one client component
 * because a chip filters the cards under it, client-side, by `target_species` ("All" resets).
 *
 * Two sections, each with its own `data-section` anchor (FA-1.66 measures them): the chips
 * render only when the hub has species, the cards only when it has offers.
 */

import { useState } from 'react'
import { ExpCard } from '@/components/trips/exp-card'
import OfferSection from '@/components/experience-v2/offer-section'
import { offerHasSpecies, speciesKey } from '@/lib/hub-species'
import type { HubOffer } from '@/lib/supabase/queries'

export type HubTripsProps = {
  offers:  HubOffer[]
  species: string[]
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full px-4 text-[14px] font-medium f-body transition-colors"
      style={{
        minHeight: 40,
        background: active ? '#0A2E4D' : '#fff',
        color:      active ? '#fff' : '#0A2E4D',
        boxShadow:  active ? 'none' : 'inset 0 0 0 1px rgba(10,46,77,0.16)',
      }}
    >
      {label}
    </button>
  )
}

export default function HubTrips({ offers, species }: HubTripsProps) {
  const [chip, setChip] = useState<string | null>(null)

  const visible = chip == null ? offers : offers.filter(o => offerHasSpecies(o.targetSpecies, chip))

  return (
    <>
      {species.length > 0 && (
        <OfferSection section="species" anchor="species" eyebrow="Species" title="What you fish for">
          <div className="flex flex-wrap gap-2" data-testid="hub-species-chips">
            <Chip label="All" active={chip == null} onClick={() => setChip(null)} />
            {species.map(name => (
              <Chip
                key={speciesKey(name)}
                label={name}
                active={chip != null && speciesKey(chip) === speciesKey(name)}
                onClick={() => setChip(current => (current === name ? null : name))}
              />
            ))}
          </div>
        </OfferSection>
      )}

      {offers.length > 0 && (
        <OfferSection section="trips" anchor="trips" eyebrow="Trips" title="Guided trips">
          {visible.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="hub-cards">
              {visible.map((offer, idx) => (
                <ExpCard
                  key={offer.id}
                  page={offer.page}
                  priority={idx < 3}
                  priceText={offer.priceText}
                  guideName={offer.guides[0]?.name}
                  guideAvatarUrl={offer.guides[0]?.avatarUrl}
                  moreGuides={Math.max(0, offer.guides.length - 1)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[15px] f-body" style={{ color: 'rgba(10,46,77,0.62)' }} data-testid="hub-cards-empty">
              No trips for {chip} yet.
            </p>
          )}
        </OfferSection>
      )}
    </>
  )
}
