/**
 * S4 "Included / Not included" (FA-1.54).
 *
 * "Not included" is where the surprises live, so it carries the licence as its own row (the
 * words "you buy it yourself online" and one line per link — FA-1.62), the tip, and the
 * priced add-ons. A
 * column with nothing in it is not drawn, and with both empty the section is not either.
 */

import OfferSection from './offer-section'
import { Box, BulletList, ListRow, mutedStyle } from './offer-box'
import { LINE } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
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
    <OfferSection section="S4" eyebrow="What's covered" title="Included / Not included" accordion={{ defaultOpen: false }}>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {includes.length > 0 && (
          <div className={`${grain.blur} ${grain.fjord} flex flex-col gap-3 rounded-2xl px-6 py-[22px]`}>
            <h3 className="text-lg font-bold text-white">Included</h3>
            <BulletList items={includes} mark="dark" />
          </div>
        )}

        {hasNotIncluded && (
          <Box className="flex flex-col gap-3 !rounded-2xl">
            <h3 className="text-lg font-bold">Not included</h3>
            {/* One list, one cross per row: the excluded items, then the licence and the tip. */}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {excludes.map((item, i) => <ListRow key={`${i}-${item}`} mark="cross">{item}</ListRow>)}
              {licenceRequired && <LicenceRow license={license} />}
              {tipGuidanceText != null && (
                <ListRow mark="cross"><b>Tip for the guide</b> — {tipGuidanceText}</ListRow>
              )}
            </ul>

            {addons.length > 0 && (
              <div className="border-t pt-3" style={{ borderColor: LINE }}>
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
    <ListRow mark="cross">
      <b>Fishing licence</b> — you buy it yourself online
      {license.priceText != null && <> ({license.priceText})</>}
      {license.links.length > 0 && (
        <ul className="mt-1 space-y-0.5" data-testid="licence-links">
          {license.links.map((link, i) => (
            <li key={`${i}-${link.url ?? link.text ?? ''}`}>
              {link.url != null ? (
                // `url` has already been through safeHttpUrl: http(s) only.
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-[3px]" style={{ textDecorationColor: 'var(--fa-salmon)' }}>
                  {link.label ?? 'how to buy it'} ›
                </a>
              ) : (
                <>{link.label != null && <>{link.label}: </>}{link.text}</>
              )}
            </li>
          ))}
        </ul>
      )}
    </ListRow>
  )
}
