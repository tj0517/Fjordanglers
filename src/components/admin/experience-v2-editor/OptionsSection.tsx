'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateExperienceOptionV2, type ExperienceV2EditorOption } from '@/actions/experience-pages'
import { centsToMoneyText, parseMoneyToCents, parseWholeNumber, type ItineraryItem } from '@/lib/experiences/v2-editor'
import { Field, MoneyInput, NativeSelect, SaveBar, Section, useSave } from './fields'

type ItineraryDraft = Omit<ItineraryItem, 'day'> & { key: string; day: string }

const ITINERARY_TEXT_FIELDS = ['title', 'waters', 'lodging', 'meals', 'transfer', 'notes'] as const

export function OptionsSection({ options, currency }: { options: ExperienceV2EditorOption[]; currency: string }) {
  return (
    <Section
      id="v2-options"
      title="Options"
      description="v2 fields of the page's trip options. Options are created and deleted on the Page tab."
    >
      {options.length === 0
        ? <p className="f-body text-sm text-muted-foreground">This page has no trip options yet.</p>
        : options.map(option => <OptionCard key={option.id} option={option} currency={currency} />)}
    </Section>
  )
}

function OptionCard({ option, currency }: { option: ExperienceV2EditorOption; currency: string }) {
  const [kind,      setKind]      = useState(option.kind)
  const [priceFrom, setPriceFrom] = useState(centsToMoneyText(option.priceFromCents))
  const [priceTo,   setPriceTo]   = useState(centsToMoneyText(option.priceToCents))
  const [daysMin,   setDaysMin]   = useState(option.durationDaysMin == null ? '' : String(option.durationDaysMin))
  const [daysMax,   setDaysMax]   = useState(option.durationDaysMax == null ? '' : String(option.durationDaysMax))
  const [itinerary, setItinerary] = useState<ItineraryDraft[]>(() => option.sampleItinerary.map((item, index) => ({
    ...item, key: `stored-${index}`, day: String(item.day),
  })))
  const { pending, state, run, fail } = useSave()

  const patch = (key: string, change: Partial<ItineraryDraft>) =>
    setItinerary(current => current.map(row => (row.key === key ? { ...row, ...change } : row)))

  function save() {
    const priceFromCents = priceFrom.trim() === '' ? null : parseMoneyToCents(priceFrom)
    const priceToCents   = priceTo.trim() === '' ? null : parseMoneyToCents(priceTo)
    if ((priceFrom.trim() !== '' && priceFromCents == null) || (priceTo.trim() !== '' && priceToCents == null)) {
      return fail('Price is not an amount')
    }

    const durationDaysMin = daysMin.trim() === '' ? null : parseWholeNumber(daysMin)
    const durationDaysMax = daysMax.trim() === '' ? null : parseWholeNumber(daysMax)
    if ((daysMin.trim() !== '' && durationDaysMin == null) || (daysMax.trim() !== '' && durationDaysMax == null)) {
      return fail('Duration must be whole days')
    }

    const sampleItinerary: ItineraryItem[] = []
    for (const row of itinerary) {
      const day = parseWholeNumber(row.day)
      if (day == null) return fail('Every itinerary row needs a day number')
      sampleItinerary.push({
        day, title: row.title, waters: row.waters, lodging: row.lodging,
        meals: row.meals, transfer: row.transfer, notes: row.notes,
      })
    }

    run(() => updateExperienceOptionV2(option.id, {
      kind, priceFromCents, priceToCents, durationDaysMin, durationDaysMax, sampleItinerary,
    }))
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3" data-option={option.label}>
      <h3 className="f-body text-sm font-bold">{option.label}</h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Kind">
          <NativeSelect
            aria-label={`Kind of ${option.label}`}
            value={kind}
            onChange={e => setKind(e.target.value === 'archetype' || e.target.value === 'addon' ? e.target.value : 'variant')}
          >
            <option value="variant">Variant</option>
            <option value="archetype">Archetype</option>
            <option value="addon">Add-on</option>
          </NativeSelect>
        </Field>
        <Field label="Price from">
          <MoneyInput value={priceFrom} onChange={setPriceFrom} currency={currency} />
        </Field>
        <Field label="Price to">
          <MoneyInput value={priceTo} onChange={setPriceTo} currency={currency} />
        </Field>
        <Field label="Days — min">
          <Input inputMode="numeric" value={daysMin} onChange={e => setDaysMin(e.target.value)} />
        </Field>
        <Field label="Days — max">
          <Input inputMode="numeric" value={daysMax} onChange={e => setDaysMax(e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="f-body mb-1 text-xs font-semibold text-muted-foreground">Sample itinerary</legend>
        {itinerary.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[3.5rem_repeat(3,1fr)_auto] gap-2 rounded-md bg-muted/40 p-2">
            <Input aria-label={`Itinerary row ${index + 1} day`} placeholder="Day" inputMode="numeric" value={row.day} onChange={e => patch(row.key, { day: e.target.value })} />
            {ITINERARY_TEXT_FIELDS.slice(0, 3).map(field => (
              <Input key={field} aria-label={`Itinerary row ${index + 1} ${field}`} placeholder={field} value={row[field]} onChange={e => patch(row.key, { [field]: e.target.value })} />
            ))}
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove itinerary row ${index + 1}`} onClick={() => setItinerary(current => current.filter(r => r.key !== row.key))}>
              <Trash2 />
            </Button>
            <span />
            {ITINERARY_TEXT_FIELDS.slice(3).map(field => (
              <Input key={field} aria-label={`Itinerary row ${index + 1} ${field}`} placeholder={field} value={row[field]} onChange={e => patch(row.key, { [field]: e.target.value })} />
            ))}
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setItinerary(current => [...current, {
              key: crypto.randomUUID(), day: String(current.length + 1),
              title: '', waters: '', lodging: '', meals: '', transfer: '', notes: '',
            }])}
          >
            <Plus /> itinerary day
          </Button>
        </div>
      </fieldset>

      <SaveBar label="Save option" pending={pending} state={state} onSave={save} />
    </div>
  )
}
