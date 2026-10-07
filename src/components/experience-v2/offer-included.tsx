/**
 * S4 "Included / Not included" (FA-1.54).
 *
 * "Not included" is where the surprises live, so it carries the licence as its own row (a
 * link, and the words "you buy it yourself online"), the tip, and the priced add-ons. A
 * column with nothing in it is not drawn, and with both empty the section is not either.
 */

import OfferSection from './offer-section'
import { Box, BulletList, mutedStyle } from './offer-box'
import { optionPriceText } from './option-price'
import type { LicenseInfo } from '@/lib/experience-v2-content'

type OfferAddon = {
  id:             string
  label:          string
  priceFromCents: number | null
  priceToCents:   number | null
  currency:       string | null
}

export type OfferIncludedProps = {
  includes:        string[]
  excludes:        string[]
  license:         LicenseInfo | null
  tipGuidanceText: string | null
  addons:          OfferAddon[]
  /** The page's currency, for an add-on that does not carry its own. */
  currency:        string
}

export default function OfferIncluded({
  includes, excludes, license, tipGuidanceText, addons, currency,
}: OfferIncludedProps) {
  const licenceRequired = license != null && license.required
  const hasNotIncluded  = excludes.length > 0 || licenceRequired || tipGuidanceText != null || addons.length > 0

  if (includes.length === 0 && !hasNotIncluded) return null

  return (
    <OfferSection section="S4" title="Included / Not included" accordion={{ defaultOpen: false }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {includes.length > 0 && (
          <Box>
            <h3 className="mb-2.5 text-lg font-semibold">Included</h3>
            <BulletList items={includes} />
          </Box>
        )}

        {hasNotIncluded && (
          <Box>
            <h3 className="mb-2.5 text-lg font-semibold">Not included</h3>
            <BulletList items={excludes} />

            <ul className={`space-y-1.5 text-[15px] ${excludes.length > 0 ? 'mt-1.5' : ''}`}>
              {licenceRequired && <LicenceRow license={license} />}
              {tipGuidanceText != null && (
                <li><b>Tip for the guide</b> — {tipGuidanceText}</li>
              )}
            </ul>

            {addons.length > 0 && (
              <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(10,46,77,0.10)' }}>
                <p className="mb-1.5 text-[13px]" style={mutedStyle}>Optional extras</p>
                <ul className="space-y-1 text-[15px]">
                  {addons.map(addon => {
                    const price = optionPriceText(addon.priceFromCents, addon.priceToCents, addon.currency ?? currency)
                    return (
                      <li key={addon.id}>
                        {addon.label}{price != null && <> — {price}</>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Box>
        )}
      </div>
    </OfferSection>
  )
}

function LicenceRow({ license }: { license: LicenseInfo }) {
  return (
    <li>
      <b>Fishing licence</b> — you buy it yourself online
      {license.priceText != null && <> ({license.priceText})</>}
      {license.buyText != null && <> · {license.buyText}</>}
      {license.buyUrl != null && (
        <>
          {' · '}
          {/* `buyUrl` has already been through safeHttpUrl: http(s) only. */}
          <a href={license.buyUrl} target="_blank" rel="noopener noreferrer" className="underline">
            how to buy it ›
          </a>
        </>
      )}
    </li>
  )
}
