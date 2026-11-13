/**
 * The zod schema of `inquiries.brief` (FA-1.55) — split out of `./brief` in FA-1.92 so the browser
 * wizard, which imports only the constants and helpers there, does not ship zod to the offer page.
 * What the brief is and why the schema is strict: see the header of `./brief`.
 *
 * Server-side only by convention: the public API route and the AI extraction import it.
 */

import { z } from 'zod'
import { DATES_MODES, FITNESS, MAX_BRIEF_DAYS, MAX_PEOPLE, PRIORITIES, daysBetween } from './brief'

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
