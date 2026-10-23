'use client'

/**
 * The species chips and the offer cards of a country hub (FA-1.65) — one client component
 * because a chip filters the cards under it, client-side, by `target_species` ("All" resets).
 *
 * Two sections, each with its own `data-section` anchor (FA-1.66 measures them): the chips
 * render only when the hub has species, the cards only when it has offers.
 *
 * FA-1.66: each card sits in a wrapper whose `id` is the offer's slug, the target of a map pin.
 * A pin click scrolls to that card and highlights it; a chip that hides the card is reset
 * first, so a pin always lands on its card. A card click is counted as `hub_card_click`.
 */

import { useEffect, useState } from 'react'
import { ExpCard } from '@/components/trips/exp-card'
import { useHubFunnel } from '@/components/analytics/hub-funnel'
import { useHubSelection } from './hub-selection'
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
  const funnel    = useHubFunnel()
  const selected  = useHubSelection()?.selected ?? null

  // A new pin click while a chip hides its card: drop the chip (state adjusted during render,
  // once per click — `seq` — so the visitor can pick a chip again afterwards).
  const [handledSeq, setHandledSeq] = useState(0)
  if (selected != null && selected.seq !== handledSeq) {
    setHandledSeq(selected.seq)
    const target = offers.find(o => o.page.slug === selected.slug)
    if (chip != null && target != null && !offerHasSpecies(target.targetSpecies, chip)) setChip(null)
  }

  useEffect(() => {
    if (selected == null) return
    document.getElementById(selected.slug)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selected])

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
              {visible.map((offer, idx) => {
                const highlighted = selected?.slug === offer.page.slug
                return (
                  <div
                    key={offer.id}
                    id={offer.page.slug}
                    data-highlighted={highlighted || undefined}
                    className="scroll-mt-24 rounded-[20px] transition-[outline-color] duration-300"
                    style={{ outline: '3px solid', outlineOffset: '6px', outlineColor: highlighted ? '#0A2E4D' : 'transparent' }}
                  >
                    <ExpCard
                      page={offer.page}
                      priority={idx < 3}
                      priceText={offer.priceText}
                      guideName={offer.guides[0]?.name}
                      guideAvatarUrl={offer.guides[0]?.avatarUrl}
                      moreGuides={Math.max(0, offer.guides.length - 1)}
                      onClick={() => funnel?.cardClick(offer.page.slug, idx + 1)}
                    />
                  </div>
                )
              })}
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
