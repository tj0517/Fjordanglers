'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveExperienceV2HeroFacts, type ExperienceV2EditorData } from '@/actions/experience-pages'
import { formatIssues, heroFactsOrNullSchema } from '@/lib/experiences/v2-editor'
import { Field, NativeSelect, SaveBar, Section, useSave } from './fields'

/** The gear select: '' = automatic (nothing stored), the other two are stored as a boolean. */
const gearText = (gear: boolean | undefined) => (gear == null ? '' : gear ? 'yes' : 'no')

/**
 * The S1 chips and two S3 cards typed by hand (FA-1.63). An empty field keeps the value
 * the page computes today, field by field.
 */
export function HeroFactsSection({ page }: { page: ExperienceV2EditorData['page'] }) {
  const facts = page.heroFacts
  const [location,    setLocation]    = useState(facts?.location ?? '')
  const [dayLength,   setDayLength]   = useState<string>(facts?.day_length ?? '')
  const [groupSize,   setGroupSize]   = useState(facts?.group_size ?? '')
  const [season,      setSeason]      = useState(facts?.season ?? '')
  const [gear,        setGear]        = useState(gearText(facts?.gear_included))
  const [startPickup, setStartPickup] = useState(facts?.start_pickup ?? '')
  const { pending, state, run, fail } = useSave()

  const computedGroup = page.maxAnglersPerGuide === 1 ? '1 angler / guide' : `1–${page.maxAnglersPerGuide} anglers / guide`

  function save() {
    // The same schema the action runs — a value the form cannot offer is refused here too.
    const parsed = heroFactsOrNullSchema.safeParse({
      location,
      day_length:    dayLength === '' ? null : dayLength,
      group_size:    groupSize,
      season,
      gear_included: gear === '' ? null : gear === 'yes',
      start_pickup:  startPickup,
    })
    if (!parsed.success) return fail(formatIssues(parsed.error))

    run(() => saveExperienceV2HeroFacts(page.id, parsed.data))
  }

  return (
    <Section
      id="v2-hero-facts"
      title="Hero facts"
      description="The chips under the title and two “At a glance” cards. An empty field shows what the page computes today."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Location" hint="Empty = the region from the Page tab">
          <Input value={location} maxLength={80} onChange={e => setLocation(e.target.value)} placeholder="Tierra del Fuego" />
        </Field>
        <Field label="Day length" hint="Automatic = from min and max days (Mode and price)">
          <NativeSelect value={dayLength} onChange={e => setDayLength(e.target.value)}>
            <option value="">Automatic</option>
            <option value="full_day">Full day</option>
            <option value="half_day">Half day</option>
            <option value="multi_day">Multi-day</option>
          </NativeSelect>
        </Field>
        <Field label="Group size" hint={`Chip and card. Empty = “${computedGroup}”`}>
          <Input value={groupSize} maxLength={80} onChange={e => setGroupSize(e.target.value)} placeholder="2–4 anglers" />
        </Field>
        <Field label="Season" hint="Shown as typed. Empty = “season …” from the season months">
          <Input value={season} maxLength={80} onChange={e => setSeason(e.target.value)} placeholder="Nov–Apr" />
        </Field>
        <Field label="Gear included" hint="Automatic = when Includes mentions gear, rods, tackle or flies">
          <NativeSelect value={gear} onChange={e => setGear(e.target.value)}>
            <option value="">Automatic (from Includes)</option>
            <option value="yes">Included</option>
            <option value="no">Not included</option>
          </NativeSelect>
        </Field>
      </div>

      <Field label="Start and pick-up" hint="“At a glance” card. Empty = the meeting point from the Page tab">
        <Textarea
          value={startPickup}
          maxLength={500}
          onChange={e => setStartPickup(e.target.value)}
          placeholder={'Pick-up from your hotel in Río Grande at 7:00\nDrop-off around 19:00'}
        />
      </Field>

      <SaveBar label="Save hero facts" pending={pending} state={state} onSave={save} />
    </Section>
  )
}
