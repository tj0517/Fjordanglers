/**
 * The three-step inquiry form's state, its per-step validation and the `brief` it produces
 * (FA-1.55). No React and no DOM here, so every rule below is testable on its own.
 *
 * The browser is not trusted with any of it: the same brief is validated again by
 * `briefSchema` on the server, and the old columns (`requested_dates`, `party_size`,
 * `trip_length`, `message`) are derived there from the validated brief, not from what this
 * file sends. These checks exist to stop a visitor wasting a round trip, nothing more.
 */

import {
  DATES_MODES as DATES_MODE_VALUES,
  FITNESS as FITNESS_VALUES,
  MAX_BRIEF_DAYS,
  PRIORITIES as PRIORITY_VALUES,
  type Brief,
  type DatesMode,
  type Fitness,
  type Priority,
} from '@/lib/inquiries/brief'

export type WizardStep = 1 | 2 | 3

export interface WizardAnswers {
  datesMode:  DatesMode
  /** `YYYY-MM-DD`, `exact` only. */
  dateFrom:   string
  /** `YYYY-MM`, `flexible` only. */
  flexMonth:  string
  days:       number
  anglers:    number
  nonAnglers: number
  skillLevel: number | null
  priority:   Priority | null
  fitness:    Fitness | null
  wadingOk:   boolean | null
  /** `fixed` pages — the angler confirmed the price on the page. */
  budgetAck:  boolean
  /** `custom` pages — one of `budgetBandOptions`. */
  budgetBand: string | null
  firstName:  string
  lastName:   string
  email:      string
  country:    string
  phone:      string
  /** "Anything else" — free text, optional. */
  extra:      string
}

/** What the page the form sits on decides about the form's own questions. */
export interface WizardPageRules {
  offerMode: 'fixed' | 'custom'
  minDays:   number
  maxDays:   number | null
  /** Whether step 2 asks the budget question at all — false when the page has no price to show. */
  asksBudget: boolean
}

export function initialAnswers(rules: Pick<WizardPageRules, 'minDays'>): WizardAnswers {
  return {
    datesMode:  'flexible',
    dateFrom:   '',
    flexMonth:  '',
    days:       Math.max(1, rules.minDays),
    anglers:    2,
    nonAnglers: 0,
    skillLevel: null,
    priority:   null,
    fitness:    null,
    wadingOk:   null,
    budgetAck:  false,
    budgetBand: null,
    firstName:  '',
    lastName:   '',
    email:      '',
    country:    '',
    phone:      '',
    extra:      '',
  }
}

// ─── Dates ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function utcOf(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

/** `YYYY-MM-DD` for today in UTC — the floor of the date picker. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** The twelve months from this one, for the "flexible" picker. */
export function nextMonths(count: number, now: Date = new Date()): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))
    months.push({
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    })
  }
  return months
}

/** The last day of fishing, when the angler gave a start date and more than one day. */
function lastDay(dateFrom: string, days: number): string | undefined {
  if (days <= 1) return undefined
  return new Date(utcOf(dateFrom) + (days - 1) * DAY_MS).toISOString().slice(0, 10)
}

// ─── Validation, step by step ─────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Field name → what is wrong with it, for the step the angler is on. An empty object means
 * the step may be left. Messages are shown next to the field, so they say what to do.
 */
export type WizardErrors = Partial<Record<keyof WizardAnswers, string>>

export function validateStep(
  step: WizardStep,
  a: WizardAnswers,
  rules: WizardPageRules,
  now: Date = new Date(),
): WizardErrors {
  const errors: WizardErrors = {}

  if (step === 1) {
    if (a.datesMode === 'exact') {
      if (a.dateFrom === '') errors.dateFrom = 'Pick the first day of fishing.'
      else if (a.dateFrom < todayIso(now)) errors.dateFrom = 'That day is in the past.'
    } else if (a.flexMonth === '') {
      errors.flexMonth = 'Pick a month.'
    }

    const maxDays = Math.min(rules.maxDays ?? MAX_BRIEF_DAYS, MAX_BRIEF_DAYS)
    if (a.days < rules.minDays) {
      errors.days = `This trip runs for at least ${rules.minDays} day${rules.minDays === 1 ? '' : 's'}.`
    } else if (a.days > maxDays) {
      errors.days = `Ask us directly for more than ${maxDays} days.`
    }
    if (a.anglers < 1) errors.anglers = 'At least one angler.'
  }

  if (step === 2) {
    if (a.skillLevel == null) errors.skillLevel = 'Pick the line that fits you best.'
    if (a.priority == null)   errors.priority   = 'Pick what matters most.'
    if (a.fitness == null)    errors.fitness    = 'Pick how far you want to walk.'
    if (a.wadingOk == null)   errors.wadingOk   = 'Say whether wading is fine.'
    if (rules.asksBudget) {
      if (rules.offerMode === 'fixed' && !a.budgetAck) {
        errors.budgetAck = 'Confirm the price so we only send you offers you want.'
      }
      if (rules.offerMode === 'custom' && a.budgetBand == null) {
        errors.budgetBand = 'Pick the range you are planning for.'
      }
    }
  }

  if (step === 3) {
    if (a.firstName.trim() === '') errors.firstName = 'Your first name.'
    if (a.lastName.trim()  === '') errors.lastName  = 'Your last name.'
    if (!EMAIL_RE.test(a.email.trim())) errors.email = 'An address we can send the offer to.'
    if (a.country === '') errors.country = 'Where you are travelling from.'
  }

  return errors
}

export function isStepValid(step: WizardStep, a: WizardAnswers, rules: WizardPageRules): boolean {
  return Object.keys(validateStep(step, a, rules)).length === 0
}

// ─── The brief ────────────────────────────────────────────────────────────────

/**
 * The answers as the `brief` the API stores. Only keys the page actually asked about are
 * included: `budget_ack` on a `fixed` page, `budget_band` on a `custom` one, and neither
 * when the page has no price to anchor the question to. An unknown key here would be a 400
 * (`briefSchema` is `.strict()`), which is the point — the two files cannot drift apart
 * silently.
 */
export function briefFromAnswers(a: WizardAnswers, rules: WizardPageRules): Brief {
  const dates = a.datesMode === 'exact'
    ? { dates_mode: 'exact' as const, date_from: a.dateFrom, ...(lastDay(a.dateFrom, a.days) != null ? { date_to: lastDay(a.dateFrom, a.days)! } : {}) }
    : { dates_mode: 'flexible' as const, flex_month: a.flexMonth }

  const budget = !rules.asksBudget
    ? {}
    : rules.offerMode === 'fixed'
      ? { budget_ack: a.budgetAck }
      : (a.budgetBand != null ? { budget_band: a.budgetBand } : {})

  return {
    ...dates,
    days:        a.days,
    anglers:     a.anglers,
    non_anglers: a.nonAnglers,
    skill_level: a.skillLevel ?? 1,
    priority:    a.priority ?? 'learning',
    fitness:     a.fitness ?? 'mid',
    wading_ok:   a.wadingOk ?? false,
    ...budget,
  }
}

// ─── Keeping the answers across steps ─────────────────────────────────────────

const STORAGE_PREFIX = 'fa.inquiry-wizard.v1.'

export function storageKey(experiencePageId: string): string {
  return `${STORAGE_PREFIX}${experiencePageId}`
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function strOrNull(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' ? value : value === null ? null : fallback
}

function int(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function intOrNull(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : value === null ? null : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function boolOrNull(value: unknown, fallback: boolean | null): boolean | null {
  return typeof value === 'boolean' ? value : value === null ? null : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function oneOfOrNull<T extends string>(value: unknown, allowed: readonly T[], fallback: T | null): T | null {
  if (value === null) return null
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * `sessionStorage` throws outright in some browsers (a blocked third-party context, Safari's
 * private mode under pressure) — not just "returns null". Every access here is wrapped, and
 * a failure means the form keeps its in-memory state and forgets it on reload. Losing the
 * convenience is acceptable; losing the form is not.
 */
export function loadAnswers(experiencePageId: string, fallback: WizardAnswers): WizardAnswers {
  try {
    const raw = window.sessionStorage.getItem(storageKey(experiencePageId))
    if (raw == null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback

    // Field by field, with the type checked on each one: a stored shape from an older
    // version of the form must not be able to put a string where a number belongs, and a
    // cast ("it is a WizardAnswers because it was one when we wrote it") would let it.
    const v = parsed as Record<string, unknown>
    return {
      datesMode:  oneOf(v.datesMode, DATES_MODE_VALUES, fallback.datesMode),
      dateFrom:   str(v.dateFrom, fallback.dateFrom),
      flexMonth:  str(v.flexMonth, fallback.flexMonth),
      days:       int(v.days, fallback.days),
      anglers:    int(v.anglers, fallback.anglers),
      nonAnglers: int(v.nonAnglers, fallback.nonAnglers),
      skillLevel: intOrNull(v.skillLevel, fallback.skillLevel),
      priority:   oneOfOrNull(v.priority, PRIORITY_VALUES, fallback.priority),
      fitness:    oneOfOrNull(v.fitness, FITNESS_VALUES, fallback.fitness),
      wadingOk:   boolOrNull(v.wadingOk, fallback.wadingOk),
      budgetAck:  bool(v.budgetAck, fallback.budgetAck),
      budgetBand: strOrNull(v.budgetBand, fallback.budgetBand),
      firstName:  str(v.firstName, fallback.firstName),
      lastName:   str(v.lastName, fallback.lastName),
      email:      str(v.email, fallback.email),
      country:    str(v.country, fallback.country),
      phone:      str(v.phone, fallback.phone),
      extra:      str(v.extra, fallback.extra),
    }
  } catch {
    return fallback
  }
}

export function saveAnswers(experiencePageId: string, answers: WizardAnswers): void {
  try {
    window.sessionStorage.setItem(storageKey(experiencePageId), JSON.stringify(answers))
  } catch {
    // Storage full, disabled or throwing — the form carries on from memory.
  }
}

/**
 * Called the moment a submit succeeds. The stored copy holds an e-mail, a name and possibly
 * a phone number; once the inquiry is in, there is no reason for any of it to stay in the
 * browser (task security note, FA-1.55).
 */
export function clearAnswers(experiencePageId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(experiencePageId))
  } catch {
    // Nothing to do: the data is gone from the page either way when the tab closes.
  }
}
