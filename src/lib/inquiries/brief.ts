/**
 * `inquiries.brief` — the answers of the v2 three-step inquiry form (FA-1.55).
 *
 * The column is `jsonb` (FA-1.50), so the database promises nothing about its shape: this
 * file is the shape. The endpoint is public, so the schema is strict in both directions —
 * every enum, range and length is bounded, and an **unknown key is rejected** (`.strict()`)
 * rather than stripped, because the value is stored 1:1 and a brief nobody validated would
 * be read later as if someone had.
 *
 * The keys are the ones fixed in docs/proposals/2026-10-05-experience-offer-centric.md §2
 * ("Co z `inquiries`"), with one addition: `budget_band` carries its currency inside the
 * string (`"EUR:140000-230000"`) so a band stays readable without a second key.
 *
 * It also owns the mapping back onto the columns that existed before `brief`
 * (`requested_dates`, `party_size`, `trip_length`, `message`). That mapping runs on the
 * server, from the validated brief — never from whatever the client sent alongside it — so
 * the old columns and the brief can never disagree.
 *
 * Imported by the public API route, by the data layer and by the browser wizard: plain
 * TypeScript + zod, no server-only imports.
 */

import { z } from 'zod'
import { formatCents } from '@/lib/format-price'

export const DATES_MODES = ['exact', 'flexible'] as const
export const PRIORITIES  = ['trophy', 'numbers', 'learning', 'scenery'] as const
export const FITNESS     = ['low', 'mid', 'high'] as const

export type DatesMode = (typeof DATES_MODES)[number]
export type Priority  = (typeof PRIORITIES)[number]
export type Fitness   = (typeof FITNESS)[number]

/**
 * The longest trip the form can describe. It is also what keeps `requested_dates` inside
 * the 30-entry cap of the API schema, because exact dates are expanded day by day.
 */
export const MAX_BRIEF_DAYS = 30

/** Mirrors the API schema's own ceiling on `party_size`. */
const MAX_PEOPLE = 20

const isoDate  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')

/**
 * `CUR:<from>-<to>` or `CUR:<from>+`, both ends in integer cents (CLAUDE.md rule 6).
 * The labels the angler saw are rebuilt from it by `budgetBandLabel`, so the stored value
 * survives a copy change on the page.
 */
const budgetBand = z
  .string()
  .regex(/^[A-Z]{3}:\d{1,12}(?:-\d{1,12}|\+)$/, 'Budget band must be CUR:from-to or CUR:from+')

const briefObject = z
  .object({
    dates_mode:  z.enum(DATES_MODES),
    /** `exact` only. */
    date_from:   isoDate.optional(),
    /** `exact` only; the last day of fishing, so a one-day trip may omit it. */
    date_to:     isoDate.optional(),
    /** `flexible` only. */
    flex_month:  isoMonth.optional(),
    days:        z.number().int().min(1).max(MAX_BRIEF_DAYS),
    anglers:     z.number().int().min(1).max(MAX_PEOPLE),
    non_anglers: z.number().int().min(0).max(MAX_PEOPLE),
    skill_level: z.number().int().min(1).max(5),
    priority:    z.enum(PRIORITIES),
    fitness:     z.enum(FITNESS),
    wading_ok:   z.boolean(),
    /** `fixed` pages: the angler confirmed the price shown on the page. */
    budget_ack:  z.boolean().optional(),
    /** `custom` pages: which band of the page's indicative range they are planning for. */
    budget_band: budgetBand.optional(),
    /** An archetype of a `custom` page, when the form offered one. */
    selected_option_id: z.string().uuid().optional(),
  })
  .strict()

/**
 * A brief must not be able to describe two different trips at once: `exact` carries dates
 * and no month, `flexible` carries a month and no dates. Anything else is a 400 — the form
 * that produced it is broken, and storing it would leave FA guessing which half is true.
 */
export const briefSchema = briefObject.superRefine((b, ctx) => {
  if (b.dates_mode === 'exact') {
    if (b.date_from == null) {
      ctx.addIssue({ code: 'custom', path: ['date_from'], message: 'Exact dates need a start date' })
    }
    if (b.flex_month != null) {
      ctx.addIssue({ code: 'custom', path: ['flex_month'], message: 'Exact dates cannot also carry a flexible month' })
    }
    if (b.date_from != null && b.date_to != null) {
      if (b.date_to < b.date_from) {
        ctx.addIssue({ code: 'custom', path: ['date_to'], message: 'The last day cannot be before the first' })
      } else if (daysBetween(b.date_from, b.date_to) + 1 > MAX_BRIEF_DAYS) {
        ctx.addIssue({ code: 'custom', path: ['date_to'], message: `A trip cannot span more than ${MAX_BRIEF_DAYS} days` })
      }
    }
  } else {
    if (b.flex_month == null) {
      ctx.addIssue({ code: 'custom', path: ['flex_month'], message: 'Flexible dates need a month' })
    }
    if (b.date_from != null || b.date_to != null) {
      ctx.addIssue({ code: 'custom', path: ['date_from'], message: 'Flexible dates cannot also carry exact dates' })
    }
  }
})

export type Brief = z.infer<typeof briefObject>

// ─── Dates ────────────────────────────────────────────────────────────────────

function utcOf(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

const DAY_MS = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / DAY_MS)
}

function addDays(iso: string, n: number): string {
  return new Date(utcOf(iso) + n * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Every day the angler asked for, so the existing blocked-date check and the FA
 * notification see the same list a v1 form would have produced by clicking those days.
 *
 * `flexible` has no days to list: the month lives in the brief and in the message, and
 * inventing "1 March" here would read as a commitment the angler never made.
 */
export function requestedDatesFromBrief(brief: Brief): string[] {
  if (brief.dates_mode !== 'exact' || brief.date_from == null) return []
  const last = brief.date_to ?? addDays(brief.date_from, Math.min(brief.days, MAX_BRIEF_DAYS) - 1)
  const span = Math.min(daysBetween(brief.date_from, last), MAX_BRIEF_DAYS - 1)
  if (span < 0) return [brief.date_from]
  return Array.from({ length: span + 1 }, (_, i) => addDays(brief.date_from!, i))
}

/** The buckets `inquiries.trip_length` has always used. */
export function tripLengthFromBrief(brief: Brief): '1' | '2-3' | '4-7' | '7+' {
  if (brief.days <= 1) return '1'
  if (brief.days <= 3) return '2-3'
  if (brief.days <= 7) return '4-7'
  return '7+'
}

/**
 * `party_size` is what prices and guide capacity are counted in, so it is the number of
 * **anglers**. Companions are not dropped — they are a line of the message summary and a
 * key of the brief.
 */
export function partySizeFromBrief(brief: Brief): number {
  return brief.anglers
}

// ─── Reading a brief out loud ─────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthLabel(isoMonthValue: string): string {
  const index = Number(isoMonthValue.slice(5, 7)) - 1
  return `${MONTHS[index] ?? isoMonthValue.slice(5, 7)} ${isoMonthValue.slice(0, 4)}`
}

function dateLabel(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`.replace(/\s+/g, ' ').trim()
}

/** What each level means in terms of what the angler can actually do on the water. */
export const SKILL_LEVELS: readonly { level: number; title: string; description: string }[] = [
  { level: 1, title: 'First time',   description: 'I have never fly-fished — teach me from the first cast.' },
  { level: 2, title: 'Beginner',     description: 'I can cast a short line on a good day, but I miss most fish.' },
  { level: 3, title: 'Intermediate', description: 'I cast 15 m, fish a dry fly on a drift and land what I hook.' },
  { level: 4, title: 'Experienced',  description: 'I read water myself, change tactics and cast in wind.' },
  { level: 5, title: 'Expert',       description: 'I guide myself or fish demanding water abroad every season.' },
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  trophy:  'One big fish, even if it is the only one',
  numbers: 'A good number of fish in the day',
  learning: 'Learning — I want to fish better afterwards',
  scenery: 'The place itself, the fishing second',
}

export const FITNESS_LABELS: Record<Fitness, string> = {
  low:  'I would rather stay near the vehicle or the boat',
  mid:  'A few kilometres of walking is fine',
  high: 'Walk me in — rough ground and a long day are the point',
}

/** The band as the angler saw it on the page: "under €1,400", "€1,400–€2,300", "over €3,200". */
export function budgetBandLabel(band: string): string {
  const [currency, range] = band.split(':')
  if (currency == null || range == null) return band
  if (range.endsWith('+')) {
    return `over ${formatCents(Number(range.slice(0, -1)), currency)}`
  }
  const [from, to] = range.split('-')
  if (from == null || to == null) return band
  return Number(from) === 0
    ? `under ${formatCents(Number(to), currency)}`
    : `${formatCents(Number(from), currency)}–${formatCents(Number(to), currency)}`
}

/**
 * The brief as lines a person reads — the FA notification, `inquiries.message` and the
 * block the AI agent is given (FA-1.46) all print the same text, so nobody is working from
 * a different version of the answers.
 */
export function briefSummaryLines(brief: Brief): string[] {
  const when = brief.dates_mode === 'exact'
    ? (brief.date_from == null
        ? `${brief.days} day(s), dates to confirm`
        : brief.date_to != null && brief.date_to !== brief.date_from
          ? `${dateLabel(brief.date_from)} – ${dateLabel(brief.date_to)} (${brief.days} day(s) fishing)`
          : `${dateLabel(brief.date_from)} (${brief.days} day(s) fishing)`)
    : `flexible — ${brief.flex_month == null ? 'month to confirm' : monthLabel(brief.flex_month)} (${brief.days} day(s) fishing)`

  const skill = SKILL_LEVELS.find(s => s.level === brief.skill_level)

  const lines = [
    `When: ${when}`,
    `Party: ${brief.anglers} angler(s)${brief.non_anglers > 0 ? `, ${brief.non_anglers} non-angler(s)` : ''}`,
    `Skill level: ${brief.skill_level}/5${skill != null ? ` — ${skill.title}: ${skill.description}` : ''}`,
    `Priority: ${PRIORITY_LABELS[brief.priority]}`,
    `Fitness: ${FITNESS_LABELS[brief.fitness]}`,
    `Wading: ${brief.wading_ok ? 'yes, happy to wade' : 'prefers not to wade'}`,
  ]

  if (brief.budget_band != null) lines.push(`Budget band: ${budgetBandLabel(brief.budget_band)}`)
  if (brief.budget_ack === true) lines.push('Budget: confirmed the price shown on the page')
  if (brief.budget_ack === false) lines.push('Budget: did not confirm the price shown on the page')

  return lines
}

/** The heading the summary sits under, in the message and in the agent's input block. */
export const BRIEF_BLOCK_HEADING = 'Answers from the inquiry form'

/** The exact line `composeBriefMessage` writes, and the one `anglerTextFromMessage` cuts at. */
export const BRIEF_BLOCK_MARKER = `— ${BRIEF_BLOCK_HEADING} —`

/**
 * What the angler actually typed, out of a stored `message` that also carries the summary.
 *
 * The AI block prints the brief from the brief itself, so without this the agent would read
 * the same answers twice — once as prose, once as a list.
 */
export function anglerTextFromMessage(message: string | null | undefined): string | null {
  if (message == null) return null
  const cut  = message.indexOf(BRIEF_BLOCK_MARKER)
  const typed = (cut === -1 ? message : message.slice(0, cut)).trim()
  return typed === '' ? null : typed
}

/**
 * `inquiries.message` for a v2 inquiry: what the angler typed, then the summary. Composed
 * on the server so the stored text cannot contradict the stored brief.
 */
export function composeBriefMessage(freeText: string | null | undefined, brief: Brief): string {
  const typed = freeText?.trim() ?? ''
  const summary = [BRIEF_BLOCK_MARKER, ...briefSummaryLines(brief)].join('\n')
  return typed === '' ? summary : `${typed}\n\n${summary}`
}

// ─── Budget bands for a `custom` page (tj 2026-10-07, option A) ───────────────

export type BudgetBandOption = { value: string; label: string }

/** Rounded to whole hundreds of the currency unit, so a band never reads like a quote. */
function roundToHundred(cents: number): number {
  return Math.round(cents / 10_000) * 10_000
}

/**
 * Four bands built from the page's own indicative range, in the page's currency: under the
 * first third, the two middle thirds, and over the top of the range. A page whose range is
 * missing or too narrow to cut gets no bands at all — and therefore no budget question —
 * rather than bands that contradict the price above them.
 */
export function budgetBandOptions(
  fromCents: number | null,
  toCents:   number | null,
  currency:  string,
): BudgetBandOption[] {
  if (fromCents == null || toCents == null || toCents <= fromCents) return []

  const span = toCents - fromCents
  const cut1 = roundToHundred(fromCents + span / 3)
  const cut2 = roundToHundred(fromCents + (span * 2) / 3)

  // Rounding can collapse two cuts onto one number on a narrow range; three bands then,
  // or two, is still honest. Duplicates are what would not be.
  const cuts = [...new Set([cut1, cut2, toCents])].filter(c => c > 0).sort((a, b) => a - b)
  if (cuts.length === 0) return []

  const bands: BudgetBandOption[] = []
  let lower = 0
  for (const cut of cuts) {
    if (cut === lower) continue
    const value = `${currency}:${lower}-${cut}`
    bands.push({ value, label: budgetBandLabel(value) })
    lower = cut
  }
  const top = `${currency}:${lower}+`
  bands.push({ value: top, label: budgetBandLabel(top) })

  return bands
}
