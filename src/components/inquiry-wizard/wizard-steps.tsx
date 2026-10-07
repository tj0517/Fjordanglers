'use client'

/**
 * The three steps of the inquiry form (FA-1.55), in the order the proposal fixes (§7 step 3):
 *
 *   1 the trip   — dates (exact or flexible), days, who is coming
 *   2 the angler — skill level, priority, fitness, wading, budget
 *   3 contact    — name, e-mail, country, phone, anything else
 *
 * Step 1 is also what S14 shows inline on the page, so it is a component of its own rather
 * than a branch of the wizard: the same fields, the same state, whichever frame they sit in.
 *
 * Nothing here submits or stores anything — they render `answers` and report changes up.
 * The wizard owns the POST, so there is one place where an inquiry is sent.
 */

import {
  MAX_BRIEF_DAYS,
  FITNESS,
  FITNESS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  SKILL_LEVELS,
  budgetBandOptions,
} from '@/lib/inquiries/brief'
import { formatCents } from '@/lib/format-price'
import { ANGLER_COUNTRIES } from '@/lib/angler-countries'
import { nextMonths, todayIso, type WizardAnswers, type WizardErrors } from './wizard-state'
import { BORDER, ChoiceRow, Counter, MUTED, NAVY, PillRow, Question, SELECTED, TextField } from './wizard-fields'

/** Everything the questions need to know about the page they are asked on. */
export interface WizardPageInfo {
  offerMode:          'fixed' | 'custom'
  currency:           string
  /** The "from" total the page shows, FA fee included — the number `budget_ack` confirms. */
  fromTotalCents:     number | null
  /** `custom` pages: the indicative range the bands are cut out of. */
  priceFromCents:     number | null
  priceToCents:       number | null
  minDays:            number
  maxDays:            number | null
  maxAnglersPerGuide: number
}

export type StepProps = {
  answers: WizardAnswers
  errors:  WizardErrors
  page:    WizardPageInfo
  set:     <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void
}

/** The days the page itself allows, never more than a brief can hold. */
function dayOptions(page: WizardPageInfo): { value: string; label: string }[] {
  const max = Math.min(page.maxDays ?? page.minDays + 3, MAX_BRIEF_DAYS)
  const days: { value: string; label: string }[] = []
  for (let d = page.minDays; d <= max && days.length < 6; d++) {
    days.push({ value: String(d), label: String(d) })
  }
  return days
}

/** Whether step 2 has a price to anchor the budget question to. */
export function asksBudget(page: WizardPageInfo): boolean {
  return page.offerMode === 'fixed'
    ? page.fromTotalCents != null
    : budgetBandOptions(page.priceFromCents, page.priceToCents, page.currency).length > 0
}

// ─── Step 1 — the trip ────────────────────────────────────────────────────────

export function StepTrip({ answers, errors, page, set }: StepProps) {
  const months = nextMonths(12)
  const days   = dayOptions(page)
  // Companions can outnumber the anglers (a family), but not without limit.
  const maxAnglers = Math.max(page.maxAnglersPerGuide * 3, 6)

  return (
    <div data-testid="wizard-step-1">
      <Question
        label="When do you want to fish?"
        hint="Flexible dates let us pick the days with the best water."
        error={errors.dateFrom ?? errors.flexMonth}
      >
        <div className="flex flex-col gap-2">
          <ChoiceRow
            name="dates-mode"
            checked={answers.datesMode === 'exact'}
            onChange={() => set('datesMode', 'exact')}
            title="I have exact dates"
          />
          {answers.datesMode === 'exact' && (
            <div className="pl-1">
              <TextField
                label="First day of fishing"
                type="date"
                min={todayIso()}
                value={answers.dateFrom}
                onChange={value => set('dateFrom', value)}
              />
            </div>
          )}
          <ChoiceRow
            name="dates-mode"
            checked={answers.datesMode === 'flexible'}
            onChange={() => set('datesMode', 'flexible')}
            title="Flexible — I will pick a month"
          />
          {answers.datesMode === 'flexible' && (
            <label className="flex flex-col gap-1.5 pl-1 text-[14px]">
              Month
              <select
                value={answers.flexMonth}
                onChange={e => set('flexMonth', e.target.value)}
                className="w-full rounded-lg border px-3 text-[16px]"
                style={{ minHeight: 48, borderColor: BORDER, background: '#fff' }}
              >
                <option value="">Pick a month…</option>
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Question>

      <Question label="How many days of fishing?" error={errors.days}>
        <PillRow
          name="days"
          options={days}
          value={String(answers.days)}
          onChange={value => set('days', Number(value))}
        />
      </Question>

      <Question
        label="Who is coming?"
        hint={`More than ${page.maxAnglersPerGuide} anglers — we add a second guide.`}
        error={errors.anglers}
      >
        <div className="flex flex-col gap-2">
          <Counter
            label="Anglers"
            value={answers.anglers}
            min={1}
            max={maxAnglers}
            onChange={value => set('anglers', value)}
          />
          <Counter
            label="Non-anglers"
            hint="(optional)"
            value={answers.nonAnglers}
            min={0}
            max={maxAnglers}
            onChange={value => set('nonAnglers', value)}
          />
        </div>
      </Question>
    </div>
  )
}

// ─── Step 2 — you as an angler ────────────────────────────────────────────────

export function StepAngler({ answers, errors, page, set }: StepProps) {
  const bands = page.offerMode === 'custom'
    ? budgetBandOptions(page.priceFromCents, page.priceToCents, page.currency)
    : []

  return (
    <div data-testid="wizard-step-2">
      <Question
        label="Which line describes your fishing best?"
        hint="Nobody is turned away for being a beginner — it decides which water you are taken to."
        error={errors.skillLevel}
      >
        <div className="flex flex-col gap-2">
          {SKILL_LEVELS.map(level => (
            <ChoiceRow
              key={level.level}
              name="skill-level"
              checked={answers.skillLevel === level.level}
              onChange={() => set('skillLevel', level.level)}
              title={level.title}
              description={level.description}
            />
          ))}
        </div>
      </Question>

      <Question label="What matters most on this trip?" error={errors.priority}>
        <div className="flex flex-col gap-2">
          {PRIORITIES.map(priority => (
            <ChoiceRow
              key={priority}
              name="priority"
              checked={answers.priority === priority}
              onChange={() => set('priority', priority)}
              title={PRIORITY_LABELS[priority]}
            />
          ))}
        </div>
      </Question>

      <Question label="How much walking are you up for?" error={errors.fitness}>
        <div className="flex flex-col gap-2">
          {FITNESS.map(level => (
            <ChoiceRow
              key={level}
              name="fitness"
              checked={answers.fitness === level}
              onChange={() => set('fitness', level)}
              title={FITNESS_LABELS[level]}
            />
          ))}
        </div>
      </Question>

      <Question label="Is wading in the river fine?" error={errors.wadingOk}>
        <PillRow
          name="wading"
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Rather not' }]}
          value={answers.wadingOk == null ? null : answers.wadingOk ? 'yes' : 'no'}
          onChange={value => set('wadingOk', value === 'yes')}
        />
      </Question>

      {page.offerMode === 'fixed' && page.fromTotalCents != null && (
        <Question label="The price" error={errors.budgetAck}>
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-[15px]"
            style={{
              minHeight:   48,
              borderColor: answers.budgetAck ? NAVY : BORDER,
              borderWidth: answers.budgetAck ? 2 : 1,
              background:  answers.budgetAck ? SELECTED : '#fff',
            }}
          >
            <input
              type="checkbox"
              checked={answers.budgetAck}
              onChange={e => set('budgetAck', e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-none"
            />
            <span>
              I have seen the price — from {formatCents(page.fromTotalCents, page.currency)} — and it works for me.
              <span className="block text-[13px]" style={MUTED}>
                The exact figure comes with the guide&apos;s offer. Nothing is due until you accept it.
              </span>
            </span>
          </label>
        </Question>
      )}

      {page.offerMode === 'custom' && bands.length > 0 && (
        <Question
          label="Roughly what are you planning for?"
          hint="Indicative — it tells us which waters and lodges to build the offer from."
          error={errors.budgetBand}
        >
          <div className="flex flex-col gap-2">
            {bands.map(band => (
              <ChoiceRow
                key={band.value}
                name="budget-band"
                checked={answers.budgetBand === band.value}
                onChange={() => set('budgetBand', band.value)}
                title={band.label}
              />
            ))}
          </div>
        </Question>
      )}
    </div>
  )
}

// ─── Step 3 — contact ─────────────────────────────────────────────────────────

export function StepContact({ answers, errors, set }: StepProps) {
  return (
    <div data-testid="wizard-step-3" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          value={answers.firstName}
          onChange={value => set('firstName', value)}
          error={errors.firstName}
          autoComplete="given-name"
        />
        <TextField
          label="Last name"
          value={answers.lastName}
          onChange={value => set('lastName', value)}
          error={errors.lastName}
          autoComplete="family-name"
        />
      </div>

      <TextField
        label="E-mail"
        type="email"
        inputMode="email"
        value={answers.email}
        onChange={value => set('email', value)}
        error={errors.email}
        autoComplete="email"
      />

      <label className="flex flex-col gap-1.5 text-[14px]">
        Travelling from
        <select
          value={answers.country}
          onChange={e => set('country', e.target.value)}
          className="w-full rounded-lg border px-3 text-[16px]"
          style={{
            minHeight:   48,
            borderColor: errors.country != null ? '#B23A1C' : BORDER,
            background:  '#fff',
          }}
          aria-invalid={errors.country != null}
        >
          <option value="">Pick a country…</option>
          {ANGLER_COUNTRIES.map(country => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
        {errors.country != null && (
          <span role="alert" className="text-[13px] font-medium" style={{ color: '#B23A1C' }}>{errors.country}</span>
        )}
      </label>

      <TextField
        label="Phone or WhatsApp"
        type="tel"
        inputMode="tel"
        optional
        value={answers.phone}
        onChange={value => set('phone', value)}
        autoComplete="tel"
      />

      <TextField
        label="Anything else we should know?"
        optional
        rows={4}
        value={answers.extra}
        onChange={value => set('extra', value)}
      />

      <p className="text-[12px]" style={MUTED}>
        We answer you, not a list: no newsletter, no sharing your address with anyone but the
        guide who makes the offer.
      </p>
    </div>
  )
}
