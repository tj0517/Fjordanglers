'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { saveExperienceV2Offer, type ExperienceV2EditorData } from '@/actions/experience-pages'
import {
  bpToPercentText,
  centsToMoneyText,
  parseMoneyToCents,
  parsePercentToBp,
  parseWholeNumber,
} from '@/lib/experiences/v2-editor'
import { Field, MoneyInput, NativeSelect, Notice, SaveBar, Section, useSave } from './fields'

export function OfferSection({ page }: { page: ExperienceV2EditorData['page'] }) {
  const [offerMode, setOfferMode] = useState(page.offerMode)
  const [priceFrom, setPriceFrom] = useState(centsToMoneyText(page.priceFromCents))
  const [priceTo,   setPriceTo]   = useState(centsToMoneyText(page.priceToCents))
  const [feePct,    setFeePct]    = useState(bpToPercentText(page.feeBp))
  const [maxAnglers, setMaxAnglers] = useState(String(page.maxAnglersPerGuide))
  const [minDays,   setMinDays]   = useState(String(page.minDays))
  const [maxDays,   setMaxDays]   = useState(page.maxDays == null ? '' : String(page.maxDays))
  const { pending, state, run, fail } = useSave()

  function save() {
    const priceFromCents = priceFrom.trim() === '' ? null : parseMoneyToCents(priceFrom)
    if (priceFrom.trim() !== '' && priceFromCents == null) return fail('"Price from" is not an amount')

    const priceToCents = priceTo.trim() === '' ? null : parseMoneyToCents(priceTo)
    if (priceTo.trim() !== '' && priceToCents == null) return fail('"Price to" is not an amount')

    const feeBp = parsePercentToBp(feePct)
    if (feeBp == null) return fail('FA fee must be a percentage below 100, with at most two decimals')

    const maxAnglersPerGuide = parseWholeNumber(maxAnglers)
    if (maxAnglersPerGuide == null) return fail('Max anglers per guide must be a whole number')

    const min = parseWholeNumber(minDays)
    if (min == null) return fail('Min days must be a whole number')

    const max = maxDays.trim() === '' ? null : parseWholeNumber(maxDays)
    if (maxDays.trim() !== '' && max == null) return fail('Max days must be a whole number, or empty for no limit')

    run(() => saveExperienceV2Offer(page.id, {
      offerMode, priceFromCents, priceToCents, feeBp, maxAnglersPerGuide, minDays: min, maxDays: max,
    }))
  }

  return (
    <Section
      id="v2-offer"
      title="Mode and price"
      description="Fixed = a price table and a calculator. Custom = a price range and “plan your trip”."
    >
      <Notice tone="info">
        These are the v2 prices. “Price from” on the Page tab is the v1 price and is kept separately until FA-1.51.
      </Notice>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Offer mode">
          <NativeSelect value={offerMode} onChange={e => setOfferMode(e.target.value === 'custom' ? 'custom' : 'fixed')}>
            <option value="fixed">Fixed</option>
            <option value="custom">Custom</option>
          </NativeSelect>
        </Field>
        <Field label="Price from" hint="Shown above the fold; required for v2">
          <MoneyInput value={priceFrom} onChange={setPriceFrom} currency={page.currency} />
        </Field>
        <Field label="Price to" hint="Custom mode: upper end of the range">
          <MoneyInput value={priceTo} onChange={setPriceTo} currency={page.currency} />
        </Field>
        <Field label="FA fee (%)" hint="On top of the guide price; equals the deposit">
          <Input inputMode="decimal" value={feePct} onChange={e => setFeePct(e.target.value)} />
        </Field>
        <Field label="Max anglers per guide" hint="Also picks the base price row (1 day × this many)">
          <Input inputMode="numeric" value={maxAnglers} onChange={e => setMaxAnglers(e.target.value)} />
        </Field>
        <Field label="Min days">
          <Input inputMode="numeric" value={minDays} onChange={e => setMinDays(e.target.value)} />
        </Field>
        <Field label="Max days" hint="Empty = no limit">
          <Input inputMode="numeric" value={maxDays} onChange={e => setMaxDays(e.target.value)} />
        </Field>
      </div>

      <SaveBar label="Save mode and price" pending={pending} state={state} onSave={save} />
    </Section>
  )
}
