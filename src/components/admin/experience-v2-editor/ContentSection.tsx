'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveExperienceV2Content, type ExperienceV2EditorData } from '@/actions/experience-pages'
import { parseKm, parseWholeNumber, type DayScheduleItem, type LodgingItem } from '@/lib/experiences/v2-editor'
import { Field, NativeSelect, SaveBar, Section, toLines, useSave } from './fields'

interface ScheduleDraft { key: string; time: string; title: string; driveMin: string; walkKm: string; wading: boolean }
interface LodgingDraft  { key: string; name: string; url: string; note: string }

const kmText = (km: number | null) => (km == null ? '' : String(km))

export function ContentSection({ page }: { page: ExperienceV2EditorData['page'] }) {
  const [suitedFor,     setSuitedFor]     = useState(page.suitedFor.join('\n'))
  const [notSuitedFor,  setNotSuitedFor]  = useState(page.notSuitedFor.join('\n'))
  const [expectations,  setExpectations]  = useState(page.expectationsText ?? '')
  const [skillLevel,    setSkillLevel]    = useState(page.skillLevel == null ? '' : String(page.skillLevel))
  const [walkingMin,    setWalkingMin]    = useState(kmText(page.walkingKmMin))
  const [walkingMax,    setWalkingMax]    = useState(kmText(page.walkingKmMax))
  const [schedule,      setSchedule]      = useState<ScheduleDraft[]>(() => page.daySchedule.map((item, index) => ({
    key: `stored-${index}`, time: item.time, title: item.title,
    driveMin: item.meta.drive_min == null ? '' : String(item.meta.drive_min),
    walkKm: kmText(item.meta.walk_km), wading: item.meta.wading,
  })))
  const [airport,       setAirport]       = useState(page.nearestAirport ?? '')
  const [lodging,       setLodging]       = useState<LodgingDraft[]>(() => page.suggestedLodging.map((item, index) => ({
    key: `stored-${index}`, name: item.name, url: item.url ?? '', note: item.note ?? '',
  })))
  const [hasLicense,    setHasLicense]    = useState(page.licenseInfo != null)
  const [licRequired,   setLicRequired]   = useState(page.licenseInfo?.required ?? true)
  const [licBuyUrl,     setLicBuyUrl]     = useState(page.licenseInfo?.buy_url ?? '')
  const [licPrice,      setLicPrice]      = useState(page.licenseInfo?.price_text ?? '')
  const [licSteps,      setLicSteps]      = useState((page.licenseInfo?.steps ?? []).join('\n'))
  const [tipGuidance,   setTipGuidance]   = useState(page.tipGuidanceText ?? '')
  const [weatherPolicy, setWeatherPolicy] = useState(page.weatherPolicyText ?? '')
  const [slaHours,      setSlaHours]      = useState(String(page.responseSlaHours))
  const [offerEta,      setOfferEta]      = useState(page.offerEtaText ?? '')
  const { pending, state, run, fail } = useSave()

  const patchSchedule = (key: string, change: Partial<ScheduleDraft>) =>
    setSchedule(current => current.map(row => (row.key === key ? { ...row, ...change } : row)))
  const patchLodging = (key: string, change: Partial<LodgingDraft>) =>
    setLodging(current => current.map(row => (row.key === key ? { ...row, ...change } : row)))

  function save() {
    const walkingKmMin = walkingMin.trim() === '' ? null : parseKm(walkingMin)
    const walkingKmMax = walkingMax.trim() === '' ? null : parseKm(walkingMax)
    if ((walkingMin.trim() !== '' && walkingKmMin == null) || (walkingMax.trim() !== '' && walkingKmMax == null)) {
      return fail('Walking distance must be a number of km with at most one decimal')
    }

    const daySchedule: DayScheduleItem[] = []
    for (const row of schedule) {
      const driveMin = row.driveMin.trim() === '' ? null : parseWholeNumber(row.driveMin)
      const walkKm   = row.walkKm.trim() === '' ? null : parseKm(row.walkKm)
      if (row.driveMin.trim() !== '' && driveMin == null) return fail(`Day schedule “${row.title}”: drive must be whole minutes`)
      if (row.walkKm.trim() !== '' && walkKm == null)     return fail(`Day schedule “${row.title}”: walk must be km with at most one decimal`)
      daySchedule.push({ time: row.time, title: row.title, meta: { drive_min: driveMin, walk_km: walkKm, wading: row.wading } })
    }

    const suggestedLodging: LodgingItem[] = lodging.map(row => ({
      name: row.name, url: row.url.trim() === '' ? null : row.url.trim(), note: row.note.trim() === '' ? null : row.note,
    }))

    const responseSlaHours = parseWholeNumber(slaHours)
    if (responseSlaHours == null) return fail('Response time must be a whole number of hours')

    run(() => saveExperienceV2Content(page.id, {
      suitedFor:         toLines(suitedFor),
      notSuitedFor:      toLines(notSuitedFor),
      expectationsText:  expectations,
      skillLevel:        skillLevel === '' ? null : parseWholeNumber(skillLevel),
      walkingKmMin,
      walkingKmMax,
      daySchedule,
      nearestAirport:    airport,
      suggestedLodging,
      licenseInfo:       hasLicense
        ? { required: licRequired, buy_url: licBuyUrl.trim() === '' ? null : licBuyUrl.trim(), steps: toLines(licSteps), price_text: licPrice }
        : null,
      tipGuidanceText:   tipGuidance,
      weatherPolicyText: weatherPolicy,
      responseSlaHours,
      offerEtaText:      offerEta,
    }))
  }

  return (
    <Section
      id="v2-content"
      title="Content"
      description="What the v2 page says in its own sections. An empty field means the section is not shown."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Suited for — one per line" hint="Required for v2">
          <Textarea value={suitedFor} onChange={e => setSuitedFor(e.target.value)} placeholder={'you cast 12–15 m in wind\nyou can walk 8–15 km on rocks'} />
        </Field>
        <Field label="Not suited for — one per line">
          <Textarea value={notSuitedFor} onChange={e => setNotSuitedFor(e.target.value)} />
        </Field>
      </div>

      <Field label="Expectations" hint="Shown as a quote, e.g. no guarantee of a trophy fish">
        <Textarea value={expectations} onChange={e => setExpectations(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Skill level">
          <NativeSelect value={skillLevel} onChange={e => setSkillLevel(e.target.value)}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level} / 5</option>)}
          </NativeSelect>
        </Field>
        <Field label="Walking km — min">
          <Input inputMode="decimal" value={walkingMin} onChange={e => setWalkingMin(e.target.value)} />
        </Field>
        <Field label="Walking km — max">
          <Input inputMode="decimal" value={walkingMax} onChange={e => setWalkingMax(e.target.value)} />
        </Field>
        <Field label="We answer within (hours)">
          <Input inputMode="numeric" value={slaHours} onChange={e => setSlaHours(e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="f-body mb-1 text-xs font-semibold text-muted-foreground">Day schedule</legend>
        {schedule.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[5rem_1fr_5rem_5rem_auto_auto] items-center gap-2">
            <Input aria-label={`Schedule row ${index + 1} time`} placeholder="7:30" value={row.time} onChange={e => patchSchedule(row.key, { time: e.target.value })} />
            <Input aria-label={`Schedule row ${index + 1} title`} placeholder="Pick-up from your lodging" value={row.title} onChange={e => patchSchedule(row.key, { title: e.target.value })} />
            <Input aria-label={`Schedule row ${index + 1} drive minutes`} placeholder="drive min" inputMode="numeric" value={row.driveMin} onChange={e => patchSchedule(row.key, { driveMin: e.target.value })} />
            <Input aria-label={`Schedule row ${index + 1} walk km`} placeholder="walk km" inputMode="decimal" value={row.walkKm} onChange={e => patchSchedule(row.key, { walkKm: e.target.value })} />
            <label className="f-body flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={row.wading} onChange={e => patchSchedule(row.key, { wading: e.target.checked })} />
              wading
            </label>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove schedule row ${index + 1}`} onClick={() => setSchedule(current => current.filter(r => r.key !== row.key))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="xs" onClick={() => setSchedule(current => [...current, { key: crypto.randomUUID(), time: '', title: '', driveMin: '', walkKm: '', wading: false }])}>
            <Plus /> schedule row
          </Button>
        </div>
      </fieldset>

      <Field label="Nearest airport">
        <Input value={airport} onChange={e => setAirport(e.target.value)} placeholder="Queenstown (ZQN), 1 h from Wanaka" />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="f-body mb-1 text-xs font-semibold text-muted-foreground">Suggested lodging</legend>
        {lodging.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <Input aria-label={`Lodging ${index + 1} name`} placeholder="Name" value={row.name} onChange={e => patchLodging(row.key, { name: e.target.value })} />
            <Input aria-label={`Lodging ${index + 1} link`} placeholder="https://…" value={row.url} onChange={e => patchLodging(row.key, { url: e.target.value })} />
            <Input aria-label={`Lodging ${index + 1} note`} placeholder="Note" value={row.note} onChange={e => patchLodging(row.key, { note: e.target.value })} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove lodging ${index + 1}`} onClick={() => setLodging(current => current.filter(r => r.key !== row.key))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="xs" onClick={() => setLodging(current => [...current, { key: crypto.randomUUID(), name: '', url: '', note: '' }])}>
            <Plus /> lodging row
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <label className="f-body flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={hasLicense} onChange={e => setHasLicense(e.target.checked)} />
          Fishing licence information
        </label>
        {hasLicense && (
          <>
            <label className="f-body flex items-center gap-2 text-sm">
              <input type="checkbox" checked={licRequired} onChange={e => setLicRequired(e.target.checked)} />
              A licence is required
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Where to buy (link)">
                <Input value={licBuyUrl} onChange={e => setLicBuyUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Price, in words">
                <Input value={licPrice} onChange={e => setLicPrice(e.target.value)} placeholder="about NZ$40 a day" />
              </Field>
            </div>
            <Field label="How to buy — one step per line">
              <Textarea value={licSteps} onChange={e => setLicSteps(e.target.value)} />
            </Field>
          </>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tip guidance">
          <Textarea value={tipGuidance} onChange={e => setTipGuidance(e.target.value)} />
        </Field>
        <Field label="Weather policy">
          <Textarea value={weatherPolicy} onChange={e => setWeatherPolicy(e.target.value)} />
        </Field>
      </div>

      <Field label="When the offer arrives" hint="e.g. “48–72 h” or “3–5 working days”">
        <Input value={offerEta} onChange={e => setOfferEta(e.target.value)} />
      </Field>

      <SaveBar label="Save content" pending={pending} state={state} onSave={save} />
    </Section>
  )
}
